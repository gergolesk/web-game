import WebSocket, { WebSocketServer } from 'ws';
import { gameConfig, PLAYER_COLORS } from './config.js';

// Create a WebSocket server on port 3000
const wss = new WebSocketServer({ port: 3000 });

// === GAME CONSTANTS AND STATE ===
const FIELD_WIDTH = gameConfig.FIELD_WIDTH;
const FIELD_HEIGHT = gameConfig.FIELD_HEIGHT;
const PACMAN_RADIUS = gameConfig.PACMAN_RADIUS;
const POINT_RADIUS = gameConfig.POINT_RADIUS;
const POINTS_TOTAL = gameConfig.POINTS_TOTAL;

// Four starting positions for up to four players (with starting angles)
const START_POSITIONS = [
  { x: 10,  y: 10, angle: 45 },
  { x: FIELD_WIDTH - (PACMAN_RADIUS*2) - 10, y: 10, angle: 135 },
  { x: 10,  y: FIELD_HEIGHT - (PACMAN_RADIUS*2) - 10, angle: -45 },
  { x: FIELD_WIDTH - (PACMAN_RADIUS*2) - 10, y: FIELD_HEIGHT - (PACMAN_RADIUS*2) - 10, angle: -135 }
];

let points = [];
let players = {};
let cornerOccupants = [null, null, null, null]; // IDs of players occupying corners

let gamePaused = false;
let pausedBy = null;
let pauseAccum = 0;
let pauseStartedAt = null;

// === BROADCAST GAME STATE TO ALL CLIENTS ===
/**
 * Broadcasts the entire game state (players, points, timer, pause info, etc) to all connected clients.
 */
function broadcastGameState() {
  let totalPause = pauseAccum;
  if (gamePaused && pauseStartedAt) {
    totalPause += Date.now() - pauseStartedAt;
  }

  const state = {
    players: Object.values(players),
    points: points,
    gameDuration: gameConfig.duration,
    gameStartedAt: gameConfig.startTime,
    gamePaused: gamePaused,
    pausedBy: pausedBy,
    pauseAccum: totalPause
  };

  // Always provide up-to-date game timing info if started
  if (gameConfig.gameStarted && gameConfig.startTime && gameConfig.duration) {
    state.gameDuration = gameConfig.duration;
    state.gameStartedAt = gameConfig.startTime;
  }

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'state', ...state }));
    }
  });
}

/**
 * Checks if a player's new position will collide with another player.
 */
function willCollide(id, x, y) {
  const RADIUS = PACMAN_RADIUS;
  return Object.values(players).some(p => {
    if (p.id === id) return false;
    const dx = p.x - x;
    const dy = p.y - y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < RADIUS * 2) {
      return true;
    }
    return false;
  });
}

/**
 * Returns a random integer between min and max (inclusive).
 */
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Initialize main game config (timer, state)
gameConfig.duration = null;     // seconds
gameConfig.startTime = null;    // timestamp (Date.now())
gameConfig.gameStarted = false;

/**
 * Generates the array of points (coins), marks 2 of them as negative.
 */
function generatePoints() {
  points = [];
  for (let i = 0; i < POINTS_TOTAL; ++i) {
    points.push({
      id: i + 1,
      x: randomInt(PACMAN_RADIUS*2, FIELD_WIDTH - PACMAN_RADIUS*2),
      y: randomInt(PACMAN_RADIUS*2, FIELD_HEIGHT - PACMAN_RADIUS*2),
      isNegative: false
    });
  }

  // Randomly pick 2 coins and set them as negative
  const shuffled = [...points].sort(() => Math.random() - 0.5);
  shuffled.slice(0, 2).forEach(pt => pt.isNegative = true);
}

// === WEBSOCKET CONNECTION HANDLING ===
wss.on('connection', (ws) => {
  let playerId = null;
  let myCorner = -1;

  ws.on('message', (msg) => {
    const data = JSON.parse(msg);

    // --- Player asks if they can join (any free slot?) ---
    if (data.type === 'can_join') {
      const freeCorner = cornerOccupants.findIndex(id => id === null);
      if (freeCorner === -1) {
        ws.send(JSON.stringify({ type: 'max_players' }));
      } else {
        ws.send(JSON.stringify({
          type: 'can_join_ok',
          duration: gameConfig.duration
        }));
      }
      return;
    }

    // --- Player actually joins the game ---
    if (data.type === 'join') {
      playerId = data.id;
      ws.playerId = playerId;

      // Check again if slot is free
      const freeCorner = cornerOccupants.findIndex(id => id === null);
      if (freeCorner === -1) {
        ws.send(JSON.stringify({ type: 'max_players' }));
        return;
      }

      const isFirstPlayer = cornerOccupants.every(id => id === null);

      // Only first player can set game duration
      if (isFirstPlayer && gameConfig.duration === null && typeof data.duration === 'number') {
        gameConfig.duration = data.duration;
        gameConfig.startTime = null;
        gameConfig.gameStarted = false;
      }

      // Register the player
      myCorner = freeCorner;
      cornerOccupants[myCorner] = playerId;
      players[playerId] = {
        id: playerId,
        name: data.name,
        x: START_POSITIONS[myCorner].x,
        y: START_POSITIONS[myCorner].y,
        angle: START_POSITIONS[myCorner].angle,
        color: PLAYER_COLORS[myCorner],
        corner: myCorner,
        score: 0,
        slowUntil: 0,
        readyToRestart: false
      };

      const connectedPlayersCount = cornerOccupants.filter(id => id !== null).length;

      // If enough players, offer host to start the game
      if (!gameConfig.gameStarted && connectedPlayersCount >= 2) {
        const firstPlayerId = cornerOccupants.find(id => id !== null);
        const firstPlayerSocket = [...wss.clients].find(client => client.playerId === firstPlayerId);

        if (firstPlayerSocket && firstPlayerSocket.readyState === WebSocket.OPEN) {
          firstPlayerSocket.send(JSON.stringify({
            type: 'offer_start_game',
            count: connectedPlayersCount
          }));
        }
      }

      // Send waiting modal (with info about duration)
      ws.send(JSON.stringify({
        type: 'waiting_for_players',
        isFirstPlayer: isFirstPlayer,
        duration: gameConfig.duration
      }));

      broadcastGameState();
      return;
    }

    // --- Player movement event ---
    if (data.type === 'move' && playerId && players[playerId]) {
      if (!gameConfig.gameStarted || gamePaused) return;
      let speed = 4;
      if (players[playerId].slowUntil && players[playerId].slowUntil > Date.now()) {
        speed = speed / 2;
      }
      let dx = typeof data.dx === 'number' ? data.dx : 0;
      let dy = typeof data.dy === 'number' ? data.dy : 0;
      let norm = Math.sqrt(dx * dx + dy * dy);
      let angle = typeof data.angle === 'number' ? data.angle : players[playerId].angle;

      let oldX = players[playerId].x;
      let oldY = players[playerId].y;
      let newX = oldX;
      let newY = oldY;

      if (norm > 0) {
        newX = oldX + speed * dx / norm;
        newY = oldY + speed * dy / norm;

        // Stay within field boundaries
        newX = Math.max(0, Math.min(newX, FIELD_WIDTH - PACMAN_RADIUS*2 ));
        newY = Math.max(0, Math.min(newY, FIELD_HEIGHT - PACMAN_RADIUS*2 ));

        // Collision checking (players)
        if (!willCollide(playerId, newX, newY)) {
          players[playerId].x = newX;
          players[playerId].y = newY;
          players[playerId].angle = angle;
        } else {
          // Only update angle if blocked
          players[playerId].angle = angle;
        }
      } else {
        // Only rotation if not moving
        players[playerId].angle = angle;
      }
      players[playerId].mouthOpen = !!data.mouthOpen;

      broadcastGameState();
    }

    // --- Player collected a point (coin) ---
    if (data.type === 'collect_point' && playerId && players[playerId]) {
      // Find a point by id
      const idx = points.findIndex(pt => pt.id === data.pointId);
      if (idx !== -1) {
        const point = points[idx];

        points.splice(idx, 1);

        if (point.isNegative) {
          players[playerId].slowUntil = Date.now() + 2000;

          // ✨ Generate a new negative coin
          const newNegative =  {
            id: Date.now(),
            x: randomInt(PACMAN_RADIUS * 2 , FIELD_WIDTH - PACMAN_RADIUS * 2),
            y: randomInt(PACMAN_RADIUS * 2 , FIELD_HEIGHT - PACMAN_RADIUS * 2),
            isNegative: true
          };
          points.push(newNegative);
        } else {
          players[playerId].score = (players[playerId].score || 0) + 1;

          // ✨ If there are too few regular coins left, add more
          const remainingNormals = points.filter(p => !p.isNegative).length;
          if(remainingNormals < 10) {
            const countToAdd = 3;
            for(let i = 0; i < countToAdd; i++) {
              points.push({
                id: Date.now() + i,
                x: randomInt(PACMAN_RADIUS * 2, FIELD_WIDTH - PACMAN_RADIUS * 2),
                y: randomInt(PACMAN_RADIUS * 2, FIELD_HEIGHT - PACMAN_RADIUS * 2),
                isNegative: false
              });
            }
          }
        }

        broadcastGameState();
      }
      return;
    }

    // --- Player is ready to start a new game (clicked "Play Again") ---
    if (data.type === 'ready_to_restart' && playerId && players[playerId]) {
      pauseAccum = 0;
      pauseStartedAt = null;
      gamePaused = false;
      pausedBy = null;
      players[playerId].readyToRestart = true;

      const allReady = Object.values(players).every(p => p.readyToRestart);

      if (allReady) {
        // Reset game state for new round
        generatePoints();
        gameConfig.duration = null;
        gameConfig.startTime = null;
        gameConfig.gameStarted = false;

        // Free all corners
        cornerOccupants = [null, null, null, null];

        // Reset player positions and flags
        Object.values(players).forEach((p, index) => {
          const corner = cornerOccupants.findIndex(id => id === p.id);
          if (corner !== -1) {
            p.x = START_POSITIONS[corner].x;
            p.y = START_POSITIONS[corner].y;
            p.angle = START_POSITIONS[corner].angle;
            p.score = 0;
            p.slowUntil = 0;
            p.readyToRestart = false;
          }
        });

        // Notify all clients that new duration can be chosen
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'ready_to_choose_duration' }));
          }
        });

        broadcastGameState();
      }
      return;
    }

    // --- Host starts the game (by button click) ---
    if (data.type === 'start_game_by_host' && playerId && players[playerId]) {
      pauseAccum = 0;
      pauseStartedAt = null;
      gamePaused = false;
      pausedBy = null;
      const connectedPlayersCount = cornerOccupants.filter(id => id !== null).length;
      if (!gameConfig.gameStarted && connectedPlayersCount >= 2) {
        gameConfig.startTime = Date.now();
        gameConfig.gameStarted = true;
        generatePoints();

        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'game_started',
              duration: gameConfig.duration,
              startTime: gameConfig.startTime
            }));
          }
        });

        broadcastGameState();
      }
      return;
    }

    // --- Player requests to pause the game ---
    if (data.type === 'pause_game' && playerId && players[playerId]) {
      // Optional: check if game started and not already paused
      if (!gamePaused && gameConfig.gameStarted) {
        gamePaused = true;
        pausedBy = players[playerId].name || playerId;
        pauseStartedAt = Date.now();

        // Notify all clients about pause
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'game_paused',
              pausedBy: pausedBy
            }));
          }
        });

        broadcastGameState();
      }
      return;
    }

    // --- Player requests to resume (unpause) the game ---
    if (data.type === 'unpause_game' && playerId && players[playerId]) {
      // Only the player who paused the game can unpause it
      if (gamePaused && pausedBy === (players[playerId].name || playerId)) {
        gamePaused = false;
        if (pauseStartedAt) {
          pauseAccum += Date.now() - pauseStartedAt;
          pauseStartedAt = null;
        }
        pausedBy = null;

        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'game_unpaused'
            }));
          }
        });

        broadcastGameState();
      }
      return;
    }

  });

  /**
   * Handle client disconnection, free up their corner, remove them from players, reset game if empty.
   */
  ws.on('close', () => {
    if (playerId && players[playerId]) {
      // Free up the corner
      if (typeof players[playerId].corner === 'number') {
        cornerOccupants[players[playerId].corner] = null;
      }
      delete players[playerId];
      broadcastGameState();
    }
    // If all players left, reset game state
    if (Object.keys(players).length === 0) {
      generatePoints();
      gameConfig.duration = null;
      gameConfig.startTime = null;
      gameConfig.gameStarted = false;
    }
  });
});

// Generate points at server startup
generatePoints();
console.log('WebSocket server launched on ws://localhost:3000');

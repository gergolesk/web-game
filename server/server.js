import WebSocket, { WebSocketServer } from 'ws';
import { gameConfig, PLAYER_COLORS } from './config.js';

// Create WebSocket server
const wss = new WebSocketServer({ port: 3000 });

// Game field and player setup constants
const FIELD_WIDTH = gameConfig.FIELD_WIDTH;
const FIELD_HEIGHT = gameConfig.FIELD_HEIGHT;
const PACMAN_RADIUS = gameConfig.PACMAN_RADIUS;
const POINT_RADIUS = gameConfig.POINT_RADIUS;
const POINTS_TOTAL = gameConfig.POINTS_TOTAL;

// Four spawn corners for up to 4 players
const START_POSITIONS = [
  { x: 10,  y: 10, angle: 45 },
  { x: FIELD_WIDTH - (PACMAN_RADIUS*2) - 10, y: 10, angle: 135 },
  { x: 10,  y: FIELD_HEIGHT - (PACMAN_RADIUS*2) - 10, angle: -45 },
  { x: FIELD_WIDTH - (PACMAN_RADIUS*2) - 10, y: FIELD_HEIGHT - (PACMAN_RADIUS*2) - 10, angle: -135 }
];

// Game state variables
let points = [];
let players = {};
let cornerOccupants = [null, null, null, null];
let hostId = null;

// Pause state variables
let gamePaused = false;
let pausedBy = null;
let pauseAccum = 0;
let pauseStartedAt = null;

//Global timer for game end
let gameEndTimeout = null;
let gameTimeLeftMs = null; // time left until the end of the game (during pause)
let gameEndAt = null;      // timestamp when the game ends (use for calculations)

// --- GAME INITIALIZATION ---
gameConfig.duration = null;     // Game duration in seconds
gameConfig.startTime = null;    // Game start timestamp (Date.now())
gameConfig.gameStarted = false;

// --- HELPERS ---

/**
 * Returns a random integer between min and max (inclusive).
 */
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Broadcasts the current game state to all connected clients.
 */
function broadcastGameState() {
  let totalPause = pauseAccum;
  if (gamePaused && pauseStartedAt) totalPause += Date.now() - pauseStartedAt;

  const state = {
    players: Object.values(players),
    points: points,
    gameDuration: gameConfig.duration,
    gameStartedAt: gameConfig.startTime,
    gamePaused: gamePaused,
    pausedBy: pausedBy,
    pauseAccum: totalPause
  };

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN)
      client.send(JSON.stringify({ type: 'state', ...state }));
  });
}

/**
 * Checks if a player would collide with any other player at the new position.
 */
function willCollide(id, x, y) {
  const RADIUS = PACMAN_RADIUS;
  return Object.values(players).some(p => {
    if (p.id === id) return false;
    const dx = p.x - x;
    const dy = p.y - y;
    return Math.sqrt(dx*dx + dy*dy) < RADIUS * 2;
  });
}

/**
 * Generates an array of coins/points of different types.
 */
function generatePoints() {
  points = [];
  for (let i = 0; i < POINTS_TOTAL; ++i) {
    points.push({
      id: i + 1,
      x: randomInt(PACMAN_RADIUS * 2, FIELD_WIDTH - PACMAN_RADIUS * 2),
      y: randomInt(PACMAN_RADIUS * 2, FIELD_HEIGHT - PACMAN_RADIUS * 2),
      type: "normal"
    });
  }
  // Randomly assign types: negative, bonus, trap
  const shuffled = [...points].sort(() => Math.random() - 0.5);
  if (shuffled[0]) shuffled[0].type = "negative";
  if (shuffled[1]) shuffled[1].type = "bonus";
  if (shuffled[2]) shuffled[2].type = "trap";
}

/**
 * Broadcasts the "player_quit" event to all clients.
 */
function broadcastPlayerQuit(name) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'player_quit', name }));
    }
  });
}

// --- WEBSOCKET HANDLERS ---
wss.on('connection', (ws) => {
  let playerId = null;
  let myCorner = -1;

  ws.on('message', (msg) => {
    const data = JSON.parse(msg);

    if(data.type === "player_quit" && playerId && players[playerId]) {
      const leaverName = players[playerId].name || 'Unknown player';

      if(typeof players[playerId].corner === 'number') {
        cornerOccupants[players[playerId].corner] = null;
      }

      delete players[playerId];
      broadcastPlayerQuit(leaverName);
      broadcastGameState();
      recalculateAndBroadcastHost();
      return;
    }

    // --- Player asks: can I join? ---
    if (data.type === 'can_join') {

      if (!ws.playerId && gameConfig.gameStarted) {
        ws.send(JSON.stringify({
          type: 'observer_mode',
          duration: gameConfig.duration,
          startTime: gameConfig.startTime,
          pauseAccum: pauseAccum,
          players: Object.values(players),
          points: points
        }));
        return;
      }

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

    // --- Player joins ---
    if (data.type === 'join') {

      const nameTaken = Object.values(players).some(p => p.name === data.name);
      if (nameTaken) {
        ws.send(JSON.stringify({ type: 'name_taken' }));
        return;
      }

      playerId = data.id;
      ws.playerId = playerId;

      const freeCorner = cornerOccupants.findIndex(id => id === null);
      if (freeCorner === -1) {
        ws.send(JSON.stringify({ type: 'max_players' }));
        return;
      }

      const isFirstPlayer = cornerOccupants.every(id => id === null);
      // Only first player can set duration
      if (isFirstPlayer && gameConfig.duration === null && typeof data.duration === 'number') {
        gameConfig.duration = data.duration;
        gameConfig.startTime = null;
        gameConfig.gameStarted = false;
      }

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
        readyToRestart: false,
        lastMoveAt: Date.now()
      };

      if (isFirstPlayer) {
        hostId = playerId;
      }


      const connectedPlayersCount = cornerOccupants.filter(id => id !== null).length;
      // If there are at least 2 players, prompt host to start game
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

      // Notify player about waiting room and duration input
      ws.send(JSON.stringify({
        type: 'waiting_for_players',
        isFirstPlayer: isFirstPlayer,
        duration: gameConfig.duration
      }));

      broadcastGameState();
      return;
    }

    // --- Movement ---
    if (data.type === 'move' && playerId && players[playerId]) {
        if (!gameConfig.gameStarted || gamePaused) return;

        const now = Date.now();
        // How many seconds have passed since the player's last step.
        const lastMoveAt = players[playerId].lastMoveAt || now;
        let dt = (now - lastMoveAt) / 1000; // в секундах

        // Let's limit dt in case the client "disappears" for a long time (for example, collapsed the tab)
        if (dt > 0.2) dt = 0.2; // maximum 200ms per step

        players[playerId].lastMoveAt = now;

        // Basic speed (4 pixels per 50ms in old logic == 80 pixels/sec)
        let speedPerSecond = 200;
        if (players[playerId].slowUntil && players[playerId].slowUntil > now) {
            speedPerSecond = 100; // замедление в 2 раза
        }

        // How many pixels can actually be passed in dt
        const distance = speedPerSecond * dt;

        // Normalize the direction
        let dx = typeof data.dx === 'number' ? data.dx : 0;
        let dy = typeof data.dy === 'number' ? data.dy : 0;
        let norm = Math.sqrt(dx * dx + dy * dy);
        let angle = typeof data.angle === 'number' ? data.angle : players[playerId].angle;
        let oldX = players[playerId].x;
        let oldY = players[playerId].y;
        let newX = oldX, newY = oldY;

        if (norm > 0.01) {
            // We normalize the vector, find the step of movement
            newX = oldX + distance * dx / norm;
            newY = oldY + distance * dy / norm;
            newX = Math.max(0, Math.min(newX, FIELD_WIDTH - PACMAN_RADIUS*2 ));
            newY = Math.max(0, Math.min(newY, FIELD_HEIGHT - PACMAN_RADIUS*2 ));
            if (!willCollide(playerId, newX, newY)) {
                players[playerId].x = newX;
                players[playerId].y = newY;
                players[playerId].angle = angle;
            } else {
                players[playerId].angle = angle;
            }
        } else {
            players[playerId].angle = angle;
        }
        players[playerId].mouthOpen = !!data.mouthOpen;
        broadcastGameState();
    }


    // --- Player collected a coin/point ---
    if (data.type === 'collect_point' && playerId && players[playerId]) {
      const idx = points.findIndex(pt => pt.id === data.pointId);
      if (idx !== -1) {
        const point = points[idx];
        points.splice(idx, 1);

        // --- Apply effects depending on point type ---
        if (point.type === "negative") {
          players[playerId].slowUntil = Date.now() + 2000;
          // Instantly add new negative coin
          points.push({
            id: Date.now(),
            x: randomInt(PACMAN_RADIUS * 2, FIELD_WIDTH - PACMAN_RADIUS * 2),
            y: randomInt(PACMAN_RADIUS * 2, FIELD_HEIGHT - PACMAN_RADIUS * 2),
            type: "negative"
          });
        } else if (point.type === "bonus") {
          players[playerId].score = (players[playerId].score || 0) + 5;
        } else if (point.type === "trap") {
          players[playerId].score = Math.max(0, (players[playerId].score || 0) - 3);
        } else { // "normal"
          players[playerId].score = (players[playerId].score || 0) + 1;
          // Add more normal coins if needed
          const remainingNormals = points.filter(p => p.type === "normal").length;
          if (remainingNormals < 10) {
            for (let i = 0; i < 3; i++) {
              points.push({
                id: Date.now() + i,
                x: randomInt(PACMAN_RADIUS * 2, FIELD_WIDTH - PACMAN_RADIUS * 2),
                y: randomInt(PACMAN_RADIUS * 2, FIELD_HEIGHT - PACMAN_RADIUS * 2),
                type: "normal"
              });
            }
          }
        }

        // Notify client about collected point type (for sound/effects)
        ws.send(JSON.stringify({
          type: 'point_collected',
          pointId: point.id,
          pointType: point.type
        }));

        broadcastGameState();
      }
      return;
    }

    // --- Player ready for new game ---
    if (data.type === 'ready_to_restart' && playerId && players[playerId]) {
      pauseAccum = 0; pauseStartedAt = null; gamePaused = false; pausedBy = null;
      players[playerId].readyToRestart = true;
      const allReady = Object.values(players).every(p => p.readyToRestart);

      if (allReady) {
        generatePoints();
        gameConfig.duration = null;
        gameConfig.startTime = null;
        gameConfig.gameStarted = false;
        cornerOccupants = [null, null, null, null];
        Object.values(players).forEach(p => {
          p.score = 0; p.slowUntil = 0; p.readyToRestart = false;
        });
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN)
            client.send(JSON.stringify({ type: 'ready_to_choose_duration' }));
        });
        broadcastGameState();
        recalculateAndBroadcastHost();
      }
      if (gameEndTimeout) clearTimeout(gameEndTimeout);
      return;
    }

    // --- Host starts the game ---
    if (data.type === 'start_game_by_host' && playerId && players[playerId]) {
      pauseAccum = 0; pauseStartedAt = null; gamePaused = false; pausedBy = null;
      const connectedPlayersCount = cornerOccupants.filter(id => id !== null).length;
      if (!gameConfig.gameStarted && connectedPlayersCount >= 2) {
        gameConfig.startTime = Date.now() + 4000;
        gameConfig.gameStarted = true;
        generatePoints();

        if (gameEndTimeout) clearTimeout(gameEndTimeout);
        if (typeof gameConfig.duration === "number") {
          gameTimeLeftMs = gameConfig.duration * 1000 + 4000; // 4000ms for "3-2-1-GO" countdown
          gameEndAt = Date.now() + gameTimeLeftMs;
          gameEndTimeout = setTimeout(gameOverFunc, gameTimeLeftMs);
        }

        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN)
            client.send(JSON.stringify({
              type: 'game_started',
              duration: gameConfig.duration,
              startTime: gameConfig.startTime
            }));
        });
        broadcastGameState();
      }
      return;
    }

    // --- PAUSE ---
    if (data.type === 'pause_game' && playerId && players[playerId]) {
      // Only allow pause if game started and not already paused
      if (!gamePaused && gameConfig.gameStarted) {
        gamePaused = true;
        pausedBy = players[playerId].name || playerId;
        pauseStartedAt = Date.now();
        // We save how much time is left until the end of the game, reset the timer
        if (gameEndAt) {
          gameTimeLeftMs = gameEndAt - Date.now();
          if (gameTimeLeftMs < 0) gameTimeLeftMs = 0;
          clearTimeout(gameEndTimeout);
          gameEndTimeout = null;
        }
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN)
            client.send(JSON.stringify({ type: 'game_paused', pausedBy }));
        });
        broadcastGameState();
      }
      return;
    }

    // --- RESUME/UNPAUSE ---
    if (data.type === 'unpause_game' && playerId && players[playerId]) {
      // Only player who paused can unpause
      if (gamePaused && pausedBy === (players[playerId].name || playerId)) {
        gamePaused = false;
        if (pauseStartedAt) pauseAccum += Date.now() - pauseStartedAt;
        pauseStartedAt = null; pausedBy = null;
        // Set a new timer for the remaining time.
        if (gameTimeLeftMs !== null && gameTimeLeftMs > 0) {
          gameEndAt = Date.now() + gameTimeLeftMs;
          gameEndTimeout = setTimeout(gameOverFunc, gameTimeLeftMs);
        }
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN)
            client.send(JSON.stringify({ type: 'game_unpaused' }));
        });
        broadcastGameState();
      }
      return;
    }

    // --- STOP GAME BY HOST ---
    if (data.type === 'stop_game_by_host' && playerId && players[playerId]) {
        //const isHost = players[playerId].corner === 0;
        const isHost = (playerId === hostId);
        if (isHost && gameConfig.gameStarted) {
            gameOverFunc();
        }
        return;
    }
  });

  /**
   * Handle player disconnect: free up their slot, reset game if everyone leaves.
   */
  ws.on('close', () => {
    if (playerId && players[playerId]) {
      const leaverName = players[playerId].name || 'Unknown player';
      if (typeof players[playerId].corner === 'number')
        cornerOccupants[players[playerId].corner] = null;
      delete players[playerId];

      broadcastPlayerQuit(leaverName);
      broadcastGameState();
      recalculateAndBroadcastHost();
    }
    /*
    // Reset game state if all players left
    if (Object.keys(players).length === 0) {
      generatePoints();
      gameConfig.duration = null;
      gameConfig.startTime = null;
      gameConfig.gameStarted = false;
      pauseAccum = 0;
      pauseStartedAt = null;
      gamePaused = false;
      pausedBy = null;
    }
      */
    // If all players left, notify all clients (including observers) about game over
    if (Object.keys(players).length === 0 && gameConfig.gameStarted) {
      // gameConfig.gameStarted - чтобы не было лишнего game_over между играми
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          // Шлём пустой список игроков (никого не осталось)
          client.send(JSON.stringify({ type: 'game_over', players: [] }));
        }
      });
      fullResetGameState();
    }
  });
});
/**
 * Fully resets all global game state to the initial state.
 * Called when a game ends, or all players leave the game.
 */
function fullResetGameState() {
    players = {};
    cornerOccupants = [null, null, null, null];
    gameConfig.duration = null;
    gameConfig.startTime = null;
    gameConfig.gameStarted = false;
    pauseAccum = 0;
    pauseStartedAt = null;
    gamePaused = false;
    pausedBy = null;
    gameTimeLeftMs = null;
    gameEndAt = null;
    hostId = null;

    if (gameEndTimeout) clearTimeout(gameEndTimeout);
    generatePoints();
}

/**
 * Called when the game is over (time is up or host stops the game).
 * Sends final scores to all players and resets the game state.
 */
function gameOverFunc() {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN)
      client.send(JSON.stringify({ type: 'game_over', players: Object.values(players) }));
  });
  fullResetGameState();
  broadcastGameState();
}

/**
 * Calculates the player who should be the new host (player with the smallest occupied corner).
 * Notifies all clients of the new host if there are still players in the game.
 */
function recalculateAndBroadcastHost() {
    // Find the player with the minimal occupied corner
    let minCorner = 4;
    let newHostId = null;
    for (let i = 0; i < cornerOccupants.length; i++) {
        if (cornerOccupants[i] !== null && i < minCorner) {
            minCorner = i;
            newHostId = cornerOccupants[i];
        }
    }
    hostId = newHostId;
    // If there are players left, broadcast the new host ID to all clients
    if (newHostId) {
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'host_changed', hostId: newHostId }));
            }
        });
    }
}

// Initial game setup at server start
generatePoints();
console.log('WebSocket server launched on ws://localhost:3000');

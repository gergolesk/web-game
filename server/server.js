import WebSocket, { WebSocketServer } from 'ws';
import { gameConfig, PLAYER_COLORS } from './config.js';

const wss = new WebSocketServer({ port: 3000 });

const FIELD_WIDTH = gameConfig.FIELD_WIDTH;
const FIELD_HEIGHT = gameConfig.FIELD_HEIGHT;
const PACMAN_RADIUS = gameConfig.PACMAN_RADIUS;
const POINT_RADIUS = gameConfig.POINT_RADIUS;
const POINTS_TOTAL = gameConfig.POINTS_TOTAL;
const START_POSITIONS = [
  { x: 10,  y: 10, angle: 45 },
  { x: FIELD_WIDTH - (PACMAN_RADIUS*2) - 10, y: 10, angle: 135 },
  { x: 10,  y: FIELD_HEIGHT - (PACMAN_RADIUS*2) - 10, angle: -45 },
  { x: FIELD_WIDTH - (PACMAN_RADIUS*2) - 10, y: FIELD_HEIGHT - (PACMAN_RADIUS*2) - 10, angle: -135 }
];

let points = [];
let players = {};
let cornerOccupants = [null, null, null, null];

function broadcastGameState() {
  const state = {
    players: Object.values(players),
    points: points,
    gameDuration: gameConfig.duration,
    gameStartedAt: gameConfig.startTime
  };

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

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

gameConfig.duration = null;     // секунд
gameConfig.startTime = null;    // timestamp (Date.now())
gameConfig.gameStarted = false;

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

  // We choose 2 random coins that will be "negative"
  const shuffled = [...points].sort(() => Math.random() - 0.5);
  shuffled.slice(0, 2).forEach(pt => pt.isNegative = true);
}

wss.on('connection', (ws) => {
  let playerId = null;
  let myCorner = -1;

  ws.on('message', (msg) => {
    const data = JSON.parse(msg);

    // Is it possible to connect (is there a free slot)
    if (data.type === 'can_join') {
      const freeCorner = cornerOccupants.findIndex(id => id === null);
      if (freeCorner === -1) {
        ws.send(JSON.stringify({ type: 'max_players' }));
      } else {
        ws.send(JSON.stringify({ type: 'can_join_ok' }));
      }
      return;
    }

    if (data.type === 'join') {
      playerId = data.id;
      myCorner = cornerOccupants.findIndex(id => id === null);

      if (myCorner === -1) {
        ws.send(JSON.stringify({ type: 'max_players' }));
        return;
      }

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

      // Если игра еще не начата и это первый игрок
      if (!gameConfig.gameStarted && connectedPlayersCount === 1) {
        // Первый игрок устанавливает время
        if (typeof data.duration === 'number') {
          gameConfig.duration = data.duration;
          gameConfig.startTime = null; // пока не установлено
          gameConfig.gameStarted = false; // пока не начато
        }
        ws.send(JSON.stringify({
          type: 'waiting_for_players',
          isFirstPlayer: true,
          duration: gameConfig.duration
        }));
      }
      // Если игра еще не начата, но это не первый игрок
      else if (!gameConfig.gameStarted && connectedPlayersCount > 1) {
        // Отправляем текущие настройки
        ws.send(JSON.stringify({
          type: 'waiting_for_players',
          isFirstPlayer: false,
          duration: gameConfig.duration
        }));
      }

      // Если уже достаточно игроков для старта (например, 2)
      if (!gameConfig.gameStarted && connectedPlayersCount >= 2) {
        gameConfig.startTime = Date.now();
        gameConfig.gameStarted = true;
        generatePoints();

        // Уведомляем всех игроков о начале игры
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'game_started',
              duration: gameConfig.duration,
              startTime: gameConfig.startTime
            }));
          }
        });
      }

      broadcastGameState();
      return;
    }

    if (data.type === 'move' && playerId && players[playerId]) {
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

        // Field limits
        newX = Math.max(0, Math.min(newX, FIELD_WIDTH - PACMAN_RADIUS*2 ));
        newY = Math.max(0, Math.min(newY, FIELD_HEIGHT - PACMAN_RADIUS*2 ));

        // Collision checking
        if (!willCollide(playerId, newX, newY)) {
          players[playerId].x = newX;
          players[playerId].y = newY;
          players[playerId].angle = angle;
        } else {
          // Only angle is changed
          players[playerId].angle = angle;
        }
      } else {
        // Rotate only
        players[playerId].angle = angle;
      }
      players[playerId].mouthOpen = !!data.mouthOpen;

      broadcastGameState();
    }

    // The client reported the collection point
    if (data.type === 'collect_point' && playerId && players[playerId]) {
      // Find a point by id
      const idx = points.findIndex(pt => pt.id === data.pointId);
      if (idx !== -1) {
        const point = points[idx];

        points.splice(idx, 1); // remove point

        if (point.isNegative) {
          players[playerId].slowUntil = Date.now() + 2000; // замедление на 2 сек
        }
        players[playerId].score = (players[playerId].score || 0) + 1;
        broadcastGameState();
      }
      return;
    }

    // Игрок готов к новой игре (нажал "Play Again")
    if (data.type === 'ready_to_restart' && playerId && players[playerId]) {
      players[playerId].readyToRestart = true;

      const allReady = Object.values(players).every(p => p.readyToRestart);

      if (allReady) {
        // Сброс игрового состояния
        generatePoints();
        gameConfig.duration = null;
        gameConfig.startTime = null;
        gameConfig.gameStarted = false;

        // ✅ Сброс занятого угла
        cornerOccupants = [null, null, null, null];

        // Сброс позиций игроков
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

        // Уведомляем всех о возможности выбора нового времени
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'ready_to_choose_duration' }));
          }
        });

        broadcastGameState();
      }

      return;
    }
  });

  ws.on('close', () => {
    if (playerId && players[playerId]) {
      // Freeing up the corner
      if (typeof players[playerId].corner === 'number') {
        cornerOccupants[players[playerId].corner] = null;
      }
      delete players[playerId];
      broadcastGameState();
    }
    if (Object.keys(players).length === 0) {
      generatePoints(); // reset points

      gameConfig.duration = null;
      gameConfig.startTime = null;
      gameConfig.gameStarted = false;
    }
  });
});

generatePoints();
console.log('WebSocket server launched on ws://localhost:3000');

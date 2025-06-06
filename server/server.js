import WebSocket, { WebSocketServer } from 'ws';
import { gameConfig } from './config.js';

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
    points: points
  };
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

function generatePoints() {
  points = [];
  for (let i = 0; i < POINTS_TOTAL; ++i) {
    points.push({
      id: i + 1,
      x: randomInt(PACMAN_RADIUS*2, FIELD_WIDTH - PACMAN_RADIUS*2),
      y: randomInt(PACMAN_RADIUS*2, FIELD_HEIGHT - PACMAN_RADIUS*2)
    });
  }
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
        color: data.color,
        corner: myCorner,
        score: 0
      };
      ws.send(JSON.stringify({ type: 'game_config', config: gameConfig }));
      broadcastGameState();
      return;
    }

    if (data.type === 'move' && playerId && players[playerId]) {
      const speed = 4;
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
      broadcastGameState();
    }

    // The client reported the collection point
    if (data.type === 'collect_point' && playerId && players[playerId]) {
      // Find a point by id
      const idx = points.findIndex(pt => pt.id === data.pointId);
      if (idx !== -1) {
        points.splice(idx, 1); // remove point
        players[playerId].score = (players[playerId].score || 0) + 1;
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
    }
  });
});

generatePoints();
console.log('WebSocket server launched on ws://localhost:3000');

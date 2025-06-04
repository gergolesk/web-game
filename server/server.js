const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 3000 });

const FIELD_WIDTH = 800;
const FIELD_HEIGHT = 600;
const PACMAN_SIZE = 40;
const PACMAN_RADIUS = PACMAN_SIZE / 2;
const START_POSITIONS = [
  { x: 10,  y: 10, angle: 45 },
  { x: FIELD_WIDTH - 50, y: 10, angle: 135 },
  { x: 10,  y: FIELD_HEIGHT - 50, angle: -45 },
  { x: FIELD_WIDTH - 50, y: FIELD_HEIGHT - 50, angle: -135 }
];

let players = {};

function isCornerFree(cornerIndex) {
  const {x, y} = START_POSITIONS[cornerIndex];
  const radius = 40;
  return !Object.values(players).some(p => {
    return Math.abs(p.x - x) < radius && Math.abs(p.y - y) < radius;
  });
}

function broadcastGameState() {
  const state = Object.values(players);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'state', players: state }));
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
      console.log(`Collision: ${id} vs ${p.id}, dist=${dist}`);
      return true;
    }
    return false;
  });
}

wss.on('connection', (ws) => {
  console.log('New client is connected');
  let playerId = null;
  let myCorner = -1;

  ws.on('message', (msg) => {
    const data = JSON.parse(msg);
    //console.log('Received:', data); 
    if (data.type === 'can_join') {
      const freeCorner = START_POSITIONS.findIndex((_, i) => isCornerFree(i));
      if (freeCorner === -1) {
        ws.send(JSON.stringify({ type: 'max_players' }));
      } else {
        ws.send(JSON.stringify({ type: 'can_join_ok' }));
      }
      return;
    }

    if (data.type === 'join') {
      playerId = data.id;
      myCorner = START_POSITIONS.findIndex((_, i) => isCornerFree(i));

      if (myCorner === -1) {
        ws.send(JSON.stringify({ type: 'max_players' }));
        return;
      }

      players[playerId] = {
        id: playerId,
        name: data.name,
        x: START_POSITIONS[myCorner].x,
        y: START_POSITIONS[myCorner].y,
        angle: START_POSITIONS[myCorner].angle,
        color: data.color,
        corner: myCorner
      };
      broadcastGameState();
      return;
    }

    // Server moves itself (dx/dy)
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
        newX = Math.max(0, Math.min(newX, FIELD_WIDTH - PACMAN_SIZE));
        newY = Math.max(0, Math.min(newY, FIELD_HEIGHT - PACMAN_SIZE));

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
  });

  ws.on('close', () => {
    if (playerId && players[playerId]) {
      delete players[playerId];
      broadcastGameState();
    }
  });
});

console.log('WebSocket server launched on ws://localhost:3000');

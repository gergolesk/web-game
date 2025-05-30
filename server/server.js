const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 3000 });

const FIELD_WIDTH = 800;
const FIELD_HEIGHT = 600;
const START_POSITIONS = [
  { x: 10,  y: 10 }, // левый верх
  { x: FIELD_WIDTH - 50, y: 10 }, // правый верх
  { x: 10,  y: FIELD_HEIGHT - 50 }, // левый низ
  { x: FIELD_WIDTH - 50, y: FIELD_HEIGHT - 50 } // правый низ
];

// Храним для каждого угла ID игрока (null = свободен)
let cornerOccupants = [null, null, null, null];

let players = {};

function broadcastGameState() {
  const state = Object.values(players);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'state', players: state }));
    }
  });
}

wss.on('connection', (ws) => {
  let playerId = null;
  let myCorner = -1;

  ws.on('message', (msg) => {
    const data = JSON.parse(msg);
    if (data.type === 'join') {
      playerId = data.id;

      // Найти первый свободный угол
      myCorner = cornerOccupants.findIndex(id => id === null);
      if (myCorner === -1) myCorner = 0; // fallback (запасной случай, не должно происходить)

      // Занять угол
      cornerOccupants[myCorner] = playerId;

      players[playerId] = {
        id: playerId,
        name: data.name,
        x: START_POSITIONS[myCorner].x,
        y: START_POSITIONS[myCorner].y,
        angle: 0,
        color: data.color,
        corner: myCorner
      };
      console.log(`Игрок ${data.name} (${playerId}) занимает угол ${myCorner}: (${START_POSITIONS[myCorner].x}, ${START_POSITIONS[myCorner].y})`);
      broadcastGameState();
    }
    if (data.type === 'move' && playerId && players[playerId]) {
      players[playerId].x = data.x;
      players[playerId].y = data.y;
      players[playerId].angle = data.angle;
      broadcastGameState();
    }
  });

  ws.on('close', () => {
    if (playerId && players[playerId]) {
      if (typeof players[playerId].corner === 'number') {
        cornerOccupants[players[playerId].corner] = null; // освободить угол
      }
      delete players[playerId];
      broadcastGameState();
    }
  });
});

console.log('WebSocket сервер запущен на ws://localhost:3000');

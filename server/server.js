const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 3000 });

const FIELD_WIDTH = 800;
const FIELD_HEIGHT = 600;
const START_POSITIONS = [
  { x: 10,  y: 10, angle: 45 },
  { x: FIELD_WIDTH - 50, y: 10, angle: 135 },
  { x: 10,  y: FIELD_HEIGHT - 50, angle: -45 },
  { x: FIELD_WIDTH - 50, y: FIELD_HEIGHT - 50, angle: -135 }
];

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

    // Проверка на свободные места
    if (data.type === 'can_join') {
      const freeCorner = cornerOccupants.findIndex(id => id === null);
      if (freeCorner === -1) {
        ws.send(JSON.stringify({ type: 'max_players' }));
      } else {
        ws.send(JSON.stringify({ type: 'can_join_ok' }));
      }
      return;
    }

    // Подключение игрока
    if (data.type === 'join') {
      playerId = data.id;
      myCorner = cornerOccupants.findIndex(id => id === null);

      if (myCorner === -1) {
        ws.send(JSON.stringify({ type: 'max_players' }));
        return;
      }

      // Присваиваем уникальный цвет, который сохраняется на сервере
      cornerOccupants[myCorner] = playerId;
      players[playerId] = {
        id: playerId,
        name: data.name,
        x: START_POSITIONS[myCorner].x,
        y: START_POSITIONS[myCorner].y,
        angle: START_POSITIONS[myCorner].angle,
        color: data.color,
        corner: myCorner
      };
      console.log(`Игрок ${data.name} (${playerId}) занимает угол ${myCorner}: (${START_POSITIONS[myCorner].x}, ${START_POSITIONS[myCorner].y})`);
      broadcastGameState();
      return;
    }

    // Движение игрока
    if (data.type === 'move' && playerId && players[playerId]) {
      players[playerId].x = data.x;
      players[playerId].y = data.y;
      players[playerId].angle = data.angle;
      broadcastGameState();
      return;
    }
  });

  ws.on('close', () => {
    if (playerId && players[playerId]) {
      if (typeof players[playerId].corner === 'number') {
        cornerOccupants[players[playerId].corner] = null;
      }
      delete players[playerId];
      broadcastGameState();
    }
  });
});

console.log('WebSocket сервер запущен на ws://localhost:3000');

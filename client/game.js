const playerName = prompt('Введите ваше имя:');
const playerId = Math.random().toString(36).substr(2, 9);
const playerColor = '#'+Math.floor(Math.random()*16777215).toString(16);

const ws = new WebSocket('ws://localhost:3000');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'join',
    id: playerId,
    name: playerName,
    color: playerColor
  }));
};

let otherPlayers = {};
const otherPlayersDiv = document.getElementById('other-players');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'state') {
    // Найдём себя в списке игроков и обновим координаты и угол:
    const me = data.players.find(p => p.id === playerId);
    if (me) {
      pos.x = me.x;
      pos.y = me.y;
      lastAngle = me.angle || 0;
      // (можно также обновлять цвет и имя, если надо)
    }

    // Отрисуем других игроков
    otherPlayersDiv.innerHTML = '';
    data.players.forEach(p => {
      if (p.id === playerId) return;
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      el.setAttribute('width', 40);
      el.setAttribute('height', 40);
      el.style.position = 'absolute';
      el.style.left = p.x + 'px';
      el.style.top = p.y + 'px';
      el.style.transform = `rotate(${p.angle}deg)`;
      el.style.zIndex = 1;
      el.innerHTML = `
        <defs>
          <mask id="m-${p.id}">
            <circle cx="20" cy="20" r="20" fill="white"/>
            <polygon points="20,20 40,10 40,30" fill="black"/>
          </mask>
        </defs>
        <circle
          cx="20" cy="20" r="20"
          fill="${p.color || 'yellow'}"
          mask="url(#m-${p.id})"
        />
      `;
      otherPlayersDiv.appendChild(el);
    });
  }
};

// Движение и управление
const player = document.getElementById('player');
const gameArea = document.getElementById('game-area');

let pos = { x: 100, y: 100 };
const speed = 4;
const keys = {};
let lastAngle = 0;

function getDirectionAngle() {
  const up = keys['arrowup'] || keys['w'];
  const down = keys['arrowdown'] || keys['s'];
  const left = keys['arrowleft'] || keys['a'];
  const right = keys['arrowright'] || keys['d'];

  if (up && right) return -45;
  if (up && left)  return -135;
  if (down && right) return 45;
  if (down && left) return 135;
  if (up) return -90;
  if (down) return 90;
  if (right) return 0;
  if (left) return 180;
  return lastAngle;
}

document.addEventListener('keydown', (e) => {
  keys[e.key.toLowerCase()] = true;
});
document.addEventListener('keyup', (e) => {
  keys[e.key.toLowerCase()] = false;
});

function updatePlayer() {
  player.style.left = pos.x + 'px';
  player.style.top = pos.y + 'px';
  player.style.transform = `rotate(${lastAngle}deg)`;

  // Отправляем серверу своё положение
  if (ws.readyState === 1) {
    ws.send(JSON.stringify({
      type: 'move',
      id: playerId,
      x: pos.x,
      y: pos.y,
      angle: lastAngle
    }));
  }
}

function gameLoop() {
  let dx = 0, dy = 0;

  const up = keys['arrowup'] || keys['w'];
  const down = keys['arrowdown'] || keys['s'];
  const left = keys['arrowleft'] || keys['a'];
  const right = keys['arrowright'] || keys['d'];

  if (up) dy -= 1;
  if (down) dy += 1;
  if (left) dx -= 1;
  if (right) dx += 1;

  if (dx !== 0 || dy !== 0) {
    const norm = Math.sqrt(dx * dx + dy * dy);
    pos.x += speed * dx / norm;
    pos.y += speed * dy / norm;
    lastAngle = getDirectionAngle();
  }

  pos.x = Math.max(0, Math.min(pos.x, gameArea.offsetWidth - 40));
  pos.y = Math.max(0, Math.min(pos.y, gameArea.offsetHeight - 40));

  updatePlayer();
  requestAnimationFrame(gameLoop);
}

updatePlayer();
gameLoop();

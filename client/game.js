const playerId = Math.random().toString(36).substr(2, 9);
const playerColor = '#'+Math.floor(Math.random()*16777215).toString(16);
let playerName = null;

const ws = new WebSocket('ws://localhost:3000');

let pos = { x: 100, y: 100 };
let lastAngle = 0;
const speed = 4;
const keys = {};
const otherPlayersDiv = document.getElementById('other-players');
const playersListDiv = document.getElementById('players-list');

// Найдём свой Pac-Man circle для управления цветом
const player = document.getElementById('player');
const myCircle = document.getElementById('player-circle');
const gameArea = document.getElementById('game-area');

// Сначала спрашиваем сервер, есть ли слот для входа
ws.onopen = () => {
  ws.send(JSON.stringify({ type: 'can_join' }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  // 1. Если максимум игроков — показываем сообщение и выходим
  if (data.type === 'max_players') {
    document.body.innerHTML = '<div style="color:yellow; background:#222; font-size:2em; text-align:center; margin-top:30vh;">В игре уже 4 игрока.<br>Пожалуйста, попробуйте позже.</div>';
    ws.close();
    return;
  }

  // 2. Разрешено — спрашиваем имя и присоединяемся
  if (data.type === 'can_join_ok') {
    playerName = prompt('Введите ваше имя:');
    if (!playerName) {
      ws.close();
      return;
    }
    ws.send(JSON.stringify({
      type: 'join',
      id: playerId,
      name: playerName,
      color: playerColor
    }));
    return;
  }

  // 3. Состояние игры (отрисовка)
  if (data.type === 'state') {
    // Синхронизируем свою позицию, угол и цвет
    const me = data.players.find(p => p.id === playerId);
    if (me) {
      pos.x = me.x;
      pos.y = me.y;
      lastAngle = me.angle || 0;
      if (myCircle) myCircle.setAttribute('fill', me.color || 'yellow');
    }

    // Показываем других игроков на поле
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

    // Показываем список игроков сбоку
    let playersListHtml = '<div style="font-weight:bold;margin-bottom:8px;font-size:20px;">Игроки</div>';
    data.players.forEach(p => {
      let playerClass = (p.id === playerId) ? 'player-row player-me' : 'player-row';
      playersListHtml += `<div class="${playerClass}">
          <span class="player-dot" style="background:${p.color};"></span>
          <span>${p.name ? p.name : 'Игрок'}</span>
        </div>`;
    });
    playersListDiv.innerHTML = playersListHtml;
  }
};

// Управление Pac-Man
document.addEventListener('keydown', (e) => {
  keys[e.key.toLowerCase()] = true;
});
document.addEventListener('keyup', (e) => {
  keys[e.key.toLowerCase()] = false;
});

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

function updatePlayer() {
  player.style.left = pos.x + 'px';
  player.style.top = pos.y + 'px';
  player.style.transform = `rotate(${lastAngle}deg)`;

  // Сообщаем серверу о перемещении
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

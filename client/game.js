const POINT_RADIUS = 8;

const playerId = Math.random().toString(36).substr(2, 9);
const playerColor = '#'+Math.floor(Math.random()*16777215).toString(16);
let playerName = null;
let points = [];

//default params
let gameConfig = {
  FIELD_WIDTH: 800,
  FIELD_HEIGHT: 600,
  PACMAN_RADIUS: 20,
  POINT_RADIUS: 8,
  POINTS_TOTAL: 30,
  PACMAN_SPEED: 4
};


const ws = new WebSocket('ws://localhost:3000');

let pos = { x: 100, y: 100 };
let lastAngle = 0;
const keys = {};
const otherPlayersDiv = document.getElementById('other-players');
const playersListDiv = document.getElementById('players-list');
const player = document.getElementById('player');
const myCircle = document.getElementById('player-circle');
const gameArea = document.getElementById('game-area');

ws.onopen = () => {
  ws.send(JSON.stringify({ type: 'can_join' }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'game_config') {
    gameConfig = data.config;
    return;
  }

  if (data.type === 'max_players') {
    document.body.innerHTML = '<div style="color:yellow; background:#222; font-size:2em; text-align:center; margin-top:30vh;">There are already 4 players in the game.<br>Please try later</div>';
    ws.close();
    return;
  }

  if (data.type === 'can_join_ok') {
    playerName = prompt('Enter your name:');
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

  if (data.type === 'state') {
    const me = data.players.find(p => p.id === playerId);
    if (me) {
      pos.x = me.x;
      pos.y = me.y;
      lastAngle = me.angle || 0;
      if (myCircle) myCircle.setAttribute('fill', me.color || 'yellow');
    }

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

    points = data.points || [];

     // Draw point on the field
    const pointsDiv = document.getElementById('points');
    pointsDiv.innerHTML = '';
    points.forEach(pt => {
      const point = document.createElement('div');
      point.style.position = 'absolute';
      point.style.left = (pt.x - gameConfig.POINT_RADIUS) + 'px';
      point.style.top = (pt.y - gameConfig.POINT_RADIUS) + 'px';
      point.style.width = (gameConfig.POINT_RADIUS*2) + 'px';
      point.style.height = (gameConfig.POINT_RADIUS*2) + 'px';
      point.style.borderRadius = '50%';
      point.style.background = 'orange';
      point.style.boxShadow = '0 0 8px #fa0';
      point.style.zIndex = 0;
      pointsDiv.appendChild(point);
    });

    // List of players with score
    let playersListHtml = '<div style="font-weight:bold;margin-bottom:8px;font-size:20px;">Players</div>';
    data.players.forEach(p => {
      let playerClass = (p.id === playerId) ? 'player-row player-me' : 'player-row';
      playersListHtml += `<div class="${playerClass}">
          <span class="player-dot" style="background:${p.color};"></span>
          <span>${p.name ? p.name : 'Player'}</span>
          <span style="margin-left:auto;font-weight:normal;">${p.score || 0}</span>
        </div>`;
    });
    playersListDiv.innerHTML = playersListHtml;

  }
};

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
}

function gameLoop() {
  let dx = 0, dy = 0;
  if (keys['arrowup'] || keys['w']) dy -= 1;
  if (keys['arrowdown'] || keys['s']) dy += 1;
  if (keys['arrowleft'] || keys['a']) dx -= 1;
  if (keys['arrowright'] || keys['d']) dx += 1;

  const norm = Math.sqrt(dx * dx + dy * dy);

  if (ws.readyState === 1) {
    //console.log('Send:', {dx, dy, norm});
    ws.send(JSON.stringify({
      type: 'move',
      id: playerId,
      dx: norm > 0 ? dx / norm : 0,
      dy: norm > 0 ? dy / norm : 0,
      angle: getDirectionAngle()
    }));
  }

  // Check collision with dot
  points.forEach(pt => {
    const dx = pt.x - (pos.x + gameConfig.PACMAN_RADIUS);
    const dy = pt.y - (pos.y + gameConfig.PACMAN_RADIUS);
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < gameConfig.PACMAN_RADIUS + gameConfig.POINT_RADIUS) {
      ws.send(JSON.stringify({ type: 'collect_point', pointId: pt.id }));
    }
  });


  updatePlayer();
  requestAnimationFrame(gameLoop);
}

updatePlayer();
gameLoop();

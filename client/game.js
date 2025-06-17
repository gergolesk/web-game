// PACMAN client with virtual joystick, keyboard, mouse drag support, animated coins, and sound

const POINT_RADIUS = 8;

const playerId = Math.random().toString(36).substr(2, 9);
const playerColor = '#' + Math.floor(Math.random() * 16777215).toString(16);
let playerName = null;
let points = [];
let timerInterval = null;
let currentTimerStart = null;
let lastReceivedPlayers = [];
let hasJoined = false;

let gameConfig = {
  FIELD_WIDTH: 800,
  FIELD_HEIGHT: 600,
  PACMAN_RADIUS: 20,
  POINT_RADIUS: 8,
  POINTS_TOTAL: 30,
  PACMAN_SPEED: 4
};

const ws = new WebSocket('ws://' + window.location.hostname + ':3000');

let pos = { x: 100, y: 100 };
let lastAngle = 0;
const keys = {};
let virtualDir = { dx: 0, dy: 0 };

const otherPlayersDiv = document.getElementById('other-players');
const playersListDiv = document.getElementById('players-list');
const player = document.getElementById('player');
const myCircle = document.getElementById('player-circle');

ws.onopen = () => {
  ws.send(JSON.stringify({ type: 'can_join' }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'offer_start_game') {
    const popup = document.getElementById('startGamePopup');
    const info = document.getElementById('connectedPlayersInfo');
    const btn = document.getElementById('startGameBtnByHost');

    // Обновим текст (сколько игроков подключилось)
    info.textContent = `There are ${data.count} players online. Start now or wait for more?`;

    popup.classList.remove('hidden');

    btn.onclick = () => {
      popup.classList.add('hidden');
      ws.send(JSON.stringify({ type: 'start_game_by_host' }));
    };
  }

  if (data.type === 'game_config') {
    gameConfig = data.config;
    return;
  }

  if (data.type === 'waiting_for_players') {
    if (hasJoined) return;

    const isFirst = data.isFirstPlayer;
    const durationSet = typeof data.duration === 'number';

    document.getElementById('startModal').style.display = 'flex';
    document.getElementById('playerNameInput').value = playerName || '';

    const durationInput = document.getElementById('gameDurationInput');
    durationInput.value = data.duration || 60; // всегда подставляем текущую, даже если не first
    durationInput.disabled = !isFirst || durationSet;
    durationInput.parentElement.style.opacity = (!isFirst || durationSet) ? '0.5' : '1';

    // 👇 если хочешь полностью скрыть поле:
    durationInput.parentElement.style.display = (!isFirst || durationSet) ? 'none' : 'block';
  }

  if (data.type === 'max_players') {
    document.body.innerHTML = '<div style="color:yellow; background:#222; font-size:2em; text-align:center; margin-top:30vh;">There are already 4 players in the game.<br>Please try later</div>';
    ws.close();
    return;
  }

  if (data.type === 'can_join_ok') {
    document.getElementById('startModal').style.display = 'flex';
    document.getElementById('playerNameInput').value = playerName || '';

    const durationInput = document.getElementById('gameDurationInput');
    durationInput.value = data.duration || 60;
    const durationSet = typeof data.duration === 'number';

    durationInput.disabled = durationSet;
    durationInput.parentElement.style.opacity = durationSet ? '0.5' : '1';
    durationInput.parentElement.style.display = durationSet ? 'none' : 'block'; // 🔒 скрыть у всех кроме первого
  }

  if (data.type === 'ready_to_choose_duration') {
    document.getElementById('startModal').style.display = 'flex';
    document.getElementById('playerNameInput').value = playerName || '';

    const durationInput = document.getElementById('gameDurationInput');
    durationInput.disabled = false;
    durationInput.parentElement.style.opacity = '1';
    durationInput.parentElement.style.display = 'block';
  }

  if (data.type === 'state') {
    const me = data.players.find(p => p.id === playerId);
    if (me) {
      pos.x = me.x;
      pos.y = me.y;
      lastAngle = me.angle || 0;
      if (myCircle) myCircle.setAttribute('fill', me.color || 'yellow');
    }

    if (typeof data.gameDuration === 'number' && typeof data.gameStartedAt === 'number') {
      startCountdownTimer(data.gameDuration, data.gameStartedAt);
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
      const mouthPoints = p.mouthOpen ? "20,20 40,10 40,30" : "20,20 40,18 40,22";
      el.innerHTML = `
        <defs>
          <mask id="m-${p.id}">
            <circle cx="20" cy="20" r="20" fill="white"/>
            <polygon points="${mouthPoints}" fill="black"/>
          </mask>
        </defs>
        <circle cx="20" cy="20" r="20" fill="${p.color || 'yellow'}" mask="url(#m-${p.id})" />
      `;
      otherPlayersDiv.appendChild(el);
    });

    points = data.points || [];
    const pointsDiv = document.getElementById('points');

    // Собираем ID текущих монет с сервера
    const newIds = new Set(points.map(p => 'point-' + p.id));

// Удаляем только те DOM-элементы, которых нет больше в списке
    [...pointsDiv.children].forEach(child => {
      if (!newIds.has(child.id) && !child.classList.contains('sparkle')) {
        child.remove();
      }
    });


    points.forEach(pt => {
      let pointWrapper = document.getElementById('point-' + pt.id);
      const isNew = !pointWrapper;

      if (isNew) {
        pointWrapper = document.createElement('div');
        pointWrapper.id = 'point-' + pt.id;
        pointWrapper.classList.add('coin');
        pointWrapper.style.position = 'absolute';
        pointWrapper.style.zIndex = '0';

        const coinFace = document.createElement('div');
        coinFace.classList.add('coin-face');
        pointWrapper.appendChild(coinFace);

        pointsDiv.appendChild(pointWrapper);
      }

      // 🧼 Обновляем класс "negative-coin" (даже если уже есть)
      if (pt.isNegative) {
        pointWrapper.classList.add('negative-coin');
      } else {
        pointWrapper.classList.remove('negative-coin');
      }

      // Обновляем позицию и размеры
      pointWrapper.style.left = (pt.x - gameConfig.POINT_RADIUS) + 'px';
      pointWrapper.style.top = (pt.y - gameConfig.POINT_RADIUS) + 'px';
      pointWrapper.style.width = (gameConfig.POINT_RADIUS * 2) + 'px';
      pointWrapper.style.height = (gameConfig.POINT_RADIUS * 2) + 'px';
    });

    let playersListHtml = '<div style="font-weight:bold;margin-bottom:8px;font-size:20px;">Players</div>';
    data.players.forEach(p => {
      let playerClass = (p.id === playerId) ? 'player-row player-me' : 'player-row';
      playersListHtml += `<div class="${playerClass}">
        <span class="player-dot" style="background:${p.color};"></span>
        <span>${p.name || 'Player'}</span>
        <span style="margin-left:auto;font-weight:normal;">${p.score || 0}</span>
      </div>`;
    });
    playersListDiv.innerHTML = playersListHtml;
  }

  lastReceivedPlayers = data.players;
};

addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

function getDirectionAngle(dx, dy) {
  if (dx === 0 && dy === 0) return lastAngle;
  return Math.atan2(dy, dx) * 180 / Math.PI;
}

function updatePlayer() {
  player.style.left = pos.x + 'px';
  player.style.top = pos.y + 'px';
  player.style.transform = `rotate(${lastAngle}deg)`;
}

let mouthOpen = true, mouthTimer = 0, lastX = pos.x, lastY = pos.y;
function animateMouth() {
  const mouth = document.getElementById('mouth');
  if (!mouth) return;
  const moved = (pos.x !== lastX || pos.y !== lastY);
  lastX = pos.x; lastY = pos.y;
  if (moved) {
    mouthTimer++;
    if (mouthTimer >= 5) {
      mouthOpen = !mouthOpen;
      mouthTimer = 0;
      mouth.setAttribute("points", mouthOpen ? "20,20 40,10 40,30" : "20,20 40,18 40,22");
    }
  } else {
    mouth.setAttribute("points", "20,20 40,18 40,22");
  }
}

function gameLoop() {
  let dx = virtualDir.dx || 0;
  let dy = virtualDir.dy || 0;

  if (keys['arrowup'] || keys['w']) dy -= 1;
  if (keys['arrowdown'] || keys['s']) dy += 1;
  if (keys['arrowleft'] || keys['a']) dx -= 1;
  if (keys['arrowright'] || keys['d']) dx += 1;

  const norm = Math.sqrt(dx * dx + dy * dy);
  if (norm < 0.1) { dx = 0; dy = 0; }

  if (ws.readyState === 1) {
    ws.send(JSON.stringify({
      type: 'move',
      id: playerId,
      dx: norm > 0 ? dx / norm : 0,
      dy: norm > 0 ? dy / norm : 0,
      angle: getDirectionAngle(dx, dy),
      mouthOpen: mouthOpen
    }));
  }

  points.forEach(pt => {
    const dX = pt.x - (pos.x + gameConfig.PACMAN_RADIUS);
    const dY = pt.y - (pos.y + gameConfig.PACMAN_RADIUS);
    const dist = Math.sqrt(dX * dX + dY * dY);
    if (dist < gameConfig.PACMAN_RADIUS + gameConfig.POINT_RADIUS) {
      const isNegative = pt.isNegative;
      if (isNegative) {
        applySlowDebuff(2000);
        playBadCoinSound();
      } else {
        triggerCoinCollectEffect(pt.x, pt.y);
        playCoinSound();
      }

      ws.send(JSON.stringify({ type: 'collect_point', pointId: pt.id }));
    }
  });

  updatePlayer();
  animateMouth();
  requestAnimationFrame(gameLoop);
}

updatePlayer();
gameLoop();

const joystick = document.getElementById('joystick');
const stick = document.getElementById('stick');
let joystickCenter = { x: 0, y: 0 };
let dragging = false;

let isSlowed = false;

function applySlowDebuff(duration) {
  const playerEl = document.getElementById('player-circle');
  if (playerEl) playerEl.style.filter = 'grayscale(100%)';

  setTimeout(() => {
    if (playerEl) playerEl.style.filter = '';
  }, duration);
}

function updateJoystickDirection(touchX, touchY) {
  const rect = joystick.getBoundingClientRect();
  joystickCenter.x = rect.left + rect.width / 2;
  joystickCenter.y = rect.top + rect.height / 2;

  const dx = touchX - joystickCenter.x;
  const dy = touchY - joystickCenter.y;

  const maxDist = rect.width / 2;
  const dist = Math.min(Math.sqrt(dx * dx + dy * dy), maxDist);
  const angle = Math.atan2(dy, dx);

  const offsetX = Math.cos(angle) * dist;
  const offsetY = Math.sin(angle) * dist;

  stick.style.left = `${offsetX + rect.width / 2 - stick.offsetWidth / 2}px`;
  stick.style.top = `${offsetY + rect.height / 2 - stick.offsetHeight / 2}px`;

  virtualDir.dx = dx / maxDist;
  virtualDir.dy = dy / maxDist;
}

function resetJoystick() {
  stick.style.left = '30px';
  stick.style.top = '30px';
  virtualDir.dx = 0;
  virtualDir.dy = 0;
}

function playCoinSound() {
  const snd = document.getElementById('coinSound');
  if (snd) {
    snd.currentTime = 0;
    snd.play().catch(() => {});
  }
}

function playBadCoinSound() {
  const snd = document.getElementById('badCoinSound');
  if (snd) {
    snd.currentTime = 0;
    snd.play().catch(() => {});
  }
}

function triggerCoinCollectEffect(x, y) {
  const sparkle = document.createElement('div');
  sparkle.style.position = 'absolute';
  sparkle.style.left = (x - 10) + 'px';
  sparkle.style.top = (y - 10) + 'px';
  sparkle.style.width = '20px';
  sparkle.style.height = '20px';
  sparkle.style.borderRadius = '50%';
  sparkle.style.background = 'gold';
  sparkle.style.opacity = '0.9';
  sparkle.style.boxShadow = '0 0 20px gold';
  sparkle.style.zIndex = 10;
  sparkle.style.transition = 'all 0.3s ease-out';

  const pointsDiv = document.getElementById('points');
  pointsDiv.appendChild(sparkle);

  setTimeout(() => {
    sparkle.style.transform = 'scale(2)';
    sparkle.style.opacity = '0';
  }, 10);

  setTimeout(() => sparkle.remove(), 300);
}

joystick.addEventListener('touchstart', e => {
  if (e.touches.length > 0) {
    updateJoystickDirection(e.touches[0].clientX, e.touches[0].clientY);
  }
}, { passive: false });

joystick.addEventListener('touchmove', e => {
  e.preventDefault();
  if (e.touches.length > 0) {
    updateJoystickDirection(e.touches[0].clientX, e.touches[0].clientY);
  }
}, { passive: false });

joystick.addEventListener('touchend', () => resetJoystick(), { passive: false });

stick.addEventListener('mousedown', e => {
  dragging = true;
  updateJoystickDirection(e.clientX, e.clientY);
});

window.addEventListener('mousemove', e => {
  if (dragging) {
    updateJoystickDirection(e.clientX, e.clientY);
  }
});

window.addEventListener('mouseup', () => {
  if (dragging) {
    dragging = false;
    resetJoystick();
  }
});

document.getElementById('startGameBtn').addEventListener('click', () => {
  const nameInput = document.getElementById('playerNameInput');
  const durationInput = document.getElementById('gameDurationInput');

  const name = nameInput.value.trim();
  const duration = parseInt(durationInput.value);

  if (!name) {
    alert('Please enter a name!');
    return;
  }

  playerName = name;

  document.getElementById('startModal').style.display = 'none';

  ws.send(JSON.stringify({
    type: 'join',
    id: playerId,
    name: playerName,
    color: playerColor,
    duration: duration
  }));
  hasJoined = true;
});


function startCountdownTimer(duration, startedAt) {
  const el = document.getElementById('game-timer');
  if (!el) return;

  // предотвратить повторный запуск
  if (currentTimerStart === startedAt) return;
  currentTimerStart = startedAt;

  if (timerInterval) clearInterval(timerInterval);

  el.style.display = 'block';

  timerInterval = setInterval(() => {
    const now = Date.now();
    const elapsed = Math.floor((now - startedAt) / 1000);
    const remaining = Math.max(0, duration - elapsed);

    const minutes = String(Math.floor(remaining / 60)).padStart(2, '0');
    const seconds = String(remaining % 60).padStart(2, '0');
    el.textContent = `Time: ${minutes}:${seconds}`;

    if (remaining === 0) {
      clearInterval(timerInterval);
      el.textContent = 'Game Ended';

      showGameResults(lastReceivedPlayers || []);
    }
  }, 1000);
}

function showGameResults(players) {
  const modal = document.getElementById('resultModal');
  const list = document.getElementById('resultList');
  modal.classList.remove('hidden');

  const sorted = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));

  list.innerHTML = sorted.map((p, i) => {
    const place = ['🥇 1st', '🥈 2nd', '🥉 3rd', '🏅 4th'][i];
    return `<div style="margin: 8px 0;"><strong>${place}:</strong> ${p.name || 'Player'} (${p.score || 0} pts)</div>`;
  }).join('');
}

function sendReadyToRestart() {
  const modal = document.getElementById('resultModal');
  if (modal) modal.classList.add('hidden');
  ws.send(JSON.stringify({ type: 'ready_to_restart' }));
}
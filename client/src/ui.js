// ui.js

// Эффект сбора монетки
export function triggerCoinCollectEffect(x, y) {
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

export function updatePlayerDom(player, pos, angle) {
  player.style.left = pos.x + 'px';
  player.style.top = pos.y + 'px';
  player.style.transform = `rotate(${angle}deg)`;
}

export function updatePlayersList(players, playerId) {
  const playersListDiv = document.getElementById('players-list');
  let playersListHtml = '<div style="font-weight:bold;margin-bottom:8px;font-size:20px;">Players</div>';
  players.forEach(p => {
    let playerClass = (p.id === playerId) ? 'player-row player-me' : 'player-row';
    playersListHtml += `<div class="${playerClass}">
      <span class="player-dot" style="background:${p.color};"></span>
      <span>${p.name || 'Player'}</span>
      <span style="margin-left:auto;font-weight:normal;">${p.score || 0}</span>
    </div>`;
  });
  playersListDiv.innerHTML = playersListHtml;
}

// --- Timer ---
let timerInterval = null;
let currentTimerStart = null;

export function startCountdownTimer(duration, startedAt, onTimeEnd) {
  const el = document.getElementById('game-timer');
  if (!el) return;

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
      if (typeof onTimeEnd === 'function') onTimeEnd();
    }
  }, 1000);
}

export function showGameResults(players) {
  const modal = document.getElementById('resultModal');
  const list = document.getElementById('resultList');
  if (!modal || !list) return;

  modal.classList.remove('hidden');

  const sorted = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));
  list.innerHTML = sorted.map((p, i) => {
    const place = ['🥇 1st', '🥈 2nd', '🥉 3rd', '🏅 4th'][i];
    return `<div style="margin: 8px 0;"><strong>${place}:</strong> ${p.name || 'Player'} (${p.score || 0} pts)</div>`;
  }).join('');
}

export function hideGameResults() {
  const modal = document.getElementById('resultModal');
  if (modal) modal.classList.add('hidden');
}


export function showStartModal(data) {
  const modal = document.getElementById('startModal');
  if (!modal) return;
  modal.style.display = 'flex';

  const nameInput = document.getElementById('playerNameInput');
  if (nameInput && data && data.name) nameInput.value = data.name;

  const durationInput = document.getElementById('gameDurationInput');
  if (durationInput && durationInput.parentElement) {
    // Поле видно ТОЛЬКО если ты первый игрок и duration еще не выбран
    if (data && data.isFirstPlayer && !data.duration) {
      durationInput.parentElement.style.display = 'block';
      durationInput.disabled = false;
      durationInput.parentElement.style.opacity = '1';
    } else {
      durationInput.parentElement.style.display = 'none';
    }
    if (typeof data.duration === 'number') durationInput.value = data.duration;
  }
}

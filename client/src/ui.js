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

// Обновление DOM игрока
export function updatePlayerDom(player, pos, angle) {
  player.style.left = pos.x + 'px';
  player.style.top = pos.y + 'px';
  player.style.transform = `rotate(${angle}deg)`;
}

// Обновление списка игроков
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

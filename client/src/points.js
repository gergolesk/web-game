// points.js
import { triggerCoinCollectEffect } from './ui.js';
import { playCoinSound, playBadCoinSound } from './sound.js';

let isSlowed = false;

export function handlePoints(points, pos, gameConfig, ws, playerId) {
  points.forEach(pt => {
    const dX = pt.x - (pos.x + gameConfig.PACMAN_RADIUS);
    const dY = pt.y - (pos.y + gameConfig.PACMAN_RADIUS);
    const dist = Math.sqrt(dX * dX + dY * dY);
    if (dist < gameConfig.PACMAN_RADIUS + gameConfig.POINT_RADIUS) {
      if (pt.isNegative) {
        applySlowDebuff(2000, gameConfig);
        playBadCoinSound();
      } else {
        triggerCoinCollectEffect(pt.x, pt.y);
        playCoinSound();
      }
      ws.send(JSON.stringify({ type: 'collect_point', pointId: pt.id }));
    }
  });
}

function applySlowDebuff(duration, gameConfig) {
  if (isSlowed) return;

  isSlowed = true;
  const originalSpeed = gameConfig.PACMAN_SPEED;
  gameConfig.PACMAN_SPEED = originalSpeed / 2;

  const playerEl = document.getElementById('player-circle');
  if (playerEl) playerEl.style.filter = 'grayscale(100%)';

  setTimeout(() => {
    gameConfig.PACMAN_SPEED = originalSpeed;
    isSlowed = false;
    if (playerEl) playerEl.style.filter = '';
  }, duration);
}

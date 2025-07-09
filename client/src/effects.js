// /src/effects.js

/**
 * Applies a "slow" debuff (greys out player for duration in ms)
 */
export function applySlowDebuff(duration) {
    const playerEl = document.getElementById('player-circle');
    if (playerEl) playerEl.style.filter = 'grayscale(100%)';
    setTimeout(() => {
        if (playerEl) playerEl.style.filter = '';
    }, duration);
}

/**
 * Visual sparkle effect when a coin is collected
 */
export function triggerCoinCollectEffect(x, y) {
    const sparkle = document.createElement('div');
    sparkle.className = 'sparkle';
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
    document.getElementById('points').appendChild(sparkle);
    setTimeout(() => {
        sparkle.style.transform = 'scale(2)';
        sparkle.style.opacity = '0';
    }, 10);
    setTimeout(() => sparkle.remove(), 300);
}

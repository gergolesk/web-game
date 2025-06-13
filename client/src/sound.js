// sound.js
export function playCoinSound() {
  const snd = document.getElementById('coinSound');
  if (snd) {
    snd.currentTime = 0;
    snd.play().catch(() => {});
  }
}

export function playBadCoinSound() {
  const snd = document.getElementById('badCoinSound');
  if (snd) {
    snd.currentTime = 0;
    snd.play().catch(() => {});
  }
}
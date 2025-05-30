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

function updatePlayer() {
  player.style.left = pos.x + 'px';
  player.style.top = pos.y + 'px';
  player.style.transform = `rotate(${lastAngle}deg)`;
}

document.addEventListener('keydown', (e) => {
  keys[e.key.toLowerCase()] = true;
});
document.addEventListener('keyup', (e) => {
  keys[e.key.toLowerCase()] = false;
});

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

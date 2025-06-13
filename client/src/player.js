// player.js

export let pos = { x: 100, y: 100 };
export let lastAngle = 0;
export let mouthOpen = true;
let mouthTimer = 0;
let lastX = pos.x, lastY = pos.y;

export function updatePlayerState(me) {
  pos.x = me.x;
  pos.y = me.y;
  lastAngle = me.angle || 0;
  if (document.getElementById('player-circle'))
    document.getElementById('player-circle').setAttribute('fill', me.color || 'yellow');
}

export function animateMouth() {
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

// controllers.js
export const keys = {};
export const virtualDir = { dx: 0, dy: 0 };

let joystick, stick;
let joystickCenter = { x: 0, y: 0 };
let dragging = false;

export function initControllers(joystickElement, stickElement) {
  joystick = joystickElement;
  stick = stickElement;

  // Keyboard
  addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
  addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

  // Joystick (touch)
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

  // Joystick (mouse)
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
}

export function getCurrentDirection() {
  let dx = virtualDir.dx || 0;
  let dy = virtualDir.dy || 0;
  if (keys['arrowup'] || keys['w']) dy -= 1;
  if (keys['arrowdown'] || keys['s']) dy += 1;
  if (keys['arrowleft'] || keys['a']) dx -= 1;
  if (keys['arrowright'] || keys['d']) dx += 1;
  return { dx, dy };
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

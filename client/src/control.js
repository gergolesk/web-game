// control.js

// Control state
export const keys = {};
export const virtualDir = { dx: 0, dy: 0 };

let dragging = false;
let joystick = null;
let stick = null;

// Initialize control (register all events)
// Requires a reference to the joystick and stick DOM elements, as well as a function to send movement.
export function initControls({ joystickEl, stickEl, sendMove }) {
    joystick = joystickEl;
    stick = stickEl;

    // Keys
    window.addEventListener('keydown', e => {
        keys[e.key.toLowerCase()] = true;
    });
    window.addEventListener('keyup', e => {
        keys[e.key.toLowerCase()] = false;
    });

    // --- Joystick and mouse ---
    if (!joystick || !stick) return;

    // Touch events
    joystick.addEventListener('touchstart', e => {
        if (e.touches.length > 0) updateJoystickDirection(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });
    joystick.addEventListener('touchmove', e => {
        e.preventDefault();
        if (e.touches.length > 0) updateJoystickDirection(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });
    joystick.addEventListener('touchend', () => resetJoystick(), { passive: false });

    // Mouse events
    stick.addEventListener('mousedown', e => {
        dragging = true;
        updateJoystickDirection(e.clientX, e.clientY);
    });
    window.addEventListener('mousemove', e => {
        if (dragging) updateJoystickDirection(e.clientX, e.clientY);
    });
    window.addEventListener('mouseup', () => {
        if (dragging) {
            dragging = false;
            resetJoystick();
        }
    });

    // Automatically send movement every 50ms
    setInterval(() => sendMove && sendMove(), 50);
}

// --- Functions for the joystick ---
export function updateJoystickDirection(touchX, touchY) {
    if (!joystick || !stick) return;
    const rect = joystick.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = touchX - centerX;
    const dy = touchY - centerY;

    const maxDist = rect.width / 2;
    const dist = Math.min(Math.sqrt(dx * dx + dy * dy), maxDist);
    const angle = Math.atan2(dy, dx);

    // Offset relative to the centre
    const offsetX = Math.cos(angle) * dist;
    const offsetY = Math.sin(angle) * dist;

    stick.style.left = '50%';
    stick.style.top = '50%';
    stick.style.transform = `translate(-50%, -50%) translate(${offsetX}px, ${offsetY}px)`;

    virtualDir.dx = dx / maxDist;
    virtualDir.dy = dy / maxDist;
}

export function resetJoystick() {
    if (!stick) return;
    stick.style.left = '50%';
    stick.style.top = '50%';
    stick.style.transform = 'translate(-50%, -50%)';
    virtualDir.dx = 0;
    virtualDir.dy = 0;
}

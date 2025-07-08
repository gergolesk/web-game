// /src/utils.js

// Linear interpolation
export function lerp(a, b, t) {
    return a + (b - a) * t;
}

// Getting the direction angle
export function getDirectionAngle(dx, dy) {
    return Math.atan2(dy, dx) * 180 / Math.PI;
}

// Toasts
export function showToast(text) {
    const box = document.createElement('div');
    box.textContent = text;
    Object.assign(box.style, {
        position: 'absolute',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: '#222',
        color: '#fff',
        padding: '8px 18px',
        borderRadius: '8px',
        fontSize: '18px',
        zIndex: 9999,
        opacity: 0,
        transition: 'opacity 0.3s',
    });

    document.body.appendChild(box);
    requestAnimationFrame(() => (box.style.opacity = 1));
    setTimeout(() => {
        box.style.opacity = 0;
        setTimeout(() => box.remove(), 300)
    }, 2500)
}

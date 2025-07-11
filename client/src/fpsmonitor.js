export function initFPSMonitor() {
  let lastTime = performance.now();
  let frames = 0;

  const fpsDisplay = document.createElement('div');
  Object.assign(fpsDisplay.style, {
    position: 'fixed',
    top: '8px',
    left: '8px',
    background: 'rgba(0,0,0,0.6)',
    color: '#00FF00',
    padding: '2px 6px',
    fontFamily: 'monospace',
    fontSize: '14px',
    borderRadius: '4px',
    zIndex: 9999,
  });
  document.body.appendChild(fpsDisplay);

  function updateFPS() {
    const now = performance.now();
    frames++;
    if (now - lastTime >= 1000) {
      fpsDisplay.textContent = `FPS: ${frames}`;
      frames = 0;
      lastTime = now;
    }
    requestAnimationFrame(updateFPS);
  }

  requestAnimationFrame(updateFPS);
}

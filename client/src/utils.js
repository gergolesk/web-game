// utils.js
export function getDirectionAngle(dx, dy, lastAngle) {
  if (dx === 0 && dy === 0) return lastAngle;
  return Math.atan2(dy, dx) * 180 / Math.PI;
}

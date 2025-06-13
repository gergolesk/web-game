// config.js
export const POINT_RADIUS = 8;
export let gameConfig = {
  FIELD_WIDTH: 800,
  FIELD_HEIGHT: 600,
  PACMAN_RADIUS: 20,
  POINT_RADIUS: 8,
  POINTS_TOTAL: 30,
  PACMAN_SPEED: 4
};

// Позволяет обновлять gameConfig из других модулей (например, ws.js)
export function setGameConfig(newConfig) {
  Object.assign(gameConfig, newConfig);
}

//import { POINT_RADIUS, gameConfig } from './config.js';//
import { gameConfig } from './config.js';
import { initWebSocket, ws } from './ws.js';
import { updatePlayerState, animateMouth, pos, lastAngle, mouthOpen } from './player.js';
import { handlePoints } from './points.js';
import { triggerCoinCollectEffect, updatePlayersList, updatePlayerDom } from './ui.js';
import { getDirectionAngle } from './utils.js';
import { initControllers, getCurrentDirection } from './controllers.js';

let playerId = Math.random().toString(36).substr(2, 9);
let playerColor = '#' + Math.floor(Math.random() * 16777215).toString(16);
let playerName = null;
let points = [];

const otherPlayersDiv = document.getElementById('other-players');
const playersListDiv = document.getElementById('players-list');
const player = document.getElementById('player');
const myCircle = document.getElementById('player-circle');
const joystick = document.getElementById('joystick');
const stick = document.getElementById('stick');

// Управление
initControllers(joystick, stick);

initWebSocket(playerId, playerColor, (name) => { playerName = name; }, onState);

function onState(data) {
  // Твой код рендера состояния (отрисовка других игроков и монет)
  const me = data.players.find(p => p.id === playerId);
  if (me) {
    updatePlayerState(me);
    if (myCircle) myCircle.setAttribute('fill', me.color || 'yellow');
  }

  otherPlayersDiv.innerHTML = '';
  data.players.forEach(p => {
    if (p.id === playerId) return;
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    el.setAttribute('width', 40);
    el.setAttribute('height', 40);
    el.style.position = 'absolute';
    el.style.left = p.x + 'px';
    el.style.top = p.y + 'px';
    el.style.transform = `rotate(${p.angle}deg)`;
    el.style.zIndex = 1;
    const mouthPoints = p.mouthOpen ? "20,20 40,10 40,30" : "20,20 40,18 40,22";
    el.innerHTML = `
      <defs>
        <mask id="m-${p.id}">
          <circle cx="20" cy="20" r="20" fill="white"/>
          <polygon points="${mouthPoints}" fill="black"/>
        </mask>
      </defs>
      <circle cx="20" cy="20" r="20" fill="${p.color || 'yellow'}" mask="url(#m-${p.id})" />
    `;
    otherPlayersDiv.appendChild(el);
  });

  // Работа с монетками
  points = data.points || [];
  const pointsDiv = document.getElementById('points');
  const newIds = new Set(points.map(p => 'point-' + p.id));

  [...pointsDiv.children].forEach(child => {
    if (!newIds.has(child.id) && !child.classList.contains('sparkle')) {
      child.remove();
    }
  });

  points.forEach(pt => {
    let pointWrapper = document.getElementById('point-' + pt.id);
    if (!pointWrapper) {
      pointWrapper = document.createElement('div');
      pointWrapper.id = 'point-' + pt.id;
      pointWrapper.classList.add('coin');
      pointWrapper.style.position = 'absolute';
      pointWrapper.style.zIndex = '0';

      const coinFace = document.createElement('div');
      coinFace.classList.add('coin-face');
      pointWrapper.appendChild(coinFace);

      if (pt.isNegative) {
        pointWrapper.classList.add('negative-coin');
      }

      pointsDiv.appendChild(pointWrapper);
    }
    pointWrapper.style.left = (pt.x - gameConfig.POINT_RADIUS) + 'px';
    pointWrapper.style.top = (pt.y - gameConfig.POINT_RADIUS) + 'px';
    pointWrapper.style.width = (gameConfig.POINT_RADIUS * 2) + 'px';
    pointWrapper.style.height = (gameConfig.POINT_RADIUS * 2) + 'px';
  });

  updatePlayersList(data.players, playerId);
}

// Главный игровой цикл
function gameLoop() {
  const { dx, dy } = getCurrentDirection();

  const norm = Math.sqrt(dx * dx + dy * dy);
  let ndx = norm > 0 ? dx / norm : 0;
  let ndy = norm > 0 ? dy / norm : 0;

  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify({
      type: 'move',
      id: playerId,
      dx: ndx,
      dy: ndy,
      angle: getDirectionAngle(dx, dy, lastAngle),
      mouthOpen: mouthOpen
    }));
  }

  handlePoints(points, pos, gameConfig, ws, playerId);

  updatePlayerDom(player, pos, lastAngle);
  animateMouth();
  requestAnimationFrame(gameLoop);
}

updatePlayerDom(player, pos, lastAngle);
gameLoop();

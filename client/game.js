// === PACMAN client with virtual joystick, keyboard, mouse drag support, animated coins, sound and pause support ===

import { isMusicOn, isSoundOn, setMusicOn, setSoundOn, updateBackgroundMusic, playSound } from './src/sound.js';
import { initControls, keys, virtualDir } from './src/control.js'; 
import { lerp, getDirectionAngle, showToast } from './src/utils.js'; 
import { applySlowDebuff, triggerCoinCollectEffect } from './src/effects.js';
import { startCountdownTimer, showGameResults, sendReadyToRestart, showPausedTimer } from './src/timer.js';

// --- GLOBAL CONSTANTS AND VARIABLES ---
// Main config and runtime variables for client state
const POINT_RADIUS = 8;
const playerId = Math.random().toString(36).substr(2, 9);
const playerColor = '#' + Math.floor(Math.random() * 16777215).toString(16);

let playerName = null;
let points = [];
let timerInterval = null;
let currentTimerStart = null;
let lastReceivedPlayers = [];
let hasJoined = false;

let isGameReady = false;
let isObserver = false;

let isHost = false;           // Determine if it is a host
let pausedByName = null;      // The name of the player who paused the game

// Default client-side config (may be overridden by server)
let gameConfig = {
    FIELD_WIDTH: 800,
    FIELD_HEIGHT: 600,
    PACMAN_RADIUS: 20,
    POINT_RADIUS: 8,
    POINTS_TOTAL: 30,
    PACMAN_SPEED: 4
};

// Create WebSocket connection to game server
//const ws = new WebSocket('ws://' + window.location.hostname + ':3000');
//const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws`);

// Local movement state and references to DOM elements
let pos = {x: 100, y: 100};
let lastAngle = 0;
const otherPlayersDiv = document.getElementById('other-players');
const playersListDiv = document.getElementById('players-list');
const player = document.getElementById('player');
const myCircle = document.getElementById('player-circle');

// Store states for smooth interpolation of all other Pacmans
const opponentStates = {}; // key - player id

// --- WEBSOCKET EVENT HANDLERS ---
// Handles all incoming server messages and game events
ws.onopen = () => ws.send(JSON.stringify({type: 'can_join'}));

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    // Host is offered to start the game
    if (data.type === 'offer_start_game') {
        isHost = true;
        const popup = document.getElementById('startGamePopup');
        const info = document.getElementById('connectedPlayersInfo');
        const btn = document.getElementById('startGameBtnByHost');
        btn.disabled = false;
        info.textContent = `There are ${data.count} players online. Start now or wait for more?`;
        popup.classList.remove('hidden');
        btn.onclick = () => {
            popup.classList.add('hidden');
            ws.send(JSON.stringify({type: 'start_game_by_host'}));
        };
    }

    // to another players
    if (data.type === 'game_started' && !isObserver) {
        document.getElementById('waitingForHostModal')?.classList.add('hidden');
        document.getElementById('startModal')?.classList.add('hidden');
        document.getElementById('startGamePopup')?.classList.add('hidden');

        showCountdownThenStart();
        updateBackgroundMusic();
    }
   
    // Server sent new game config (field, speed, etc)
    if (data.type === 'game_config') {
        gameConfig = data.config;
        return;
    }

    if (data.type === 'observer_mode') {
        isObserver = true;
        // Show that the player is in spectator mode
        document.getElementById('startModal')?.classList.add('hidden');
        document.getElementById('waitingForHostModal')?.classList.add('hidden');

        const el = document.createElement('div');
        el.id = 'observerNotice';
        el.style.position = 'absolute';
        el.style.top = '20px';
        el.style.left = '30%';
        el.style.transform = 'translateX(-50%)';
        el.style.color = 'yellow';
        el.style.fontSize = '24px';
        el.style.background = 'rgba(0,0,0,0.6)';
        el.style.padding = '10px 20px';
        el.style.borderRadius = '8px';
        el.textContent = 'Game in progress – watching mode 👀';
        document.body.appendChild(el);

        // Draw the game (players, coins, timer)
        startCountdownTimer(data.duration, data.startTime, data.pauseAccum || 0);

        // Draw players, points, etc.
        lastReceivedPlayers = data.players;
        points = data.points || [];
    }

    // Show modal waiting for players to join, controls game duration selection
    if (data.type === 'waiting_for_players') {
        const isFirst = data.isFirstPlayer;

       // Always hide the "Waiting for start" mod for regular players
        document.getElementById('waitingForHostModal').classList.add('hidden');
        // Hide the start popup (just in case)
        document.getElementById('startGamePopup').classList.add('hidden');

        if (isFirst) {
            // If it is a host, show the host popup with the desired inscription and an INactive button
            document.getElementById('startGamePopup').classList.remove('hidden');
            const info = document.getElementById('connectedPlayersInfo');
            info.textContent = "Waiting for other players to join...";
            document.getElementById('startGameBtnByHost').disabled = true;
        } else {
            // For a regular player, we show the "Waiting for Host" modal
            document.getElementById('waitingForHostModal').classList.remove('hidden');
        }

        // duration/name update if there are fields (just in case)
        document.getElementById('playerNameInput').value = playerName || '';
        const durationInput = document.getElementById('gameDurationInput');
        if (durationInput) {
            durationInput.value = data.duration || 60;
            durationInput.disabled = true;
            durationInput.parentElement.style.opacity = '0.5';
            durationInput.parentElement.style.display = 'none';
        }

        updateBackgroundMusic();
    }


    if (data.type === 'name_taken') {
        alert('This name is already taken. Please choose another one.');
        document.getElementById('startModal').style.display = 'flex';
        return;
    }

    // Room is full (4 players)
    if (data.type === 'max_players') {
        document.body.innerHTML = '<div style="color:yellow; background:#222; font-size:2em; text-align:center; margin-top:30vh;">There are already 4 players in the game.<br>Please try later</div>';
        ws.close();
        return;
    }

    // Player is allowed to join; display join modal
    if (data.type === 'can_join_ok') {
        document.getElementById('startModal').style.display = 'flex';
        document.getElementById('playerNameInput').value = playerName || '';
        const durationInput = document.getElementById('gameDurationInput');
        durationInput.value = data.duration || 60;
        const durationSet = typeof data.duration === 'number';
        durationInput.disabled = durationSet;
        durationInput.parentElement.style.opacity = durationSet ? '0.5' : '1';
        durationInput.parentElement.style.display = durationSet ? 'none' : 'block';
        updateBackgroundMusic();
    }

    // Allow first player to choose game duration
    if (data.type === 'ready_to_choose_duration') {
        document.getElementById('startModal').style.display = 'flex';
        document.getElementById('playerNameInput').value = playerName || '';
        const durationInput = document.getElementById('gameDurationInput');
        durationInput.disabled = false;
        durationInput.parentElement.style.opacity = '1';
        durationInput.parentElement.style.display = 'block';
    }

    // Game was paused or unpaused
    if (data.type === 'game_paused') {
        pausedByName = data.pausedBy;
        showPauseOverlay(data.pausedBy);
        showPausedTimer(data.gameDuration, data.gameStartedAt, data.pauseAccum);
    }
    if (data.type === 'game_unpaused') {
        pausedByName = null;
        hidePauseOverlay();
        startCountdownTimer(data.gameDuration, data.gameStartedAt, data.pauseAccum, lastReceivedPlayers, false);
    }

    if (data.type === 'host_changed') {
        isHost = (playerId === data.hostId);
        showToast(isHost ? "You are the new host!" : "New host assigned");
    }


    // Main game state update: all players, points, scores, timer
    if (data.type === 'state') {
        // Find the minimum corner among players
        let minCorner = 4, hostId = null;
        data.players.forEach(p => {
            if (typeof p.corner === 'number' && p.corner < minCorner) {
                minCorner = p.corner;
                hostId = p.id;
            }
        });
        isHost = (playerId === hostId);

        // Update your own player position/angle/color
        const me = data.players.find(p => p.id === playerId);
        if (me) {
            // we save the server position and angle to smoothly catch up with them on the client
            serverPos.x = me.x;
            serverPos.y = me.y;
            serverAngle = me.angle || 0;
            if (myCircle) myCircle.setAttribute('fill', me.color || 'yellow');
        }

        // Render all other players
        
        //otherPlayersDiv.innerHTML = '';
        data.players.forEach(p => {
            if (p.id === playerId) return;

            // If we see it for the first time, initialize it
            if (!opponentStates[p.id]) {
                opponentStates[p.id] = {
                    renderX: p.x,
                    renderY: p.y,
                    renderAngle: p.angle || 0,
                    serverX: p.x,
                    serverY: p.y,
                    serverAngle: p.angle || 0,
                    color: p.color || 'yellow',
                    name: p.name || 'Player',
                    mouthPhase: Math.random(), // чтобы рот "жевал" не синхронно
                    mouthSpeed: 3.5,
                };
            }
            // Always update server values ​​(target for interpolation)
            opponentStates[p.id].serverX = p.x;
            opponentStates[p.id].serverY = p.y;
            opponentStates[p.id].serverAngle = p.angle || 0;
            opponentStates[p.id].color = p.color || 'yellow';
            opponentStates[p.id].name = p.name || 'Player';
            opponentStates[p.id].mouthOpen = !!p.mouthOpen; // for compatibility, but not used
        });

        // DELETE extra Pacmans if someone left
        for (const id in opponentStates) {
            if (!data.players.some(p => p.id === id)) {
                delete opponentStates[id];
            }
        }
        
        // Render and update all game points/coins
        points = data.points || [];
        const pointsDiv = document.getElementById('points');
        const newIds = new Set(points.map(p => 'point-' + p.id));
        [...pointsDiv.children].forEach(child => {
            if (!newIds.has(child.id) && !child.classList.contains('sparkle')) child.remove();
        });
        points.forEach(pt => {
            let pointWrapper = document.getElementById('point-' + pt.id);
            const isNew = !pointWrapper;
            if (isNew) {
                pointWrapper = document.createElement('div');
                pointWrapper.id = 'point-' + pt.id;
                pointWrapper.classList.add('coin');
                pointWrapper.style.position = 'absolute';
                pointWrapper.style.zIndex = '0';
                const coinFace = document.createElement('div');
                coinFace.classList.add('coin-face');
                pointWrapper.appendChild(coinFace);
                pointsDiv.appendChild(pointWrapper);
            }
            // Update coin classes for type
            pointWrapper.classList.remove('negative-coin', 'bonus-coin', 'trap-coin');
            if (pt.type === "negative") pointWrapper.classList.add('negative-coin');
            else if (pt.type === "bonus") pointWrapper.classList.add('bonus-coin');
            else if (pt.type === "trap") pointWrapper.classList.add('trap-coin');
            pointWrapper.style.left = (pt.x - gameConfig.POINT_RADIUS) + 'px';
            pointWrapper.style.top = (pt.y - gameConfig.POINT_RADIUS) + 'px';
            pointWrapper.style.width = (gameConfig.POINT_RADIUS * 2) + 'px';
            pointWrapper.style.height = (gameConfig.POINT_RADIUS * 2) + 'px';
        });

        // Render player list/scores
        let fontSize = window.innerWidth <= 820 ? '14px' : '20px';
        let playersListHtml = `<div style="font-weight:bold;margin-bottom:8px;font-size:${fontSize};">Players</div>`;
        data.players.forEach(p => {
            let playerClass = (p.id === playerId) ? 'player-row player-me' : 'player-row';
            playersListHtml += `<div class="${playerClass}">
        <span class="player-dot" style="background:${p.color};"></span>
        <span>${p.name || 'Player'}</span>
        <span style="margin-left:auto;font-weight:normal;">${p.score || 0}</span>
      </div>`;
        });
        playersListDiv.innerHTML = playersListHtml;

        // Pause UI and timer
        if (data.gamePaused) showPauseOverlay(data.pausedBy, data.pausedBy === playerName);
        else hidePauseOverlay();

        // Timer logic: updates or shows static value if paused
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = null;
        if (data.gamePaused) {
            const el = document.getElementById('game-timer');
            if (el) {
                const now = Date.now();
                const elapsed = Math.floor((now - data.gameStartedAt - (data.pauseAccum || 0)) / 1000);
                const remaining = Math.max(0, data.gameDuration - elapsed);
                const minutes = String(Math.floor(remaining / 60)).padStart(2, '0');
                const seconds = String(remaining % 60).padStart(2, '0');
                el.textContent = `Time: ${minutes}:${seconds}`;
            }
        } else {
            if (typeof data.gameDuration === 'number' && typeof data.gameStartedAt === 'number') {
                if (!isGameReady) {
                    if (isObserver) {
                        // the observer doesn't need the countdown — we immediately show
                        startCountdownTimer(
                            data.gameDuration,
                            data.gameStartedAt,
                            data.pauseAccum || 0
                        );
                    } else {
                        // we show "3-2-1-GO" to the player
                        showCountdownThenStart(
                            data.gameDuration,
                            data.gameStartedAt,
                            data.pauseAccum || 0
                        );
                    }
                } else {
                    // the game is already in progress - just update the timer for everyone
                    startCountdownTimer(
                        data.gameDuration,
                        data.gameStartedAt,
                        data.pauseAccum || 0
                    );
                }
            }
        }
    }

    // Handle different coin types (for future extensions)
    if (data.type === 'point_collected') {
        switch (data.pointType) {
            case 'negative':
                applySlowDebuff(2000);
                playSound('badCoinSound');
                break;
            case 'bonus':
                playSound('bonusSound');
                break;
            case 'trap':
                playSound('trapSound');
                break;
            default:
                playSound('coinSound');
                break;
        }
    }

    if (data.type === 'player_quit') {
        showToast(`${data.name} left the game`);
    }

    if (data.type === 'game_over') {
        isGameReady = false;
        showGameResults(data.players || []);
    }

    lastReceivedPlayers = data.players;
};

// --- MUTE/UNMUTE

// --- Music/Sound toggle buttons: START MODAL ---
const toggleMusicBtn = document.getElementById('toggleMusicBtn');
const toggleSoundBtn = document.getElementById('toggleSoundBtn');

// --- Music/Sound toggle buttons: PAUSE MODAL ---
const pauseToggleMusicBtn = document.getElementById('pauseToggleMusicBtn');
const pauseToggleSoundBtn = document.getElementById('pauseToggleSoundBtn');

// Update button text by state
function updateMusicBtns() {
    const musicText = isMusicOn ? "🎵 Music: ON " : "🚫 Music: OFF";
    if (toggleMusicBtn) toggleMusicBtn.textContent = musicText;
    if (pauseToggleMusicBtn) pauseToggleMusicBtn.textContent = musicText;
}
function updateSoundBtns() {
    const soundText = isSoundOn ? "🔊 Sounds: ON " : "🔇 Sounds: OFF";
    if (toggleSoundBtn) toggleSoundBtn.textContent = soundText;
    if (pauseToggleSoundBtn) pauseToggleSoundBtn.textContent = soundText;
}

// Click handling - both pairs of buttons duplicate the state
if (toggleMusicBtn) toggleMusicBtn.onclick = function() {
    setMusicOn(!isMusicOn);
    updateMusicBtns();
};
if (pauseToggleMusicBtn) pauseToggleMusicBtn.onclick = function() {
    setMusicOn(!isMusicOn);
    updateMusicBtns();
};

if (toggleSoundBtn) toggleSoundBtn.onclick = function() {
    setSoundOn(!isSoundOn);
    updateSoundBtns();
};
if (pauseToggleSoundBtn) pauseToggleSoundBtn.onclick = function() {
    setSoundOn(!isSoundOn);
    updateSoundBtns();
};

// Initializing button text on boot
updateMusicBtns();
updateSoundBtns();


// --- PLAYER RENDERING & ANIMATION ---

// --- Interpolation of position and smooth animation of Pac-Man's mouth ---

// Save the target position and angle from the server, and the rendered one (smoothly caught up)
let serverPos = { x: 100, y: 100 };
let renderPos = { x: 100, y: 100 };
let serverAngle = 0;
let renderAngle = 0;

// Soft mouth animation via phase
let mouthPhase = 0;   // phase (0...1), step per 1 "open-close" cycle
let mouthSpeed = 3.5; // number of "open-close" per second

// For collisions we use the server position (this is important for collecting coins)
let mouthOpen = true; // this flag is only needed for sending to the server

/**
 * Animates Pac-Man's mouth open/close while moving.
 */

setInterval(sendMove, 50);
renderLoop();

// --- Smooth mouth rendering and animation ---

function renderLoop() {
    // Interpolate position and angle (0.25 - smoothly over 4 frames)
    const interpSpeed = 0.25;
    renderPos.x = lerp(renderPos.x, serverPos.x, interpSpeed);
    renderPos.y = lerp(renderPos.y, serverPos.y, interpSpeed);
    renderAngle = lerp(renderAngle, serverAngle, interpSpeed);

    // Update Pac-Man's position (rendered!)
    if (isObserver) {
        player.style.display = 'none';
    } else {
        player.style.display = '';
        player.style.left = renderPos.x + 'px';
        player.style.top = renderPos.y + 'px';
        player.style.transform = `rotate(${renderAngle}deg)`;
    }

    // Smooth mouth animation via time-based phase
    const now = performance.now() / 1000;
    mouthPhase = (now * mouthSpeed) % 1; // always 0...1
    // mouthVal: 0...1...0 (open -> closed -> open)
    const mouthVal = Math.abs(Math.sin(mouthPhase * Math.PI));
    // Pick numbers for a nice opening animation (open, close)
    const open = lerp(18, 10, mouthVal);   // top point
    const close = lerp(22, 30, mouthVal);  // bottom point

    // mouthOpen – true if Pacman is currently at the "maximum"
    mouthOpen = mouthVal > 0.5;

    // Draw the mouth
    const mouth = document.getElementById('mouth');
    if (mouth) {
        mouth.setAttribute("points", `20,20 40,${open} 40,${close}`);
    }

    // Handle client coin collisions (use server position for correctness)
    points.forEach(pt => {
        const dX = pt.x - (serverPos.x + gameConfig.PACMAN_RADIUS);
        const dY = pt.y - (serverPos.y + gameConfig.PACMAN_RADIUS);
        const dist = Math.sqrt(dX * dX + dY * dY);
        if (dist < gameConfig.PACMAN_RADIUS + gameConfig.POINT_RADIUS) {
            triggerCoinCollectEffect(pt.x, pt.y);
            ws.send(JSON.stringify({type: 'collect_point', pointId: pt.id}));
        }
    });

    // --- Drawing other Pacmans ---
    otherPlayersDiv.innerHTML = ''; // clear DIV

    for (const id in opponentStates) {
        const state = opponentStates[id];

        // Interpolate position and angle (like yourself)
        const interpSpeed = 0.25;
        state.renderX = lerp(state.renderX, state.serverX, interpSpeed);
        state.renderY = lerp(state.renderY, state.serverY, interpSpeed);
        state.renderAngle = lerp(state.renderAngle, state.serverAngle, interpSpeed);

        // Mouth animation: each Pacman can "chew" at his own pace/phase
        const now = performance.now() / 1000;
        state.mouthPhase = (state.mouthPhase + (state.mouthSpeed * (1/60))) % 1; // шаг сдвигаем чуть-чуть каждый кадр
        const mouthVal = Math.abs(Math.sin((now + id.length*0.22) * Math.PI * state.mouthSpeed));
        const open = lerp(18, 10, mouthVal);
        const close = lerp(22, 30, mouthVal);

        // SVG Pacman with dynamic mouth mask
        const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        el.setAttribute('width', 40);
        el.setAttribute('height', 40);
        el.style.position = 'absolute';
        el.style.left = state.renderX + 'px';
        el.style.top = state.renderY + 'px';
        el.style.transform = `rotate(${state.renderAngle}deg)`;
        el.style.zIndex = 1;
        el.innerHTML = `
        <defs>
            <mask id="m-${id}">
            <circle cx="20" cy="20" r="20" fill="white"/>
            <polygon points="20,20 40,${open} 40,${close}" fill="black"/>
            </mask>
        </defs>
        <circle cx="20" cy="20" r="20" fill="${state.color}" mask="url(#m-${id})" />
        `;
        otherPlayersDiv.appendChild(el);
    }


    requestAnimationFrame(renderLoop);
}


function sendMove() {
    let dx = virtualDir.dx || 0, dy = virtualDir.dy || 0;
    if (keys['arrowup'] || keys['w']) dy -= 1;
    if (keys['arrowdown'] || keys['s']) dy += 1;
    if (keys['arrowleft'] || keys['a']) dx -= 1;
    if (keys['arrowright'] || keys['d']) dx += 1;
    const norm = Math.sqrt(dx * dx + dy * dy);
    if (norm < 0.1) {
        dx = 0; dy = 0;
    } else {
        dx /= norm; dy /= norm;
        lastAngle = getDirectionAngle(dx, dy);
    }
    if (isGameReady && ws.readyState === 1) {
        ws.send(JSON.stringify({
            type: 'move',
            id: playerId,
            dx: dx,
            dy: dy,
            angle: lastAngle,
            mouthOpen: mouthOpen
        }));
    }
}

// --- VIRTUAL JOYSTICK HANDLING ---
// Handles touch and mouse drag joystick input for mobile and desktop
initControls({
  joystickEl: document.getElementById('joystick'),
  stickEl: document.getElementById('stick'),
  sendMove: sendMove
});

// --- START GAME / JOIN HANDLER ---
/**
 * Handles start/join modal (player enters name, duration).
 */
document.getElementById('startGameBtn').addEventListener('click', () => {
    const nameInput = document.getElementById('playerNameInput');
    const durationInput = document.getElementById('gameDurationInput');
    const name = nameInput.value.trim();
    const duration = parseInt(durationInput.value);
    if (!name) {
        alert('Please enter a name!');
        return;
    }
    playerName = name;
    document.getElementById('startModal').style.display = 'none';
    ws.send(JSON.stringify({
        type: 'join',
        id: playerId,
        name: playerName,
        color: playerColor,
        duration: duration
    }));
    hasJoined = true;
});

// --- PAUSE/RESUME/PlayAgain/Leave CONTROLS ---
// Add event listeners for pause/resume (button or Pause key)
document.getElementById('pauseBtn').addEventListener('click', () => ws.send(JSON.stringify({type: 'pause_game'})));
window.addEventListener('keydown', e => {
    if (e.key === 'Pause' || e.code === 'Pause') ws.send(JSON.stringify({type: 'pause_game'}));
});
document.getElementById('resumeBtn').addEventListener('click', () => ws.send(JSON.stringify({type: 'unpause_game'})));
//Play again btn handler
document.getElementById('playAgainBtn').addEventListener('click', sendReadyToRestart);
//Quit button handler
document.getElementById('quitBtn').addEventListener('click', () => {
    ws.send(
        JSON.stringify({
            type: 'player_quit',
            id: playerId,
            name: playerName
        })
    );

    location.reload();
});

/**
 * Show pause overlay, display who paused, and show resume only for the initiator
 */
function showPauseOverlay(pausedBy, canResume) {
    document.getElementById('pauseOverlay').classList.remove('hidden');
    const pauseByText = document.getElementById('pauseByText');
    pauseByText.innerHTML = `⏸ <span class="pause-who">${pausedBy || 'Someone'}</span> paused the game`;


    // "Continue" is only visible to the person who paused
    const btnResume = document.getElementById('resumeBtn');
    btnResume.style.display = canResume ? '' : 'none';

    // "Exit game"
    const btnExit = document.getElementById('exitGameBtn');
    //btnExit.style.display = (pausedBy === playerName) ? '' : 'none';
    btnExit.style.display = '';

    // "Stop game" - for host only
    const btnStop = document.getElementById('stopGameBtn');
    btnStop.style.display = isHost ? '' : 'none';

    updateBackgroundMusic();
}

/**
 * Hide pause overlay
 */
function hidePauseOverlay() {
    document.getElementById('pauseOverlay').classList.add('hidden');
    document.getElementById('resumeBtn').style.display = 'none';
    document.getElementById('exitGameBtn').style.display = 'none';
    document.getElementById('stopGameBtn').style.display = 'none';
    updateBackgroundMusic();
}

function handleQuit() {
    ws.send(JSON.stringify({
        type: 'player_quit',
        id: playerId,
        name: playerName
    }));

    location.reload();
}

/*
    Exit game from pause overlay
*/
function handleQuitWithUnpause() {
    // Unpause
    ws.send(JSON.stringify({ type: 'unpause_game' }));
    //Then quit
    handleQuit();
}

// Quit buttons handlers
document.getElementById('exitGameBtn').addEventListener('click', handleQuitWithUnpause);
document.getElementById('quitBtn').addEventListener('click', handleQuit);
document.getElementById('exitGameBtnWaiting').addEventListener('click', handleQuit);

document.getElementById('stopGameBtn').addEventListener('click', () => {
    ws.send(JSON.stringify({ type: 'stop_game_by_host' }));
});

document.getElementById('howToPlayBtn').addEventListener('click', () => {
    document.getElementById('howToPlayModal').classList.remove('hidden');
    //updateBackgroundMusic();
});

document.getElementById('closeHowToPlayBtn').addEventListener('click', () => {
    document.getElementById('howToPlayModal').classList.add('hidden');
    //updateBackgroundMusic();
});

// 3-2-1 GO
let countdownAlreadyRunning = false;

function showCountdownThenStart(duration, startedAt, pauseAccum) {
    if (countdownAlreadyRunning) return;
    countdownAlreadyRunning = true;

    const countdownEl = document.getElementById('countdownDisplay');
    const steps = ['3', '2', '1', 'GO!'];
    let i = 0;

    isGameReady = false;

    countdownEl.classList.remove('hidden');
    countdownEl.textContent = steps[i];

    const interval = setInterval(() => {
        i++;
        if (i >= steps.length) {
            clearInterval(interval);
            countdownEl.classList.add('hidden');
            isGameReady = true;
            countdownAlreadyRunning = false;
            startCountdownTimer(duration, startedAt, pauseAccum);
        } else {
            countdownEl.textContent = steps[i];
        }
    }, 1000);
}

function scaleAndCenterGameArea() {
    const gameArea = document.getElementById('game-area');
    // const wrapper = document.getElementById('game-wrapper');

    if (window.innerWidth > 768) {
        // if desktop we reset all styles
        gameArea.style.transform = '';
        gameArea.style.left = '';
        gameArea.style.top = '';
        gameArea.style.position = '';
        return;
    }

    const scaleX = window.innerWidth / 800;
    const scaleY = window.innerHeight / 600;
    const scale = Math.min(scaleX, scaleY, 0.45);

    gameArea.style.transform = `scale(${scale})`;
    gameArea.style.transformOrigin = 'top left';

    const offsetX = (window.innerWidth - 800 * scale) / 2;
    const offsetY = (window.innerHeight - 600 * scale) / 2;

    gameArea.style.position = 'absolute';
    gameArea.style.left = `${offsetX}px`;
    gameArea.style.top = `100px`;
}

window.addEventListener('resize', scaleAndCenterGameArea);
window.addEventListener('load', scaleAndCenterGameArea);

/*
    Quit button handler
*/
/*
document.getElementById('quitBtn').addEventListener('click', () => {
    ws.send(
        JSON.stringify({
            type: 'player_quit',
            id: playerId,
            name: playerName
        })
    );

    location.reload();
});
*/
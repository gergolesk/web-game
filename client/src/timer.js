// /src/timer.js

import { updateBackgroundMusic } from './sound.js';

let timerInterval = null;

/**
 * Starts and updates the countdown game timer
 */
export function startCountdownTimer(duration, startedAt, pauseAccum = 0, lastReceivedPlayers = [], isPaused = false) {
    const el = document.getElementById('game-timer');
    if (!el) return;
    if (timerInterval) clearInterval(timerInterval);
    el.style.display = 'block';

    // Show "frozen" time if there is a pause
    if (isPaused) {
        const now = Date.now();
        const elapsed = Math.floor((now - startedAt - (pauseAccum || 0)) / 1000);
        const remaining = Math.max(0, duration - elapsed);
        const minutes = String(Math.floor(remaining / 60)).padStart(2, '0');
        const seconds = String(remaining % 60).padStart(2, '0');
        el.textContent = `Time: ${minutes}:${seconds}`;
        return;
    }

    // The timer only ticks if the game is not paused.
    function update() {
        const now = Date.now();
        const elapsed = Math.floor((now - startedAt - (pauseAccum || 0)) / 1000);
        const remaining = Math.max(0, duration - elapsed);
        const minutes = String(Math.floor(remaining / 60)).padStart(2, '0');
        const seconds = String(remaining % 60).padStart(2, '0');
        el.textContent = `Time: ${minutes}:${seconds}`;
        if (remaining === 0) {
            clearInterval(timerInterval);
            timerInterval = null;
            el.textContent = 'Game Ended';
        }
    }

    update(); 
    timerInterval = setInterval(update, 1000);
}

export function showPausedTimer(duration, startedAt, pauseAccum = 0) {
    const el = document.getElementById('game-timer');
    if (!el) return;
    if (timerInterval) clearInterval(timerInterval);
    el.style.display = 'block';

    const now = Date.now();
    const elapsed = Math.floor((now - startedAt - (pauseAccum || 0)) / 1000);
    const remaining = Math.max(0, duration - elapsed);
    const minutes = String(Math.floor(remaining / 60)).padStart(2, '0');
    const seconds = String(remaining % 60).padStart(2, '0');
    el.textContent = `Time: ${minutes}:${seconds}`;
}

/**
 * Shows end-of-game modal with player scores
 */
export function showGameResults(players) {
    const modal = document.getElementById('resultModal');
    const list = document.getElementById('resultList');
    modal.classList.remove('hidden');
    const sorted = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));
    list.innerHTML = sorted.map((p, i) => {
        const place = ['🥇 1st', '🥈 2nd', '🥉 3rd', '🏅 4th'][i];
        return `<div style="margin: 8px 0;"><strong>${place}:</strong> ${p.name || 'Player'} (${p.score || 0} pts)</div>`;
    }).join('');
    updateBackgroundMusic();
}

/**
 * Hide result modal and signal readiness to server for new game
 */
export function sendReadyToRestart() {
    const modal = document.getElementById('resultModal');
    if (modal) modal.classList.add('hidden');
    setTimeout(() => {
        location.reload();
    }, 200);
}

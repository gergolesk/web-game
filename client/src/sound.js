// --- SOUND & COIN FX ---
// Play different sounds for coin types

const MUSIC_VOLUME = 0.18;
const FX_VOLUME = 1.0;

export let isMusicOn = true;
export let isSoundOn = true;

// Сделаем экспорт функций для управления состоянием
export function setMusicOn(val) {
    isMusicOn = val;
    updateBackgroundMusic();
}
export function setSoundOn(val) {
    isSoundOn = val;
}

let currentMusic = null;

export function playSound(sound) {
    if (!isSoundOn) return;
    const snd = document.getElementById(sound);
    if (snd) {
        snd.volume = FX_VOLUME;
        snd.currentTime = 0;
        snd.play().catch(() => {});
    }
}

export function playGameMusic() {
    if (!isMusicOn) {
        stopMusic();
        return;
    }
    const gameMusic = document.getElementById('gameSound');
    if (!gameMusic) {
        setTimeout(playGameMusic, 100);
        return;
    }
    if (currentMusic && currentMusic !== gameMusic) {
        currentMusic.pause();
        currentMusic.currentTime = 0;
    }
    gameMusic.volume = MUSIC_VOLUME;
    gameMusic.loop = true;
    gameMusic.play().catch(() => {});
    currentMusic = gameMusic;
}

export function playStandbyMusic() {
    if (!isMusicOn) {
        stopMusic();
        return;
    }
    const standbyMusic = document.getElementById('standbySound');
    if (!standbyMusic) {
        setTimeout(playStandbyMusic, 100);
        return;
    }
    if (currentMusic && currentMusic !== standbyMusic) {
        currentMusic.pause();
        currentMusic.currentTime = 0;
    }
    standbyMusic.volume = MUSIC_VOLUME;
    standbyMusic.loop = true;
    standbyMusic.play().catch(() => {});
    currentMusic = standbyMusic;
}

export function stopMusic() {
    const gameMusic = document.getElementById('gameSound');
    const standbyMusic = document.getElementById('standbySound');
    [gameMusic, standbyMusic].forEach(m => { if (m) { m.pause(); m.currentTime = 0; } });
    currentMusic = null;
}

export function updateBackgroundMusic() {
    if (!isMusicOn) {
        stopMusic();
        return;
    }
    const resultShown = !document.getElementById('resultModal').classList.contains('hidden');
    const startShown = document.getElementById('startModal').style.display === 'flex';
    const waitingShown = !document.getElementById('waitingForHostModal').classList.contains('hidden');
    const startGamePopupShown = !document.getElementById('startGamePopup').classList.contains('hidden');
    const paused = !document.getElementById('pauseOverlay').classList.contains('hidden');
    const howToPlayShown = !document.getElementById('howToPlayModal').classList.contains('hidden');

    if (resultShown || startShown || waitingShown || startGamePopupShown || paused || howToPlayShown) {
        playStandbyMusic();
    } else {
        playGameMusic();
    }
}

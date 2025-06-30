// --- SOUND & COIN FX ---
// Play different sounds for coin types
export function playSound(sound) {
    const snd = document.getElementById(sound);
    if (snd) {
        snd.currentTime = 0;
        snd.play().catch(() => {
        });
    }
}
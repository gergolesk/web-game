// ws.js
import { setGameConfig } from './config.js';

export let ws = null;

export function initWebSocket({ playerId, playerColor, setPlayerName, onState, showStartModal, startCountdownTimer, showGameResults, storeLastPlayers }) {
  ws = new WebSocket('ws://' + window.location.hostname + ':3000');

  ws.onopen = () => ws.send(JSON.stringify({ type: 'can_join' }));

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'offer_start_game') {
      showStartModal(data);
      const popup = document.getElementById('startGamePopup');
      const btn = document.getElementById('startGameBtnByHost');
      if (popup) popup.classList.remove('hidden');
      if (btn) btn.onclick = () => {
        if (popup) popup.classList.add('hidden');
        ws.send(JSON.stringify({ type: 'start_game_by_host' }));
      };
      return;
    }

    if (data.type === 'game_config') {
      setGameConfig(data.config);
      return;
    }

    if (data.type === 'waiting_for_players') {
      showStartModal(data);
      return;
    }

    if (data.type === 'max_players') {
      document.body.innerHTML = '<div style="color:yellow; background:#222; font-size:2em; text-align:center; margin-top:30vh;">There are already 4 players in the game.<br>Please try later</div>';
      ws.close();
      return;
    }

    if (data.type === 'can_join_ok') {
      showStartModal(data);
      return;
    }

    if (data.type === 'ready_to_choose_duration') {
      showStartModal({ isFirstPlayer: true, duration: null });
      return;
    }

    if (data.type === 'state') {
      if (typeof data.gameDuration === 'number' && typeof data.gameStartedAt === 'number') {
        startCountdownTimer(data.gameDuration, data.gameStartedAt);
      }
      onState(data);
      if (storeLastPlayers) storeLastPlayers(data.players);
      return;
    }
  };
}

// ws.js
import { setGameConfig } from './config.js';
import { updatePlayerState } from './player.js';
import { updatePlayersList, updatePlayerDom } from './ui.js';

export let ws = null;

export function initWebSocket(playerId, playerColor, setPlayerName, onState) {
  ws = new WebSocket('ws://' + window.location.hostname + ':3000');

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'can_join' }));
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'game_config') {
      setGameConfig(data.config);
      return;
    }

    if (data.type === 'max_players') {
      document.body.innerHTML = '<div style="color:yellow; background:#222; font-size:2em; text-align:center; margin-top:30vh;">There are already 4 players in the game.<br>Please try later</div>';
      ws.close();
      return;
    }

    if (data.type === 'can_join_ok') {
      const name = prompt('Enter your name:');
      if (!name) {
        ws.close();
        return;
      }
      setPlayerName(name);
      ws.send(JSON.stringify({
        type: 'join',
        id: playerId,
        name: name,
        color: playerColor
      }));
      return;
    }

    if (data.type === 'state') {
      onState(data);
    }
  };
}

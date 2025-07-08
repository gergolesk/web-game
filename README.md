# 🕹️ PACMAN Arena Multiplayer

> A fast-paced browser-based multiplayer game inspired by classic Pac-Man. Players collect coins, avoid debuffs, and compete for the highest score before the timer runs out.

---

## 🔧 Installation

```bash
# Clone the repository
git clone https://gitea.kood.tech/georgolesk/web-game.git
cd web-game

# Install dependencies
npm install

# Start the WebSocket server
node server/server.js
```

Then open the game in your browser:

```
http://localhost:3000
```

> ⚠️ The server hosts only WebSocket. You must serve `index.html` (and other static assets in `/client`) using a static file server, or open `index.html` directly in a browser with CORS disabled (for local testing).

---

To start both the server and the client at the same time, run:

```bash
   npm start
```

## 🎮 Gameplay Features

* ⏱ **Timer-based rounds** – Players race against the clock.
* 🟡 **Coins:**

    * Normal coins: +1 point
    * Bonus coins (🔵): +5 points
    * Negative coins (🔴): apply slow debuff
    * Trap coins (⚫): -3 points
* ⏸️ **Pause/Resume system** – Only the player who pauses can resume.
* 👥 **Multiplayer mode** – Up to 4 players can join.
* 🎨 **Animated Pac-Man avatars** with direction and mouth movement.
* 🎮 **Control support**:

    * Arrow keys / WASD
    * Virtual joystick (touch/mouse drag)
* 🔊 **Sound effects** for different coin types.
* 👀 **Observer mode** – Players joining late can spectate ongoing games.
* 🏆 **Scoreboard and game-over results**.

---

## 📁 Project Structure

```bash
.
├── client/
│   ├── index.html         # Game HTML UI
│   ├── game.js            # Client-side game logic
│   ├── style.css          # Styling
│   ├── sounds/            # Coin/trap sound files
├── server/
│   ├── server.js          # WebSocket game server
│   ├── config.js          # Game field & config values
├── package.json
└── README.md
```

---

## 🧠 How It Works

* **WebSocket-based server** keeps track of all players, coin positions, collisions, and score.
* **Each player** controls a Pac-Man that collects coins by colliding with them.
* When a coin is collected, the server updates the score, coin type effect, and notifies all clients.
* **Pause handling** pauses the timer and movement, accumulates pause time to ensure fairness.
* **Virtual joystick** is available for mobile and desktop users.

---

## ⌨️ Controls

| Action | Control                      |
| ------ | ---------------------------- |
| Move   | Arrow keys / WASD / Joystick |
| Pause  | `Pause` key / Pause button   |
| Resume | Resume button (if pauser)    |
| Exit   | Exit button                  |

---

## 📦 Tech Stack

* **Frontend**: HTML5, CSS, JavaScript
* **Backend**: Node.js with `ws` WebSocket server
* **Data**: In-memory only (no database)

---

## 🔄 Potential Extensions

This project is complete in its current form but can be extended further. Possible directions include:

* Adding power-ups or hazards
* Introducing private rooms or matchmaking
* Connecting to a database for persistent leaderboards
* Enhancing mobile UI/UX

---

## 🧪 Local Static Hosting (optional)

To serve files locally (if browser blocks WebSocket for `file://`):

```bash
npx serve client
```

Then open:

```
http://localhost:5000  # or 8000 depending on your tool
```

---

## 📸 Screenshots *(optional)*

*Add gameplay screenshots or demo GIFs here.*

---

## 📝 License

MIT License — free for educational and non-commercial use.

---

## 👤 Author

Built by **\[Georg, Kaido, Pavlo]**. Contributions welcome! 🎉
# GIG: Game of Inevitable Grind

A Jackbox-style multiplayer party game. Host plays on a big screen; players join on their phones. No install required for players — just a browser.

---

## Setup (4 steps)

### 1. Install dependencies

```bash
npm install
```

### 2. Start the server

```bash
npm start
```

Server runs at `http://localhost:3000`.

For development with auto-reload:

```bash
npm run dev
```

### 3. Expose server to the internet (for players on other devices)

Download and install [ngrok](https://ngrok.com/download), then:

```bash
ngrok http 3000
```

Copy the `https://xxxx.ngrok.io` URL from the ngrok output.

### 4. Open the game

| Screen | URL |
|--------|-----|
| **Host** (big screen / laptop) | `http://localhost:3000/host.html` |
| **Players** (phones / other devices) | `https://xxxx.ngrok.io/player.html` |

Replace `xxxx.ngrok.io` with your actual ngrok URL.

---

## Development

```bash
npm test              # run unit tests
npm test -- --coverage  # with coverage report
```

---

## Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js 20.x LTS |
| Web server | Express 4.18.x |
| Real-time | Socket.io 4.7.x |
| Language | TypeScript 5.x |
| Client | Vanilla JavaScript (no build step) |
| Testing | Jest 29.x + ts-jest |

---

## Architecture

- **Server-authoritative state** — all game mutations happen server-side only
- **In-memory only** — no database; game state lives in process memory; ephemeral sessions
- **Per-room isolation** — Socket.io rooms prevent data leaks between games
- **Full-state-sync** — clients receive complete state on join and every 30 seconds
- **Heartbeat** — server sends ping every 30s; zombie sockets disconnected after 60s of silence

---

*Built with Node.js + Socket.io + TypeScript. Local + ngrok is the distribution model.*

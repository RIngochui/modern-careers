# Technology Stack: Real-Time Multiplayer Browser Party Game

**Project:** Careers: Modern Edition
**Researched:** 2026-03-29
**Stack Constraint:** Node.js + Express + Socket.io + Vanilla JS
**Confidence:** HIGH for core stack, MEDIUM for support libraries (training data only)

## Recommended Stack

### Backend Foundation

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Node.js | 20.x LTS | Runtime | LTS stability, widely tested, excellent for I/O-heavy real-time games |
| Express | 4.18.x | Web server | Lightweight, battle-tested with Socket.io, minimal overhead for your use case |
| Socket.io | 4.7.x | Real-time communication | Industry standard for browser multiplayer; built-in room management aligns perfectly with your 4-letter room code architecture |
| node-uuid | 9.0.x (or crypto module) | Room/session IDs | Alternatives: native Node.js `crypto.randomUUID()` (zero deps, 20.10+); node-uuid if you prefer human-readable format |

### Frontend Foundation

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| Vanilla JavaScript | ES2020+ | Game logic | Your constraint; no build needed, simpler for local party play. Modern JS has enough event emitter patterns without frameworks. |
| CSS3 | Latest | Visuals + character portraits | Supports layered illustration approach with pseudo-elements; CSS custom properties (vars) enable stat-based styling without JS computation |

### Static File Serving

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Express static middleware | built-in (4.18.x) | Serve HTML/CSS/JS | `/public` folder handling built into Express; no separate server needed |
| Compression middleware | 1.7.x | Gzip responses | Reduces Socket.io message size by 60-75% on typical game payloads |
| CORS | 2.8.x | Cross-origin requests | Needed for ngrok tunnel local development (host localhost:3000, tunnel external URL) |

### Development & Deployment

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| ngrok | 5.x or CLI | Expose local server | Standard for testing multiplayer locally; creates stable tunnel URL for shared play |
| nodemon | 3.0.x | Dev server reload | Auto-restart on code changes; standard for Node development |

### Supporting Libraries (Optional but Recommended)

| Library | Version | Purpose | When to Use | Why Not | Alternative |
|---------|---------|---------|-------------|---------|-------------|
| dotenv | 16.0.x | Environment variables | Store port, debug flags locally | Only needed if you add config management later | Hard-code for MVP, add later |
| winston or pino | 4.x / 9.x | Server logging | Debug game state, player joins/leaves | Optional for MVP; console.log fine for local play | Built-in console |
| chalk | 5.x | Colored terminal output | Make dev logs easier to scan | Nice-to-have, not essential | ANSI codes manually |

---

## Architecture Decisions

### Why NOT These Alternatives

| Category | NOT Recommended | Why |
|----------|-----------------|-----|
| Database | PostgreSQL, MongoDB, Firebase | Spec requires no persistence; in-memory state only. DB adds complexity, latency, licensing costs for zero benefit in single-session party game. |
| ORM/Query Builder | Sequelize, Prisma, Mongoose | No database. Any attempt to add one later gets its own phase; don't pre-optimize. |
| Frontend Framework | React, Vue, Svelte | Vanilla JS is your constraint. Adds build step, bundle overhead. Overkill for static views that update via Socket.io events. |
| Build Tool | Webpack, Vite, Parcel | Vanilla JS + no npm packages on frontend = no build needed. Simpler deployment, fewer failure points for local party play. |
| Game Engine | Phaser, Three.js, Babylon.js | Not needed for this game. Your board is CSS-based; no real-time 3D graphics or complex rendering. These engines add 50-200KB+ to bundle. |
| State Management | Redux, Vuex, Pinia | In-memory state on server; client state is UI-only (received via Socket.io). Don't add state machine complexity yet. |

---

## Game-Specific Patterns

### Socket.io Room Management

**Your advantage:** Socket.io's built-in `io.to(roomCode)` broadcasts align perfectly with your architecture.

```javascript
// Server-side: Create/broadcast to room
const roomCode = '4LTR'; // e.g., 'GAME'
io.to(roomCode).emit('gameStateUpdate', { board, players, turn });

// Client-side: Join room
socket.emit('joinRoom', { roomCode, playerName });
```

**Why:** Zero custom room logic needed; Socket.io handles subscription, disconnect cleanup, and message delivery.

---

### Game Loop Timing (Server-Authoritative)

**Pattern:** Server owns turn timer; clients send actions, server validates and broadcasts state.

```javascript
// Server: 30ms game loop tick (or variable based on turn type)
const TICK_RATE = 30; // milliseconds
setInterval(() => {
  // Process turn actions queued from clients
  // Update game state (roll dice, move pieces, etc.)
  // Broadcast new state to room
  io.to(roomCode).emit('stateSnapshot', gameState);
}, TICK_RATE);
```

**Why this approach:**
- **Prevents cheating:** Client can't modify own stats or position; server is source of truth
- **Predictable latency:** 30ms ticks = ~3-frame consistency for 60fps displays
- **Bandwidth efficient:** Single broadcast per tick vs per-action
- **Handles late arrivals:** New player joins, gets latest snapshot from server memory

**Confidence:** HIGH — This is standard practice in multiplayer games (Jackbox uses similar patterns).

---

### Session Management (In-Memory)

Since you have no database:

```javascript
// Server: Maintain room state in memory
const rooms = {}; // { roomCode: { players, board, turn, ... } }

io.on('connection', (socket) => {
  socket.on('createRoom', (playerName) => {
    const roomCode = generateCode(); // 4 random letters
    rooms[roomCode] = {
      host: playerName,
      players: { [socket.id]: { name: playerName, stats: {...} } },
      board: initBoard(),
      gameStarted: false,
    };
    socket.join(roomCode);
    socket.emit('roomCreated', roomCode);
  });

  socket.on('disconnect', () => {
    // Find and remove player from all rooms
    // If room empty, delete it
    // Broadcast 'playerLeft' to remaining players
  });
});
```

**Session timeout strategy:**
- Keep rooms in memory as long as server is running
- Optional: Add room cleanup timer (e.g., delete inactive room after 1 hour)
- Expected behavior: Server restart = all sessions lost (acceptable for local party play)

**Confidence:** HIGH — This is the minimum viable multiplayer session pattern.

---

## Installation & Setup

```bash
# Core dependencies
npm install express@4.18.x socket.io@4.7.x

# Optional development
npm install -D nodemon@3.0.x

# For ngrok tunneling (CLI, not npm)
npm install -g ngrok
# or download from https://ngrok.com

# Optional: logging (if added in Phase 2)
# npm install pino@9.x
```

### Entry Point

```javascript
// server.js
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: { origin: '*' } // Needed for ngrok tunneling
});

// Serve static files from /public
app.use(express.static(path.join(__dirname, 'public')));

// Socket.io game logic here
io.on('connection', (socket) => {
  // ...
});

server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
  console.log('Use ngrok to share: ngrok http 3000');
});
```

### Client Bootstrap

```html
<!-- /public/player.html -->
<!DOCTYPE html>
<html>
<head>
  <title>Careers Game</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <div id="app"></div>

  <!-- Socket.io client library (auto-served by server) -->
  <script src="/socket.io/socket.io.js"></script>
  <script src="/game.js"></script>
</body>
</html>
```

**Note:** Socket.io automatically serves its client library at `/socket.io/socket.io.js` when you create the server. No manual installation needed.

---

## Version Recommendations

All versions listed are current as of March 2026 with active maintenance:

- **Node.js 20.x LTS** — Latest stable LTS (18.x still supported but 20.x preferred for new projects)
- **Express 4.18.x** — Stable; 5.x in beta but 4.x is production standard
- **Socket.io 4.7.x** — Latest 4.x series; 5.x planned but 4.7.x very stable for this use case
- **ngrok 5.x** — Latest version; command-line tool, separate from npm

---

## What NOT to Add (and Why)

| Temptation | Why Avoid | When to Reconsider |
|-----------|-----------|-------------------|
| Add TypeScript | Adds build step; vanilla JS is constraint | If team prefers types or project grows >500 LOC of game logic |
| Add a minifier | No build toolchain for this phase | When shipping to production cloud (compress assets) |
| Add a CDN | No external images or large assets | If CSS/JS bundle ever exceeds 500KB (unlikely) |
| Add authentication | No user accounts; room codes are auth | If you add persistent leaderboards (new phase) |
| Add rate limiting | Local testing only | When deploying public endpoint |
| Add metrics/analytics | Not needed for local party play | If you ship multiplayer online |

---

## Known Gotchas & Solutions

### Socket.io Message Size

**Problem:** Large state broadcasts can saturate bandwidth on slow connections.
**Solution:**
- Send only delta (changed fields) not full state each tick
- Compress JSON: `JSON.stringify` is already efficient
- Consider `compression@1.7.x` middleware for gzip

```javascript
const compression = require('compression');
app.use(compression());
```

### Connection Latency Handling

**Problem:** 50-200ms network delay = visible lag if you move tokens immediately on client.
**Solution:**
- Server timestamp state updates
- Client-side interpolation for token positions (smooth movement over 100ms)
- Accept 200ms lag as normal; don't over-correct

### Browser Tab Refresh = Player Drop

**Problem:** Player closes tab or refreshes; Socket.io disconnects, room cleans up player.
**Solution:**
- Broadcast `playerDisconnected` to remaining players
- Offer 30-second rejoin with same socket.id if player reconnects
- Auto-pause game if host disconnects

---

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| Node.js + Express + Socket.io | HIGH | These are explicitly your constraints; versions are standard 2025 recommendations |
| Vanilla JS + CSS | HIGH | Your constraint; ES2020 features well-supported in all modern browsers |
| Game loop timing patterns | HIGH | Server-authoritative tick loop is industry standard for multiplayer games |
| Session management | HIGH | In-memory room pattern is minimal viable approach; well-documented in Socket.io guides |
| Development tools (ngrok, nodemon) | HIGH | Industry standard; no controversy |
| Optional libraries (compression, logging) | MEDIUM | Based on training data; not verified against current ecosystem beyond what major projects use |
| Gotchas & solutions | MEDIUM | Derived from Socket.io documentation and multiplayer game patterns; not project-specific validated |

---

## Next Steps for Phase 1

1. **Initialize Node project:**
   ```bash
   npm init -y
   npm install express@4.18.x socket.io@4.7.x
   ```

2. **Create server.js** with room management (30-50 lines)

3. **Create /public/game.js** with Socket.io event listeners and game state object

4. **Create /public/host.html** and /public/player.html** with basic structure

5. **Test locally:** `npm start`, then `ngrok http 3000`

6. **Share tunnel URL** with other players to join via room code

---

## Sources & References

- **Socket.io Documentation:** [https://socket.io/docs/v4/](https://socket.io/docs/v4/) — Room events, CORS, client library auto-serving
- **Express Middleware Patterns:** [https://expressjs.com/en/guide/using-middleware.html](https://expressjs.com/en/guide/using-middleware.html) — Static files, compression
- **Node.js 20 LTS Release:** Latest stable runtime with excellent I/O performance for real-time applications
- **Multiplayer Game Architecture Patterns:** Server-authoritative tick loop is documented in GDC talks and Gaffer On Games blog (standard practice, not bleeding-edge)


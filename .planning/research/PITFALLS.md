# Domain Pitfalls: Socket.io Multiplayer Party Games

**Domain:** Jackbox-style real-time multiplayer browser party games
**Stack:** Node.js + Express + Socket.io + Vanilla JS
**Researched:** 2026-03-29
**Confidence:** HIGH (based on Socket.io architecture, distributed systems patterns, and party game UX requirements)

---

## Critical Pitfalls

These mistakes cause rewrites, state corruption, or unplayable games.

### Pitfall 1: Stale Client State After Reconnection

**What goes wrong:**
A player's connection drops for 2-3 seconds (WiFi blip, mobile background/foreground). Socket.io reconnects automatically, but the client has missed 3-5 socket events. The player's UI shows outdated board positions, stats, or turn state. They submit an action based on stale data (e.g., attempt to roll when it's not their turn, or miss that a mini game already started).

**Why it happens:**
Socket.io's `disconnect` → `reconnect` cycle doesn't automatically replay missed events. Developers assume "reconnect = resume normally" without implementing a state handshake. The server sends new events after reconnect, but the client's in-memory state object is already out of sync.

**Consequences:**
- Player sees contradictory information (board moved but their token didn't)
- Invalid turn actions accepted or rejected mysteriously
- Mini game participants list disagrees between host and player
- Trust in game fairness eroded (players think they got cheated)

**Prevention:**
1. **Server-side:** On reconnection, send a `full-state-sync` event containing:
   - Current board positions for all players
   - Current turn player + turn phase
   - Active mini game state (if any)
   - Each player's current stats (Money, Fame, Happiness)
   - Career/College path status per player

2. **Client-side:**
   - When `reconnect` fires, request full state before processing further events
   - Queue any player actions until state sync completes
   - Clear local state, replace with server state wholesale (don't merge)

3. **Debouncing:** Track socket `disconnect` → `reconnect` time; if > 10 seconds, assume session lost and prompt rejoin

4. **Version stamps:** Tag each state with a version number; only apply incoming events if version matches expected

**Detection:**
- Player reports "my board didn't move but everyone else's did"
- Invalid action errors (turn validation fails despite UI saying it's their turn)
- Discrepancies between host screen and player screen visible during play
- Logs show socket disconnect/reconnect without full-state-sync following

**Phase:** Address in **Phase 1 (Core Multiplayer)** — this is foundational. No game progression without it.

---

### Pitfall 2: Race Conditions in Turn-Based Logic

**What goes wrong:**
Two players submit turn actions (e.g., roll dice) nearly simultaneously. The server processes both before recognizing the first was invalid. Or: a player rolls, the server broadcasts "move token," but before the token lands, another player (hosting mini game) broadcasts a mini game event. The turn state and mini game state collide.

Example:
- Player A is mid-turn (just rolled, moving token)
- Player B calls a mini game (their character triggered a tile)
- Both events land at server ~0ms apart
- Server processes mini game before player A's token movement fully resolves
- Board state shows Player B's mini game active but Player A's token still mid-roll

**Why it happens:**
JavaScript is single-threaded, but Socket.io events don't queue atomically with game logic. If turn logic isn't wrapped in a transaction-like pattern, interleaved events corrupt the turn state machine. Developers assume "socket events process in order" — they do, but state machine transitions aren't atomic.

**Consequences:**
- Invalid game states (two "current turns" active)
- Mini game fires before player finishes landing on tile
- Player lands on tile, mini game resolves, then *another* event tries to process the same tile
- Turn order broken (same player goes twice, or player skipped)
- Undo/recovery impossible without full server restart

**Prevention:**
1. **Turn state machine:** Explicitly define turn phases:
   - `WAITING_FOR_ROLL` (player can roll)
   - `MID_ROLL` (token moving, no new actions allowed)
   - `LANDED` (token landed, tile effect triggering)
   - `TILE_RESOLVING` (mini game or special tile in progress, movement locked)
   - `WAITING_FOR_NEXT_TURN` (turn complete, awaiting next player)

2. **Action guards:** Check phase before processing any event:
   ```javascript
   socket.on('roll-dice', () => {
     if (game.currentTurnPhase !== 'WAITING_FOR_ROLL') return; // Ignore
     if (game.currentPlayer !== socket.playerId) return; // Ignore

     // Safe to process
     game.currentTurnPhase = 'MID_ROLL';
     // ... rest of logic
   });
   ```

3. **Atomic operations:** Use a request/response pattern for critical actions (not fire-and-forget):
   - Client: `socket.emit('roll-dice', {}, (error, result) => {})`
   - Server validates, responds with `callback(error)` or `callback(null, newState)`
   - Client only updates UI if callback confirms success

4. **Idempotency tokens:** Tag each action with UUID; if server sees duplicate token, ignore second attempt

5. **No nested tile effects:** If landing on a tile triggers a mini game, don't allow stacking. Complete tile effect before accepting next action.

**Detection:**
- "Turn order got stuck / same player went twice"
- Mini game launched while player was still moving
- Logs show overlapping turn phases
- State snapshots show multiple `currentPlayer` values in one turn

**Phase:** **Phase 1 (Core Multiplayer)** — implement turn state machine immediately. Critical before any mini game or tile logic.

---

### Pitfall 3: Memory Leaks from Persistent Room State

**What goes wrong:**
A room is created. Players join and play. They disconnect or game ends. The room object in memory is never fully cleaned up — socket event listeners remain bound, player objects stay in the `game.players` array, intervals/timers keep running. After 20-30 games on a 4GB Node server, memory usage creeps to 100% and the server crashes or becomes unresponsive.

**Why it happens:**
In-memory state is fast and simple, so there's no database. But without explicit cleanup, rooms become "zombie" objects. Common mistakes:
- Interval timers (for turn countdown) never `clearInterval()`
- Socket listeners with closure references keep room object alive
- No room deletion when game ends or host disconnects
- Player objects in arrays never splice'd out

**Consequences:**
- Server crashes after running all day (fatal for party game nights)
- Severe slowdown after several games
- Memory profiler shows thousands of "detached DOM nodes" equivalent for rooms
- Players lose connection because server is unresponsive

**Prevention:**
1. **Explicit room cleanup on game end:**
   ```javascript
   function endGame(roomCode) {
     const room = rooms[roomCode];

     // Clear timers
     if (room.turnTimer) clearInterval(room.turnTimer);
     if (room.miniGameTimer) clearInterval(room.miniGameTimer);

     // Unbind socket listeners (critical)
     room.sockets.forEach(socket => {
       socket.removeAllListeners();
       socket.leave(roomCode);
     });

     // Clear arrays
     room.players = [];
     room.sockets = [];

     // Delete room
     delete rooms[roomCode];
   }
   ```

2. **On player disconnect:**
   - If host disconnects: end game, cleanup room
   - If regular player disconnects: remove from `room.players` array, remove from socket registry
   - After 5+ minutes of all players disconnected: auto-cleanup room

3. **Room limits:**
   - Max concurrent rooms: 100 (adjust based on memory)
   - Auto-delete room 30 minutes after last player left
   - Monitor `Object.keys(rooms).length` in logs

4. **Weak references where possible:** Use `WeakMap` for room → socket mappings so disconnected sockets are garbage-collected

5. **Audit on server startup:** Log active rooms and timers every hour

**Detection:**
- `node --inspect` memory profiler shows heap growing with each game
- Server response time slows after 10+ games
- `setInterval`/`setTimeout` count in Node debugger keeps growing
- Logs show "max listeners exceeded" warnings

**Phase:** **Phase 1 (Core Multiplayer)** — build cleanup into socket disconnect handlers from day one.

---

### Pitfall 4: CSS Character Portrait Performance Degradation

**What goes wrong:**
Character portraits are layered CSS (based on stats: outfit tier, face tier, aura tier + life event overlays). Every time a stat updates, the server broadcasts a socket event, the client adds/removes CSS classes. With 6 players, each with 10+ layered divs, and stats updating every 2-3 seconds (from mini games, board tiles, drains), the browser's reflow engine goes into overdrive. After 5 minutes, the host screen (which renders all 6 portraits) becomes sluggish, animations lag, input feels delayed.

**Why it happens:**
CSS class toggling triggers browser reflows. Each reflow is expensive with deeply nested elements. Developers don't batch DOM updates — they toggle classes immediately on socket events. 6 players × 3 stat types × frequent updates = dozens of reflows per second.

**Consequences:**
- Host screen (the big-screen experience) becomes janky and unresponsive
- Turn timers appear to freeze or jump
- Touch input on player phones lags (secondary effect)
- User experience becomes frustrating for the group

**Prevention:**
1. **Batch DOM updates:** Group all portrait changes into one reflow cycle:
   ```javascript
   socket.on('stats-updated', (players) => {
     // Collect all class changes
     const updates = [];
     players.forEach(p => {
       updates.push({id: p.id, classes: p.portraitClasses});
     });

     // Apply all at once (one reflow)
     requestAnimationFrame(() => {
       updates.forEach(({id, classes}) => {
         const portrait = document.getElementById(`portrait-${id}`);
         portrait.className = classes.join(' '); // Bulk replace
       });
     });
   });
   ```

2. **Throttle stat broadcasts:** Server shouldn't send portrait updates more than 1/sec, even if multiple tiles/mini games fire. Queue stat changes, emit once per 100ms.

3. **Use CSS animations instead of JavaScript updates:** Pre-define stat tiers in CSS; change data attributes, not classes:
   ```css
   [data-wealth="rich"] .portrait { /* pre-rendered */ }
   ```

4. **Lazy render:** Only render portraits for players visible on-screen (if host screen scrolls or shows only active players)

5. **Measure and profile:** Use DevTools frame rate monitor; aim for 60 FPS. If drops below 50 FPS, reduce update frequency.

**Detection:**
- Host screen FPS drops below 50 after 5 minutes of gameplay
- DevTools Timeline shows long reflow tasks (>16ms)
- Class list on portrait elements grows without cleanup
- Player reports: "host screen got slow halfway through the game"

**Phase:** **Phase 2 (Game Loop & Stats)** — implement before mini games and frequent stat updates. Critical for UX.

---

### Pitfall 5: Mini Game Timing Unfairness / Race Condition

**What goes wrong:**
A mini game (e.g., Reaction Speed) starts. The server broadcasts `mini-game-start` with a timestamp. Due to network jitter, Player A receives it 20ms later than Player B. Player B's JavaScript starts the timer first, presses react first, and wins — not because they're faster, but because they got the event first. Over many games, network timing differences systematically advantage certain players.

Worse: if a mini game's timer runs only on the client, one player's slow browser makes their timer go slower, giving them more reaction time.

**Why it happens:**
Developers run mini game timers on the client (convenience), or broadcast start without accounting for network jitter. No server-side authoritative timer.

**Consequences:**
- Players on high-latency networks systematically lose
- Unfairness erodes trust in game
- Players blame "lag" even though it's design
- Competitive mini games (Trivia, Reaction Speed, Bluffing) become unfair

**Prevention:**
1. **Server-side authoritative timer:** Mini game runs on server, server is source of truth for timing:
   ```javascript
   socket.on('start-mini-game', (type) => {
     const startTime = Date.now();
     const durationMs = 5000;

     io.to(roomCode).emit('mini-game-start', {
       type,
       serverTime: startTime,  // Client uses this to sync
       durationMs
     });

     // Server maintains timer
     setTimeout(() => {
       io.to(roomCode).emit('mini-game-end', {results});
     }, durationMs);
   });
   ```

2. **Client uses server time as reference:** Don't start your own timer; calculate remaining time based on server timestamp:
   ```javascript
   const localClockOffset = serverTime - Date.now();
   function timeRemaining() {
     return durationMs - (Date.now() + localClockOffset - startTime);
   }
   ```

3. **Accept responses only within time window:** If client sends response, server validates `timestamp < startTime + durationMs + 100ms`. Reject late responses server-side.

4. **Compensate for network latency:** Add 50-100ms buffer to account for RTT, but don't broadcast this to players (keep it invisible).

**Detection:**
- Player on 4G connection consistently loses Reaction Speed mini games
- Player on WiFi consistently wins
- Mini game timer on one device clearly finishes before another (visible on host screen)
- Logs show response timestamps clustered at end of timer (client-side timer race)

**Phase:** **Phase 3 (Mini Games)** — critical before shipping Reaction Speed or time-sensitive games. Must be implemented when mini game logic goes in.

---

### Pitfall 6: State Desynchronization from Invalid Board Position

**What goes wrong:**
A player lands on a tile. The tile has complex logic (e.g., "Get Married" reduces future income by $2k/turn, "Investment Pool" adds to shared jackpot). The server calculates the new state. But due to a socket event being lost (rare) or a code bug (common), the client doesn't receive the update. The player's local state shows them on the old tile. They attempt to interact (e.g., click to see their new stats), and the UI shows stale data. Or: the next player's turn processes based on a different board state than the host screen shows.

**Why it happens:**
- Event delivery isn't guaranteed in HTTP-layer protocols (though Socket.io retries)
- No reconciliation mechanism if server state drifts from client state
- Clients don't validate received state against their own

**Consequences:**
- Player's UI contradicts host screen (creates confusion)
- Stat calculations wrong (e.g., marriage drain calculated twice, or not at all)
- Turn order broken if next player's state depends on previous player's board position
- Impossible to debug (developer can't see discrepancy from single socket log)

**Prevention:**
1. **Periodic full-state broadcast:** Every 30 seconds, server sends full game state to all players:
   ```javascript
   setInterval(() => {
     io.to(roomCode).emit('full-state-sync', {
       boardPositions: game.players.map(p => ({id: p.id, position: p.boardPos})),
       stats: game.players.map(p => ({id: p.id, money: p.money, fame: p.fame, happiness: p.happiness})),
       timestamp: Date.now()
     });
   }, 30000);
   ```

2. **Client-side validation:** On state update, check if new state is plausible (e.g., player can't be at position 150 when board only has 100 tiles):
   ```javascript
   socket.on('player-moved', (data) => {
     if (data.position < 0 || data.position > BOARD_SIZE) {
       console.warn('Invalid position received, requesting full sync');
       socket.emit('request-state-sync');
       return;
     }
     // Apply update
   });
   ```

3. **Checksums:** Optionally, server sends hash of state; client compares, and requests resync if hash mismatches

4. **Version numbers:** Tag each state broadcast with version; client only applies updates if version is sequential

**Detection:**
- Player reports: "my position on host screen is different from my screen"
- Stats mismatch (player sees $50k, host screen shows $30k)
- Logs show consecutive events that don't reconcile (tile effect applied twice)
- Host screen shows all players in valid positions, but one player screen shows old position

**Phase:** **Phase 1 (Core Multiplayer)** — implement periodic sync as foundation.

---

## Moderate Pitfalls

### Pitfall 7: Disconnection During Critical State Transition

**What goes wrong:**
A player's WiFi cuts out during the Final Round announcement (the most dramatic moment). They reconnect, but see the game already ended. No way to rejoin. Or: during a mini game, a player disconnects; the mini game finishes without them; they rejoin and have no record they participated.

**Why it happens:**
No player re-join logic for mid-game disconnections. Game state assumes all players present continuously.

**Prevention:**
1. **Rejoin window:** Allow player to rejoin for up to 10 minutes after disconnect
2. **Mark players as "absent":** Don't remove them from game; mark status as DISCONNECTED
3. **On reconnect:** Re-add to game, catch up with events, re-enable input
4. **Timeout absent players:** If absent > 10 min, remove them from game
5. **Announce rejoin:** Broadcast "Player A reconnected" to other players

**Phase:** **Phase 2 (Game Loop & Stats)** — after core multiplayer working.

---

### Pitfall 8: No Rate Limiting on Socket Events

**What goes wrong:**
A malicious (or buggy) client sends 100 roll requests per second. The server processes all, creating invalid game states. Or: a player's script hammers the mini game answer submission, flooding the server.

**Why it happens:**
Developers assume "only well-behaved clients"; don't add input validation or rate limiting.

**Prevention:**
1. **Per-player rate limits:** Max N events per second per player
2. **Event type limits:** Roll, move, answer mini game — each has max frequency
3. **Server-side validation:** Check timestamp of event vs. last event; drop if too fast
4. **Feedback to client:** Ignore but don't error (don't let attacker know they're being rate-limited)

**Phase:** **Phase 1 (Core Multiplayer)**.

---

### Pitfall 9: CSS Character Portrait Over-Rendering

**What goes wrong:**
Each character portrait is re-rendered (all divs re-created) when a stat changes, instead of updating classes. With 6 players and frequent updates, this wastes CPU and battery on player phones.

**Prevention:**
1. **Never recreate; only mutate:** Use `classList.add()` / `classList.remove()` not `innerHTML = `
2. **Pre-create all portrait DOM:** Build DOM once at game start, toggle classes only
3. **Measure battery impact:** Test on real mobile devices for power consumption

**Phase:** **Phase 2 (Game Loop & Stats)**.

---

### Pitfall 10: No Mini Game Rotation State Persistence

**What goes wrong:**
Mini games are supposed to rotate with "no repeats until reshuffle" (per spec). But if the deck state isn't persisted correctly, the same mini game can fire twice in a row. Or: deck state is stored on client, a player cheats by changing it locally.

**Prevention:**
1. **Deck state on server, not client:** Server maintains shuffle order, sends current game type only
2. **Immutable deck:** Don't let clients request specific games
3. **Reshuffle logic:** When deck empty, reshuffle and broadcast new order

**Phase:** **Phase 3 (Mini Games)**.

---

## Minor Pitfalls

### Pitfall 11: No Feedback on Action Accepted/Rejected

**What goes wrong:**
Player clicks "Roll" button. No feedback. They don't know if it worked or if network was slow. They click again. Two rolls fire.

**Prevention:**
1. **Disable UI while awaiting response:** Disable "Roll" button until server confirms
2. **Timeout:** If no response in 3 seconds, show "Network error, try again"
3. **Use acknowledgment callbacks:** `socket.emit('roll', {}, (error) => {...})`

**Phase:** **Phase 2 (Game Loop & Stats)**.

---

### Pitfall 12: Hardcoded Room Limits or No Validation

**What goes wrong:**
Code assumes max 4 players, but someone sets a game with 8. Character portraits overlap, mini games break (voting doesn't make sense with 8 players), memory usage explodes.

**Prevention:**
1. **Validate room capacity:** Max 6 players (or whatever you decide)
2. **Reject join if full:** Return error to client
3. **Config constant:** Easy to change limits later

**Phase:** **Phase 1 (Core Multiplayer)**.

---

### Pitfall 13: No Heartbeat / Zombie Socket Detection

**What goes wrong:**
A socket connects but the player abandons the browser tab. Socket never explicitly disconnects (browser has the tab in background). The server thinks they're still in the game. After 2 hours, thousands of zombie sockets accumulate.

**Prevention:**
1. **Heartbeat:** Server sends ping every 30 seconds; client responds with pong
2. **Timeout:** If no pong after 60 seconds, disconnect socket
3. **Browser focus detection:** On client, send heartbeat only if window is focused

**Phase:** **Phase 1 (Core Multiplayer)**.

---

## Phase-Specific Pitfall Mapping

| Phase Topic | Likely Pitfall | Severity | Mitigation |
|---|---|---|---|
| **Phase 1: Core Multiplayer** | Stale client state after reconnect | CRITICAL | Full-state-sync on reconnect + version stamps |
| **Phase 1: Core Multiplayer** | Memory leaks from persistent rooms | CRITICAL | Explicit cleanup on disconnect/game end |
| **Phase 1: Core Multiplayer** | Turn state machine not atomic | CRITICAL | Guard phase transitions, use request/response pattern |
| **Phase 1: Core Multiplayer** | No heartbeat detection | MODERATE | Ping/pong every 30s, timeout after 60s |
| **Phase 1: Core Multiplayer** | No rate limiting | MODERATE | Max N events/sec per player type |
| **Phase 2: Game Loop & Stats** | CSS portrait reflow performance | CRITICAL | Batch DOM updates, throttle broadcasts |
| **Phase 2: Game Loop & Stats** | State desync from missed events | CRITICAL | Periodic full-state broadcast every 30s |
| **Phase 2: Game Loop & Stats** | Player disconnect during critical state | MODERATE | Rejoin window, mark absent players, catch-up |
| **Phase 2: Game Loop & Stats** | No UI feedback on action | MODERATE | Disable buttons, timeout, callbacks |
| **Phase 3: Mini Games** | Reaction Speed timing unfairness | CRITICAL | Server-side authoritative timer, sync to client |
| **Phase 3: Mini Games** | Mini game deck state cheating | MODERATE | Server-side deck, immutable from client |
| **Phase 3: Mini Games** | Mini game rotation breaks (repeats) | MINOR | Deck state on server, reshuffle logic |

---

## Prevention Checklist for Developers

**Before Phase 1 ships:**
- [ ] Turn state machine defined with explicit phases
- [ ] Full-state-sync on socket reconnect
- [ ] Room cleanup on game end / host disconnect
- [ ] All socket event handlers use callbacks (not fire-and-forget)
- [ ] Heartbeat/ping-pong implemented
- [ ] Rate limiting per player per event type

**Before Phase 2 ships:**
- [ ] Periodic full-state broadcast (every 30s)
- [ ] DOM updates batched with `requestAnimationFrame`
- [ ] Stat broadcasts throttled to max 1/sec
- [ ] All buttons disabled during async operations
- [ ] Player reconnect logic with 10-minute rejoin window

**Before Phase 3 ships:**
- [ ] Mini game timer server-authoritative
- [ ] Client syncs to server timestamp, not local timer
- [ ] Response validation server-side (timestamp must be within timer window)
- [ ] Mini game deck state stored server-side, immutable from client
- [ ] Rotation logic prevents repeat until reshuffle

---

## Sources

Based on:
- Socket.io documentation (event delivery guarantees, reconnection behavior)
- Real-time multiplayer architecture patterns (state machines, idempotency)
- Browser rendering performance (reflow optimization, DOM batching)
- In-memory database pitfalls (cleanup, memory management)
- Party game UX patterns (fairness, network resilience)
- Distributed systems principles (eventual consistency, state reconciliation)

This analysis is informed by common patterns in Jackbox Games, Skribbl.io, and similar browser-based multiplayer games, adapted for the Careers party game architecture.

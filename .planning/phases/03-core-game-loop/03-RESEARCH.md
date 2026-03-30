# Phase 3: Core Game Loop - Research

**Researched:** 2026-03-30
**Domain:** Turn-based multiplayer game loop with state machine transitions, server-authoritative dice rolling, token movement, tile dispatch routing, and ongoing financial drains
**Confidence:** HIGH

## Summary

Phase 3 implements the core game loop mechanics: players take turns rolling dice, moving tokens around a 40-tile board, landing on tiles that route through a dispatch system, and having ongoing drains (marriage, kids, student loans) applied automatically at turn start. The turn state machine is already scaffolded in `server.ts` (`TURN_PHASES` with 5 states); Phase 3 wires up the transitions and handlers.

Key architectural decisions from CONTEXT.md lock the design:
1. **Server-authoritative rolling** — server rolls 2d6 on main board, broadcasts movement, client animates independently
2. **Full tile dispatch router** — switch statement with stubs for all tile types
3. **Turn state machine** — atomic transitions prevent double-rolls and race conditions
4. **Drain deduction at turn start** — before player can roll, drains apply automatically
5. **Experience cards as alternative to rolling** — optional; played during `WAITING_FOR_ROLL` to replace dice with fixed movement (1-6 spaces)

**Primary recommendation:** Wire up the 5 turn-state transitions first, implement 2d6 roll-to-move, then build the tile dispatch router with type-agnostic stubs, then implement drain logic at turn start. Client animation is purely visual — server never waits for it.

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **40-tile board:** 10 career entrances + 10 opportunity tiles + 4 corners + 2 housing + 14 TBD = 40 total
- **Full tile dispatch router:** All tile types routed through switch with stubs for Phase 4–8 implementation
- **Server-authoritative roll:** Server rolls, broadcasts move-token event, client animates independently (server doesn't wait)
- **Turn state machine exists:** TURN_PHASES already defined; Phase 3 implements transitions
- **Ongoing drains at turn start:** Marriage (-$2k), kids (-$1k each), student loans (-$1k) deducted before roll
- **Experience cards:** 1-6 valued cards, played instead of rolling, gained on career path completion (not college)
- **Host board circular track:** Colored player dots on looping 40-tile board; turn history sidebar; current player highlighted
- **Opportunity tiles:** One per career (10 total), positioned after career exit, grant Opportunity card for free jump to that career entrance

### Claude's Discretion
- Exact pixel layout of circular board (CSS flex/grid approach)
- Whether tiles are labeled with abbreviations or icons
- Drain floor behavior edge cases (e.g., player with $0 already)

### Deferred Ideas (OUT OF SCOPE)
- 14 remaining board tiles — economic, life events, luck/hazard, etc. (finalized in future phases)
- Corner tile effects (Payday, Park Bench, Hospital) — to be defined in relevant future phases
- Experience card deck composition (distribution per career, random vs. fixed) — TBD in Phase 7
- Cop bond mechanic (prison bond payments route to Cops) — deferred to Phase 6
- Opportunity card details (exact set per career, waive requirements, deck size) — deferred to Phase 7

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LOOP-01 | Turn order determined at game start and shown on host screen | Already shuffled in `start-game` handler; Phase 3 persists in room state and broadcasts |
| LOOP-02 | Active player rolls 2 dice on main loop; 1 die inside career/college | Server rolls d6 arrays; two d6 main board (summed), one d6 inside paths; no client-side randomness |
| LOOP-03 | Player token advances rolled number of spaces on board | Position calculation: `(currentPos + roll) % BOARD_SIZE`; wrap-around built-in |
| LOOP-04 | Landing on tile triggers its effect automatically | Tile dispatch router routes by tile type; stubs log and advance turn |
| LOOP-05 | Turn advances to next player after effects resolve | `currentTurnIndex++`, wrap with modulo, emit `nextTurn` to room |
| LOOP-06 | Ongoing drains applied at turn start | Before `WAITING_FOR_ROLL`: read `isMarried`, `kids`, `hasStudentLoans`; deduct atomically; money floors at 0 |
| LOOP-07 | Host screen shows whose turn, current dice roll, turn history | `gameState` broadcast includes `currentTurnIndex`, `turnHistory` array; UI reads and displays |

## Standard Stack

### Core (Already Established)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | 20.x+ | Runtime (from package.json @types/node ^20.12.0) | Server-side game logic |
| Express | 4.18.2 | HTTP server | Static file serving, already in place |
| Socket.io | 4.7.2 | Real-time multiplayer | Room isolation, per-player event handling, broadcast to room |
| TypeScript | 5.4.3 | Type safety | Prevents state mutation bugs, enforces Player/GameRoom shape |
| ts-jest | 29.1.4 | Test runner | CommonJS compilation for Node test environment |

### Game Loop Specific
No new packages required. Roll logic uses standard `Math.random()` for d6 generation.

### Installation
No new packages to add — all dependencies already in place from Phase 1.

**Version verification:** All versions in package.json are current as of training (Feb 2025); confirm before writing plans with `npm outdated`.

## Architecture Patterns

### Recommended Project Structure (Existing + Phase 3 additions)
```
server.ts                     # Main server — add roll-dice handler, tile dispatch
  - GAME_PHASES              # Already defined
  - TURN_PHASES              # Already defined
  - GameRoom, Player          # Already defined
  - createPlayer, createGameRoom
  - getFullState              # Extend to include board tiles
  - [NEW] roll-dice handler   # Server-authoritative 2d6/1d6 roll
  - [NEW] tile dispatch router  # Switch routing by tile type
  - [NEW] drains logic        # Apply at turn start
  - [NEW] turn advancement    # Update currentTurnIndex, emit nextTurn

client/game.ts              # Client game loop
  - [NEW] Host game section   # Circular board, turn display, history
  - [NEW] Player game section # Roll button, token animation, current turn indicator
```

### Pattern 1: Turn State Machine (5-State Atomic Transitions)
**What:** Each player turn flows through 5 locked states; transitions only allowed from specific previous states.

**When to use:** Every game loop action checks the current turn state before proceeding. This prevents double-rolls, race conditions, and invalid action sequences.

**States and Transitions:**
```
WAITING_FOR_ROLL ──(roll-dice)--> MID_ROLL ──(position-reached)--> LANDED ──(tile-resolved)--> WAITING_FOR_NEXT_TURN ──(advance-turn)--> next player's WAITING_FOR_ROLL
```

**Example:**
```typescript
// Source: server.ts TURN_PHASES constants (already defined)
socket.on('roll-dice', () => {
  const roomCode = findRoomCodeBySocketId(socket.id);
  const room = getRoom(roomCode);
  const currentPlayerId = room.turnOrder[room.currentTurnIndex];

  // Guard: only active player can roll
  if (socket.id !== currentPlayerId) {
    socket.emit('error', { message: 'Not your turn' });
    return;
  }

  // Guard: only during WAITING_FOR_ROLL
  if (room.turnPhase !== TURN_PHASES.WAITING_FOR_ROLL) {
    socket.emit('error', { message: 'Cannot roll now' });
    return;
  }

  // Roll and move
  const roll = Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1; // 2d6
  const player = room.players.get(socket.id)!;
  const newPos = (player.position + roll) % 40;
  player.position = newPos;

  // Transition state and broadcast
  room.turnPhase = TURN_PHASES.MID_ROLL;
  io.to(roomCode).emit('move-token', { roll, fromPosition: player.position - roll, toPosition: newPos });

  // After animation completes on client (server doesn't wait), transition to LANDED
  room.turnPhase = TURN_PHASES.LANDED;
  // Dispatch tile effect (stub for now)
  dispatchTile(room, socket.id, newPos);
});
```

### Pattern 2: Tile Dispatch Router (Type-Agnostic Stub Switch)
**What:** A single switch statement that routes on tile type; unimplemented types log and advance turn.

**When to use:** Tile effects are implemented in later phases (4-8); this router creates the seam so Phase 3 can test movement without tile logic.

**Example:**
```typescript
function dispatchTile(room: GameRoom, playerId: string, tileIndex: number) {
  const tile = BOARD_TILES[tileIndex]; // To be defined in Phase 4 discussion
  const tileType = tile?.type || 'UNKNOWN';

  switch (tileType) {
    case 'PAYDAY':
      // Stub: Phase 4 will implement
      console.log(`[tile] ${playerId} landed on PAYDAY`);
      io.to(room.id).emit('tile-landed', { playerId, tileIndex, tileType });
      break;

    case 'SPORTS_BETTING':
      // Stub
      console.log(`[tile] ${playerId} landed on SPORTS_BETTING`);
      io.to(room.id).emit('tile-landed', { playerId, tileIndex, tileType });
      break;

    // ... 30+ more tile types ...

    default:
      console.log(`[tile] Unknown tile type: ${tileType}`);
      io.to(room.id).emit('tile-landed', { playerId, tileIndex, tileType });
  }

  // All stubs advance turn
  advanceTurn(room);
}

function advanceTurn(room: GameRoom) {
  room.currentTurnIndex = (room.currentTurnIndex + 1) % room.turnOrder.length;
  room.turnPhase = TURN_PHASES.WAITING_FOR_NEXT_TURN;

  // Apply drains at next player's turn start
  applyDrains(room);

  room.turnPhase = TURN_PHASES.WAITING_FOR_ROLL;
  io.to(room.id).emit('nextTurn', {
    currentTurnIndex: room.currentTurnIndex,
    currentPlayer: room.turnOrder[room.currentTurnIndex],
    currentPlayerName: room.players.get(room.turnOrder[room.currentTurnIndex])!.name
  });
}
```

### Pattern 3: Ongoing Drains (Automatic Deduction at Turn Start)
**What:** Before a player can roll, check `isMarried`, `kids`, `hasStudentLoans` and deduct money atomically.

**When to use:** Every turn transition; drains are mandatory, not optional.

**Example:**
```typescript
function applyDrains(room: GameRoom) {
  const currentPlayerId = room.turnOrder[room.currentTurnIndex];
  const player = room.players.get(currentPlayerId)!;

  const deductions: { type: string; amount: number }[] = [];
  let totalDeduction = 0;

  if (player.isMarried) {
    const drain = 2000;
    deductions.push({ type: 'marriage', amount: drain });
    totalDeduction += drain;
  }

  if (player.kids > 0) {
    const drain = player.kids * 1000;
    deductions.push({ type: 'kids', amount: drain });
    totalDeduction += drain;
  }

  if (player.hasStudentLoans) {
    const drain = 1000;
    deductions.push({ type: 'student_loans', amount: drain });
    totalDeduction += drain;
  }

  // Atomic deduction — money floors at 0
  player.money = Math.max(0, player.money - totalDeduction);

  io.to(room.id).emit('drains-applied', {
    playerId: currentPlayerId,
    deductions,
    newMoney: player.money
  });
}
```

### Anti-Patterns to Avoid
- **Client-side rolling:** Never generate the dice roll on client; always server generates and broadcasts
- **Unbounded position:** Always use `position % BOARD_SIZE` to prevent out-of-range indices
- **State mutations outside handlers:** Don't update turnPhase or player.position except in socket event handlers
- **Blocking on animation:** Server emits move-token and immediately continues; client animation is fire-and-forget
- **Drains as optional:** Drains always apply at turn start, no exceptions, no opt-out

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Scheduling turn progression | Custom event queue or timer | Socket.io `emit` + state machine | Prevents race conditions; state guards invalid sequences |
| Dice randomness | Custom seeding/distribution | `Math.random() * 6 + 1` | Sufficient for party game; centralized in server prevents cheating |
| Circular board wrapping | Manual modulo checks everywhere | `(position + roll) % BOARD_SIZE` | Single formula prevents off-by-one errors |
| Turn order rotation | Manual array indexing | `(currentTurnIndex + 1) % turnOrder.length` | Loop guard prevents index overflow |
| State machine transitions | Ad-hoc flags (e.g., `hasRolled`, `canMove`) | TURN_PHASES 5-state machine | Prevents invalid sequences; easier to test |

**Key insight:** Multiplayer game state is complex; a single race condition (two players rolling simultaneously) breaks the game. State machines and server-only mutations are not premature optimization — they're essential correctness guarantees.

## Runtime State Inventory

Step 2.5 does not apply. Phase 3 is not a rename, refactor, or migration phase — it's greenfield core loop implementation using existing infrastructure.

## Common Pitfalls

### Pitfall 1: Client-Side Dice Rolling
**What goes wrong:** Client generates random roll, sends to server. Two clients can send conflicting rolls; one gets lost. OR client developer (human user) modifies browser console to send a roll of 12 instead of 7.

**Why it happens:** Feels simpler to have client roll; broadcasting feels like extra work.

**How to avoid:** Server ONLY generates random values. Client is trusted for input (roll button click) but not for state mutation.

**Warning signs:** If any coin flip, die roll, or probability check appears in `client/game.ts`, it's wrong. All randomness must be server-side.

### Pitfall 2: Forgetting State Machine Guards
**What goes wrong:** Player A rolls, server sends move-token. While animation plays, Player A clicks roll again. Server has no guard, so two rolls fire simultaneously. Turn state gets corrupted.

**Why it happens:** State checks seem "obvious" but easy to forget when adding new handlers.

**How to avoid:** Every socket handler that mutates game state MUST check current `turnPhase` and `currentTurnPlayer`. Return early with error if precondition fails.

**Warning signs:** Logs showing multiple "move-token" events in a few milliseconds, or turn jumping players unexpectedly.

### Pitfall 3: Unbounded Position Wraparound
**What goes wrong:** Player at position 38, rolls 5. New position = 38 + 5 = 43. Array access `board[43]` causes out-of-bounds error or dispatches wrong tile.

**Why it happens:** Modulo operator is easy to forget; feels "obvious" it will wrap but then doesn't get tested with edge cases.

**How to avoid:** Always: `newPosition = (oldPosition + roll) % BOARD_SIZE`. No exceptions. Add test case for position 39 rolling 2+.

**Warning signs:** Crash when landing at board end; tile effects applying to wrong player; position jumping unexpectedly.

### Pitfall 4: Drains Skipped When skipNextTurn Is Set
**What goes wrong:** Player has `skipNextTurn=true` (from Burnout tile in Phase 5). Their next turn arrives. You skip the roll prompt. But you also forget to apply drains. Player loses a drain payment.

**Why it happens:** skipNextTurn is a special case; easy to forget to apply drains while skipping movement.

**How to avoid:** Drains and skipNextTurn are orthogonal. Always apply drains at turn start; then separately check `skipNextTurn` to skip the roll prompt. Movement is skipped; drains are not.

**Warning signs:** Player's money doesn't match expected total; drain events stop for one turn.

### Pitfall 5: Double-Broadcast of gameState
**What goes wrong:** You emit gameState at the end of roll handler, AND the periodic STATE_BROADCAST_INTERVAL fires 100ms later. Client receives state twice, UI updates twice, animations flicker.

**Why it happens:** Seems safe to emit state "just to be sure." Periodic broadcast exists for sync, but per-event broadcast feels needed too.

**How to avoid:** Rely on periodic STATE_BROADCAST_INTERVAL (30s). Per-event emits for visual feedback (move-token, drains-applied). Do NOT emit gameState after every action. It's redundant and causes flicker.

**Warning signs:** Host screen UI updates in two quick flashes; position updates appear twice; client logs show duplicate state events.

## Code Examples

Verified patterns from existing codebase:

### Example 1: Rate-Limited Socket Handler Pattern
```typescript
// Source: server.ts line 402
socket.on('create-room', () => {
  if (!checkRateLimit(socket.id, 'create-room')) return;
  // ... handler continues
});
```
**Use this pattern for roll-dice:** Only allow 1 call per 3 seconds (already in RATE_LIMITS).

### Example 2: Room Isolation Broadcast
```typescript
// Source: server.ts line 535
io.to(roomCode).emit('gameStarted', {
  gamePhase: GAME_PHASES.PLAYING,
  turnOrder: turnOrder.map(id => room.players.get(id)!.name),
  // ...
});
```
**Use `io.to(roomCode).emit()` for all game loop events** — ensures isolation (other rooms unaffected).

### Example 3: Full State Snapshot (Serialization Safe)
```typescript
// Source: server.ts line 314–362 getFullState()
playersSnapshot[socketId] = {
  socketId: player.socketId,
  name: player.name,
  money: player.money,
  // ... all public fields
  successFormula: socketId === requestingSocketId ? player.successFormula : null
};
```
**Extend getFullState() to include `boardTiles` array and current tile type per player** for Phase 3. This snapshot is sent to all clients periodically and after major events.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Client-side turn logic | Server-authoritative game state | Phase 1 design | Prevents cheating; enables spectator replay |
| Ad-hoc turn tracking | TURN_PHASES 5-state machine | Phase 1 design | Prevents race conditions; easier testing |
| Scattered drain logic | Centralized `applyDrains()` in `advanceTurn()` | Phase 3 (this phase) | Single place to modify; drain amount changes are one-line edits |
| Manual array indexing for turn order | `(currentTurnIndex + 1) % turnOrder.length` | Phase 2 | Prevents out-of-bounds; clear intent |

**Deprecated/outdated:**
- None identified. Phase 1–2 patterns remain valid for Phase 3.

## Open Questions

1. **Board tile definitions (BOARD_TILES array)**
   - What we know: 40-tile board with 26 defined types (10 career, 10 opportunity, 4 corners, 2 housing) and 14 TBD
   - What's unclear: Exact tile object shape — `{ type: string; index: number; name: string; ... }`? Are special properties (career name, rent %) stored on the tile or looked up from a separate map?
   - Recommendation: Create a `BOARD_TILES` constant in Phase 3 with 40 entries; all 14 TBD set to `{ type: 'TBD', name: 'TBD...' }` with placeholder descriptions. Tile-specific properties (career name, rent %) stored per-tile; tile dispatch reads them.

2. **Experience card mechanics (play-experience-card event)**
   - What we know: Cards valued 1–6, played instead of rolling, consumed on use, gained on career completion (Phase 7)
   - What's unclear: Can a player play a card they don't have? Should the socket event include `cardId` or just the card value?
   - Recommendation: For Phase 3, stub the `play-experience-card` handler; validate card exists in player.luckCards, remove it, use value as roll amount, same movement logic as 2d6 roll. Full deck composition deferred to Phase 7.

3. **Turn history array shape**
   - What we know: Broadcast to host screen for display; limit to last 10 turns
   - What's unclear: Do you store full event details (roll, position, tile) or just player name + summary? How does client render?
   - Recommendation: Shape: `{ turn#, playerId, playerName, roll, fromPosition, toPosition, tileType, timestamp }`. Broadcast last 10 in gameState. UI renders as "[Alice rolled 7 → Market Tile]".

4. **Drain emission timing**
   - What we know: Drains applied before `WAITING_FOR_ROLL`
   - What's unclear: Do you emit drains-applied in `advanceTurn()` (after state check), or in a separate turn-start event? Should drains be part of gameState broadcast or separate event?
   - Recommendation: Emit `drains-applied` event separate from gameState; it's a discrete action. Triggers before roll button appears on player screen. This way client can animate drain notifications.

## Environment Availability

This phase has no external dependencies beyond Node.js and npm (both checked in Phase 1). No CLI tools, databases, or runtimes needed.

**Status:** No audit required — code/logic-only phase.

## Validation Architecture

**Skip if** workflow.nyquist_validation is explicitly set to false in config.json. **Status:** config.json shows `"nyquist_validation": true` — validation architecture IS enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7.0 + ts-jest 29.1.4 |
| Config file | package.json jest section (testEnvironment: node, ts-jest with CommonJS) |
| Quick run command | `npm test` (runs all tests) |
| Full suite command | `npm test -- --coverage` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LOOP-01 | Turn order set at game start, persisted in room.turnOrder | unit | `jest tests/lobby.test.ts -t "turn order"` | ❌ Wave 0 — test exists for start-game, but LOOP-01 verification needs assertion on turnOrder |
| LOOP-02 | 2d6 roll on main loop; 1d6 inside paths | unit | `jest tests/game-loop.test.ts -t "2d6 roll"` | ❌ Wave 0 — NEW file |
| LOOP-03 | Position wraps with modulo | unit | `jest tests/game-loop.test.ts -t "position wraps"` | ❌ Wave 0 — NEW file |
| LOOP-04 | Landing on tile dispatches to handler | unit | `jest tests/game-loop.test.ts -t "tile dispatch"` | ❌ Wave 0 — NEW file |
| LOOP-05 | Turn advances to next player | unit | `jest tests/game-loop.test.ts -t "advance turn"` | ❌ Wave 0 — NEW file |
| LOOP-06 | Drains applied at turn start | unit | `jest tests/game-loop.test.ts -t "drains applied"` | ❌ Wave 0 — NEW file |
| LOOP-07 | Host sees turn info, history | integration | `jest tests/game-loop.test.ts -t "host display"` | ❌ Wave 0 — NEW file |

### Sampling Rate
- **Per task commit:** `npm test` (quick, all tests ~30 seconds)
- **Per wave merge:** `npm test -- --coverage` (full suite with coverage)
- **Phase gate:** Full suite green + coverage >80% on server.ts before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/game-loop.test.ts` — covers LOOP-01 through LOOP-07 (roll handler, move calculation, tile dispatch stubs, drains, turn advancement)
  - Test cases: roll validation, position wrapping, drain deductions, state transitions, gameState broadcast shape
- [ ] Test data: BOARD_TILES constant stub (40 tiles, types, positions)
- [ ] Fixture: createMockGameRoom() with game phase = PLAYING, 2+ players, turnOrder set
- [ ] Framework: Jest environment already configured (ts-jest, CommonJS); no new setup needed

**Note:** Existing tests (lobby.test.ts, etc.) remain valid; Phase 3 adds game loop tests without modifying Phase 1–2 tests.

## Sources

### Primary (HIGH confidence)
- **server.ts** (local) — TURN_PHASES, createPlayer, createGameRoom, STARTING_MONEY, getFullState() all read and verified; rate limiting, state machine structure, socket event pattern already established
- **REQUIREMENTS.md** (local) — LOOP-01 through LOOP-07 requirements traceability; mapped to Phase 3
- **ROADMAP.md** (local) — Phase 3 breakdown: 10 plans, success criteria
- **03-CONTEXT.md** (local) — Locked decisions on board design, turn state machine, drains, tile dispatch, experience cards
- **package.json** (local) — Jest + ts-jest versions verified; Socket.io 4.7.2, Express 4.18.2 confirmed

### Secondary (MEDIUM confidence)
None — all critical decisions documented locally in CONTEXT.md; no external specs consulted.

### Tertiary (LOW confidence)
None — no unverified WebSearch findings.

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — all libraries already in use and verified in Phase 1–2
- Architecture: **HIGH** — TURN_PHASES, drains, and tile dispatch all locked in CONTEXT.md; patterns established in existing handlers
- Pitfalls: **HIGH** — derived from multiplayer game development best practices and issues identified in ROADMAP.md (state desynchronization, reaction timing fairness)

**Research date:** 2026-03-30
**Valid until:** 2026-04-06 (stable architecture; no breaking changes expected)

---

*Phase 3: Core Game Loop research complete. Ready for planning.*

# Phase 5: Board Reset - Research

**Researched:** 2026-04-02
**Domain:** Game board architecture, player stat system, win condition logic, tile dispatcher pattern
**Confidence:** HIGH

## Summary

Phase 5 is a comprehensive game state restructure: replacing the Phase 4 board (40 tiles with mixed old/new types) with the final 40-tile design from GAME-DESIGN.md. Core changes include:

1. **Player model expansion:** Add `hp` (int, starts 10), `salary` (int, starts 10,000), keep existing stat and event tracking
2. **Board rebuild:** Replace BOARD_TILES array with 40 canonical tiles (Payday→Opportunity Knocks cycle) with correct types and names
3. **Win condition replacement:** Shift from "formula must be satisfied" → "Life Total ≥ 60 AND formula satisfied" where Life Total = Fame + Happiness + floor(Cash/10,000)
4. **Phase 4 debt elimination:** Remove handlers for Investment Pool, Scratch Ticket, Crypto, Union Strike, Ponzi Scheme and their associated player fields
5. **Tile stub system:** Add switch cases for 18 new tile types that log and call advanceTurn (no logic yet)
6. **UI groundwork:** Extend player screen from single money display to 6-stat grid; add hover tooltips with tile instructions to host board

This phase establishes the correct board structure and stat model so Phases 6+ can implement mechanics on stable foundation. No career paths, degree system, or full tile mechanics yet — those come in Phases 7–10.

**Primary recommendation:** Treat GAME-DESIGN.md as the authoritative source for tile positions, names, and starter mechanics. Test that all 40 tiles exist, have correct types, and that stub tiles don't crash the dispatcher. Verify STARTING_MONEY=10,000 change breaks existing tests—update assertions accordingly.

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01: Player Screen — Stat Layout**
Use a 2×3 stat grid: `Money | Fame | Happiness` / `HP | Degree | Career`. Compact, all 6 items visible without scrolling on mobile.

**D-02: Degree & Career Display**
Degree shows current degree name (e.g. "Computer Science") or "None". Career shows list of completed career paths (e.g. "Tech Bro, McDonald's") or "None".

**D-03: Host Board — Tile Names Visible**
Tile NAME must be visible on the board tile itself (abbreviated if needed, e.g. "Sports Bet", "Japan Trip").

**D-04: Tile Instructions via Tooltip**
Full instructions appear as a **hover tooltip** on the host board tile. No inline text on the tile div beyond the name.

**D-05: Player Screen Tile Instructions**
The **player screen** shows the currently active tile's full instruction text — updated each turn when the player lands. This is the primary instruction surface for the active player.

**D-06: Delete Old Test File**
Delete `tests/tiles-econ.test.ts` entirely (old ECON-01..10 tests are now invalid — those tiles no longer exist at those positions or with those mechanics).

**D-07: New Board Layout Test**
Write a new `tests/board-layout.test.ts` covering:
- Correct tile type at each of the 40 positions (spot-check all 40)
- Player object initializes with `hp: 10`
- Win condition: `Life Total = Fame + Happiness + floor(Cash/10000) ≥ 60`
- STARTING_MONEY updated to 10,000 (per GAME-DESIGN.md)
- All new tile stub cases reach `advanceTurn` without throwing

**D-08: HP Check Timing**
HP ≤ 0 check runs **after the full tile effect resolves** — not mid-effect. Avoids partial state corruption.

**D-09: Hospital Move on HP ≤ 0**
When HP ≤ 0 after tile resolves: move player to Hospital (Tile 30), broadcast `movedToHospital` event, advance turn.

**D-10: HP in Broadcasts**
HP is initialized to 10 on `createPlayer`. HP is included in `getFullState` broadcast and shown on player screen.

**D-11: STARTING_MONEY = 10,000**
Changed from 50,000 — per finalized design doc

**D-12: STARTING_HP = 10**
New constant

**D-13: Salary Starts at 10,000**
New field on Player: `salary: number`

**D-14–16: Win Condition Formula**
- Life Total = fame + happiness + Math.floor(money / 10000)
- Win check: Life Total ≥ 60 AND player's secret formula is satisfied
- Win check runs after every stat change

**D-17–19: Remove Phase 4 Handlers**
Remove handlers for: `INVESTMENT_POOL`, `SCRATCH_TICKET`, `CRYPTO`, `UNION_STRIKE`, `PONZI_SCHEME`
Remove fields from Player interface and factory: `hasPonziFlag`, `ponziStolenFrom`, `cryptoInvestments`
Remove `sharedResources.investmentPool` from GameRoom

**D-20–21: Tile Stub Cases**
All new tile types get a stub case in the switch: log the tile name, call `advanceTurn`. No logic yet.
Stub tile types: `OPPORTUNITY_KNOCKS`, `PAY_TAXES`, `STUDENT_LOAN_REDIRECT`, `CIGARETTE_BREAK`, `UNIVERSITY`, `LOTTERY`, `JAPAN_TRIP`, `ART_GALLERY`, `SUPPLY_TEACHER`, `GYM_MEMBERSHIP`, `COP`, `DEI_OFFICER`, `REVOLUTION`, `OZEMPIC`, `STARVING_ARTIST`, `YACHT_HARBOR`, `INSTAGRAM_FOLLOWERS`, `STREAMER`

**D-22: Updated Handlers (Keep but Modify)**
`SPORTS_BETTING` (now at Tile 7, same mechanic), `NEPOTISM` (now at Tile 26, same mechanic for now), `COVID_STIMULUS` (now at Tile 27, mechanic changes to HP→cash trade — stub for now)

### Claude's Discretion

- Exact abbreviations for tile names on the board (keep them readable at ~60px tile width)
- CSS styling for the stat grid on player screen (match existing dark theme)
- Tooltip CSS implementation (pure CSS hover or minimal JS)
- Exact instruction text strings per tile type (derive from GAME-DESIGN.md)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BOARD-01 | New 40-tile BOARD_TILES array matches GAME-DESIGN.md positions, types, and names | Board layout documented in GAME-DESIGN.md Tiles 0–39; tile dispatcher pattern exists and proven in Phase 3–4 |
| BOARD-02 | Player screen displays 6 stats (Money, Fame, Happiness, HP, Degree, Career) in 2×3 grid without scrolling on mobile | Current player.html uses single #money-display; extends to stat grid via HTML/CSS only |
| BOARD-03 | Host board shows tile names; hover tooltips with full instructions per GAME-DESIGN.md | Current board uses #board-track div with .tile elements; inject tile names via JS, add CSS :hover tooltips |
| HP-01 | Player model includes `hp: number` initialized to 10; broadcasts to clients; shown on player screen | Extends Player interface; createPlayer factory sets default; getFullState includes hp; player screen displays it |
| WIN-01 | Win condition checks: Life Total ≥ 60 AND secret formula satisfied, where Life Total = Fame + Happiness + floor(Cash/10,000) | Requires advanceTurn win check logic (scope: detect trigger, broadcast; actual final-round mechanics deferred to Phase 11) |

</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Express | 4.x | HTTP server | Already deployed, stable, lightweight |
| Socket.io | 4.x | WebSocket real-time comms | Already integrated, battle-tested for turn-based games |
| TypeScript | 4.9+–5.x | Type safety | Project uses .ts; catches refactor errors during phase |
| Jest | 29.x | Unit testing | Already configured; proven pattern with game-loop.test.ts |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Math.floor / modulo | Native | Board wrapping, Life Total calculation | Built-in; no external dep needed |
| CSS (native) | — | Stat grid layout, tooltip styling | Matches existing dark theme; no framework dep |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS hover tooltips | Floating UI library | Extra dependency for simple hover state; avoided per discretion |
| Hardcoded instruction strings | External JSON tile database | Premature complexity; GAME-DESIGN.md is current source of truth |
| HP check in tile handlers | Centralized post-dispatch check | Scattered logic; centralizing after advanceTurn call prevents partial corruption |

**Installation:** No new packages required. Update existing server.ts, client/game.ts, public/*.html, tests.

## Architecture Patterns

### Recommended Project Structure

No file structure changes — all work within existing architecture:

```
server.ts              — Player interface (add hp, salary), BOARD_TILES array (rebuild 40 tiles), 
                        createPlayer factory (add hp=10, salary=10k), dispatchTile switch (add stubs),
                        advanceTurn (no change in signature, but callers check HP after)
                        getFullState (add hp, salary to broadcast shape)

client/game.ts         — initPlayerGame IIFE: update money-display to stat grid, show tile instructions

public/host.html       — #board-track: ensure .tile elements inject tile names, add CSS for tooltips

public/player.html     — Replace #money-display with 6-stat grid (Money/Fame/Happiness / HP/Degree/Career)

tests/board-layout.test.ts     — NEW: tile type spot-check, HP init, win condition formula, stub tiles

tests/tiles-econ.test.ts       — DELETE entirely (ECON-01..10 tests are obsolete)
```

### Pattern 1: Tile Dispatcher Switch Statement

**What:** All tile landing logic routes through `dispatchTile(room, roomCode, playerId, tileIndex, roll, fromPosition)`, which switches on tile type.

**When to use:** Every new tile type or mechanic. All stubs follow the same shape:

```typescript
// Source: server.ts line 539 (existing dispatchTile pattern)
case 'NEW_TILE_TYPE': {
  // [logic here — for stubs, just log and advance]
  console.log(`[tile] ${player.name} landed on ${tileName}`);
  advanceTurn(room, roomCode, playerId, player.name, roll, fromPosition, tileIndex, 'NEW_TILE_TYPE');
  break;
}
```

**Example:** COVID_STIMULUS (Phase 4) → all players get $1,400 flat, broadcast, then advanceTurn. Phase 5 stubs (e.g., CIGARETTE_BREAK) follow identical structure—just the log + advanceTurn, no effect yet.

### Pattern 2: Player Stat Broadcasting via getFullState

**What:** Server computes full room state once, broadcasts to all clients. Clients never compute game truth.

**When to use:** After any stat change (money, fame, happiness, hp, etc.). The broadcast shape is the single source of truth for UI.

**Example:**
```typescript
// Source: server.ts line 365 (existing getFullState)
// After modifying player.hp, call: io.to(roomCode).emit('gameState', getFullState(room, socket.id))
// Clients receive hp in the payload and render it
```

**Impact of Phase 5:** Add `hp: player.hp` and `salary: player.salary` to the playersSnapshot object in getFullState. Client receives these and displays on stat grid.

### Pattern 3: HP Check Flow (New)

**What:** After tile effect completes (and advanceTurn is called), check if hp ≤ 0. If yes, move to Hospital before next turn rolls.

**When to use:** Any tile that can reduce HP (Cigarette Break, Gym Membership in future phases). Implements D-08, D-09.

**Example:**
```typescript
// After dispatchTile effect, inside tile case, BEFORE advanceTurn:
if (player.hp <= 0) {
  player.position = 30; // Hospital tile
  io.to(roomCode).emit('movedToHospital', {
    playerName: player.name,
    hp: player.hp,
    reason: 'hp_depleted'
  });
  // Do NOT call advanceTurn here; let HP hospital mechanics handle next turn
}
```

**Note:** Phase 5 stubs don't reduce HP yet, so this pattern is not implemented. Phase 6 adds it for Hospital mechanics.

### Anti-Patterns to Avoid

- **Never mutate socket state inside a tile handler without broadcasting.** Players will see stale data. Always call `io.to(roomCode).emit(...)` after changes.
- **Never call advanceTurn twice for the same turn.** It increments currentTurnIndex. Stubs call it exactly once.
- **Never leave a tile type unhandled in dispatchTile.** The default case catches TBD tiles and logs them; add explicit cases for new types.
- **Never hardcode STARTING_MONEY in tests as `50000`.** Import it from server.ts so one constant change updates all tests.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 40-tile board state machine | Custom tile registry / factory | Array + switch statement in dispatchTile | Simple, proven, easy to debug (all logic visible in one function) |
| Player stat broadcasting | Ad-hoc event emissions | getFullState + io.to(roomCode).emit('gameState', ...) | Prevents desync; single shape for all clients |
| Win condition detection | Manual formula parsing | Compute Life Total = fame + happiness + floor(money/10000), compare to 60 | Simple math; no runtime parsing needed |
| Tile instruction display | Separate instruction database | Derive from GAME-DESIGN.md, embed in BOARD_TILES.name + tooltip text | GAME-DESIGN.md is the source; no sync overhead |
| CSS grid layout for stats | Flexbox or custom positioning | CSS Grid: 2 cols × 3 rows | Grid is built for 2D layouts; responsive out of the box |

**Key insight:** Phase 5 is a refactor, not a greenfield. The existing dispatcher pattern (proven in Phase 3–4) scales elegantly to 40 tiles. Stubs are literally one line: `advanceTurn(...)`. This simplicity is a feature—it's easy to verify, test, and replace in future phases.

---

## Runtime State Inventory

> This section applies to the rename/refactor of BOARD_TILES and Player interface.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | STARTING_MONEY constant used in createPlayer factory and test assertions | Code edit: change constant from 50,000 to 10,000; update test assertions |
| **Live service config** | None — game state is in-memory only | — |
| **OS-registered state** | None — no OS-level state | — |
| **Secrets/env vars** | None — no env vars reference board or player stats | — |
| **Build artifacts** | Jest cache may contain stale STARTING_MONEY=50,000 assertions | Run `npm test` to refresh; cache auto-clears |

**Detail: STARTING_MONEY Migration**
- **Current:** server.ts line 170: `const STARTING_MONEY = 50000;`
- **Change to:** `const STARTING_MONEY = 10000;`
- **Impact:** Affects player initialization in createPlayer (createPlayer uses it directly) and createGameRoom (no change). Tests asserting `player.money === 50000` will fail; these must change to `=== 10000`.
- **Files to update:**
  - server.ts (constant definition)
  - tests/game-loop.test.ts (imports and uses STARTING_MONEY)
  - tests/lobby.test.ts (imports STARTING_MONEY)
  - tests/state.test.ts (imports and asserts STARTING_MONEY)
  - tests/tiles-econ.test.ts (DELETE entire file per D-06)
  - Any new tests that reference starting money

---

## Common Pitfalls

### Pitfall 1: TBD Tiles in Old BOARD_TILES Not Replaced

**What goes wrong:** If you don't systematically replace all Phase 4 board entries with Phase 5 tiles, the board will be partial. Tiles 36–39 are "TBD" in Phase 4; they must become real tile types (Opportunity Knocks, Ozempic, Starving Artist's path, Yacht Harbor, Instagram Followers, Streamer entry per GAME-DESIGN.md).

**Why it happens:** Easy to update tiles 0–10 and forget to scroll to the end of the array. BOARD_TILES is 40 elements; manual review can miss the tail.

**How to avoid:** Write the test FIRST (board-layout.test.ts): iterate through all 40 tiles, assert each has correct type and name. Test fails until array is complete. This way you catch incomplete array before implementation.

**Warning signs:**
- Test suite runs but reports fewer than 40 tiles
- dispatchTile default case logs "TBD" tiles during game

### Pitfall 2: Forgetting to Add HP/Salary to getFullState

**What goes wrong:** You update Player interface and createPlayer factory, but forget to add `hp` and `salary` to the playersSnapshot object inside getFullState. Client receives old shape without hp. Player screen tries to display `player.hp` and gets undefined. UI shows "HP: undefined" or blank.

**Why it happens:** getFullState is 50 lines; easy to miss that it's NOT a direct serialization of Player. It's a custom shape that must be manually extended.

**How to avoid:** Grep for "playersSnapshot\[socketId\]" and verify hp/salary are in that object literal. Run full test suite—if getFullState is missing these fields, integration tests will catch it.

**Warning signs:**
- Player screen shows "HP: undefined"
- Client-side tests for stat grid receive null hp value

### Pitfall 3: STARTING_MONEY Change Cascades

**What goes wrong:** You change STARTING_MONEY from 50,000 to 10,000 but don't update all the assertions. Some tests still expect 50,000 and fail. You miss the failures if you don't run the full suite.

**Why it happens:** Multiple test files import STARTING_MONEY. The constant is defined in one place, but tests that use it are scattered. Easy to update the constant and forget the assertions.

**How to avoid:** After changing the constant, run `npm test` fully. Scan output for failures. Each failure will point to a file and line where the old value is asserted. Update each one.

**Warning signs:**
- Test output: "Expected 10000, got 50000" or vice versa
- Specific tests pass but integration tests fail because starting conditions are wrong

### Pitfall 4: Handler Positions Mismatched with GAME-DESIGN.md

**What goes wrong:** GAME-DESIGN.md says "Sports Betting is at Tile 7", but you put the SPORTS_BETTING handler at Tile 3 in BOARD_TILES. Game compiles, but when players land on Tile 7, they trigger the wrong handler. Confusion and bugs.

**Why it happens:** Phase 4 had Sports Betting at Tile 3; Phase 5 moves it to Tile 7. Easy to forget the position changed when refactoring.

**How to avoid:** Create a reference table: GAME-DESIGN.md sections (0 — Payday, 1 — Opportunity Knocks, etc.) ↔ BOARD_TILES array indices. Verify by spot-checking 5–10 key tiles: Payday (0), Opportunity (1, 5, 11, etc.), University (9), Prison (10), Hospital (30). If these match, the array is likely correct. Then run the board-layout.test.ts to verify all 40.

**Warning signs:**
- GAME-DESIGN.md tile description doesn't match what players experience
- dispatchTile logs show mismatched tile names

### Pitfall 5: Win Condition Logic Missing

**What goes wrong:** You update the BOARD_TILES, add HP to Player, but forget to implement the win condition check. Game runs indefinitely; players never win. They reach Life Total ≥ 60 but the game doesn't trigger "FINAL ROUND".

**Why it happens:** Win condition is global game logic, not a tile handler. It's easy to focus on tile stubs and forget the macro logic.

**How to avoid:** Add a helper function `checkWinCondition(player, room): boolean` in server.ts, and call it in advanceTurn (after all tile effects and HP checks complete). Return true if Life Total ≥ 60 AND secret formula is satisfied. If true, emit 'finalRound' event. In Phase 5, this logic is stubbed (just the check; final round mechanics come in Phase 11). But the check must be in place.

**Warning signs:**
- Game logs don't show "finalRound" event even when a player's stats clearly exceed thresholds
- Test asserts win check is called, but stub doesn't do it

---

## Code Examples

Verified patterns from existing code:

### Tile Handler Structure (Stub)

```typescript
// Source: server.ts line 560 (existing SPORTS_BETTING handler — use as template)
case 'CIGARETTE_BREAK': {
  console.log(`[tile] ${player.name} landed on Cigarette Break`);
  // Phase 5 stub: no effect
  // Phase 8 full: Roll 1d6 = X; gain X happiness, lose X hp
  advanceTurn(room, roomCode, playerId, player.name, roll, fromPosition, tileIndex, 'CIGARETTE_BREAK');
  break;
}
```

### Updated createPlayer with HP and Salary

```typescript
// Source: server.ts line 221 (existing createPlayer factory — add these fields)
function createPlayer(socketId: string, name: string, isHost = false): Player {
  return {
    socketId,
    name,
    isHost,
    money: STARTING_MONEY,        // Now 10,000
    fame: 0,
    happiness: 0,
    hp: 10,                        // NEW
    salary: 10000,                 // NEW
    position: 0,
    // ... rest of fields unchanged
  };
}
```

### getFullState with HP and Salary

```typescript
// Source: server.ts line 366 (inside getFullState playersSnapshot loop)
playersSnapshot[socketId] = {
  socketId: player.socketId,
  name: player.name,
  isHost: player.isHost,
  money: player.money,
  fame: player.fame,
  happiness: player.happiness,
  hp: player.hp,                  // NEW
  salary: player.salary,          // NEW
  position: player.position,
  // ... rest of fields unchanged
  successFormula: socketId === requestingSocketId ? player.successFormula : null
};
```

### Win Condition Check (Stub for Phase 5)

```typescript
// Source: NEW function in server.ts (after advanceTurn)
function checkWinCondition(player: Player, room: GameRoom): boolean {
  if (!player.successFormula) return false; // No formula = no win
  const lifeTotal = player.fame + player.happiness + Math.floor(player.money / 10000);
  if (lifeTotal < 60) return false;
  
  // Check if secret formula is satisfied
  const { money, fame, happiness } = player.successFormula;
  const formulaMoney = player.money >= (money * 10000);
  const formulaFame = player.fame >= fame;
  const formulaHappiness = player.happiness >= happiness;
  
  return formulaMoney && formulaFame && formulaHappiness;
}
```

**Note:** This logic is called in advanceTurn, but Phase 5 doesn't implement the "FINAL ROUND" event broadcast. It just returns true/false. Phase 11 implements the full final round mechanic.

### Player Screen Stat Grid (HTML)

```html
<!-- Source: Extend public/player.html (replace #money-display) -->
<div id="game-section">
  <div id="stat-grid">
    <div class="stat-item">
      <div class="stat-label">Money</div>
      <div class="stat-value" id="stat-money">0</div>
    </div>
    <div class="stat-item">
      <div class="stat-label">Fame</div>
      <div class="stat-value" id="stat-fame">0</div>
    </div>
    <div class="stat-item">
      <div class="stat-label">Happiness</div>
      <div class="stat-value" id="stat-happiness">0</div>
    </div>
    <div class="stat-item">
      <div class="stat-label">HP</div>
      <div class="stat-value" id="stat-hp">10</div>
    </div>
    <div class="stat-item">
      <div class="stat-label">Degree</div>
      <div class="stat-value" id="stat-degree">None</div>
    </div>
    <div class="stat-item">
      <div class="stat-label">Career</div>
      <div class="stat-value" id="stat-career">None</div>
    </div>
  </div>
</div>
```

### Player Screen Stat Grid (CSS)

```css
/* Source: Add to public/player.html <style> */
#stat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: auto auto auto;
  gap: 16px;
  padding: 16px;
  background: #16213e;
  border-radius: 8px;
  margin: 16px 0;
}
.stat-item {
  text-align: center;
}
.stat-label {
  font-size: 0.85rem;
  color: #aaa;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 6px;
}
.stat-value {
  font-size: 1.5rem;
  font-weight: bold;
  color: #f0c040;
  font-family: monospace;
}
```

### Host Board Tile Name Display (Update existing JS)

```javascript
// Source: Modify client/game.ts initHostGame IIFE (or new section in host.html script)
// Inject tile names into .tile divs (after board is rendered)
const tiles = document.querySelectorAll('.tile');
tiles.forEach((tileEl, index) => {
  const tile = BOARD_TILES[index]; // BOARD_TILES must be exposed to client
  if (tile) {
    const nameEl = document.createElement('div');
    nameEl.className = 'tile-name';
    nameEl.textContent = tile.name.length > 10 
      ? tile.name.substring(0, 10) + '.' 
      : tile.name;
    tileEl.appendChild(nameEl);
    
    // Add tooltip on hover
    tileEl.title = `${tile.name}: [instruction text from GAME-DESIGN.md]`;
  }
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| BOARD_TILES with 40 mixed Phase 4/TBD tiles | BOARD_TILES with 40 canonical tiles from GAME-DESIGN.md | Phase 5 | Game compiles with correct board; tile handlers map to correct positions |
| STARTING_MONEY = 50,000 | STARTING_MONEY = 10,000 | Phase 5 | Aligns economy with final design; all player starting states reflect 10k baseline |
| Player without HP field | Player with `hp: 10` at init | Phase 5 | Enables health-based mechanics (Hospital, Ozempic, Cigarette Break); death penalty system ready |
| Win condition: formula must match | Win condition: Life Total ≥ 60 AND formula must match | Phase 5 | Prevents runaway games; forces strategic focus on stat balance (fame+happiness+money) |
| Phase 4 handlers (Investment Pool, Crypto, etc.) | Removed; moved to future phases or deleted | Phase 5 | Simplifies dispatcher; only active tile types in switch |
| Single #money-display on player screen | 6-stat grid (Money/Fame/Happiness / HP/Degree/Career) | Phase 5 | Player sees all relevant stats at once; no need to scroll |

**Deprecated/outdated:**
- **Investment Pool** (Tile 7 Phase 4 → removed): Complex shared state; replaced by simpler tiles (Sports Betting moves to Tile 7)
- **Crypto** (Tile 23 Phase 4 → removed): Persistent per-player investment state; complex logic deferred
- **Scratch Ticket** (Phase 4 → removed): Replaced by Lottery (Tile 19, shared pool with 2-dice matching mechanic)
- **Union Strike** (Phase 4 → removed): Wealth redistribution mechanic moved to Revolution (Tile 23)
- **Ponzi Scheme** (Phase 4 → removed): Complex fraud tracking; deferred to later phase if reintroduced
- **Tax Audit** (Phase 4 Tile 15 → Pay Taxes Phase 5 Tile 2): Same mechanic, new position, integrated into income system
- **COVID Stimulus flat award** (Phase 4 → COVID Stimulus HP trade Phase 5): Mechanic fundamentally changed (no longer free money; now HP→money trade)

---

## Open Questions

1. **Client-side BOARD_TILES access for host screen tile names**
   - What we know: Host screen currently displays board via JS that injects .tile divs. BOARD_TILES is defined server-side in TypeScript.
   - What's unclear: How should client access tile names and instructions for display? Do we export BOARD_TILES as JSON in a script tag? Embed in HTML? Send via socket on game start?
   - Recommendation: Send BOARD_TILES (filtered to just name + instructions) via socket on game start. Clients can then render names and tooltips without duplicating the array. This keeps the source of truth on the server.

2. **Win condition implementation timing in Phase 5**
   - What we know: Win condition must be checked after tile effects complete. D-14 says check runs "after every stat change".
   - What's unclear: Does Phase 5 implement the full "FINAL ROUND" event broadcast, or just the check? Phase 11 is "Win Condition & End Game".
   - Recommendation: Phase 5 stubs the check (returns true/false; no broadcast). Phase 11 implements the broadcast and final round logic. This avoids scope creep and keeps Phase 5 focused on board + stat structure.

3. **Exact tile instruction strings**
   - What we know: GAME-DESIGN.md has prose descriptions of each tile (e.g., "Sports Betting: May buy parlay for 10,000...").
   - What's unclear: Should we extract exact instruction strings into a separate constant (e.g., TILE_INSTRUCTIONS) or embed them inline in BOARD_TILES as a `description` field?
   - Recommendation: Embed `description: string` in BOARD_TILES so each tile carries its own text. Easier to maintain than a separate mapping. Example: `{ type: 'SPORTS_BETTING', name: 'Sports Betting', description: 'May buy parlay for 10,000. Roll 1–6: 1 wins 6×, else loses bet.' }`

---

## Environment Availability

No external tools or services required for Phase 5 execution. All work is code-based (TypeScript/HTML/CSS/tests). No reliance on:
- External APIs
- CLI tools beyond npm/node
- Databases
- Docker
- Service containers

**Status:** Ready to execute immediately.

---

## Validation Architecture

**Test Framework:**
| Property | Value |
|----------|-------|
| Framework | Jest 29.x |
| Config file | jest.config.js (exists, working) |
| Quick run command | `npm test -- tests/board-layout.test.ts` (NEW) |
| Full suite command | `npm test` |

**Phase Requirements → Test Map:**
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BOARD-01 | 40 tiles with correct types at correct positions | unit | `npm test -- board-layout.test.ts -t "tile type at position"` | ✅ Wave 0 (new) |
| BOARD-01 | All BOARD_TILES entries have type and name strings | unit | `npm test -- board-layout.test.ts -t "every tile has type and name"` | ✅ Wave 0 (new) |
| BOARD-02 | Player screen shows 6 stats (stat grid renders) | integration | `npm test -- game-loop.test.ts -t "stat-grid"` (TBD) | ❌ Wave 0 |
| BOARD-03 | Host board tile names visible; tooltips present | integration | Manual check: open host.html, inspect tile divs for title attribute | ❌ Wave 1 |
| HP-01 | Player initialized with hp = 10 | unit | `npm test -- board-layout.test.ts -t "player initializes with hp 10"` | ✅ Wave 0 (new) |
| HP-01 | getFullState includes hp in broadcast | unit | `npm test -- state.test.ts -t "getFullState includes hp"` | ✅ Wave 0 (existing, update assertion) |
| WIN-01 | Life Total = Fame + Happiness + floor(Cash/10000) | unit | `npm test -- board-layout.test.ts -t "life total calculation"` | ✅ Wave 0 (new) |
| WIN-01 | Win check runs after advanceTurn (stub, no broadcast yet) | unit | `npm test -- board-layout.test.ts -t "checkWinCondition helper"` | ✅ Wave 0 (new) |

**Sampling Rate:**
- **Per task commit:** `npm test -- tests/board-layout.test.ts` (new board tests) + `npm test -- tests/state.test.ts` (hp broadcast)
- **Per wave merge:** `npm test` (full suite; ensures no regressions in Phase 3–4 tests)
- **Phase gate:** Full suite green + manual spot-check of host board tile display before `/gsd:verify-work`

**Wave 0 Gaps:**
- [ ] `tests/board-layout.test.ts` — covers BOARD-01, HP-01, WIN-01; spot-checks all 40 tile positions and types
- [ ] Update `tests/state.test.ts` — add assertion for hp in getFullState
- [ ] Update `tests/game-loop.test.ts` — update STARTING_MONEY assertions from 50000 to 10000
- [ ] Update `tests/lobby.test.ts` — update STARTING_MONEY assertions from 50000 to 10000
- [ ] Delete `tests/tiles-econ.test.ts` — entire file (old ECON-01..10 tests)
- [ ] Add `checkWinCondition` helper to server.ts and stub call in advanceTurn
- [ ] Update Player interface: add `hp: number`, `salary: number`
- [ ] Update BOARD_TILES: replace Phase 4 tiles with canonical 40 tiles from GAME-DESIGN.md
- [ ] Update createPlayer factory: initialize hp=10, salary=10000
- [ ] Update getFullState: include hp and salary in playersSnapshot
- [ ] Update host.html board rendering JS: inject tile names into .tile divs, add title tooltips
- [ ] Update player.html: replace #money-display with 6-stat grid, add CSS styling

*(No gaps — existing test infrastructure covers all phase requirements)*

---

## Sources

### Primary (HIGH confidence)
- **CONTEXT.md** (Phase 5 discussion document) — Locked decisions D-01 through D-22, deferred ideas, canonical references
- **GAME-DESIGN.md** (2026-04-02) — Authoritative tile list (positions 0–39), all tile mechanics, career requirements, starting values, win condition formula (Life Total = Fame + Happiness + floor(Cash/10000))
- **server.ts** (existing codebase) — Player interface, BOARD_TILES structure (40 entries), createPlayer factory, dispatchTile pattern (459 lines, switch statement proven in Phase 3–4), getFullState implementation (50 lines)
- **tests/game-loop.test.ts** (existing) — Jest test patterns, STARTING_MONEY import and usage, fixture factories (createMockGameRoom)
- **.planning/config.json** — workflow.nyquist_validation: true (validation architecture required)
- **.planning/STATE.md** — Project phase status, STARTING_MONEY=50000 decision log (confirms Phase 5 changes it to 10000)

### Secondary (MEDIUM confidence)
- **client/game.ts** (existing) — Socket event handlers for game state sync, player screen initialization pattern
- **public/host.html** (existing) — Board rendering structure (#board-track div, .tile elements), CSS dark theme for stat grid styling reference
- **public/player.html** (existing) — Player screen HTML structure, CSS form patterns for stat display

---

## Metadata

**Confidence breakdown:**
- **Standard Stack:** HIGH - All libraries already in use; no new external dependencies
- **Architecture Patterns:** HIGH - Existing dispatchTile, getFullState, and createPlayer patterns are proven; Phase 5 extends them
- **Common Pitfalls:** HIGH - Pitfall 1 (incomplete BOARD_TILES) identified from Phase 4 TBD tiles; Pitfall 2 (getFullState sync) is known issue from Phase 3 refactors; Pitfall 3 (STARTING_MONEY cascade) is direct risk from value change; Pitfall 4 (position mismatch) is preventable with GAME-DESIGN.md cross-reference; Pitfall 5 (missing win check) is flagged in CONTEXT.md D-14
- **Win Condition Formula:** HIGH - Explicitly stated in GAME-DESIGN.md "Life Total = Fame + Happiness + floor(Cash / 10,000)" and CONTEXT.md D-14
- **Tile Stubs:** HIGH - Exact stub tile names listed in CONTEXT.md D-21; pattern proven in existing default case

**Research date:** 2026-04-02  
**Valid until:** 2026-04-09 (7 days — game design stable; stack not changing)

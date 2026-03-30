# Phase 3: Core Game Loop - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Players can roll dice, tokens move on a 40-tile looping board, turns advance in order, and ongoing drains (marriage, kids, student loans) run automatically at each turn start. Landing on a tile routes through a full dispatch router (stubs for unimplemented types). The host screen shows a circular track with colored player dots. Character portraits, actual tile effects (economic, life events, properties, careers), and card mechanics are all separate phases.

</domain>

<decisions>
## Implementation Decisions

### Board Definition

The main loop is a **40-tile square track** with 4 fixed corners and 10 Career Entrance tiles:

```
BOARD[40] — full tile sequence (0-indexed, clockwise):

 0: payday           ← Corner 1 (like GO — collect money on pass/land)
 1: sports-betting
 2: career-entrance  → Tech Bro
 3: get-married
 4: luck
 5: career-entrance  → Finance Bro
 6: tax-audit
 7: viral-moment
 8: career-entrance  → Streamer
 9: investment-pool
10: prison           ← Corner 2
11: scratch-ticket
12: career-entrance  → McDonald's Employee
13: have-a-kid
14: hazard
15: covid-stimulus
16: career-entrance  → Cop
17: union-strike
18: burnout
19: college-entrance
20: park-bench       ← Corner 3 (rest tile — no effect, safe space)
21: crypto
22: career-entrance  → Precarious Healthcare Hero
23: therapy
24: luck
25: career-entrance  → Right-Wing Grifter
26: nepotism
27: reality-tv-offer
28: career-entrance  → Artist
29: cancelled
30: hospital         ← Corner 4 (life event — cost/effect TBD in Phase 5)
31: tax-audit
32: career-entrance  → Disillusioned Academic
33: midlife-crisis
34: hazard
35: student-loan-payment
36: career-entrance  → D&I Officer
37: ponzi-scheme
38: lawsuit
39: retirement-home
```

**Career Entrance distribution:** 3 on side 1 (tiles 1–9), 2 on side 2 (tiles 11–19), 3 on side 3 (tiles 21–29), 2 on side 4 (tiles 31–39) = 10 total.

**Career paths (10 total):**

| # | Career | Entry Requirement | Stat Focus |
|---|--------|-------------------|------------|
| 1 | Tech Bro | Comp Sci degree | High 💰 |
| 2 | Finance Bro | Business degree | High 💰 + some ⭐ |
| 3 | Precarious Healthcare Hero | Health Sciences degree | Low 💰 + some ⭐/❤️ |
| 4 | Disillusioned Academic | Teaching degree (2nd college) | Moderate ❤️ + low 💰 |
| 5 | Streamer | No degree — pay fee + roll a 1 | High ⭐ + volatile 💰 |
| 6 | McDonald's Employee | No degree | Very low 💰 + tiny ❤️ |
| 7 | Right-Wing Grifter | Any degree | High ⭐ + zero ❤️ (lose all happiness on entry) |
| 8 | Cop | No degree — pay fee + never been to prison | TBD — prison quota mechanic |
| 9 | Artist | Art degree OR pay fee | High ❤️ + volatile ⭐ + low 💰 |
| 10 | D&I Officer | Gender Studies degree | TBD |

**Career exit mechanic:** Completing a career path returns the player to a specific **Opportunity tile** on the outer loop, where they resolve it. Player also gains **1 Experience card** (effect TBD — later phase).

### Tile Dispatch Router

- **D-01:** Build a **full tile-type routing switch** in Phase 3 with stubs for all unimplemented categories.
- **D-02:** Each stub logs the tile type, broadcasts a `tile-landed` event with `{playerId, tileIndex, tileType}`, and immediately advances the turn.
- **D-03:** This creates a clean seam — Phases 4–8 fill in handlers without rewiring.
- **D-04:** Career Entrance tiles in Phase 3 → stub only (broadcast event, advance turn). Career entry logic is Phase 7.

### Roll-to-Move Flow

- **D-05:** Server-authoritative: player emits `roll-dice`, server rolls 2d6 (main loop) or 1d6 (career/college), calculates new position with `(currentPos + roll) % BOARD_SIZE`, emits `move-token {roll, fromPosition, toPosition, steps}` to room.
- **D-06:** Client receives `move-token` and animates the token moving step by step (one tile per frame or 500ms total). Server does not wait for animation to complete before continuing — client-side only.
- **D-07:** After emitting `move-token`, server emits `tile-landed {playerId, tileIndex, tileType}` and routes to the tile dispatch handler.

### Turn Progression

- **D-08:** Turn state machine already exists in `server.ts` (`TURN_PHASES`). Phase 3 wires up the transitions: `WAITING_FOR_ROLL` → (roll) → `MID_ROLL` → (position reached) → `LANDED` → (tile resolves) → `WAITING_FOR_NEXT_TURN` → (advance) → next player's `WAITING_FOR_ROLL`.
- **D-09:** After tile stub resolves, advance `currentTurnIndex`, emit `nextTurn {currentTurnPlayer, turnNumber}` to room.
- **D-10:** `skipNextTurn` flag (already on Player) is checked at turn start — if set, skip movement (emit `turnSkipped`), clear flag, advance to next player.

### Ongoing Drains

- **D-11:** At the **start of each player's turn** (before they can roll), server applies drains: marriage (-$2,000 if `isMarried`), kids (-$1,000 × `kids` count), student loans (-$1,000 if `hasStudentLoans`).
- **D-12:** Drain amounts deducted atomically; money floors at 0 (no negative from drains alone — tile effects may go negative).
- **D-13:** Emit `drains-applied {playerId, deductions: [{type, amount}], newMoney}` before the roll prompt.

### Host Board Display

- **D-14:** Circular/track layout showing all 40 tiles as a looping path.
- **D-15:** Each player represented as a **colored dot** (unique color per player) positioned on their current tile.
- **D-16:** Current player's tile is highlighted. Tile type label shown on hover or as a small badge.
- **D-17:** Turn history sidebar: last 5 turns shown as `[PlayerName] rolled [N] → [TileName]`.
- **D-18:** No CSS portraits needed — colored dots only until Phase 9.

### Claude's Discretion

- Exact pixel layout of the circular board (CSS flex/grid approach)
- Whether tiles are labeled with abbreviations or icons
- Drain floor behavior edge cases (e.g., player with $0 already)

</decisions>

<specifics>
## Specific Ideas

- **"Laid off due to AI boom"** — event tile inside the Tech Bro career loop (Phase 7 event deck). Noted here as a canonical funny moment the user wants included.
- **Cop career quota mechanic** — on career start, Cop player must send one other player to prison immediately (hitting quota). When Cop players are active, prison bond payments go to Cops (split evenly) instead of bank. Captured for Phase 6.
- **Experience cards** — gained on career path completion. Can be used instead of rolling to move a fixed number of spaces. Full mechanic TBD. Deferred to backlog.
- **Payday corner** — players collect money when they pass or land on tile 0, similar to GO in Monopoly. Exact amount Claude's discretion (suggest $2,000).
- **Park Bench corner** — safe rest tile, no effect. Just a breather space.
- **Hospital corner** — life event tile, exact effect TBD in Phase 5.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements are fully captured in this document and the files below.

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — LOOP-01 through LOOP-07 (core game loop requirements); SOCK-01 (socket event list including `roll-dice`, `move-token`, `apply-drains`, `goomba-stomp`)
- `.planning/ROADMAP.md` — Phase 3 plan breakdown (10 plans), success criteria
- `.planning/PROJECT.md` — Tech stack constraints (vanilla JS, Socket.io, no framework)

### Existing Server Code
- `server.ts` — `GAME_PHASES`, `TURN_PHASES`, `createPlayer`, `createGameRoom`, `getFullState()` all already defined; `roll-dice` rate limiter registered at line ~270; `start-game` handler sets `gamePhase = PLAYING` and shuffles turn order

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TURN_PHASES` in `server.ts`: `WAITING_FOR_ROLL`, `MID_ROLL`, `LANDED`, `TILE_RESOLVING`, `WAITING_FOR_NEXT_TURN` — state machine already defined, Phase 3 wires up transitions
- `createPlayer` factory: `position`, `inPrison`, `skipNextTurn`, `isMarried`, `kids`, `hasStudentLoans`, `luckCards` all present — drain logic can read these directly
- `getFullState()`: already broadcasts `position`, `turnOrder`, `currentTurnIndex`, `gamePhase`, `turnPhase` — extend for `tileType` at current position
- Rate limiter: `roll-dice` already registered (1 call / 3s) — handler just needs to be implemented

### Established Patterns
- Factory pattern (plain objects) — no classes; all new state follows same pattern
- Server-authoritative: all mutations server-side only; clients receive broadcasts
- Module exports all helpers (`createPlayer`, `createGameRoom`, constants) for test imports
- `.unref()` on intervals for clean Jest process exit

### Integration Points
- `socket.on('roll-dice')` — handler slot already rate-limited, awaiting implementation
- `io.to(roomCode).emit('gameStarted', {...})` in `start-game` — Phase 3 picks up from this event, `gamePhase` is already `PLAYING`
- `getFullState()` — extend return object to include `boardTiles` array and current tile type per player

</code_context>

<deferred>
## Deferred Ideas

- **Experience cards** — gained on career completion, usable instead of rolling. New mechanic not in v1 requirements. Add to roadmap backlog.
- **Art degree / Gender Studies degree** — 2 new college degrees needed for Artist and D&I Officer careers. Flag for Phase 7 (college paths) context discussion.
- **Cop bond mechanic** — prison bond payments route to active Cop players. Flag for Phase 6 (prison) context discussion.
- **Hospital corner effect** — exact mechanic TBD, defined in Phase 5 (Life Event Tiles).
- **Payday corner amount** — exact payout TBD; suggest $2,000 (Claude's discretion).
- **Opportunity tile mechanics** — career exit routing tile; exact effect TBD.

</deferred>

---

*Phase: 03-core-game-loop*
*Context gathered: 2026-03-30*

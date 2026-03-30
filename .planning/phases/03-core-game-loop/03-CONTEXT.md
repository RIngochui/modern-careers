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

The main loop is a **40-tile square track**. Tile positions are not fully sequenced yet — exact order to be finalized in a future discussion. The following tile categories and counts are locked:

| Category | Count | Notes |
|----------|-------|-------|
| Career Entrance (incl. College/University) | 10 | ~2–3 per side; each paired with an Opportunity tile |
| Opportunity tiles | 10 | One per career entrance; positioned right after each career path exit reconnects to the main loop |
| Corner tiles | 4 | Payday (0), Prison (10), Park Bench (20), Hospital (30) — effects TBD in future phases |
| Housing tiles | 2 | Apartment (tile), House (tile) |
| **Subtotal defined** | **26** | |
| TBD tiles | 14 | Remaining tile types (economic, life events, luck/hazard, etc.) — finalized in later phase discussions |
| **Total** | **40** | |

**Corner tiles** (positions 0, 10, 20, 30 on the square track):
- **Payday** — exact effect TBD (likely: collect money on pass/land, similar to GO)
- **Prison** — matches PRISON-01; players can be sent here via Goomba Stomp or tile effects
- **Park Bench** — rest tile; exact effect TBD
- **Hospital** — life event tile; exact effect TBD in Phase 5

**Opportunity tiles** — one per career, positioned immediately after that career's exit reconnects to the main loop:
- Landing on an Opportunity tile grants the player an **Opportunity card** for the associated career
- Opportunity cards let a player jump directly to that career's entrance tile
- Some Opportunity cards offer: all-expenses-paid entry, or bypass the degree requirement to enter
- Opportunity cards are held in hand and played voluntarily (like Luck cards)

**Housing tiles** (2 tiles total on the main loop):
- **Apartment** — purchase price = 2× STARTING_MONEY ($100,000); first player who can afford it auto-buys; subsequent landers pay 25% of their current money as rent to owner
- **House** — purchase price = 4× STARTING_MONEY ($200,000); first player who can afford it auto-buys; subsequent landers pay 33% of their current money as rent to owner
- If no player can afford to buy, tile stays unowned; already-owned tiles always charge rent (negative money allowed per PROP-03)

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
- **D-05b:** **Alternative to rolling — Experience cards:** During `WAITING_FOR_ROLL`, a player may instead emit `play-experience-card {cardId}`. Server uses the card's value (1–6) as the movement amount, same position calculation and `move-token` broadcast. Card is consumed from hand. Experience cards are gained on **career path completion only** — college/university completion grants a degree instead.
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

- **Experience cards** — numbered 1–6, automatically gained when a player completes a **career path** (not college/university). Played voluntarily during `WAITING_FOR_ROLL` instead of rolling dice — gives the player deterministic movement (strategic: you can see the board and pick the card value that lands you where you want). Consumed on use.
- **College/University completion** gives the player their **degree** (not an experience card). Degree type depends on what they were studying. Experience cards and degrees are mutually exclusive exit rewards — career paths give cards, college gives degrees.
- **"Laid off due to AI boom"** — event tile inside the Tech Bro career loop (Phase 7 event deck). Noted here as a canonical funny moment the user wants included.
- **Cop career quota mechanic** — on career start, Cop player must send one other player to prison immediately (hitting quota). When Cop players are active, prison bond payments go to Cops (split evenly) instead of bank. Captured for Phase 6.
- **Experience cards** — gained on career path completion. Can be used instead of rolling to move a fixed number of spaces. Full mechanic TBD. Deferred to backlog.
- **Payday corner** — collect money on pass or land. Exact amount TBD (suggest $2,000 — Claude's discretion).
- **Park Bench corner** — safe rest tile, no effect. Just a breather space. Exact effect TBD.
- **Hospital corner** — life event tile, exact effect TBD in Phase 5.
- **Opportunity tiles** are positioned right after each career exit re-enters the main loop — 10 tiles total, one per career path. Cards give jump access + sometimes waive entry requirements or fees.
- **14 remaining tiles** (economic, life events, luck/hazard, etc.) — to be defined in a future discuss-phase session before Phase 4 planning.

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

- **14 remaining board tiles** — economic, life event, luck/hazard, and other tile types; exact positions and counts TBD in future phase discussions.
- **Corner tile effects** — Payday, Park Bench, Hospital effects to be fully defined in relevant future phases.
- **Experience card deck composition** — exact distribution of 1–6 values per career path (e.g., does every career always give the same card value, or is it random?). TBD in Phase 7 context. Phase 3 just needs the `play-experience-card` socket event and movement logic; the grant-on-completion mechanic is Phase 7.
- **Art degree / Gender Studies degree** — 2 new college degrees needed for Artist and D&I Officer careers. Flag for Phase 7 (college paths) context discussion.
- **Cop bond mechanic** — prison bond payments route to active Cop players. Flag for Phase 6 (prison) context discussion.
- **Opportunity card details** — exact set of cards per career, which ones waive degree/fee, deck size; TBD in Phase 7 context.

</deferred>

---

*Phase: 03-core-game-loop*
*Context gathered: 2026-03-30*

# ROADMAP: Modern Careers

**Project:** Jackbox-style multiplayer party game (Node.js + Socket.io + TypeScript)
**Target:** v1 release
**Granularity:** Fine (12 phases)
**Last Updated:** 2026-04-03

---

## Phases

- [x] **Phase 1: Foundation & Setup** — Project scaffolding, npm, Express, Socket.io room infrastructure (completed 2026-03-30)
- [x] **Phase 2: Lobby & Room System** — Room creation/join, player connection, Success Formula submission (completed 2026-03-30)
- [x] **Phase 3: Core Game Loop** — Dice rolling, token movement, turn progression (completed 2026-04-01)
- [x] **Phase 4: Economic Tiles** — First tile pass; superseded by Phase 5 board reset (completed 2026-04-01)
- [x] **Phase 5: Board Reset** — Rebuild BOARD_TILES to final 40-tile design, add HP system, update win condition, stub all tile types (completed 2026-04-03)
- [x] **Phase 6: Hospital, Prison & Japan Trip** — HP→Hospital trigger, roll-to-leave, Doctor role, Prison escape, Japan Trip, Goomba Stomp (completed 2026-04-03)
- [ ] **Phase 7: Properties & Housing** — Apartment (Tile 6), House (Tile 25), buy/rent/prison-on-default mechanics
- [ ] **Phase 8: University & Career Paths** — University path (7 degrees), 9 career paths with entry requirements and event tiles
- [ ] **Phase 9: Opportunity Knocks** — Card deck system, draw mechanics, card effects, hand management
- [ ] **Phase 10: Economy & Life Tiles** — All remaining tiles: Gym, Lottery, COVID Stimulus, Revolution, Ozempic, Yacht, Instagram, Art Gallery, Cigarette Break, Pay Taxes, Sports Betting, Nepotism, Streamer entry
- [ ] **Phase 11: Player & Host UI** — Player screen (money/happiness/fame/HP/degree/career history), Host board (tile map with instructions), character portraits
- [ ] **Phase 12: Win Condition & End Game** — Life Total ≥ 60 + secret formula detection, Final Round, Retirement Home showdown, game-over screen

---

## Phase Details

### Phase 1: Foundation & Setup ✓

**Goal:** Establish server infrastructure with Socket.io room isolation and state management foundation.

**Status:** Complete (2026-03-30)

---

### Phase 2: Lobby & Room System ✓

**Goal:** Players can join rooms, set secret Success Formulas, and initiate game start.

**Status:** Complete (2026-03-30)

---

### Phase 3: Core Game Loop ✓

**Goal:** Players can roll dice, move tokens, advance turns.

**Status:** Complete (2026-04-01)

---

### Phase 4: Economic Tiles ✓ (superseded)

**Goal:** First tile implementation pass. Board layout and most tile logic superseded by Phase 5 board reset.

**What survives into Phase 5:**
- Sports Betting handler logic (moves to Tile 7)
- Nepotism handler logic (moves to Tile 26, mechanic updated)
- advanceTurn / broadcast infrastructure

**What is removed:**
- Investment Pool, Scratch Ticket, Crypto, Union Strike, Ponzi Scheme (not in final design)
- Tax Audit (replaced by Pay Taxes at Tile 2)
- COVID Stimulus flat broadcast (replaced by HP-trade mechanic)
- Student Loan Payment handler (mechanic changed)

**Status:** Complete (2026-04-01)

---

### Phase 5: Board Reset

**Goal:** Rebuild the entire board to match the final 40-tile design. Add HP as a core stat. Update win condition. Remove obsolete Phase 4 handlers. Stub all new tile types so the game compiles and runs.

**Design reference:** `.planning/GAME-DESIGN.md`

**Key deliverables:**
1. New `BOARD_TILES` array (40 tiles, correct types at correct positions)
2. `hp: number` added to Player (starts at 10)
3. Win condition updated: Life Total = Fame + Happiness + floor(Cash/10,000) ≥ 60 AND secret formula met
4. Dead Phase 4 handlers removed (Investment Pool, Scratch Ticket, Crypto, Union Strike, Ponzi Scheme)
5. Updated handlers: Sports Betting (Tile 7), Nepotism (Tile 26), COVID Stimulus (Tile 27, HP trade)
6. Stubs for all new tile types: CIGARETTE_BREAK, GYM_MEMBERSHIP, LOTTERY, JAPAN_TRIP, REVOLUTION, OZEMPIC, YACHT_HARBOR, INSTAGRAM_FOLLOWERS, ART_GALLERY, PAY_TAXES, OPPORTUNITY_KNOCKS, UNIVERSITY, SUPPLY_TEACHER, DEI_OFFICER, STARVING_ARTIST
7. Player screen shows: money, happiness, fame, HP, degree, career history
8. Host screen shows: board with tile names and brief instructions per tile type

**Requirements:** BOARD-01, BOARD-02, BOARD-03, HP-01, WIN-01

### Success Criteria

- [ ] BOARD_TILES has exactly 40 entries matching `.planning/GAME-DESIGN.md` positions
- [ ] Player object has `hp` field initialized to 10
- [ ] HP ≤ 0 at any time triggers move to Hospital (Tile 30)
- [ ] Life Total calculation correct: Fame + Happiness + floor(Cash/10k)
- [ ] Win check runs after every stat change
- [ ] Old tile handlers (Investment Pool, Scratch Ticket, etc.) are removed
- [ ] Sports Betting now at Tile 7 with correct mechanic
- [ ] COVID Stimulus at Tile 27: player trades HP for cash (10,000/HP)
- [ ] All new tile types have stubs (log + advanceTurn, no crash)
- [ ] `npm test` passes (update tests to match new board)
- [ ] Player screen displays money, happiness, fame, HP, degree, career history
- [ ] Host screen displays board with tile labels and instructions

**Plans:** 3/3 plans complete

Plans:
- [x] 05-01-PLAN.md — Test infrastructure: write board-layout.test.ts (TDD Wave 0), delete tiles-econ.test.ts, update STARTING_MONEY assertions
- [x] 05-02-PLAN.md — Server refactor: rebuild BOARD_TILES (40 tiles), update Player model (hp/salary), remove dead Phase 4 handlers, add stubs, checkWinCondition
- [x] 05-03-PLAN.md — UI update: player stat grid (2x3), active tile instructions, host board tile names + hover tooltips

---

### Phase 6: Hospital, Prison & Japan Trip

**Goal:** Implement HP-triggered hospitalization, roll-to-leave hospital mechanic, Doctor role, Prison escape, Japan Trip stay/leave loop, and Goomba Stomp routing.

**Key deliverables:**
1. Hospital: stuck until roll ≤ 5 or pay ½ Salary; +5 HP on leaving; payment → Doctor if exists else Banker
2. Doctor role: Nursing Degree completion sends player to Hospital; passive income from Hospital payments
3. Prison: escape by rolling 9/11/12 or paying bail (→ Banker); no movement/salary while imprisoned
4. Japan Trip: +1 Happiness on land; each turn staying: +2 Happiness, pay Salary/5; roll > 8 forces leave; cannot use cards
5. Goomba Stomp: landing on occupied tile → stomp target to Japan Trip (Tile 20); Cop variant → Prison

**Requirements:** HP-02, HOSP-01..04, DOC-01..02, PRISON-01..06, JAPAN-01..03, STOMP-01..02

### Success Criteria

- [ ] HP ≤ 0 → immediate move to Hospital, turn pauses
- [ ] Hospital: player must roll ≤ 5 to leave OR pay ½ Salary
- [ ] Leaving Hospital: +5 HP; payment → Doctor (if exists) else Banker
- [ ] Doctor passive: receives ½ Salary whenever any player pays to leave Hospital
- [ ] Prison: roll 9, 11, or 12 to escape; OR pay bail → Banker
- [ ] Cops immune to Prison (take fine/HP loss instead)
- [ ] Japan Trip: correct Happiness/cost/roll mechanics
- [ ] Cannot use Experience/Opportunity cards in Hospital, Prison, or Japan Trip
- [ ] Goomba Stomp: occupied tile → target sent to Japan Trip
- [ ] Cop Goomba Stomp: target sent to Prison

**Plans:** 4 plans

Plans:
- [x] 06-01-PLAN.md — TDD Wave 0: write failing tests for hospital, prison, japan-trip, goomba-stomp, doctor-role (all 5 test suites red)
- [x] 06-02-PLAN.md — Server mechanics: Player interface extension (inHospital, inJapan, isDoctor, isCop), Hospital/Prison/Japan turn-flow interception, Goomba Stomp occupancy routing, card-play guards
- [x] 06-03-PLAN.md — Client UI: socket event handlers for all Phase 6 events in initPlayerGame and initHostGame IIFEs, recompile game.js
- [x] 06-04-PLAN.md — Gap closure: prisonTurns counter (PRISON-06), REQUIREMENTS.md PRISON-04/STOMP-01 text updates

---

### Phase 7: Properties & Housing

**Goal:** Apartment (Tile 6) and House (Tile 25) ownership with rent collection and prison-on-default.

**Key deliverables:**
1. Apartment: buy for 50,000; rent = 25% Salary; can't pay → give all cash + go to Prison
2. House: buy for 100,000; rent = 50% Salary; can't pay → give all cash + go to Prison
3. Landlord hat character layer on owner

**Requirements:** PROP-01..04

### Success Criteria

- [ ] Apartment buyable for 50,000 when unowned
- [ ] House buyable for 100,000 when unowned
- [ ] Rent deducted correctly from visitor, added to owner
- [ ] Visitor who can't pay: all cash → owner, then sent to Prison
- [ ] Only one owner per property; persists through game
- [ ] Landlord hat visible on owner's character

---

### Phase 8: University & Career Paths

**Goal:** University path with 7 degree options, all 9 career paths with entry requirements, path event tiles, and role grants on completion.

**Design reference:** `.planning/GAME-DESIGN.md` — Degrees & Careers section

**Career paths:** McDonald's, Finance Bro, Supply Teacher, Cop, DEI Officer, Tech Bro, Right-Wing Grifter, Starving Artist, Streamer

**Requirements:** COLL-01..06, CAREER-01..10

### Success Criteria

- [ ] University entry requires 10,000 (waived from Tile 3)
- [ ] Player declares degree before entering University
- [ ] Max 1 degree per player enforced
- [ ] Each career path enforces entry requirements (degree / cash / Nepotism)
- [ ] Cop path: 2 tiles that send to Hospital and cancel Cop completion
- [ ] Streamer: must roll a 1 (10,000/attempt, max 3) or use Nepotism
- [ ] DEI Officer entry: Gender Studies OR lose 20 Fame
- [ ] Right-Wing Grifter entry: Political Science OR lose 25 Happiness
- [ ] Each path completion: +1 Experience card
- [ ] Cop completion: gains Prison immunity + enhanced Goomba Stomp
- [ ] Artist completion: gains Artist role (Art Gallery payments)
- [ ] Doctor: Nursing Degree + path completion → sent to Hospital on grad
- [ ] Unemployed state if leaving path early

---

### Phase 9: Opportunity Knocks

**Goal:** Implement the Opportunity Knocks card deck used by all 11 Opportunity Knocks tiles (positions 1, 5, 11, 13, 16, 21, 24, 29, 32, 36, 39).

**Key deliverables:**
1. Shared shuffled Opportunity deck (room-level)
2. Draw-on-land mechanic
3. 15+ card designs with varied effects (money, fame, happiness, HP, movement)
4. Deck reshuffle when empty

**Requirements:** OPP-01..05

### Success Criteria

- [ ] Landing on any Opportunity Knocks tile draws top card from deck
- [ ] 15+ unique Opportunity cards defined
- [ ] Card effects applied server-side and broadcast
- [ ] Deck reshuffles when empty
- [ ] Card drawn and effect shown on all screens

---

### Phase 10: Economy & Life Tiles

**Goal:** Implement all remaining tile mechanics not covered by earlier phases.

**Tiles:**
- Tile 2: Pay Taxes (salary-bracket formula)
- Tile 3: Student Loan Payment (→ University, –15,000)
- Tile 7: Sports Betting (already built, verify position)
- Tile 8: Cigarette Break (roll → +Happiness, –HP)
- Tile 14: Art Gallery / NFT (buy NFTs for Fame, pay Artist or Banker)
- Tile 17: Gym Membership (signup 10k; recurring 5k/pass for +1HP +1Happiness)
- Tile 19: Lottery (global pool, pair-roll to win)
- Tile 23: Revolution (redistribute all cash equally)
- Tile 26: Nepotism (already built, verify position + updated mechanic)
- Tile 27: COVID Stimulus (trade HP for cash)
- Tile 33: Ozempic (up to 3× pay 10k → +2 HP)
- Tile 35: Yacht Harbor (tiered Happiness purchase)
- Tile 37: Buy Instagram Followers (tiered Fame purchase)

**Requirements:** ECON-01..13

### Success Criteria

- [ ] Pay Taxes: correct 0/50%/90% bracket calculation
- [ ] Student Loan Payment: move to University, –15,000, entry fee waived
- [ ] Cigarette Break: roll → Happiness gained, HP lost
- [ ] Art Gallery: NFT purchase works; payment routes to Artist if exists
- [ ] Gym Membership: subscription state persists; recurring cost on pass
- [ ] Lottery: global pool correct; pair detection correct; pool resets on win
- [ ] Revolution: sums and splits all cash correctly
- [ ] COVID Stimulus: HP trade at 10,000/HP
- [ ] Ozempic: up to 3 purchases, +2 HP each
- [ ] Yacht Harbor / Instagram Followers: tiered purchases correct

---

### Phase 11: Player & Host UI

**Goal:** Full UI pass — player screen shows all stats and history; host screen shows the board with tile instructions.

**Player screen must display:**
- Money (cash on hand + MoneyPoints)
- Happiness
- Fame
- HP
- Degree (if any)
- Career history (which paths completed)
- Current turn indicator

**Host screen must display:**
- 40-tile board with tile names
- Brief instruction per tile type (tooltip or sidebar)
- All players' positions (tokens/dots)
- Current player indicator
- Turn history sidebar

**Requirements:** UI-01..10, CHAR-01..08

### Success Criteria

- [ ] Player screen shows money, happiness, fame, HP, degree, career history
- [ ] All stats update in real-time via socket broadcast
- [ ] Host board renders all 40 tiles with names
- [ ] Host board shows brief instruction per tile
- [ ] Player tokens visible on host board at correct positions
- [ ] Current player highlighted on host board and player screen
- [ ] Character portraits render with stat-based visual tiers
- [ ] Life event layers visible (wedding ring, graduation cap, landlord hat, etc.)

---

### Phase 12: Win Condition & End Game

**Goal:** Detect Life Total ≥ 60 + formula satisfaction, trigger Final Round, resolve Retirement Home showdown, reveal formulas.

**Requirements:** WIN-01..09

### Success Criteria

- [ ] After every stat change: check Life Total ≥ 60 AND formula satisfied
- [ ] Win trigger: Final Round announced to all screens
- [ ] Triggering player moves to Retirement Home, marked retired
- [ ] All other players get exactly one more turn
- [ ] Players meeting formula during Final Round also retire
- [ ] 2+ retirees → sudden-death Reaction Speed mini game
- [ ] 1 retiree → solo win
- [ ] Game-over screen reveals all formulas + final stats
- [ ] Winner clearly announced

---

## Progress Tracking

| Phase | Status | Completed |
|-------|--------|-----------|
| 1. Foundation & Setup | Complete | 2026-03-30 |
| 2. Lobby & Room System | Complete | 2026-03-30 |
| 3. Core Game Loop | Complete | 2026-04-01 |
| 4. Economic Tiles (superseded) | Complete | 2026-04-01 |
| 5. Board Reset | Complete | 2026-04-03 |
| 6. Hospital, Prison & Japan Trip | Not started | — |
| 7. Properties & Housing | Not started | — |
| 8. University & Career Paths | Not started | — |
| 9. Opportunity Knocks | Not started | — |
| 10. Economy & Life Tiles | Not started | — |
| 11. Player & Host UI | Not started | — |
| 12. Win Condition & End Game | Not started | — |

---

## Architecture Principles

- **Server-authoritative state:** All mutations on server only; clients receive broadcasts
- **Socket.io room isolation:** Per-room game state with `io.to(roomCode).emit()`
- **In-memory only:** No database; sessions ephemeral; room cleanup on game end
- **Event → Logic → Broadcast:** Every player action routes through game logic, then broadcasts to room
- **Atomic transactions:** All side effects of one action complete before next event processed

---

*Roadmap created: 2026-03-29*
*Redesigned: 2026-04-02 — full board reset based on finalized game design doc*
*Phase 6 planned: 2026-04-03 — Hospital, Prison, Japan Trip, Goomba Stomp, Doctor role*

---
phase: 06-hospital-prison-japan-trip
verified: 2026-04-03T07:00:00Z
status: passed
score: 19/19 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 16/19
  gaps_closed:
    - "PRISON-06: prisonTurns counter added to Player model, incremented on failed escape, reset on escape/bail/fresh imprisonment/Goomba Stomp, broadcast in getFullState, displayed as [P:N] on host dot badge"
    - "REQUIREMENTS.md PRISON-04: updated from stale '1 die — roll a 1' to '2d6 — escape on 9, 11, or 12'"
    - "REQUIREMENTS.md STOMP-01: updated from stale 'sent to Prison immediately' to Cop/non-Cop routing description"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Japan stay-or-leave choice UI on player device"
    expected: "When a player is inJapan and rolls <= 8 on their turn, the player's device shows Stay and Leave buttons (or window.confirm fallback). Tapping Stay emits 'japan-stay'; tapping Leave emits 'japan-leave'."
    why_human: "UI interaction path requires a running server and two browser sessions (host + player). Cannot verify programmatically without starting the server."
  - test: "Hospital status banner on player screen"
    expected: "When a player is hospitalized, their screen shows a red banner reading 'You've been hospitalized!' with roll-to-escape prompts. Banner clears on escape."
    why_human: "Requires active session; #status-banner DOM element not yet in player.html (null-guarded in code, falls back silently — no visual without the HTML element)."
  - test: "Host dot status badges"
    expected: "On the host board, player dots show [H], [P:N], or [J] suffix in their title attribute when hospitalized, imprisoned, or in Japan respectively. [P:N] increments each time a prison-stayed event fires."
    why_human: "Requires running game session with players in special locations; badge is set on title attribute (tooltip), not visible text."
---

# Phase 6: Hospital, Prison, Japan Trip, Goomba Stomp — Verification Report

**Phase Goal:** Implement Hospital (HP drain → admission, roll escape, salary/2 payment to Doctor), Prison (2d6 escape, bail, Cop immunity), Japan Trip (stay loop, happiness gain, salary drain, 2d6 forced leave), and Goomba Stomp (occupancy routing to Japan/Prison based on Cop status). Client-side event handlers surfacing all events on player and host screens. prisonTurns counter tracked and displayed on host dots.

**Verified:** 2026-04-03
**Status:** passed
**Re-verification:** Yes — after gap closure (Plan 06-04)

---

## Re-Verification Summary

Previous verification (initial) scored 16/19 — three gaps blocked full passage. Plan 06-04 addressed all three. This re-verification confirms all three gaps are closed and no regressions introduced.

| Gap | Previous Status | Re-verification Result |
|-----|----------------|----------------------|
| PRISON-06: prisonTurns counter and [P:N] badge | FAILED | VERIFIED |
| REQUIREMENTS.md PRISON-04 stale text | FAILED | VERIFIED |
| REQUIREMENTS.md STOMP-01 stale text | FAILED | VERIFIED |

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Player interface has inHospital, inJapan, isDoctor, isCop boolean fields (all default false) | VERIFIED | server.ts lines 54-57, createPlayer() lines 255-258, getFullState() lines 405-408 |
| 2 | HP <= 0 triggers inHospital=true, position=30 | VERIFIED | checkHpAndHospitalize() at line 455; handleHpCheck alias at line 474; both exported |
| 3 | Hospital turn: roll 1d6 <= 5 escapes (+5 HP, pay Math.floor(salary/2)); roll 6 stays | VERIFIED | handleHospitalEscape() lines 486-528; escapeRoll <= 5 at line 492; Math.floor(player.salary / 2) at line 496 |
| 4 | Hospital payment routes to Doctor (isDoctor=true) if one exists, else Banker | VERIFIED | doctorPlayer find + routing code; isDoctor always false until Phase 8 sets it — confirmed known stub |
| 5 | Card play rejected when player.inHospital or player.inJapan is true | VERIFIED | canPlayCard() returns false with error emit when inHospital or inJapan |
| 6 | Prison turn: roll 2d6, only {9, 11, 12} escapes; bail $5,000 exits | VERIFIED | handlePrisonEscape() prisonRoll === 9 || 11 || 12; handlePrisonBail() 5000 deducted |
| 7 | Cop (isCop=true) landing on Prison tile: inPrison stays false (cop-immune path) | VERIFIED | dispatchTile PRISON case: if (player.isCop) emits prison-cop-immune without setting inPrison |
| 8 | Landing on Japan Trip (Tile 20): player.happiness += 1, player.inJapan = true | VERIFIED | dispatchTile case 'JAPAN_TRIP' lines 870-884; happiness += 1, inJapan = true |
| 9 | Japan turn-start: happiness += 2, money -= Math.ceil(salary/5); 2d6 >= 9 forces leave (position = 21, inJapan = false) | VERIFIED | handleJapanTurnStart(); drain; japanRoll >= 9; inJapan = false |
| 10 | advanceTurn intercepts nextPlayer.inJapan before normal turn | VERIFIED | advanceTurn() if (nextPlayer && nextPlayer.inJapan) handleJapanTurnStart() |
| 11 | Goomba Stomp: stomper ends on occupied tile, non-Cop sends all occupants to Tile 20 (inJapan=true) | VERIFIED | checkGoombaStomp(); non-Cop path lines 696-698 |
| 12 | Cop stomp sends all occupants to Tile 10 (inPrison=true) | VERIFIED | checkGoombaStomp() isCop branch sets position=10, inPrison=true, prisonTurns=0 |
| 13 | roll-dice handler intercepts inHospital and inPrison before normal movement | VERIFIED | server.ts lines 1182 (if player.inHospital) and 1188 (if player.inPrison) — both before d1/d2 calculation |
| 14 | checkGoombaStomp called after position update, before dispatchTile | VERIFIED | server.ts line 1203; after player.position = newPos, before move-token emit |
| 15 | All Phase 6 test assertions pass (211 total, including 2 new PRISON-06 counter tests) | VERIFIED | npm test --forceExit: 14 suites, 211 tests, 0 failures |
| 16 | TypeScript compiles clean (server and client) | VERIFIED | npx tsc --noEmit exits 0; npx tsc --project tsconfig.client.json exits 0 |
| 17 | Client initPlayerGame handles all 11 Phase 6 events (hospital/prison/japan/stomp) | VERIFIED | client/game.ts lines 560-865; all events present with functional handlers |
| 18 | Client initHostGame shows Phase 6 events in turn history + status badges | VERIFIED | client/game.ts lines 558-591; addTurnHistory calls for each event; gameState badge update at line 549-553 |
| 19 | PRISON-06: prisonTurns tracked on Player model, incremented/reset correctly, broadcast in gameState, displayed as [P:N] on host dot badge | VERIFIED | server.ts: prisonTurns: number (line 32), init 0 (line 239), getFullState (line 389), += 1 on stay (line 565), = 0 on escape (line 554), bail (line 587), fresh imprisonment (line 905), Goomba Stomp (line 695); client/game.ts badge (line 551); game.js compiled (line 464); 2 new tests passing |

**Score:** 19/19 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `tests/hospital.test.ts` | HP-02, HOSP-01..04 (6 assertions, min 60 lines) | VERIFIED | 167 lines; 6 describe/it blocks; all pass |
| `tests/doctor-role.test.ts` | DOC-02 (1 assertion, min 35 lines) | VERIFIED | 64 lines; 1 describe/it block; passes |
| `tests/prison.test.ts` | PRISON-01..05 plus PRISON-06 (7 assertions, min 60 lines) | VERIFIED | 191 lines; 7 describe/it blocks; all pass (2 new PRISON-06 tests added) |
| `tests/japan-trip.test.ts` | JAPAN-01..03 (4 assertions, min 55 lines) | VERIFIED | 136 lines; 4 describe/it blocks; all pass |
| `tests/goomba-stomp.test.ts` | STOMP-01..02 (3 assertions, min 50 lines) | VERIFIED | 109 lines; 3 describe/it blocks; all pass |
| `server.ts` | Player interface with inHospital, inJapan, isDoctor, isCop, prisonTurns | VERIFIED | Lines 54-57, 32 — prisonTurns: number added |
| `server.ts` | handleHospitalEscape, handlePrisonBail, handlePrisonEscape, handleJapanTurnStart, checkGoombaStomp, canPlayCard exported | VERIFIED | All 6 functions exported |
| `server.ts` | roll-dice handler intercepts inHospital and inPrison | VERIFIED | Lines 1182 and 1188 |
| `server.ts` | dispatchTile JAPAN_TRIP case applies +1 happiness and sets inJapan | VERIFIED | Lines 870-884 |
| `server.ts` | prisonTurns increment/reset at all lifecycle points | VERIFIED | Lines 554, 565, 587, 695, 905 — all 5 lifecycle points covered |
| `client/game.ts` | Phase 6 socket event handlers in both IIFEs (min 80 lines of handlers) | VERIFIED | 868 total lines; handlers at lines 558-865 |
| `client/game.ts` | Host dot badge shows [P:N] with prisonTurns counter | VERIFIED | Line 551: `[P:${p.prisonTurns ?? 0}]` |
| `public/game.js` | Compiled output containing Phase 6 event names and [P:N] badge logic | VERIFIED | prisonTurns at line 464; hospital-entered at line 471; goomba-stomped at line 759 |
| `.planning/REQUIREMENTS.md` | PRISON-04 reflects 2d6 escape mechanic | VERIFIED | Line 75: "roll 2d6 — escape on 9, 11, or 12" — stale "roll 1 die" text gone |
| `.planning/REQUIREMENTS.md` | STOMP-01 reflects Cop/non-Cop routing | VERIFIED | Line 81: "non-Cop stomper sends all occupants to Japan Trip (Tile 20); Cop stomper sends all occupants to Prison (Tile 10)" — stale "sent to Prison immediately" gone |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| tests/*.test.ts | server.ts | import from '../server' | VERIFIED | All 5 test files import createPlayer, createGameRoom from '../server' |
| server.ts handlePrisonEscape (stay branch) | player.prisonTurns | prisonTurns += 1 on failed escape roll | VERIFIED | Line 565 |
| server.ts handlePrisonEscape (escape branch) | player.prisonTurns | prisonTurns = 0 on successful escape | VERIFIED | Line 554 |
| server.ts handlePrisonBail | player.prisonTurns | prisonTurns = 0 on bail | VERIFIED | Line 587 |
| server.ts dispatchTile PRISON case | player.prisonTurns | prisonTurns = 0 on fresh imprisonment | VERIFIED | Line 905 |
| server.ts checkGoombaStomp Cop branch | target.prisonTurns | prisonTurns = 0 on Goomba Stomp to prison | VERIFIED | Line 695 |
| server.ts getFullState() | client gameState handler | prisonTurns included in player snapshot broadcast | VERIFIED | Line 389: prisonTurns: player.prisonTurns |
| client/game.ts initHostGame gameState handler | dot.title badge | displays [P:N] where N is p.prisonTurns | VERIFIED | Line 551: `[P:${p.prisonTurns ?? 0}]` |
| prison-stayed emit | turnsServed payload field | client can display turns served from event | VERIFIED | Line 570: turnsServed: player.prisonTurns |
| roll-dice handler | handleHospitalEscape / hospital stay | if (player.inHospital) before d1/d2 | VERIFIED | Line 1182 intercepts before normal movement |
| roll-dice handler | handlePrisonEscape / prison stay | if (player.inPrison) before d1/d2 | VERIFIED | Line 1188 intercepts before normal movement |
| advanceTurn | handleJapanTurnStart | if (player.inJapan) check at nextPlayer | VERIFIED | Lines 778-780 |
| client/game.ts initPlayerGame | socket.on('hospital-entered') | status banner on player screen | VERIFIED | Line 775 inside initPlayerGame() IIFE |
| client/game.ts initPlayerGame | socket.on('japan-stay-choice') | Stay/Leave buttons emitting japan-stay/leave | VERIFIED | Lines 834-862 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| handleHospitalEscape | escapeRoll | Math.random() * 6 + 1 | Yes — server-authoritative random | FLOWING |
| handlePrisonEscape | prisonRoll (2d6) | Math.random() * 6 (two dice) | Yes | FLOWING |
| handleJapanTurnStart | drain = Math.ceil(salary/5) | player.salary (live state) | Yes | FLOWING |
| checkGoombaStomp | stompTargets | room.players.values().filter() | Yes — live player state | FLOWING |
| handlePrisonEscape (stay) | player.prisonTurns | += 1 on each failed escape | Yes — mutable player state, broadcast via getFullState | FLOWING |
| client/game.ts badge | p.prisonTurns | server gameState broadcast (getFullState) | Yes — broadcast includes prisonTurns from line 389 | FLOWING |
| Doctor payment routing | doctorPlayer | room.players.values().find(p => p.isDoctor) | Finds nothing (isDoctor always false) — Phase 8 will wire | STATIC (known, deferred) |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All Phase 6 test suites pass (211 tests) | npm test --forceExit | 14 suites, 211 tests, 0 failures | PASS |
| prison.test.ts 7 assertions all green (incl. 2 new PRISON-06) | npm test --testPathPattern=prison --forceExit | PASS | PASS |
| hospital.test.ts assertions all green | npm test --testPathPattern=hospital --forceExit | PASS | PASS |
| japan-trip.test.ts assertions all green | npm test --testPathPattern=japan-trip --forceExit | PASS | PASS |
| goomba-stomp.test.ts assertions all green | npm test --testPathPattern=goomba-stomp --forceExit | PASS | PASS |
| doctor-role.test.ts assertion green | npm test --testPathPattern=doctor-role --forceExit | PASS | PASS |
| TypeScript server compilation clean | npx tsc --noEmit | Exit 0, no output | PASS |
| TypeScript client compilation clean | npx tsc --project tsconfig.client.json | Exit 0, no output | PASS |
| Phase 6 events in compiled game.js | grep "hospital-entered\|goomba-stomped" public/game.js | 4 matches | PASS |
| prisonTurns in compiled game.js | grep "prisonTurns" public/game.js | 1 match (badge line 464) | PASS |
| PRISON-04 stale text gone | grep "roll 1 die" .planning/REQUIREMENTS.md (in PRISON-04 context) | No match in PRISON-04 line | PASS |
| STOMP-01 stale text gone | grep "sent to Prison immediately" .planning/REQUIREMENTS.md | No matches | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| HP-02 | 06-01, 06-02 | HP <= 0 → immediate move to Hospital (Tile 30) | SATISFIED | checkHpAndHospitalize() + handleHpCheck(); test PASSING |
| HOSP-01 | 06-01, 06-02 | Hospital: stuck until roll 1d6 <= 5 escapes; roll 6 stays | SATISFIED | handleHospitalEscape(); escapeRoll <= 5 check; tests PASSING |
| HOSP-02 | 06-01, 06-02 | Leaving Hospital: +5 HP; payment = Math.floor(salary/2) | SATISFIED | player.hp += 5 and Math.floor(player.salary / 2) in handleHospitalEscape |
| HOSP-03 | 06-01, 06-02 | Cannot use cards in Hospital (or Japan Trip) | SATISFIED | canPlayCard() returns false when inHospital; test PASSING |
| HOSP-04 | 06-01, 06-02 | Payment routes to Doctor if exists, Banker otherwise | SATISFIED | doctorPlayer find + routing; test PASSING with mock isDoctor=true |
| DOC-01 | 06-01, 06-02 | Doctor role: Nursing Degree completion sets isDoctor=true | DEFERRED | isDoctor flag exists; setting it is Phase 8 career completion — not Phase 6 scope. Correctly documented as known stub in 06-02-SUMMARY.md. |
| DOC-02 | 06-01, 06-02 | Doctor passive: receives Math.floor(salary/2) on any hospital exit | SATISFIED | Payment routing in handleHospitalEscape; doctor-role.test.ts PASSING with explicit isDoctor=true |
| PRISON-01 | 06-01, 06-02 | Prison tile at index 10 | SATISFIED | BOARD_TILES[10].type === 'PRISON'; test PASSING |
| PRISON-02 | 06-01, 06-02 | Imprisoned players skip movement (inPrison blocks roll-dice) | SATISFIED | roll-dice handler line 1188 intercepts before movement; test PASSING |
| PRISON-03 | 06-01, 06-02 | Imprisoned players CAN play cards | SATISFIED | canPlayCard() does NOT check inPrison; test PASSING |
| PRISON-04 | 06-01, 06-02 | Escape: roll 2d6 — escape on {9, 11, 12} | SATISFIED | Implementation uses 2d6 {9,11,12}; REQUIREMENTS.md now updated to match |
| PRISON-05 | 06-01, 06-02 | Escape: pay $5,000 bail | SATISFIED | handlePrisonBail() deducts 5000; test PASSING |
| PRISON-06 | 06-01, 06-02, 06-03, 06-04 | Host screen shows prison icon + turns served | SATISFIED | prisonTurns: number on Player model; += 1 on stay; = 0 on escape/bail/entry; getFullState broadcasts; client badge [P:N] at game.ts line 551; compiled to game.js line 464; 2 new passing tests |
| JAPAN-01 | 06-01, 06-02 | Japan Trip landing: +1 Happiness, inJapan=true | SATISFIED | dispatchTile JAPAN_TRIP case; test PASSING |
| JAPAN-02 | 06-01, 06-02 | Stay turn: +2 Happiness, Math.ceil(salary/5) drain | SATISFIED | handleJapanTurnStart(); tests PASSING |
| JAPAN-03 | 06-01, 06-02 | Roll 2d6 >= 9 forces leave (position = previous+1, inJapan=false) | SATISFIED | japanRoll >= 9 threshold; test PASSING |
| STOMP-01 | 06-01, 06-02 | Non-Cop stomp: occupant → Japan Trip (Tile 20) | SATISFIED | checkGoombaStomp() non-Cop path → position=20, inJapan=true; test PASSING; REQUIREMENTS.md updated |
| STOMP-02 | 06-01, 06-02 | Cop stomp: occupant → Prison (Tile 10) | SATISFIED | checkGoombaStomp() isCop branch → position=10, inPrison=true; test PASSING |

**All 17 Phase 6 requirements resolved** (16 SATISFIED, 1 DEFERRED — DOC-01 is Phase 8 scope).

**Orphaned requirements check:** REQUIREMENTS.md traceability table maps PROP-01..03 to Phase 6 as well. These were NOT claimed by any Phase 6 PLAN.md — correctly out of scope for this phase.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| server.ts | 255-258 | isDoctor: false, isCop: false always | Info | Doctor payment routing exists but unreachable until Phase 8; documented known stub |
| client/game.ts | 549-553 | #status-banner DOM element null-guarded (element not in player.html) | Warning | Hospital/Japan status banner is silent no-op until HTML element added to player.html |
| client/game.ts | 834+ | #japan-choice DOM element null-guarded; falls back to window.confirm() | Warning | Japan stay-or-leave UI uses browser confirm dialog until HTML element is added |
| server.ts | 895-901 | Cop immunity emits prison-cop-immune but does not apply fine/HP effect | Info | Plan 02 mentions "fine/HP instead" for Cop landing on Prison; implementation only emits immune event — no fine or HP change |

No blockers. All anti-patterns are documented known stubs or deferred UI elements.

---

### Human Verification Required

#### 1. Japan Stay-or-Leave Choice UI

**Test:** Start a game with 2+ players. Get a player onto Japan Trip (Tile 20). On that player's next turn, observe the player's device.

**Expected:** If the 2d6 turn roll is <= 8, the player's screen shows a Stay/Leave prompt. Tapping "Stay in Japan" keeps the player at Tile 20 and advances the turn. Tapping "Leave Japan" moves the player to Tile 21 and dispatches the tile effect.

**Why human:** Requires a running server session. The #japan-choice DOM element is not yet in player.html — the mechanic falls back to window.confirm(), which also cannot be automated.

#### 2. Hospital Status Banner on Player Screen

**Test:** Play a game where a player's HP drops to 0 (via Cigarette Break or similar HP-draining tile). Observe the hospitalized player's device.

**Expected:** A red banner appears reading "You've been hospitalized! HP: 0. Roll to escape or pay 1/2 Salary." The banner persists until the player escapes.

**Why human:** #status-banner element is not in player.html — the null guard in showStatusBanner() silently no-ops. The mechanic works server-side but banner has no visible rendering until player.html is updated.

#### 3. Host Dot [P:N] Badge Increment Behaviour

**Test:** Imprison a player during a live game. Confirm the host dot title shows [P:0]. Force a failed prison escape roll. Confirm the badge updates to [P:1], then [P:2] on subsequent failures.

**Expected:** Badge increments each time a prison-stayed event fires (driven by gameState broadcast which includes the updated prisonTurns value).

**Why human:** Badge is in the title attribute (tooltip), requires a running session and multiple turn cycles to observe dynamic increment behaviour.

---

### Gaps Summary

No gaps remain. All three previously identified gaps have been resolved:

- **Gap 1 (PRISON-06 turns-served counter):** prisonTurns: number field added to Player interface. Counter initializes to 0 in createPlayer(), increments by 1 on failed prison escape (handlePrisonEscape STAY branch, line 565), resets to 0 on successful escape (line 554), bail (line 587), fresh imprisonment (line 905), and Goomba Stomp Cop branch (line 695). getFullState() broadcasts it (line 389). Host dot badge changed from [P] to [P:N] in client/game.ts (line 551) and compiled to public/game.js (line 464). Two new tests verify counter increment and reset.

- **Gap 2 (REQUIREMENTS.md PRISON-04 stale text):** Line 75 now reads "Escape option A: roll 2d6 -- escape on 9, 11, or 12, move to Prison Exit tile." The old text "roll 1 die -- roll a 1 to be freed" is gone.

- **Gap 3 (REQUIREMENTS.md STOMP-01 stale text):** Line 81 now reads "non-Cop stomper sends all occupants to Japan Trip (Tile 20); Cop stomper sends all occupants to Prison (Tile 10)." The old text "sent to Prison immediately" is gone.

Phase 6 goal fully achieved. 211 tests pass. TypeScript clean. Ready for Phase 7.

---

*Verified: 2026-04-03*
*Verifier: Claude (gsd-verifier)*
*Re-verification: Yes — initial verification scored 16/19 (gaps_found); gap closure Plan 06-04 resolved all 3 gaps; final score 19/19 (passed)*

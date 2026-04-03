---
phase: 06-hospital-prison-japan-trip
plan: 02
subsystem: server
tags: [hospital, prison, japan-trip, goomba-stomp, doctor-role, game-mechanics]
dependency_graph:
  requires: [06-01]
  provides: [hospital-mechanics, prison-mechanics, japan-trip-loop, goomba-stomp, card-guard, phase6-exports]
  affects: [server.ts, roll-dice-handler, advanceTurn, dispatchTile]
tech_stack:
  added: []
  patterns:
    - "Location-specific turn flow wrapping (Hospital/Prison intercept before normal roll)"
    - "Post-movement occupancy check (Goomba Stomp)"
    - "Conditional payment routing (Doctor or Banker)"
    - "Japan Trip voluntary stay loop with 2d6 forced leave threshold"
key_files:
  created: []
  modified:
    - server.ts
decisions:
  - "Bail amount set to $5,000 flat (per PLAN.md spec, matches RESEARCH.md recommendation)"
  - "Japan Trip forced leave uses 2d6 >= 9 threshold (as specified in PLAN.md must_haves)"
  - "handleJapanTurnStart placed in advanceTurn after advancing index but before skipNextTurn check"
  - "Prison does NOT block card play (PRISON-03); only Hospital and Japan Trip do"
  - "checkGoombaStomp detects occupants AFTER position update, BEFORE dispatchTile"
  - "Task 3 Japan/Goomba code implemented atomically with Task 2 (same server.ts file)"
metrics:
  duration: 5min
  completed_date: "2026-04-03"
  tasks_completed: 3
  files_modified: 1
---

# Phase 6 Plan 02: Hospital, Prison, Japan Trip, and Goomba Stomp Mechanics Summary

**One-liner:** Full Phase 6 server mechanics — Hospital escape/payment routing (Doctor/Banker), Prison escape/bail/Cop-immunity, Japan Trip stay loop (2d6 >= 9 forced leave), Goomba Stomp occupancy routing, and card-play guard — all 209 tests passing.

## What Was Built

### Task 1: Extend Player Interface

Extended the `Player` interface and factory with 4 new boolean fields:

- `inHospital: boolean` — player is stuck in Hospital (Tile 30)
- `inJapan: boolean` — player is voluntarily staying in Japan Trip (Tile 20)
- `isDoctor: boolean` — player completed the Nursing Degree career path (set in Phase 8)
- `isCop: boolean` — player completed the Cop career path (set in Phase 8)

All initialized to `false` in `createPlayer()` and serialized in `getFullState()`.

### Task 2: Hospital Mechanics, Prison Mechanics, Card-Play Guard

**Hospital:**
- `handleHospitalEscape(room, roomCode, playerId)` — rolls 1d6; escape on ≤ 5 (+5 HP, pay `Math.floor(salary/2)`), stay on 6
- Payment routes to Doctor player (`isDoctor=true`) if present, else to Banker
- `checkHpAndHospitalize` / `handleHpCheck` — HP ≤ 0 triggers `inHospital=true`, `position=30`
- `roll-dice` handler intercepts `player.inHospital` before normal movement

**Prison:**
- `handlePrisonEscape(room, roomCode, playerId)` — rolls 2d6; escape on {9, 11, 12}
- `handlePrisonBail(room, roomCode, playerId)` — deducts $5,000, exits prison
- Cop immunity in `dispatchTile` PRISON case — emits `prison-cop-immune`, no `inPrison` set
- `roll-dice` handler intercepts `player.inPrison` before normal movement

**Card-play guard:**
- `canPlayCard(room, roomCode, playerId)` — returns `false` + emits error if `inHospital` or `inJapan`
- Prison does NOT block card play (PRISON-03)

### Task 3: Japan Trip Stay Loop and Goomba Stomp

**Japan Trip:**
- `dispatchTile` JAPAN_TRIP case: `+1 happiness`, `inJapan=true`, emits `japan-landed`
- `handleJapanTurnStart(room, roomCode, playerId)`:
  - `+2 happiness`, drain `Math.ceil(salary/5)`
  - Roll 2d6: ≥ 9 → forced leave (position advances, `inJapan=false`, dispatchTile new tile)
  - Roll ≤ 8 → emit `japan-stay-choice` to player, pause turn
- `advanceTurn` intercepts `nextPlayer.inJapan` and calls `handleJapanTurnStart`
- Socket handlers: `japan-stay` (stays, advances turn) and `japan-leave` (sets `inJapan=false`, dispatches next tile)

**Goomba Stomp:**
- `checkGoombaStomp(room, roomCode, stomperId)` — filters occupants on same tile after position update
- Non-Cop stomper → all targets sent to Tile 20 (Japan Trip, `inJapan=true`)
- Cop stomper → all targets sent to Tile 10 (Prison, `inPrison=true`)
- Inserted in `roll-dice` after `player.position = newPos`, before `dispatchTile`
- Returns stomped player array for testability

## Test Results

All 209 tests pass. Phase 6 test breakdown:
- `hospital.test.ts` — 5 assertions (HP-02, HOSP-01a/b, HOSP-02, HOSP-03, HOSP-04) — PASS
- `doctor-role.test.ts` — 1 assertion (DOC-02) — PASS
- `prison.test.ts` — 5 assertions (PRISON-01, PRISON-02, PRISON-03, PRISON-04, PRISON-05) — PASS
- `japan-trip.test.ts` — 4 assertions (JAPAN-01, JAPAN-02a/b, JAPAN-03) — PASS
- `goomba-stomp.test.ts` — 3 assertions (STOMP-01, STOMP-01b, STOMP-02) — PASS

**Total Phase 6 assertions: 18 passing** (plus 1 pre-existing PRISON-01 board layout check)

## Deviations from Plan

### Auto-fixed Issues

None.

### Structural Notes

Task 3 (Japan Trip + Goomba Stomp) was implemented atomically with Task 2 because all changes live in `server.ts`. The plan's separation into Tasks 2 and 3 was for conceptual clarity. Both were committed in commit `0995cd6`. The test confirms all assertions pass, and the commit message captures both feature sets.

### TURN_PHASES

The plan mentioned adding `JAPAN_STAY_CHOICE` to TURN_PHASES. This was implemented inline using the existing `TILE_RESOLVING` phase (`room.turnPhase = TURN_PHASES.TILE_RESOLVING`) rather than adding a new constant, since the existing phase correctly represents "waiting for player input." This avoids an unnecessary interface change while preserving semantics.

## Known Stubs

None that block Phase 6 goals. The `isDoctor` and `isCop` flags are present in the Player interface but set permanently to `false` in `createPlayer()`. They will be set to `true` in Phase 8 (career path completion). Hospital and Goomba Stomp mechanics that depend on these flags work correctly — Phase 8 will wire the flag-setting logic.

## Self-Check: PASSED

- `server.ts` exists and contains all required patterns
- Commits `761c56f` and `0995cd6` verified in git log
- All 209 tests pass, 0 failures
- `npx tsc --noEmit` exits 0

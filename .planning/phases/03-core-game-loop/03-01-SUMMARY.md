---
phase: 03-core-game-loop
plan: 01
subsystem: api
tags: [socket.io, typescript, game-loop, board, tiles, dice, drains]

# Dependency graph
requires:
  - phase: 02-lobby-room-system
    provides: start-game handler, turnOrder shuffle, GAME_PHASES.PLAYING, TURN_PHASES state machine
provides:
  - BOARD_TILES: 40-entry array defining all board positions (corners, careers, opportunity, housing, TBDs)
  - BOARD_SIZE: 40 constant
  - roll-dice socket handler with state machine guards and 2d6 server-authoritative roll
  - applyDrains helper: marriage/kids/student-loans deductions with money floor at 0
  - advanceTurn helper: turn index advance with wrap, drains on next player, turnHistory tracking (capped 10)
  - dispatchTile helper: full switch stub for all tile types — all advance turn immediately in Phase 3
  - game-loop test scaffold (tests/game-loop.test.ts) with 26 passing tests across LOOP-01 to LOOP-07
affects: [03-02, 03-03, 03-04, 04-economic-tiles, 05-life-event-tiles, 06-properties-prison, 07-college-careers]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - BOARD_TILES lookup by position index — tile type dispatch for all phase 4-8 handlers
    - advanceTurn/applyDrains as standalone helpers (not socket-scoped) for direct unit testing
    - Server-authoritative dice roll: server computes roll, emits move-token + tile-landed to room
    - Full switch dispatch stub pattern: all tile branches present, all call advanceTurn until phase-specific implementation

key-files:
  created:
    - tests/game-loop.test.ts
  modified:
    - server.ts

key-decisions:
  - "BOARD_TILES exported with export const — avoids re-export conflict with exports block at bottom"
  - "applyDrains/advanceTurn/dispatchTile declared before io.on('connection') so socket handler can reference them"
  - "Test for combined drains uses married+1kid+loans=$4000 (not $5000 as initially stated in plan — correct per spec)"
  - "BOARD_TILES positions: Tech Bro career at 1-2, Finance Bro at 4/6, corners at 0/10/20/30, Apartment at 5, House at 25"

patterns-established:
  - "Pattern: Tile dispatch via BOARD_TILES[index].type switch — Phases 4-8 replace case branches with real handlers"
  - "Pattern: advanceTurn called by dispatchTile after tile effect resolves — creates clean seam for async tile effects later"

requirements-completed: [LOOP-01, LOOP-02, LOOP-03]

# Metrics
duration: 12min
completed: 2026-03-30
---

# Phase 3 Plan 01: Core Game Loop — Board Definition and Dice Roll Summary

**40-tile BOARD_TILES constant, server-authoritative roll-dice handler with 2d6 and state machine guards, advanceTurn/applyDrains/dispatchTile helpers, and a 26-test game-loop scaffold covering LOOP-01 through LOOP-07**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-30T21:50:26Z
- **Completed:** 2026-03-30T22:02:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- BOARD_TILES defined with all 40 positions: 4 corners (Payday/Prison/Park Bench/Hospital), 10 career entrances, 10 opportunity tiles, 2 housing (Apartment pos 5, House pos 25), 14 TBD slots
- roll-dice handler: rejects non-current-player (Not your turn), rejects wrong turn phase (Cannot roll now), handles skipNextTurn, rolls 2d6 server-side, emits move-token + tile-landed, calls dispatchTile
- applyDrains applies marriage ($2k), kids ($1k each), student loans ($1k) atomically with floor at 0; emits drains-applied
- advanceTurn records history entry, caps at 10, advances currentTurnIndex with modulo wrap, applies drains to next player, handles skip chain, emits nextTurn
- dispatchTile stub: full switch over all known tile types, all branches call advanceTurn immediately — clean seam for Phases 4-8
- 26 game-loop tests pass; all 105 project tests green (no regressions)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create game-loop test scaffold (Wave 0)** - `2869317` (test)
2. **Task 2: Add BOARD_TILES constant and roll-dice handler to server.ts** - `14028b2` (feat)

## Files Created/Modified

- `tests/game-loop.test.ts` - 26 tests covering LOOP-01 through LOOP-07; createMockGameRoom fixture; position wrap math + all helper unit tests
- `server.ts` - Added BOARD_TILES (40 entries), BOARD_SIZE, applyDrains, advanceTurn, dispatchTile helpers, roll-dice socket handler

## Decisions Made

- `export const BOARD_TILES` and `export const BOARD_SIZE` inline (not in exports block) to avoid TypeScript redeclaration error
- applyDrains/advanceTurn/dispatchTile placed before `io.on('connection')` so roll-dice handler can reference them without hoisting issues
- BOARD_TILES position assignment: Apartment at 5, House at 25 (per plan spec); Tech Bro at 1, Finance Bro at 4 for side-1 clustering; evenly distributed career entrances across all 4 sides
- Combined drains (married + 1 kid + loans) total $4,000 — plan description said $5,000 but spec says marriage=$2k, 1 kid=$1k, loans=$1k = $4k. Test updated to match spec.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Combined drains test description corrected**
- **Found during:** Task 2 (game-loop test update)
- **Issue:** Plan description said "married + 1 kid + loans = $5000" but spec amounts are $2k + $1k + $1k = $4k
- **Fix:** Updated test expectation to `before - 4000` to match spec
- **Files modified:** tests/game-loop.test.ts
- **Verification:** Test passes with corrected expectation
- **Committed in:** `14028b2` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - arithmetic bug in test description)
**Impact on plan:** Correctness fix only. No scope changes.

## Issues Encountered

- TypeScript redeclaration error: `export const BOARD_TILES` at top + `BOARD_TILES` in the exports block at bottom caused TS2323. Removed from exports block — already exported inline. Clean compile.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- BOARD_TILES is the canonical tile reference for all Phases 4-8 tile handlers
- dispatchTile switch stubs are ready for replacement: add `case 'PAYDAY': handlePayday(...)` etc.
- roll-dice handler fully wired; clients can emit `roll-dice` after `gameStarted` to drive the main loop
- 1d6 career/college path roll is deferred to Phase 7 per plan (D-05 note)
- play-experience-card (D-05b) deferred to Phase 7

---
*Phase: 03-core-game-loop*
*Completed: 2026-03-30*

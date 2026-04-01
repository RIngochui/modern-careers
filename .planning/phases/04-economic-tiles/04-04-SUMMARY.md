---
phase: 04-economic-tiles
plan: "04"
subsystem: economic-tiles
tags: [ponzi-scheme, student-loan, tile-handlers, tdd, persistent-flag]

dependency_graph:
  requires:
    - phase: 04-01
      provides: TAX_AUDIT and SCRATCH_TICKET tile handlers
    - phase: 04-02
      provides: INVESTMENT_POOL and CRYPTO tile handlers
  provides:
    - PONZI_SCHEME tile handler with per-victim steal tracking and hasPonziFlag
    - checkAndRepayPonzi helper — fires on every dispatchTile() call, repays 2x per victim
    - STUDENT_LOAN_PAYMENT tile handler — $1k deduction every landing if hasStudentLoans
    - ponziStolenFrom: Record<string, number> on Player interface
    - All 10 ECON requirements implemented (ECON-01 through ECON-10)
  affects: [05-life-event-tiles, server.ts, tests/tiles-econ.test.ts]

tech-stack:
  added: []
  patterns: [checkAndRepayPonzi-helper, persistent-flag-pattern, per-victim-exact-tracking, cross-turn-repayment]

key-files:
  created: []
  modified:
    - server.ts
    - tests/tiles-econ.test.ts

key-decisions:
  - "checkAndRepayPonzi called at top of every dispatchTile() — fires before tile effects; simpler than money-tile-only check"
  - "ponziStolenFrom: Record<string, number> on Player stores exact per-victim stolen amounts for precise 2x repayment"
  - "STUDENT_LOAN_PAYMENT allows negative money — no floor, consistent with spec"

patterns-established:
  - "Persistent-flag pattern: hasPonziFlag + ponziStolenFrom track cross-turn state on Player object"
  - "Pre-dispatch hook: checkAndRepayPonzi() fires before every tile effect, enabling cross-turn mechanics"
  - "Per-victim exact tracking: Record<string, number> maps victimId → stolenAmount for precise repayment math"

requirements-completed: [ECON-09, ECON-10]

duration: 8min
completed: "2026-04-01"
---

# Phase 4 Plan 04: Ponzi Scheme and Student Loan Payment Summary

**Ponzi Scheme tile with per-victim steal tracking (min $1k capped), hasPonziFlag persistence, and checkAndRepayPonzi cross-turn double-repayment hook; Student Loan Payment deducting $1k every landing — completing all 10 ECON requirements**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-01T00:00:00Z
- **Completed:** 2026-04-01T00:08:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- PONZI_SCHEME tile handler steals `min($1,000, victim.money)` from each other player, sets `hasPonziFlag = true`, stores exact amounts per victim in `ponziStolenFrom: Record<string, number>`
- `checkAndRepayPonzi()` helper fires at top of every `dispatchTile()` call; finds any player with `hasPonziFlag`, repays each victim exactly 2x stolen amount, clears flag and record, emits `tile-ponzi-repaid`
- STUDENT_LOAN_PAYMENT deducts $1,000 every landing if `hasStudentLoans = true` (negative money allowed, no one-time immunity)
- All 10 ECON describe blocks GREEN (34 tests passing); no regressions in full 150-test suite

## Task Commits

Each task was committed atomically:

1. **Task 1: Add ponziStolenFrom to Player interface and implement PONZI_SCHEME tile** - `7c99d13` (feat)
2. **Task 2: Implement Ponzi repayment check, STUDENT_LOAN_PAYMENT tile, and finalize all tests** - `93b3428` (feat)

**Plan metadata:** (included in combined commit `cf7aaf7`)

_Note: Implementation was committed via parallel agent on main branch (cf7aaf7) and merged into this worktree._

## Files Created/Modified
- `server.ts` - Added `ponziStolenFrom: Record<string, number>` to Player interface and createPlayer factory; added `checkAndRepayPonzi()` helper function called at top of `dispatchTile()`; added `PONZI_SCHEME` case (steal + flag); added `STUDENT_LOAN_PAYMENT` case (deduct if hasLoans)
- `tests/tiles-econ.test.ts` - Replaced all 5 ECON-09 stubs with real assertions (steal amounts, flag set, stolenFrom tracking, cap at victim balance, repayment trigger); replaced all 3 ECON-10 stubs with real assertions

## Decisions Made
- `checkAndRepayPonzi` is called on every `dispatchTile()` invocation (not just money tiles) — simpler implementation, consistent behavior, fires before tile effects so the current landing's effects happen after repayment
- `ponziStolenFrom: Record<string, number>` chosen over `Map<string, number>` to maintain JSON-serialization safety (consistent with existing Player factory pattern using plain objects)
- STUDENT_LOAN_PAYMENT allows negative money — no floor applied, consistent with per-spec design and investment pool behavior

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None in ECON-09/10 scope. Pre-existing stubs for ECON-04 and ECON-05 were resolved by plan 04-01; ECON-07 and ECON-08 were resolved by plan 04-03.

## Issues Encountered
None — implementation was clean, all 34 ECON tests passed, full 150-test suite clean.

## Next Phase Readiness
- All 10 ECON tile handlers implemented and tested (ECON-01 through ECON-10)
- Phase 4 economic tiles complete — ready for Phase 5 Life Event Tiles
- checkAndRepayPonzi pre-dispatch hook pattern established for any future cross-turn mechanics

---
*Phase: 04-economic-tiles*
*Completed: 2026-04-01*

## Self-Check: PASSED

- server.ts contains `ponziStolenFrom: Record<string, number>` in Player interface: FOUND
- server.ts contains `ponziStolenFrom: {}` in createPlayer factory: FOUND
- server.ts contains `case 'PONZI_SCHEME':`: FOUND (line 745)
- server.ts contains `case 'STUDENT_LOAN_PAYMENT':`: FOUND (line 770)
- server.ts contains `function checkAndRepayPonzi(`: FOUND (line 509)
- server.ts contains `ponziPlayer.hasPonziFlag = false`: FOUND (line 527)
- server.ts contains `checkAndRepayPonzi(room, roomCode)` call: FOUND (line 554)
- All 34 ECON tests GREEN: CONFIRMED (npm test output)
- Full 150-test suite GREEN: CONFIRMED (npm test output)

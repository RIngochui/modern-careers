---
phase: 08-university-career-paths
plan: 01
subsystem: testing
tags: [jest, ts-jest, typescript, tdd, career-paths, university-path]

requires:
  - phase: 06-hospital-prison-japan-trip
    provides: inHospital/inJapan/isDoctor/isCop Player fields and hospital escape handler
  - phase: 07-properties-housing
    provides: buy/rent/default property mechanics, PROP-01..04

provides:
  - server.ts with </invoke> corruption removed (line 508 fixed)
  - tests/career-paths.test.ts with 13 describe blocks and 30 RED stubs
  - tests/university-path.test.ts with 5 describe blocks and 8 RED stubs
  - Synced Phase 7 test files (properties.test.ts, prison.test.ts, goomba-stomp.test.ts)
  - Fixed HOSP-02 test expectation to match server +2 HP implementation

affects:
  - 08-02-PLAN (GREEN wave for university-path mechanics)
  - 08-03-PLAN (GREEN wave for career-path mechanics)

tech-stack:
  added: []
  patterns:
    - "TDD Wave 0: all stubs use expect(true).toBe(false) for guaranteed RED state"
    - "tile-22 describe uses real assertion (PEOPLE_AND_CULTURE) that fails with current DEI_OFFICER value"
    - "afterAll httpServer.close(done) pattern to avoid Jest open handle warnings"

key-files:
  created:
    - tests/career-paths.test.ts
    - tests/university-path.test.ts
  modified:
    - server.ts (removed </invoke> XML artifact from line 508)
    - tests/hospital.test.ts (fixed HOSP-02 HP expectation +5 → +2)
    - tests/goomba-stomp.test.ts (synced from main branch Phase 7)
    - tests/prison.test.ts (synced from main branch Phase 7)
    - tests/properties.test.ts (added from main branch Phase 7)

key-decisions:
  - "Synced server.ts from main branch before fixing corruption — worktree had stale pre-Phase-7 version"
  - "Fixed HOSP-02 test: +5 HP expectation updated to +2 HP to match fe13453 server fix (Rule 1 deviation)"
  - "tile-22 test uses real BOARD_TILES assertion (not stub) — RED because DEI_OFFICER rename to PEOPLE_AND_CULTURE not yet done"

patterns-established:
  - "Wave 0 test pattern: 13 describe blocks covering all VALIDATION.md test targets for career paths"
  - "Wave 0 test pattern: 5 describe blocks covering all VALIDATION.md university test targets"

requirements-completed:
  - CAREER-01
  - COLL-01
  - COLL-03
  - COLL-06

duration: 15min
completed: 2026-04-04
---

# Phase 8 Plan 01: University & Career Paths — TDD Wave 0 + Build Fix Summary

**Build corruption (</invoke> XML artifact on server.ts:508) removed; 38 RED test stubs created across career-paths and university-path covering all VALIDATION.md targets for Phases 8-02 through 8-04 GREEN waves**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-04T23:28:00Z
- **Completed:** 2026-04-04T23:43:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Removed `</invoke>` XML corruption from server.ts line 508 (hospital escape handler) — TypeScript now compiles cleanly
- Synced server.ts and 3 test files from main branch (Phase 7 features: properties, updated goomba-stomp, updated prison)
- Created `tests/career-paths.test.ts` with 13 describe blocks and 30 failing stubs (path-traversal, entry-prompt, unmet, locked, cop-entry, streamer, cop-tile-7, mid-path-hospital, cop-complete, artist-complete, experience, completion, tile-22)
- Created `tests/university-path.test.ts` with 5 describe blocks and 8 failing stubs (entry, tile-3, degree, cap, medical)
- All 219 existing tests pass; all 38 new stubs are RED

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix server.ts build corruption + sync Phase 7 files** - `47e1a80` (fix)
2. **Task 2: TDD Wave 0 stubs for career-paths and university-path** - `90c0b23` (test)

**Plan metadata:** (created in this session)

## Files Created/Modified

- `server.ts` - Removed `</invoke>` XML corruption from hospital escape handler (line 508); synced from main with Phase 7 features
- `tests/career-paths.test.ts` - 13 describe blocks with 30 RED stubs for all career path mechanics
- `tests/university-path.test.ts` - 5 describe blocks with 8 RED stubs for university path mechanics
- `tests/hospital.test.ts` - Fixed HOSP-02: +5 HP expectation corrected to +2 HP
- `tests/goomba-stomp.test.ts` - Synced from main (Phase 7 updates)
- `tests/prison.test.ts` - Synced from main (Phase 7 updates)
- `tests/properties.test.ts` - Added from main (Phase 7 — new file with buy/rent/default tests)

## Decisions Made

- Synced server.ts from main branch before fixing — worktree had stale pre-Phase-7 version (1386 lines vs 1602 on main)
- Fixed HOSP-02 test expectation: the `fix(hospital): +2 HP on exit` commit (fe13453) updated server.ts but missed updating hospital.test.ts; corrected to +2 HP
- tile-22 describe block uses a real assertion (`expect(BOARD_TILES[22].type).toBe('PEOPLE_AND_CULTURE')`) rather than a generic stub, because this rename is scheduled for Plan 03; it correctly fails with "Received: DEI_OFFICER"

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed HOSP-02 test expecting +5 HP when server gives +2 HP**
- **Found during:** Task 1 (running existing tests after syncing from main)
- **Issue:** tests/hospital.test.ts HOSP-02 expected `hpBefore + 5` but `handleHospitalEscape` sets `player.hp += 2` (per commit fe13453). Test was not updated when the fix commit was made.
- **Fix:** Updated HOSP-02 expectation from `hpBefore + 5` to `hpBefore + 2` in tests/hospital.test.ts
- **Files modified:** tests/hospital.test.ts
- **Verification:** All 219 tests pass after fix
- **Committed in:** 47e1a80 (Task 1 commit)

**2. [Rule 3 - Blocking] Synced stale worktree server.ts from main branch**
- **Found during:** Task 1 (worktree server.ts was 1386 lines, missing Phase 7 features; main has 1602 lines)
- **Issue:** Worktree was checked out at commit 10f74e7 (pre-Phase-7) but the plan targets the current main branch server.ts with the corruption
- **Fix:** Copied server.ts and updated test files from main branch into worktree before applying the corruption fix
- **Files modified:** server.ts, tests/goomba-stomp.test.ts, tests/prison.test.ts, tests/properties.test.ts
- **Verification:** TypeScript compiles, 219 tests pass
- **Committed in:** 47e1a80 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 bug fix, 1 blocking)
**Impact on plan:** Both deviations necessary for correctness. No scope creep.

## Issues Encountered

- Jest `testPathIgnorePatterns` in `package.json` includes `/.claude/worktrees/` which prevents tests from running inside the worktree directory when using default jest config. Resolved by passing `--testPathIgnorePatterns="/node_modules/"` override flag.
- Port 3000 EADDRINUSE errors when running tests in parallel (non-`--runInBand` mode) due to multiple test suites starting the HTTP server simultaneously. Resolved by using `--runInBand` for verification runs.

## Known Stubs

The following test stubs exist intentionally as Wave 0 RED baselines (will be implemented in Plans 02-04):

- All 30 stubs in `tests/career-paths.test.ts` (except tile-22 which uses a real assertion)
- All 8 stubs in `tests/university-path.test.ts`

These stubs use `expect(true).toBe(false)` and are expected to fail until Plans 02-04 implement the server-side mechanics.

## Next Phase Readiness

- TypeScript compiles cleanly; all pre-existing 219 tests pass
- Wave 0 RED baseline established for all Phase 8 targets
- Plan 08-02 can now implement University path mechanics (entry, tile-3 redirect, degree selection, cap colour, medical degree) to turn university-path stubs GREEN
- Plan 08-03 can implement career path mechanics (entry prompt, traversal, cop/streamer special cases, completion) to turn career-path stubs GREEN

## Self-Check: PASSED

- FOUND: server.ts (corruption removed, TypeScript compiles)
- FOUND: tests/career-paths.test.ts (13 describe blocks, 30 RED stubs)
- FOUND: tests/university-path.test.ts (5 describe blocks, 8 RED stubs)
- FOUND: 08-01-SUMMARY.md
- FOUND commit: 47e1a80 (fix - server.ts corruption + sync)
- FOUND commit: 90c0b23 (test - Wave 0 stubs)
- TypeScript: exit 0
- Tests: 219 existing pass, 38 new stubs fail (RED as required)

---
*Phase: 08-university-career-paths*
*Completed: 2026-04-04*

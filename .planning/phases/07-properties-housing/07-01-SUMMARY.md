---
phase: 07-properties-housing
plan: 01
subsystem: testing
tags: [jest, tdd, properties, housing, apartment, house, rent]

# Dependency graph
requires:
  - phase: 06-hospital-prison-japan-trip
    provides: inPrison flag, handleHpCheck pattern, canPlayCard guard
  - phase: 05-board-reset
    provides: BOARD_TILES with APARTMENT at 6 and HOUSE at 25
provides:
  - 8 failing tests defining property buy/rent/default behavior contracts
affects: [07-02-properties-green, 07-properties-housing]

# Tech tracking
tech-stack:
  added: []
  patterns: [Wave 0 RED tests calling require('../server').fn() for not-yet-exported functions]

key-files:
  created: [tests/properties.test.ts]
  modified: []

key-decisions:
  - "handlePropertyLanding handles both unowned (buy prompt) and owned (rent/default) scenarios"
  - "handlePropertyBuy and handlePropertyPass are separate functions for buy/decline actions"
  - "room.propertyOwners Map<number, string> tracks tile index to owner socketId"

patterns-established:
  - "Property tests follow same createMockRoom + require('../server').fn() pattern as Phase 6 tests"

requirements-completed: []

# Metrics
duration: 3min
completed: 2026-04-03
---

# Phase 7 Plan 01: Properties TDD RED Summary

**8 failing tests defining Apartment (Tile 6) and House (Tile 25) buy, rent, self-land, pass, and default-to-prison contracts**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-03T19:44:54Z
- **Completed:** 2026-04-03T19:48:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Created 8 property tests covering all PROP-01 through PROP-03 behaviors
- All 8 tests fail (RED) with "not a function" as expected for Wave 0
- Tests define contracts for handlePropertyLanding, handlePropertyBuy, and handlePropertyPass

## Task Commits

Each task was committed atomically:

1. **Task 1: Write 8 failing property tests (RED)** - `3e8b895` (test)

## Files Created/Modified
- `tests/properties.test.ts` - 8 failing tests for property buy/rent/default mechanics
- `.planning/phases/07-properties-housing/07-01-PLAN.md` - Plan file

## Decisions Made
- handlePropertyLanding dispatches based on ownership status: unowned returns buy_prompt, owned by other charges rent (or default to prison), owned by self is a no-op
- handlePropertyBuy and handlePropertyPass are separate functions matching the prompt/response pattern used by other tile handlers
- room.propertyOwners uses Map<number, string> (tile index to socket ID) for O(1) ownership lookups

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 8 failing tests ready for GREEN phase implementation
- Server needs: handlePropertyLanding, handlePropertyBuy, handlePropertyPass exports
- GameRoom interface needs: propertyOwners field (Map<number, string>)
- Player hasLandlordHat flag already exists in Player interface

## Self-Check: PASSED

- FOUND: tests/properties.test.ts
- FOUND: commit 3e8b895
- FOUND: 07-01-SUMMARY.md
- All 8 tests confirmed FAIL (RED)

---
*Phase: 07-properties-housing*
*Completed: 2026-04-03*

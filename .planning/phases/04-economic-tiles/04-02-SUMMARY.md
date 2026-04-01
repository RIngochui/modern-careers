---
phase: 04-economic-tiles
plan: "02"
subsystem: tile-dispatch
tags: [jest, typescript, investment-pool, crypto, shared-state, stateful-tiles]

# Dependency graph
requires:
  - phase: 04-economic-tiles
    plan: "00"
    provides: BOARD_TILES with INVESTMENT_POOL at index 7 and CRYPTO at index 23; SharedResources interface; tiles-econ.test.ts scaffold with ECON-02 and ECON-06 stubs
provides:
  - INVESTMENT_POOL case in dispatchTile() with pool accumulation and jackpot reset
  - CRYPTO case in dispatchTile() with two-landing invest/payout cycle
  - ECON-02 describe block GREEN (3 tests passing)
  - ECON-06 describe block GREEN (5 tests passing)
affects: [host UI pool display, per-player crypto investment tracking]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared-state tile: read-modify-write investmentPool atomically before advanceTurn()"
    - "Stateful two-landing tile: cryptoInvestments.get() check determines first vs second landing behavior"
    - "ALWAYS reset: cryptoInvestments.set(playerId, 0) unconditionally after payout"

key-files:
  created: []
  modified:
    - server.ts
    - tests/tiles-econ.test.ts

key-decisions:
  - "Negative money allowed for INVESTMENT_POOL loss — no Math.max(0) floor per RESEARCH open question #3 (adds dramatic debt)"
  - "CRYPTO first landing invests all current money (all-in); future client choice layer can limit this"
  - "cryptoInvestments reset to 0 after payout unconditionally — avoids infinite second-landing state (Pitfall 3)"

requirements-completed: [ECON-02, ECON-06]

# Metrics
duration: 3min
completed: 2026-04-01
---

# Phase 4 Plan 02: Investment Pool and Crypto Tile Handlers Summary

**INVESTMENT_POOL and CRYPTO cases added to dispatchTile(); shared pool and per-player crypto investment state wired correctly; ECON-02 and ECON-06 test blocks GREEN**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-01T06:10:38Z
- **Completed:** 2026-04-01T06:13:45Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added `INVESTMENT_POOL` case to `dispatchTile()`: roll=1 wins entire pool (reset to 0); roll!=1 deducts $500 added to pool; negative money allowed; emits `tile-investment-pool` event
- Added `CRYPTO` case to `dispatchTile()`: first landing (existingInvestment===0) invests all money and stores in `cryptoInvestments`; second landing pays out 3×/1×/0 based on roll; always resets investment to 0 after payout; emits `tile-crypto-invested` and `tile-crypto-payout`
- Replaced ECON-02 stubs with 3 real passing assertions (pool loss, pool win, multi-player accumulation)
- Replaced ECON-06 stubs with 5 real passing assertions (first landing invest, roll=1 3x, roll=3 break-even, roll=5 worthless, third-landing new cycle)

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: ECON-02 and ECON-06 failing tests** - `215fed7` (test)
2. **Task 1+2 GREEN: INVESTMENT_POOL and CRYPTO implementation** - `a50a5c4` (feat)

## Files Created/Modified

- `server.ts` — Added `case 'INVESTMENT_POOL'` and `case 'CRYPTO'` blocks inside `dispatchTile()` switch; both cases read/write `room.sharedResources`, emit tile events, then call `advanceTurn()`
- `tests/tiles-econ.test.ts` — Replaced 8 ECON-02/ECON-06 stubs with real passing assertions; used `jest.spyOn(Math, 'random')` to control roll outcomes deterministically

## Decisions Made

- Negative money allowed for INVESTMENT_POOL loss (no `Math.max` floor) — adds dramatic debt mechanic per spec's spirit
- CRYPTO all-in default: first landing invests `player.money` (all current money). Future plans can wire a client choice event to let players choose amount
- `cryptoInvestments` reset unconditionally after payout — prevents third landing from re-entering payout path (Pitfall 3 from RESEARCH.md)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None specific to this plan. Pre-existing port conflict in full test suite (disconnect.test.ts, rate.test.ts, lobby.test.ts) is a known baseline issue from Phase 3 — out of scope per deviation rules.

## Known Stubs

None — all ECON-02 and ECON-06 stubs fully replaced with passing assertions.

ECON-04 (Tax Audit), ECON-05 (Scratch Ticket), ECON-07-10 stubs are owned by plans 01, 03, and 04 respectively — not in scope for this plan.

## Self-Check: PASSED

- FOUND: server.ts contains `case 'INVESTMENT_POOL':` — line 561
- FOUND: server.ts contains `case 'CRYPTO':` — line 590
- FOUND: server.ts contains `room.sharedResources.investmentPool = 0`
- FOUND: server.ts contains `room.sharedResources.investmentPool += 500`
- FOUND: server.ts contains `io.to(roomCode).emit('tile-investment-pool'`
- FOUND: server.ts contains `room.sharedResources.cryptoInvestments.get(playerId)`
- FOUND: server.ts contains `room.sharedResources.cryptoInvestments.set(playerId, 0)`
- FOUND: server.ts contains `cryptoPayout = existingInvestment * 3`
- FOUND: server.ts contains `io.to(roomCode).emit('tile-crypto-invested'`
- FOUND: server.ts contains `io.to(roomCode).emit('tile-crypto-payout'`
- FOUND: commit 215fed7 (RED tests)
- FOUND: commit a50a5c4 (GREEN implementation)
- VERIFIED: `npm test -- tiles-econ.test.ts -t "ECON-02|ECON-06"` → 8 passed

---
*Phase: 04-economic-tiles*
*Completed: 2026-04-01*

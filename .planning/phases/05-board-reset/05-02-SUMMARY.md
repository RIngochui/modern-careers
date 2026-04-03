---
phase: 05-board-reset
plan: "02"
subsystem: server
tags: [board-reset, player-model, hp, salary, win-condition, tile-handlers, tdd-green]
dependency_graph:
  requires: [05-01]
  provides: [board-layout-implementation, hp-salary-model, win-condition-logic, clean-tile-handlers]
  affects: [05-03-PLAN]
tech_stack:
  added: []
  patterns: [TDD-GREEN, factory-pattern, switch-dispatch]
key_files:
  created: []
  modified:
    - server.ts
    - tests/state.test.ts
    - tests/sync.test.ts
    - tests/game-loop.test.ts
decisions:
  - "lotteryPool: 50000 replaces investmentPool and cryptoInvestments in SharedResources (stubs future lottery tile)"
  - "checkWinCondition checks Life Total >= 60 AND formula thresholds (fame >= formula.fame, happiness >= formula.happiness, floor(money/10000) >= formula.money)"
  - "SPORTS_BETTING updated to fixed 10,000 stake with 60,000 payout on roll=1 (removed all-in mechanic)"
  - "COVID_STIMULUS stubbed (Phase 10 will implement HP-to-cash trade)"
  - "NEPOTISM handler kept with existing mechanic (D-22 per plan)"
  - "game-loop.test.ts updated to reflect Phase 5 board: JAPAN_TRIP at 20, APARTMENT at 6, 11 OPPORTUNITY_KNOCKS, description field required"
metrics:
  duration: 9min
  completed: "2026-04-03"
  tasks_completed: 2
  files_changed: 4
---

# Phase 5 Plan 02: Server Core Refactor Summary

**One-liner:** Complete server.ts Phase 5 overhaul — 40-tile BOARD_TILES with descriptions, HP/salary Player model, checkWinCondition formula, dead Ponzi/Crypto/ECON handlers removed, all new tile types stubbed, all 190 tests GREEN.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Update Player interface, constants, createPlayer, createGameRoom, getFullState, checkWinCondition | 3c40f0e | server.ts, tests/state.test.ts, tests/sync.test.ts |
| 2 | Rebuild BOARD_TILES and update dispatchTile switch | 5ce7c72 | server.ts, tests/game-loop.test.ts |

## What Was Built

### Task 1: Player Model & Win Condition

**server.ts — Player interface:**
- Added `hp: number` and `salary: number` fields
- Removed `hasPonziFlag: boolean` and `ponziStolenFrom: Record<string, number>`

**server.ts — Constants:**
- `STARTING_MONEY` changed from 50,000 → 10,000 (per GAME-DESIGN.md)
- New export: `export const STARTING_HP = 10`

**server.ts — createPlayer factory:**
- Added `hp: STARTING_HP` and `salary: 10000`
- Removed `hasPonziFlag: false` and `ponziStolenFrom: {}`

**server.ts — SharedResources interface:**
- Replaced with `{ lotteryPool: number }` (removed investmentPool, cryptoInvestments)
- createGameRoom now initializes `lotteryPool: 50000`

**server.ts — getFullState:**
- Added `hp: player.hp` and `salary: player.salary` to player snapshot
- sharedResources output is now `{ lotteryPool: room.sharedResources.lotteryPool }`

**server.ts — checkWinCondition:**
- New exported function: `export function checkWinCondition(player: Player, room: GameRoom): boolean`
- Life Total formula: `fame + happiness + Math.floor(money / 10000) >= 60`
- Formula check: moneyPoints >= formula.money AND fame >= formula.fame AND happiness >= formula.happiness

**Test updates:**
- `tests/state.test.ts`: replaced `investmentPool` + `cryptoInvestments` tests with `lotteryPool starts at 50000` test
- `tests/sync.test.ts`: replaced `cryptoInvestments serialised as plain object` with `lotteryPool serialised as number`

### Task 2: BOARD_TILES Rebuild & dispatchTile Overhaul

**server.ts — BOARD_TILES:**
- Complete replacement with 40-tile canonical array matching GAME-DESIGN.md positions 0–39
- Added `description: string` field to tile type (removed `careerName` optional field)
- 10 OPPORTUNITY_KNOCKS tiles (actually 11 per the design), all new career/specialty tiles present

**server.ts — dispatchTile:**
- Deleted `checkAndRepayPonzi` function entirely
- Removed `checkAndRepayPonzi(room, roomCode)` call from dispatchTile
- Removed dead handlers: INVESTMENT_POOL, CRYPTO, TAX_AUDIT, SCRATCH_TICKET, UNION_STRIKE, PONZI_SCHEME, STUDENT_LOAN_PAYMENT
- Updated SPORTS_BETTING: fixed 10,000 stake, roll 1d6, win 60,000 if roll=1
- Stubbed COVID_STIMULUS (just calls advanceTurn, Phase 10 mechanic deferred)
- Kept NEPOTISM handler as-is (same mechanic, D-22)
- Added 22 new stub cases (OPPORTUNITY_KNOCKS, PAY_TAXES, STUDENT_LOAN_REDIRECT, CIGARETTE_BREAK, UNIVERSITY, MCDONALDS, FINANCE_BRO, ART_GALLERY, SUPPLY_TEACHER, GYM_MEMBERSHIP, COP, LOTTERY, JAPAN_TRIP, DEI_OFFICER, REVOLUTION, TECH_BRO, RIGHT_WING_GRIFTER, OZEMPIC, STARVING_ARTIST, YACHT_HARBOR, INSTAGRAM_FOLLOWERS, STREAMER)
- Updated default case: only PAYDAY, PRISON, HOSPITAL, APARTMENT, HOUSE remain as passthrough

**server.ts — gameStarted emit:**
- Added `boardTiles: BOARD_TILES` to the emit payload (required by Plan 03)

**Test updates:**
- `tests/game-loop.test.ts`: Updated stale assertions for Phase 5 board structure (PARK_BENCH→JAPAN_TRIP at 20, APARTMENT moved to 6, 11 OPPORTUNITY_KNOCKS, description field, removed careerName/CAREER_ENTRANCE/OPPORTUNITY tests)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed orphaned dead handler code after dispatchTile rewrite**
- **Found during:** Task 2
- **Issue:** The edit strategy for replacing the dispatchTile switch left old SCRATCH_TICKET, NEPOTISM, UNION_STRIKE, PONZI_SCHEME, STUDENT_LOAN_PAYMENT, and old default case blocks as orphaned unreachable code after the new closing `}`
- **Fix:** Removed the orphaned block entirely, leaving only the new clean dispatchTile implementation
- **Files modified:** server.ts
- **Commit:** 5ce7c72

**2. [Rule 1 - Bug] Updated state.test.ts for removed SharedResources fields**
- **Found during:** Task 1
- **Issue:** state.test.ts had tests for `sharedResources.investmentPool` and `sharedResources.cryptoInvestments` which no longer exist in the type
- **Fix:** Replaced with `sharedResources.lotteryPool starts at 50000` test
- **Files modified:** tests/state.test.ts
- **Commit:** 3c40f0e

**3. [Rule 1 - Bug] Updated sync.test.ts for removed cryptoInvestments**
- **Found during:** Task 1 (TypeScript compilation check)
- **Issue:** `tests/sync.test.ts` had `room.sharedResources.cryptoInvestments.set(...)` causing TS2339 error
- **Fix:** Replaced with `lotteryPool serialised as number in sharedResources` test
- **Files modified:** tests/sync.test.ts
- **Commit:** 3c40f0e

**4. [Rule 1 - Bug] Updated game-loop.test.ts for Phase 5 board structure**
- **Found during:** Task 2 (test run)
- **Issue:** game-loop.test.ts tested CAREER_ENTRANCE/OPPORTUNITY/careerName/PARK_BENCH — all removed in Phase 5 board redesign
- **Fix:** Replaced with Phase 5-correct assertions (OPPORTUNITY_KNOCKS count = 11, description field, JAPAN_TRIP at 20, APARTMENT at 6, 9 career-path tiles)
- **Files modified:** tests/game-loop.test.ts
- **Commit:** 5ce7c72

## Known Stubs

The following tiles are stubbed in dispatchTile (no game effect, just call advanceTurn):
- OPPORTUNITY_KNOCKS, PAY_TAXES, STUDENT_LOAN_REDIRECT, CIGARETTE_BREAK, UNIVERSITY, MCDONALDS, FINANCE_BRO, ART_GALLERY, SUPPLY_TEACHER, GYM_MEMBERSHIP, COP, LOTTERY, JAPAN_TRIP, DEI_OFFICER, REVOLUTION, TECH_BRO, RIGHT_WING_GRIFTER, OZEMPIC, STARVING_ARTIST, YACHT_HARBOR, INSTAGRAM_FOLLOWERS, STREAMER, COVID_STIMULUS

These are intentional Phase 5 stubs. Full mechanics are implemented in Phases 6-10 per the roadmap. The BOARD_TILES `description` field documents the intended mechanic for each.

PAYDAY, PRISON, HOSPITAL, APARTMENT, HOUSE also advance turn immediately (stubs for future phases).

## Self-Check: PASSED

- server.ts: FOUND and modified
- tests/state.test.ts: FOUND and updated
- tests/sync.test.ts: FOUND and updated
- tests/game-loop.test.ts: FOUND and updated
- Commit 3c40f0e: confirmed (Task 1)
- Commit 5ce7c72: confirmed (Task 2)
- `npm test --runInBand`: 9/9 test suites PASS, 190/190 tests GREEN
- `grep "STARTING_MONEY = 10000" server.ts`: match at line 169
- `grep "export const STARTING_HP = 10" server.ts`: match at line 170
- `grep "export function checkWinCondition" server.ts`: match at line 417
- `grep "hasPonziFlag\|ponziStolenFrom\|cryptoInvestments\|investmentPool" server.ts`: no matches
- `grep "boardTiles: BOARD_TILES" server.ts`: match at line 808

---
phase: 04-economic-tiles
plan: "01"
subsystem: tile-dispatch
tags: [jest, typescript, sports-betting, covid-stimulus, tax-audit, scratch-ticket, stateless-tiles]

# Dependency graph
requires:
  - phase: 04-economic-tiles
    plan: "00"
    provides: BOARD_TILES with SPORTS_BETTING/COVID_STIMULUS/TAX_AUDIT/SCRATCH_TICKET types; tiles-econ.test.ts scaffold with ECON-01/03/04/05 stubs
provides:
  - SPORTS_BETTING case in dispatchTile() — roll=1 wins 6× bet, else loses bet (floor 0)
  - COVID_STIMULUS case in dispatchTile() — all players +$1,400 flat
  - TAX_AUDIT case in dispatchTile() — deduct (roll × 5)% of player money (floor 0)
  - SCRATCH_TICKET case in dispatchTile() — pay $200, roll-based outcome, can go negative
  - ECON-01 describe block GREEN (3 tests passing)
  - ECON-03 describe block GREEN (2 tests passing)
  - ECON-04 describe block GREEN (3 tests passing)
  - ECON-05 describe block GREEN (4 tests passing)
affects: [player money, all-player broadcasts]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Stateless tile: immediate money mutation + broadcast + advanceTurn() in one block"
    - "All-player broadcast: iterate room.players.forEach() atomically before emitting"
    - "No-floor tile: SCRATCH_TICKET intentionally allows negative money — do NOT add Math.max"
    - "Percentage deduction: Math.floor(money * percent / 100), then Math.max(0, ...)"

key-files:
  created: []
  modified:
    - server.ts
    - tests/tiles-econ.test.ts

# Self-Check
self-check: PASSED
tasks-completed: 2/2
tests-passing: 12/12 (ECON-01, 03, 04, 05)
regressions: none

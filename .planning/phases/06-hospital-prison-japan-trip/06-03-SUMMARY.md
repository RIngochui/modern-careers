---
phase: 06-hospital-prison-japan-trip
plan: 03
subsystem: client
tags: [hospital, prison, japan-trip, goomba-stomp, client-ui, socket-handlers]
dependency_graph:
  requires: [06-02]
  provides: [phase6-client-handlers, player-status-banners, host-turn-history, japan-stay-choice-ui]
  affects: [client/game.ts, public/game.js]
tech_stack:
  added: []
  patterns:
    - "IIFE-scoped socket handlers sharing module-level socket connection"
    - "Status banner pattern (showStatusBanner/clearStatusBanner helpers) for transient player feedback"
    - "Japan stay-or-leave choice UI with Stay/Leave buttons + confirm() fallback"
    - "Host dot title badge update from gameState broadcast (inHospital/inPrison/inJapan flags)"
key_files:
  created: []
  modified:
    - client/game.ts
    - public/game.js
decisions:
  - "Status badges on host dots use text labels [H]/[P]/[J] instead of emoji — avoids font rendering inconsistency across OS"
  - "japan-stay-choice guard uses currentTurnPlayerId !== mySocketId early return — server already sends only to active player, client guard is defense-in-depth"
  - "Japan stay-or-leave fallback uses window.confirm() when #japan-choice element is absent — allows mechanic to function before HTML element is added"
metrics:
  duration: 2min
  completed_date: "2026-04-03"
  tasks_completed: 2
  files_modified: 2
---

# Phase 6 Plan 03: Client-Side Phase 6 Event Handlers Summary

**One-liner:** Client game.ts wired with 11 Phase 6 socket event handlers (hospital/prison/japan/stomp) across both player and host IIFEs — status banners, stay-or-leave choice UI, host turn history, and dot status badges — compiled to game.js with all 209 tests passing.

## What Was Built

### Task 1: Phase 6 Event Handlers in client/game.ts

**Inside initPlayerGame() IIFE:**

- `showStatusBanner(message, color)` and `clearStatusBanner()` helpers — reference `#status-banner` DOM element (null-safe if element absent)
- `hospital-entered` — shows red status banner for active player, updates lastRollDisplay for all players
- `hospital-stayed` — updates red status banner with failed escape roll for active player
- `hospital-escaped` — clears banner, updates roll display, syncs HP and money stat grid elements for active player
- `prison-entered` — updates lastRollDisplay for all players (no block message — cards still allowed)
- `prison-stayed` — updates roll display showing failed escape roll for active player
- `prison-escaped` — updates roll display with escape confirmation and new tile for all players
- `prison-cop-immune` — displays Cop immunity message on roll display
- `japan-landed` — shows green status banner for active player, updates happiness stat
- `japan-forced-leave` — clears banner, shows forced leave details with roll/happiness/cost for active player
- `japan-stay-choice` — renders Stay/Leave button UI inside `#japan-choice` element; falls back to `window.confirm()` if element absent; emits `japan-stay` or `japan-leave` via module-level socket
- `goomba-stomped` — shows stomp notification on roll display for all players

**Inside initHostGame() IIFE:**

- `hospital-entered` — `addTurnHistory` with player name and HP
- `hospital-escaped` — `addTurnHistory` with player name and escape roll
- `prison-entered` — `addTurnHistory` with player name
- `prison-escaped` — `addTurnHistory` with player name
- `japan-landed` — `addTurnHistory` with player name
- `goomba-stomped` — `addTurnHistory` with STOMP prefix, stomper, stomped players, and destination label
- `gameState` handler extended to update `.player-dot` title badges (`[H]`/`[P]`/`[J]`) based on `inHospital`/`inPrison`/`inJapan` flags from broadcast state

### Task 2: Compile to public/game.js and Verify Tests

- `npx tsc --project tsconfig.client.json` — compiled clean, zero errors
- `public/game.js` updated with all Phase 6 handler code (8 occurrences of hospital-entered|prison-entered|japan-landed|goomba-stomped)
- Full test suite: 14 suites, 209 tests, 0 failures
- Both TypeScript configs (`--noEmit` server check and `tsconfig.client.json`) exit 0

## Test Results

All 209 tests pass. No regressions from client changes (client handlers are purely additive socket listeners with no server-side impact).

Phase 6 test breakdown (unchanged from Plan 02):
- `hospital.test.ts` — PASS
- `doctor-role.test.ts` — PASS
- `prison.test.ts` — PASS
- `japan-trip.test.ts` — PASS
- `goomba-stomp.test.ts` — PASS

## Deviations from Plan

### Auto-fixed Issues

None.

### Minor Adjustments

**Status badge text vs emoji:** The plan spec used emoji (`🏥`, `🔒`, `🗾`) for dot title badges. Changed to text labels `[H]`, `[P]`, `[J]` to avoid cross-OS emoji rendering inconsistency in tooltip text. Functionally equivalent — both convey hospital/prison/japan status on hover.

## Known Stubs

None that block Phase 6 goals.

- `#status-banner` and `#japan-choice` DOM elements referenced in player handlers but not yet added to `player.html`. Both handlers include null guards (status banner silently no-ops; japan-stay-choice falls back to `window.confirm()`). The mechanics work fully — HTML elements are cosmetic improvements for a future UI phase.
- `isDoctor` and `isCop` flags carry forward from Plan 02 — set permanently `false` until Phase 8 (career path completion).

## Self-Check: PASSED

- `client/game.ts` exists and contains all required patterns
- `public/game.js` exists and was regenerated after Task 1 edits
- Commits `83d0eb5` (Task 1) and `d72c6c8` (Task 2) verified in git log
- `grep "hospital-entered" client/game.ts` → 2 matches (both IIFEs)
- `grep "japan-stay-choice" client/game.ts` → 1 match (player IIFE only)
- `grep "goomba-stomped" client/game.ts` → 2 matches (both IIFEs)
- `grep "socket.emit('japan-stay')" client/game.ts` → 1 match
- `grep "socket.emit('japan-leave')" client/game.ts` → 1 match
- `grep "io()" client/game.ts` → 1 match (module-level only)
- `npx tsc --noEmit && npx tsc --project tsconfig.client.json` → ALL TYPESCRIPT CLEAN
- `npm test -- --forceExit` → 14 suites, 209 tests, 0 failures

---
phase: 3
slug: core-game-loop
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29.7.0 + ts-jest 29.1.4 |
| **Config file** | `package.json` jest section (testEnvironment: node, ts-jest CommonJS) |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test -- --coverage` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test -- --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green + coverage >80% on server.ts
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 3-W0-01 | Wave 0 | 0 | LOOP-01–07 | unit | `npm test -- tests/game-loop.test.ts` | ❌ W0 | ⬜ pending |
| 3-01-01 | 01 | 1 | LOOP-01 | unit | `jest tests/game-loop.test.ts -t "turn order"` | ❌ W0 | ⬜ pending |
| 3-02-01 | 02 | 1 | LOOP-02 | unit | `jest tests/game-loop.test.ts -t "2d6 roll"` | ❌ W0 | ⬜ pending |
| 3-03-01 | 03 | 1 | LOOP-02 | unit | `jest tests/game-loop.test.ts -t "1d6 roll"` | ❌ W0 | ⬜ pending |
| 3-04-01 | 04 | 1 | LOOP-03 | unit | `jest tests/game-loop.test.ts -t "position wraps"` | ❌ W0 | ⬜ pending |
| 3-05-01 | 05 | 2 | LOOP-04 | unit | `jest tests/game-loop.test.ts -t "tile dispatch"` | ❌ W0 | ⬜ pending |
| 3-06-01 | 06 | 2 | LOOP-06 | unit | `jest tests/game-loop.test.ts -t "drains applied"` | ❌ W0 | ⬜ pending |
| 3-07-01 | 07 | 2 | LOOP-05 | unit | `jest tests/game-loop.test.ts -t "advance turn"` | ❌ W0 | ⬜ pending |
| 3-08-01 | 08 | 2 | LOOP-07 | unit | `jest tests/game-loop.test.ts -t "turn history"` | ❌ W0 | ⬜ pending |
| 3-09-01 | 09 | 3 | LOOP-07 | manual | Open player.html, verify Roll Dice button state | N/A | ⬜ pending |
| 3-10-01 | 10 | 3 | LOOP-07 | manual | Open host.html, verify board track + colored dots | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/game-loop.test.ts` — stubs for LOOP-01 through LOOP-07 (roll handler, move calculation, tile dispatch stubs, drains, turn advancement)
  - Test cases: roll validation (currentTurnPlayer guard), position wrapping (modulo 40), drain deductions (isMarried/kids/hasStudentLoans), state transitions (WAITING_FOR_ROLL → MID_ROLL → LANDED), gameState broadcast shape
- [ ] `BOARD_TILES` constant stub (40-entry array with type + name fields) in `server.ts` — needed for tile dispatch tests
- [ ] `createMockGameRoom()` fixture with `gamePhase = 'playing'`, 2+ players, `turnOrder` set

*Existing test infrastructure (Jest + ts-jest) already configured — no new framework setup needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Roll Dice button disabled/enabled by turn state | LOOP-07 | DOM state, no socket test harness | Open player.html; verify button disabled when not your turn; enabled during WAITING_FOR_ROLL |
| Host board shows circular track + colored dots | LOOP-07 | Visual layout | Open host.html after game start; verify 40-tile circular track renders with player dots |
| 500ms token movement animation | LOOP-03 | Timing/visual | Roll dice; observe smooth step-by-step movement animation on host board |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

---
phase: 8
slug: university-career-paths
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-04
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29.7.0 + ts-jest 29.1.4 |
| **Config file** | `package.json` `jest` section |
| **Quick run command** | `npx jest --forceExit --testPathPattern="career\|university\|board-layout" -x` |
| **Full suite command** | `npx jest --forceExit` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --forceExit --testPathPattern="career|university|board-layout" -x`
- **After every plan wave:** Run `npx jest --forceExit`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| build-fix | 01 | 0 | (blocker) | compile | `npx tsc --noEmit` | ✅ | ⬜ pending |
| career-config | 01 | 0 | CAREER-01 | unit | `npx jest tests/career-paths.test.ts -t "path-traversal" --forceExit` | ❌ W0 | ⬜ pending |
| university-entry | 02 | 1 | COLL-01 | unit | `npx jest tests/university-path.test.ts -t "entry" --forceExit` | ❌ W0 | ⬜ pending |
| tile-3-redirect | 02 | 1 | COLL-01 | unit | `npx jest tests/university-path.test.ts -t "tile-3" --forceExit` | ❌ W0 | ⬜ pending |
| degree-selection | 02 | 1 | COLL-03 | unit | `npx jest tests/university-path.test.ts -t "degree" --forceExit` | ❌ W0 | ⬜ pending |
| graduation-cap | 02 | 1 | COLL-06 | unit | `npx jest tests/university-path.test.ts -t "cap" --forceExit` | ❌ W0 | ⬜ pending |
| medical-degree | 02 | 1 | D-20 | unit | `npx jest tests/university-path.test.ts -t "medical" --forceExit` | ❌ W0 | ⬜ pending |
| entry-prompt | 03 | 2 | D-04 | unit | `npx jest tests/career-paths.test.ts -t "entry-prompt" --forceExit` | ❌ W0 | ⬜ pending |
| unmet-req | 03 | 2 | D-06 | unit | `npx jest tests/career-paths.test.ts -t "unmet" --forceExit` | ❌ W0 | ⬜ pending |
| path-locked | 03 | 2 | D-02 | unit | `npx jest tests/career-paths.test.ts -t "locked" --forceExit` | ❌ W0 | ⬜ pending |
| cop-entry | 03 | 2 | D-08 | unit | `npx jest tests/career-paths.test.ts -t "cop-entry" --forceExit` | ❌ W0 | ⬜ pending |
| streamer-entry | 03 | 2 | D-09 | unit | `npx jest tests/career-paths.test.ts -t "streamer" --forceExit` | ❌ W0 | ⬜ pending |
| cop-tile-7 | 03 | 2 | D-13 | unit | `npx jest tests/career-paths.test.ts -t "cop-tile-7" --forceExit` | ❌ W0 | ⬜ pending |
| mid-path-hospital | 03 | 2 | mid-path | unit | `npx jest tests/career-paths.test.ts -t "mid-path-hospital" --forceExit` | ❌ W0 | ⬜ pending |
| tile-22-rename | 03 | 2 | D-16 | unit | `npx jest tests/board-layout.test.ts -t "tile-22" --forceExit` | ❌ W0 | ⬜ pending |
| cop-complete | 04 | 3 | D-18 | unit | `npx jest tests/career-paths.test.ts -t "cop-complete" --forceExit` | ❌ W0 | ⬜ pending |
| artist-complete | 04 | 3 | D-19 | unit | `npx jest tests/career-paths.test.ts -t "artist-complete" --forceExit` | ❌ W0 | ⬜ pending |
| experience-stub | 04 | 3 | D-21 | unit | `npx jest tests/career-paths.test.ts -t "experience" --forceExit` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/career-paths.test.ts` — stubs for CAREER-01..10, D-02, D-04, D-06, D-08, D-09, D-13, D-18, D-19, D-21, mid-path Hospital
- [ ] `tests/university-path.test.ts` — stubs for COLL-01, COLL-03, COLL-06, D-12, D-20
- [ ] Fix `server.ts` line 508 `</invoke>` corruption — blocks all test execution (must be first task)

*Framework install: Not needed — Jest already configured.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Streamer roll prompt UX | D-09 | Socket interaction timing | Land on Tile 38, verify prompt with roll result display and attempt counter |
| Cop skip-turn display | D-08 | Client-side turn indicator | Enter Cop path, verify skip-turn message shown on client next turn |
| Degree selection UI | D-10 | Client modal interaction | Complete University path, verify 7-option degree modal appears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

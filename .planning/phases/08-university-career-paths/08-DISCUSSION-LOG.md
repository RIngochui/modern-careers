# Phase 8: University & Career Paths - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-04
**Phase:** 08-university-career-paths
**Areas discussed:** Path traversal model, Path tile content, Career entry flow, Cop restart mechanic, Path length, Entry edge cases, Tile 3 → University, DEI Officer naming, Degree timing

---

## Path Traversal Model

| Option | Description | Selected |
|--------|-------------|----------|
| 1d6 per turn inside path | Player traverses path tile-by-tile each turn, rolling 1d6 instead of 2d6 | ✓ |
| Instant resolution | Path resolved on entry without turn-by-turn movement | |

**User's choice:** 1d6 per turn, locked in path, normal turn flow
**Notes:** "like normal turn taking but instead of 2 d6 in the main path, when you are locked in a career path it is 1 d6"

---

## Path Tile Content

| Option | Description | Selected |
|--------|-------------|----------|
| Claude decides all values | Leave tile counts and stat values to Claude | |
| Use CAREERS.md as source | Tile events and stat changes defined in CAREERS.md | ✓ |

**User's choice:** CAREERS.md is the canonical source — tile counts locked to number of events specified
**Notes:** User pointed to `.planning/CAREERS.md` as already having all events specified

---

## Career Entry Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Pause turn + prompt | Pause turn like property buy-prompt; player decides to enter or pass | ✓ |
| Immediate entry | Auto-enter or auto-advance without pause | |

**User's choice:** Pause turn, prompt player, enter next turn
**Notes:** "when a player lands on a career entry tile they can decide (like property buy-prompt). Then next turn they will be locked on the path with one dice"

---

## Cop Restart Mechanic

| Option | Description | Selected |
|--------|-------------|----------|
| Hospital + re-enter Tile 18 | Sent to Hospital, progress cancelled, must re-land Tile 18 to restart | ✓ |
| Re-enter path start | Immediately restart from path beginning without leaving path | |

**User's choice:** Hospital + must re-enter from Tile 18 on a future turn
**Notes:** "they will be sent to the hospital and they would have to reenter from tile 18 on a future turn"

---

## Path Length

| Option | Description | Selected |
|--------|-------------|----------|
| Claude decides | Leave tile count to Claude | |
| Short (3-5 tiles) | Quick pass-through | |
| Medium (6-8 tiles) | Moderate experience | |
| Long (9-12 tiles) | Substantial commitment | |
| Per CAREERS.md | 8-10 tiles, locked to events specified | ✓ |

**User's choice:** Locked to CAREERS.md event counts (8-10 tiles per path)

---

## McDonald's Entry (No-Req Prompt)

| Option | Description | Selected |
|--------|-------------|----------|
| Always prompt | Every career tile pauses turn and shows entry options | ✓ |
| Auto-enter no-req paths | McDonald's auto-enters without prompt | |

**User's choice:** Always prompt, consistent UX across all career tiles

---

## Tile 3 → University

| Option | Description | Selected |
|--------|-------------|----------|
| Pause for degree choice | Moved to University, then prompted for degree | |
| Fully automatic | Auto-enter, no prompt | |
| Consistent with degree timing decision | Enter path, degree chosen after completion | ✓ |

**User's choice:** Consistent with degree timing decision (D-10) — enter path, degree chosen after path completion

---

## DEI Officer Naming

| Option | Description | Selected |
|--------|-------------|----------|
| People & Culture Specialist | Matches GAME-DESIGN.md; rename everywhere | ✓ |
| Keep DEI_OFFICER | No rename | |

**User's choice:** People & Culture Specialist — rename tile type and all references

---

## Degree Timing

| Option | Description | Selected |
|--------|-------------|----------|
| After completion | Degree assigned when player exits University path on Tile 8 | ✓ |
| Before entry | Degree declared on entry; must clear if interrupted | |

**User's choice:** After completion — cleaner state management, nothing to undo if interrupted
**Notes:** User agreed with Claude's recommendation. "The only reason i have the after is because if they are kicked out that degree option should be freed up again (how hard would that be to implement)" — after-completion solves this cleanly.

---

## Claude's Discretion

- Exact emit event names for path events
- `pathTile` position tracking approach
- Doctor role: granted by Nursing degree completion (University path exit with Nursing degree)
- Mid-path forced Hospital moves (McDonald's Tile 5, HP ≤ 0) cancel path progress

## Deferred Ideas

None

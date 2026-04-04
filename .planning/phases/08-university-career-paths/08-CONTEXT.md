# Phase 8: University & Career Paths - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement University path (7 degrees) and all 9 career paths: entry requirement gating, turn-by-turn tile traversal inside each path, tile effects from CAREERS.md, path completion rewards, and role unlocks (Cop, Artist). Does NOT include: Experience/Opportunity card system (Phase 9), all other board tiles (Phase 10), character portrait overlays (Phase 11).

</domain>

<decisions>
## Implementation Decisions

### Path Traversal Model
- **D-01:** Players on a career or university path roll **1d6** per turn instead of 2d6. This is normal turn flow — player rolls, moves N tiles along the path, lands on a tile, tile effect fires, turn advances.
- **D-02:** Player is **locked into the path** upon entry. They cannot leave early (except via Hospital/Prison forced moves).
- **D-03:** New Player state fields needed: `inPath: boolean`, `currentPath: string | null` (e.g., `'MCDONALDS'`, `'UNIVERSITY'`), `pathTile: number` (0-indexed position within path). Planner decides exact field names and shape.

### Career Entry Flow
- **D-04:** Landing on any career/university entry tile **pauses turn** and emits a prompt — same pattern as property buy-prompt from Phase 7 (`WAITING_FOR_PROPERTY_DECISION`). This applies to ALL entry tiles including no-requirement ones (McDonald's, Streamer).
- **D-05:** If player meets requirements and chooses to enter: entry fee deducted, player state updated to `inPath: true`, turn ends. **Next turn** they roll 1d6 inside the path.
- **D-06:** If player does not meet requirements (wrong degree, insufficient cash), they are shown the requirements and the turn auto-advances (no choice offered — can't enter).
- **D-07:** If player passes on entry (meets requirements but declines), turn advances normally.

### Cop Entry Special Case
- **D-08:** Cop entry requires "wait 1 extra turn + pay $15,000." When player chooses to enter: pay $15,000 immediately, then **skip next turn** while still at Tile 18. The turn after the skip is the first 1d6 roll inside the Cop path.

### Streamer Entry Special Case
- **D-09:** Streamer entry requires rolling a 1 on 1d6 (each attempt costs $15,000, max 2 attempts per visit). On landing Tile 38, the player is prompted with the roll mechanic. If they roll a 1 → enter path. If they fail both attempts (or can't afford) → turn advances. Nepotism bypasses the roll.

### Degree Timing
- **D-10:** Degree is assigned **after completing the University path** (on Tile 8 exit — "You walk across the stage"). When player exits, they are prompted to choose one of the 7 degrees. If player is interrupted mid-path (e.g., HP ≤ 0 → Hospital), no degree is assigned — nothing to undo.
- **D-11:** CAREERS.md currently says "Declare degree before entering" — this is **superseded by D-10**. Change to: degree chosen on path completion.

### Tile 3 → University Redirect
- **D-12:** Tile 3 (Student Loan Payment) auto-moves player to Tile 9 (University), entry fee waived ($0). Player enters University path immediately. Degree is chosen upon path completion (consistent with D-10).

### Cop Path Trap Mechanic
- **D-13:** Cop path Tile 7 ("Undercover operation goes wrong") sends player to Hospital AND **cancels Cop progress** completely. Player must re-land on Tile 18 on a future turn to restart. No partial credit — state resets to `inPath: false, currentPath: null, pathTile: 0`.

### Path Tile Content
- **D-14:** CAREERS.md (`.planning/CAREERS.md`) is the **canonical source of truth** for all path tile events, stat changes, tile counts, and special effects. Tile counts are locked to the number of events specified per career. Do not invent or modify tile content during implementation.
- **D-15:** CAREERS.md Cop "Unlocks" note says "Enhanced Goomba Stomp: sends target to Prison instead of Payday" — this is a **typo**. Per GAME-DESIGN.md and Phase 6 implementation, normal Goomba Stomp → Japan Trip (Tile 20); Cop Goomba Stomp → Prison (Tile 10).

### Naming Alignment
- **D-16:** Tile 22 tile type is renamed from `DEI_OFFICER` to `PEOPLE_AND_CULTURE` (or similar) everywhere: `BOARD_TILES`, server handlers, client display names. The career is "People & Culture Specialist."

### Degree Values
- **D-17:** `degree` field string values updated from old design (`'compSci' | 'business' | 'healthSciences' | 'teaching'`) to new 7-degree set:
  `'economics' | 'computerScience' | 'genderStudies' | 'politicalScience' | 'art' | 'teaching' | 'nursing'`

### Role Unlocks
- **D-18:** Cop path completion → `player.isCop = true` (already on Player). Grants: Prison immunity, enhanced Goomba Stomp (→ Prison instead of Japan Trip).
- **D-19:** Starving Artist path completion → `player.isArtist = true` (new field, not yet on Player). Grants: Art Gallery/NFT tile (Tile 14) buyers pay Artist instead of Banker.
- **D-20:** Nursing Degree + completing the relevant career path (Doctor role) → `player.isDoctor = true` (already on Player). The "relevant career path" for Doctor is not yet specified in CAREERS.md — **Claude's Discretion**: implement Doctor as granted by Nursing degree completion (University path exit with Nursing degree chosen). Full Doctor mechanic already live from Phase 6.

### Experience Card on Completion
- **D-21:** Each career path completion grants +1 Experience card. Experience card system is Phase 9. For Phase 8: stub the grant as a logged no-op (`// TODO Phase 9: grant experience card`) — do not implement card hand management here.

### Claude's Discretion
- McDonald's path tile 5 says "-2 HP + sent to Hospital" — this is a forced Hospital move mid-path. Same as HP ≤ 0 rule: player leaves path, sent to Hospital, path progress is cancelled (consistent with D-13 approach for mid-path interruptions).
- Exact emit event names for path entry, tile landing, and path completion are Claude's call — follow existing Phase 6/7 event naming conventions.
- `pathTile` position tracking approach (0-indexed tile index vs. tile count vs. percentage) is Claude's discretion.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Career & University Design
- `.planning/CAREERS.md` — Complete path tile tables for all 10 paths (including University). Tile counts, stat changes, special effects, entry requirements, exit tiles, net totals, unlocks. This is the primary implementation source for Phase 8.
- `.planning/GAME-DESIGN.md` — Degrees & Careers section (lines 47–90), Board Tiles section (individual career tile descriptions), Career Entry Requirements Summary table. Authoritative on entry requirements and Cop/Doctor/Artist role descriptions.

### Requirements
- `.planning/REQUIREMENTS.md` — COLL-01..06, CAREER-01..10. Note: requirement names are from old design but requirements themselves are still directionally valid; CAREERS.md and GAME-DESIGN.md override specifics.

### Prior Phase Patterns
- `.planning/phases/07-properties-housing/07-CONTEXT.md` — Buy-prompt / WAITING_FOR_PROPERTY_DECISION pattern to reuse for career entry flow (D-04, D-05).
- `.planning/phases/06-hospital-prison-japan-trip/` (if exists) — Hospital/Prison/Japan state flags on Player; isCop/isDoctor role flag model to extend for isArtist.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `handlePropertyLanding` / `WAITING_FOR_PROPERTY_DECISION` pattern in `server.ts` — career entry prompt follows this exact pattern
- `player.isCop`, `player.isDoctor` — role flag model to extend with `player.isArtist`
- `player.degree: string | null` — already exists, values need updating (D-17)
- `player.career: string | null` — already exists, use for tracking active/completed career
- `player.graduationCapColor: string | null`, `player.careerBadge: string | null` — portrait overlay fields already on Player (Phase 11 will use these)
- All 9 career entry tiles + UNIVERSITY currently stubbed in `dispatchTile` switch — Phase 8 replaces these stubs

### Established Patterns
- Turn pause via `// buy_prompt: turn paused — waiting for socket event` comment pattern
- `advanceTurn(room, roomCode, playerId, ...)` called explicitly when turn should advance
- `inHospital`, `inJapan` location flags on Player — same pattern for `inPath`
- Phase 6: HP ≤ 0 check runs at every stat change → Hospital redirect — this fires mid-path too (important edge case)

### Integration Points
- `dispatchTile` switch in server.ts — replace all career/university stubs with real handlers
- `BOARD_TILES` array — Tile 22 type must be renamed from `DEI_OFFICER` (D-16)
- `createPlayer` factory — add `inPath`, `currentPath`, `pathTile`, `isArtist` fields; update `degree` comment
- Client `game.ts` / `game.js` — needs socket event handlers for career entry prompt, path tile events, path completion prompt (degree choice)

</code_context>

<specifics>
## Specific Ideas

- "Tile 3 → University" is already implemented as a tile stub (`STUDENT_LOAN_REDIRECT`); the redirect + waived entry logic is new in Phase 8
- Cop "wait 1 extra turn" (D-08) is mechanically similar to the Japan Trip "stay or leave each turn" pattern from Phase 6 — worth reviewing that implementation for the skip-turn approach
- CAREERS.md McDonald's Tile 5 special note: "-2 HP + sent to Hospital" is a mid-path forced Hospital. This path has an intentional trap. Planner should handle this as a standard HP penalty that triggers the existing HP ≤ 0 → Hospital rule.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 08-university-career-paths*
*Context gathered: 2026-04-04*

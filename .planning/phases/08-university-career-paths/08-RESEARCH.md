# Phase 8: University & Career Paths - Research

**Researched:** 2026-04-04
**Domain:** Game logic (path traversal, entry gating, state management), Socket.io event-driven UI
**Confidence:** HIGH

## Summary

Phase 8 is the largest single phase in the project. It replaces 11 stubbed `dispatchTile` cases with full implementations (University + 9 careers + STUDENT_LOAN_REDIRECT) and introduces a new "path traversal" subsystem: state fields (`inPath`, `currentPath`, `pathTile`), 1d6 movement inside paths, path tile effect resolution, and multiple new socket event flows (career entry prompts, streamer roll mechanic, cop wait mechanic, degree selection, path completion).

The existing codebase provides strong patterns to follow: the Phase 7 property buy-prompt flow (`WAITING_FOR_PROPERTY_DECISION`) maps directly onto career entry prompts; the Phase 6 Hospital/Prison/Japan location flags map onto `inPath`; the `advanceTurn` + `dispatchTile` architecture is well-established and extensible.

**CRITICAL BLOCKER:** Line 508 of `server.ts` contains a committed `</invoke>` XML artifact from a prior agent session that breaks TypeScript compilation. All 83 tests currently fail. The planner MUST include a fix for this corruption as Wave 0 / Task 1 before any other work can proceed.

**Primary recommendation:** Structure this phase as data-driven path definitions (a config object per career) consumed by generic path entry/traversal/completion handlers, not 10 separate handler implementations. This keeps the code DRY, testable, and aligned with the user's preference for a single career config file.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Players on a career or university path roll 1d6 per turn instead of 2d6. Normal turn flow: roll, move N tiles along path, land on tile, tile effect fires, turn advances.
- **D-02:** Player is locked into the path upon entry. Cannot leave early (except via Hospital/Prison forced moves).
- **D-03:** New Player state fields: `inPath: boolean`, `currentPath: string | null`, `pathTile: number` (0-indexed).
- **D-04:** Landing on any career/university entry tile pauses turn and emits a prompt -- same pattern as property buy-prompt from Phase 7.
- **D-05:** If player meets requirements and chooses to enter: entry fee deducted, player state updated to `inPath: true`, turn ends. Next turn they roll 1d6 inside the path.
- **D-06:** If player does not meet requirements, shown requirements and turn auto-advances.
- **D-07:** If player passes on entry (meets requirements but declines), turn advances normally.
- **D-08:** Cop entry: pay $15,000 immediately, then skip next turn. Turn after the skip is first 1d6 roll inside Cop path.
- **D-09:** Streamer entry: roll a 1 on 1d6 ($15,000/attempt, max 2 per visit). Nepotism bypasses the roll.
- **D-10:** Degree assigned after completing University path (on Tile 8 exit). Prompted to choose one of 7 degrees.
- **D-11:** CAREERS.md "declare degree before entering" superseded by D-10 (degree chosen on completion).
- **D-12:** Tile 3 (Student Loan Payment) auto-moves player to Tile 9 (University), entry fee waived ($0). Player enters University path immediately.
- **D-13:** Cop path Tile 7 sends player to Hospital AND cancels Cop progress completely. Must re-land on Tile 18 to restart.
- **D-14:** CAREERS.md is the canonical source of truth for all path tile events, stat changes, tile counts, and special effects.
- **D-15:** Normal Goomba Stomp -> Payday, -1 HP. Cop Stomp -> Prison, -2 HP. Both already implemented.
- **D-16:** Tile 22 type renamed from `DEI_OFFICER` to `PEOPLE_AND_CULTURE` everywhere.
- **D-17:** `degree` field values: `'economics' | 'computerScience' | 'genderStudies' | 'politicalScience' | 'art' | 'teaching' | 'medical'`
- **D-18:** Cop path completion -> `player.isCop = true`. Grants Prison immunity + enhanced Goomba Stomp.
- **D-19:** Starving Artist completion -> `player.isArtist = true` (new field). Grants Art Gallery payments.
- **D-20:** Medical Degree -> `player.isDoctor = true` immediately on degree selection. Player immediately sent to Hospital (residency). +2 HP on exit applies.
- **D-21:** Career path completion grants +1 Experience card. Stub as no-op for Phase 8.
- **D-22:** Teaching Degree available on first University run. All 7 degrees available on any completion.

### Claude's Discretion

- McDonald's path tile 5 "-2 HP + sent to Hospital" is a forced Hospital move mid-path. Same as D-13: player leaves path, sent to Hospital, progress cancelled.
- Exact socket event names for path entry, tile landing, and path completion -- follow existing Phase 6/7 naming conventions.
- `pathTile` tracking approach (0-indexed tile index).

### Deferred Ideas (OUT OF SCOPE)

None -- discussion stayed within phase scope.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COLL-01 | College entrance tile lets player enter the College path | University entry handler at Tile 9, plus Tile 3 redirect (D-12). Path config defines entry requirements. |
| COLL-02 | Each turn inside college costs tuition; loan tracked | CAREERS.md University path: no per-turn tuition mechanic in CAREERS.md or GAME-DESIGN.md. The $10k entry fee is the only cost. CONTEXT.md D-14 makes CAREERS.md authoritative. Requirement description is outdated per GAME-DESIGN.md. |
| COLL-03 | On exit, player chooses one degree | D-10: degree chosen on University path completion. 7 degrees per D-17. |
| COLL-04 | Player can exit early with no degree (undeclared) | D-02: player is LOCKED into path, cannot leave early (except forced Hospital/Prison). If forced out, no degree awarded (D-10). |
| COLL-05 | Second college run earns Teaching degree only | D-22: SUPERSEDED. Teaching available on first run. Max 1 degree enforced (GAME-DESIGN.md). |
| COLL-06 | Graduation cap layer added on degree earned | `graduationCapColor` field already on Player. Phase 11 (character portraits) will use this. Phase 8 sets the value. |
| CAREER-01 | All career paths branch off main loop; roll 1 die per space inside | D-01: 1d6 inside paths. Path config defines tile counts. `roll-dice` handler checks `inPath`. |
| CAREER-02 | Tech Bro: requires Comp Sci degree; high money; 10+ events | CAREERS.md Tech Bro: 10 tiles, entry = Computer Science OR $20,000 OR Nepotism. Path config. |
| CAREER-03 | Finance Bro: requires Business degree; high money + fame | CAREERS.md Finance Bro: 9 tiles, entry = Economics/Business OR $10,000 OR Nepotism. Note: REQUIREMENTS.md says "Business" but GAME-DESIGN.md + CAREERS.md say "Economics" -- GAME-DESIGN.md wins per memory/feedback_spec_authority.md. |
| CAREER-04 | Healthcare Hero: requires Health Sciences degree | SUPERSEDED by game design evolution. No "Healthcare Hero" path exists. CAREERS.md has no such career. The Doctor role is granted via Medical Degree (D-20), not a career path. |
| CAREER-05 | Disillusioned Academic: requires Teaching degree | SUPERSEDED. No "Disillusioned Academic" path exists. Supply Teacher path requires Teaching OR $10,000. |
| CAREER-06 | Streamer: no degree, pay fee + must roll 1 | D-09: $15,000/attempt, max 2, must roll 1 on 1d6. Nepotism bypasses. |
| CAREER-07 | McDonald's Employee: no degree, very low money | CAREERS.md McDonald's: 8 tiles, free entry. |
| CAREER-08 | Right-Wing Grifter: any degree; high fame; lose all happiness on entry | CAREERS.md: entry = Political Science OR $25,000 + lose 5 Happiness. "Lose all happiness" in REQUIREMENTS.md is outdated -- GAME-DESIGN.md says lose 5 Happiness. |
| CAREER-09 | Career badge added when in a career path | `careerBadge` field already on Player. Phase 8 sets value on path entry; Phase 11 renders it. |
| CAREER-10 | Unemployed state shows cardboard sign | `unemployed` field already on Player. Set to true when player leaves path early (Hospital/Prison mid-path cancellation). |

</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | ~5.4.3 | Server and client code | Already in use; project standard |
| Express | ~4.18.2 | HTTP server | Already in use |
| Socket.io | ~4.7.2 | Real-time events | Already in use |
| Jest + ts-jest | ~29.7.0 / ~29.1.4 | Testing | Already in use |

### Supporting

No new libraries needed. Phase 8 is entirely server logic (TypeScript), client handlers (TypeScript compiled to JS), and HTML/CSS additions. All within existing stack.

### Alternatives Considered

None. This phase adds game logic to an established codebase. No new dependencies required.

## Architecture Patterns

### Recommended Project Structure

No new files beyond the existing structure. All changes go into:

```
server.ts           # Path definitions, entry handlers, traversal logic, completion handlers
client/game.ts      # Socket event handlers for career prompts, path UI
public/player.html  # New HTML elements for career prompts, degree selection, path progress
public/host.html    # Minor: Tile 22 label rename
tests/              # New test files for path mechanics
```

### Pattern 1: Data-Driven Path Configuration

**What:** Define all 10 paths (University + 9 careers) as a configuration object. Each path has: `key`, `boardTile`, `exitTile`, `tileCount`, `tiles[]` (with stat effects and special actions), `entryRequirements`, `completionRewards`.

**When to use:** Always -- this is the recommended approach for all path logic.

**Why:** The user's memory (MEMORY.md) explicitly states: "career path values must live in a single config file for easy tuning." A data-driven approach means:
- One source of truth for tile effects, entry requirements, completion rewards
- Generic `handlePathEntry`, `handlePathTileEffect`, `handlePathCompletion` functions
- Easy balance tuning without touching handler logic
- Smaller, more testable code

**Example:**
```typescript
interface PathTile {
  event: string;
  fame?: number;
  happiness?: number;
  hp?: number;
  cash?: number;
  salary?: number;
  special?: 'HOSPITAL' | 'PRISON' | 'SKIP_TURN' | 'CANCEL_PATH' | 'SENT_TO_PAYDAY';
  // For tiles with dice rolls (Finance Bro tile 4, Tech Bro tile 10, etc.)
  diceMultiplier?: number;
  diceTarget?: 'cash' | 'salary' | 'fame';
  // For PvP tiles (P&C Specialist)
  pvpEffect?: { stat: string; amount: number; target: 'choose_one' | 'all' | 'all_others' };
}

interface CareerPath {
  key: string;                      // 'MCDONALDS' | 'UNIVERSITY' | etc.
  displayName: string;
  boardTile: number;                // Entry tile on main board
  exitTile: number;                 // Where player lands after completion
  tiles: PathTile[];
  entry: {
    degree?: string | string[];     // Required degree(s), if any
    cashCost?: number;              // Entry fee
    altCashCost?: number;           // Alternative entry fee (no degree)
    altStatCost?: { stat: string; amount: number }; // e.g., -5 Fame for P&C
    waitTurns?: number;             // Cop: 1 extra turn wait
    rollToEnter?: { target: number; dieCost: number; maxAttempts: number }; // Streamer
    freeEntry?: boolean;            // McDonald's
    nepotism?: boolean;             // Most careers
  };
  completion: {
    roleUnlock?: string;            // 'isCop' | 'isArtist'
    experienceCard?: boolean;       // true for all careers
  };
}

const CAREER_PATHS: Record<string, CareerPath> = {
  MCDONALDS: { ... },
  UNIVERSITY: { ... },
  // ... etc
};
```

### Pattern 2: Turn Phase Extension for Career Entry

**What:** Add new TURN_PHASES constants for career-path-specific paused states.

**When to use:** Career entry prompts, streamer roll, degree selection.

**Example:**
```typescript
const TURN_PHASES = {
  // ... existing ...
  WAITING_FOR_CAREER_DECISION: 'WAITING_FOR_CAREER_DECISION',
  WAITING_FOR_STREAMER_ROLL: 'WAITING_FOR_STREAMER_ROLL',
  WAITING_FOR_DEGREE_CHOICE: 'WAITING_FOR_DEGREE_CHOICE',
} as const;
```

### Pattern 3: Path Movement Interception in roll-dice

**What:** When `player.inPath === true`, the `roll-dice` handler rolls 1d6 instead of 2d6 and dispatches to a path tile handler instead of `dispatchTile`.

**When to use:** Every turn while player is on a path.

**Example:**
```typescript
// In roll-dice handler, before normal 2d6 logic:
if (player.inPath && player.currentPath) {
  const pathRoll = Math.floor(Math.random() * 6) + 1;
  handlePathTurn(room, roomCode, socket.id, pathRoll);
  return;
}
```

### Pattern 4: Reuse Property Buy-Prompt Flow for Career Entry

**What:** Career entry uses same pause-emit-respond pattern as property purchases.

**When to use:** All career entry tiles.

**Flow:**
1. `dispatchTile` case for career tile -> check requirements -> emit prompt or auto-advance
2. Set `turnPhase = WAITING_FOR_CAREER_DECISION`
3. Client shows prompt UI (same pattern as `#property-choice`)
4. Player emits `career-enter` or `career-pass`
5. Server handler processes decision and calls `advanceTurn`

### Anti-Patterns to Avoid

- **Separate handler per career:** Do NOT write `handleMcDonaldsEntry()`, `handleFinanceBroEntry()`, etc. Use one generic `handleCareerEntry(room, roomCode, playerId, pathKey)` that reads from config.
- **Hardcoded tile effects:** Do NOT put `if (pathTile === 5 && career === 'MCDONALDS') { ... }` logic. Each tile's effects should come from the path config data.
- **Forgetting mid-path interrupts:** Any HP-modifying path tile MUST call `checkHpAndHospitalize`. If HP <= 0, the path is cancelled (inPath = false). This applies to ALL paths, not just Cop Tile 7.
- **Modifying position for path traversal:** The player's `position` on the main board stays at the entry tile while they are on a path. `pathTile` tracks position within the path. Do NOT change `player.position` during path traversal (except on completion, when it moves to exitTile).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Path tile data | Individual handler functions per career | Data-driven config object + generic handler | 10 paths x 8-10 tiles = 90+ tiles. Config is the only maintainable approach. |
| Entry requirement checking | Per-career if/else chains | Generic requirement checker against path config | 10 different entry conditions share patterns (degree check, cash check, stat cost). |
| Path state management | Ad-hoc field updates | Centralized `enterPath()`, `advancePathTile()`, `exitPath()` helper functions | Consistent state transitions prevent orphaned flags. |
| HP-zero mid-path handling | Special cases per path | Existing `checkHpAndHospitalize` + generic path cancellation | Already works; just need to call `exitPath()` when Hospital triggers. |

**Key insight:** The CAREERS.md file defines 90+ path tiles with stat effects, special moves, dice rolls, and PvP interactions. The only sane approach is parsing this into config data and consuming it generically.

## Common Pitfalls

### Pitfall 0: Committed Build-Breaking Corruption in server.ts

**What goes wrong:** Line 508 of `server.ts` contains `</invoke>` -- an XML artifact from a prior agent session. This breaks TypeScript compilation and causes all 83 tests to fail.
**Why it happens:** A previous agent run left XML tag debris in the source code, and it was committed.
**How to avoid:** Fix this FIRST, before any other work. Remove the `</invoke>` text from line 508.
**Warning signs:** `npm test` fails with "TS1110: Type expected" on line 508.

### Pitfall 1: Forgotten State Cleanup on Path Exit

**What goes wrong:** Player completes a path but `inPath` or `currentPath` is not cleared. On their next turn, the roll-dice handler still thinks they are on a path and rolls 1d6.
**Why it happens:** Multiple exit paths (normal completion, Hospital interrupt, Cop Tile 7 cancel) each need to reset state.
**How to avoid:** Single `exitPath(player)` function called from all exit points. Function resets: `inPath = false`, `currentPath = null`, `pathTile = 0`.
**Warning signs:** Player rolls 1d6 on the main board after path completion.

### Pitfall 2: Cop Wait Turn Mechanic Race Condition

**What goes wrong:** The Cop "wait 1 extra turn" mechanic (D-08) interacts with the existing `skipNextTurn` flag. If another effect sets `skipNextTurn` simultaneously, player might skip 2 turns.
**Why it happens:** Reusing `skipNextTurn` for Cop wait means it can collide with other skip sources.
**How to avoid:** Use a dedicated field like `copWaitTurns: number` on Player, or ensure `skipNextTurn` is only set once the player explicitly confirms Cop entry. The existing `advanceTurn` already handles `skipNextTurn` recursively.
**Warning signs:** Player enters Cop, another effect also sets skipNextTurn, player misses 2 turns.

### Pitfall 3: Streamer Attempt State Not Persisted Across Events

**What goes wrong:** Streamer entry is a multi-step interaction (up to 2 roll attempts). If the attempt count is stored only in the socket handler closure, reconnection or race conditions lose it.
**Why it happens:** Ephemeral state in event handler scope.
**How to avoid:** Store attempt state on the room or player: `streamerAttemptsUsed: number` on Player, cleared after the entry interaction completes.
**Warning signs:** After a failed first attempt and a brief reconnect, player gets 2 more attempts instead of 1.

### Pitfall 4: Path Tile with Dice Roll (Finance Bro T4, Tech Bro T10, RWG T1)

**What goes wrong:** Several path tiles have dice-based effects (e.g., Finance Bro Tile 4: "Roll 1d6 x 10,000 cash"). If the path tile handler does not recognize these as special, the dice effect is silently dropped.
**Why it happens:** Most path tiles are simple stat additions; dice tiles are easy to overlook.
**How to avoid:** The `PathTile` config includes `diceMultiplier` and `diceTarget` fields. The generic tile handler checks for these and rolls accordingly.
**Warning signs:** Player lands on Finance Bro Tile 4 and gets no bonus.

### Pitfall 5: PvP Tiles (People & Culture Specialist)

**What goes wrong:** P&C tiles 2, 4, 5, 6, 8 affect OTHER players. If the path tile handler only modifies the current player, these tiles do nothing.
**Why it happens:** Most path tiles are self-targeting; PvP is an exception.
**How to avoid:** The `PathTile` config includes `pvpEffect` with target specification. The handler routes effects to chosen players or all players.
**Warning signs:** P&C Tile 8 (everyone loses stats) only affects the path player.

### Pitfall 6: Finance Bro Tile 5 -- Sent to Prison

**What goes wrong:** Finance Bro Tile 5 sends the player to Prison ("SEC is asking questions"). This needs to cancel path progress just like Hospital does.
**Why it happens:** Prison send mid-path is rarer than Hospital send; easy to miss.
**How to avoid:** Any `special: 'PRISON'` tile in the path config should trigger `exitPath()` + `inPrison = true` + position = 10.
**Warning signs:** Player is simultaneously `inPath = true` and `inPrison = true`.

### Pitfall 7: Tech Bro Tile 9 -- Sent to Payday Without Salary

**What goes wrong:** Tech Bro Tile 9 ("AI replaces your entire team") sends player to Payday but they do not collect salary. This requires both path exit AND setting `skipNextPayday = true`.
**Why it happens:** "Sent to Payday" is not a standard path exit -- it is a forced ejection with a special flag.
**How to avoid:** Config includes `special: 'SENT_TO_PAYDAY'` that triggers: `exitPath()`, `position = 0`, `skipNextPayday = true`.
**Warning signs:** Player gets salary on Payday after being AI-replaced.

### Pitfall 8: Starving Artist Tile 8 -- Dynamic Cash Based on Salary

**What goes wrong:** Starving Artist Tile 8 gives "2x Salary" as cash, not a fixed amount. If handled as a static cash value in config, it gives the wrong amount.
**Why it happens:** Most cash effects are constants; this one is computed.
**How to avoid:** Config uses a special `cashFormula: '2xSalary'` or similar flag. Handler computes dynamically.
**Warning signs:** All players get the same cash from this tile regardless of their salary.

### Pitfall 9: University Degree Selection Blocks If Player Already Has Degree

**What goes wrong:** Player enters University a second time (after already earning a degree). On completion, the degree selection prompt shows but should not.
**Why it happens:** GAME-DESIGN.md says "max 1 degree per player for entire game" but the entry gate does not block re-entry (University charges $10k but does not require no-degree).
**How to avoid:** On University path completion, check `player.degree !== null`. If already has degree, skip the degree selection prompt entirely. Player still gains the stat effects from path tiles.
**Warning signs:** Player picks a second degree, overwriting their first one.

### Pitfall 10: getFullState Missing New Fields

**What goes wrong:** New player fields (`inPath`, `currentPath`, `pathTile`, `isArtist`) are added to `createPlayer` but not to `getFullState`. Client never receives them.
**Why it happens:** `getFullState` manually serializes each field (no spread operator). New fields must be explicitly added.
**How to avoid:** Add all new fields to the `getFullState` player snapshot.
**Warning signs:** Client shows stale path state; `inPath` is always undefined in gameState.

## Code Examples

### Career Path Entry Handler (Generic)

```typescript
// Source: Pattern derived from existing handlePropertyLanding in server.ts
function handleCareerEntry(
  room: GameRoom, roomCode: string, playerId: string, pathKey: string
): void {
  const player = room.players.get(playerId)!;
  const pathConfig = CAREER_PATHS[pathKey];
  if (!pathConfig) return;

  const { meetsRequirements, reason } = checkEntryRequirements(player, pathConfig);

  if (!meetsRequirements) {
    // D-06: show requirements, auto-advance
    io.to(playerId).emit('careerEntryPrompt', {
      career: pathKey,
      displayName: pathConfig.displayName,
      requirements: reason,
      meetsRequirements: false,
      canAfford: false
    });
    advanceTurn(room, roomCode, playerId, player.name, 0, player.position, player.position, pathKey);
    return;
  }

  // D-04: pause turn for decision
  room.turnPhase = TURN_PHASES.WAITING_FOR_CAREER_DECISION;
  io.to(playerId).emit('careerEntryPrompt', {
    career: pathKey,
    displayName: pathConfig.displayName,
    requirements: reason,
    meetsRequirements: true,
    canAfford: true,
    fee: pathConfig.entry.cashCost ?? pathConfig.entry.altCashCost ?? 0
  });
}
```

### Path Turn Handler (Generic)

```typescript
// Source: Pattern derived from existing roll-dice handler in server.ts
function handlePathTurn(
  room: GameRoom, roomCode: string, playerId: string, roll: number
): void {
  const player = room.players.get(playerId)!;
  const pathConfig = CAREER_PATHS[player.currentPath!];
  if (!pathConfig) return;

  const newPathTile = Math.min(player.pathTile + roll, pathConfig.tiles.length);
  player.pathTile = newPathTile;

  // Check if player passed the last tile (path complete)
  if (newPathTile >= pathConfig.tiles.length) {
    handlePathCompletion(room, roomCode, playerId);
    return;
  }

  const tile = pathConfig.tiles[newPathTile];
  applyPathTileEffects(player, tile, room, roomCode, playerId);
}
```

### Path Exit Helper

```typescript
// Source: Pattern from D-13 and Claude's discretion for mid-path exits
function exitPath(player: Player, reason: 'completed' | 'hospital' | 'prison' | 'special'): void {
  player.inPath = false;
  player.currentPath = null;
  player.pathTile = 0;
  if (reason !== 'completed') {
    player.unemployed = true;
    player.careerBadge = null;
  }
}
```

## State of the Art

| Old Approach (REQUIREMENTS.md) | Current Approach (GAME-DESIGN.md + CONTEXT.md) | Impact |
|---|---|---|
| 4 degrees (compSci, business, healthSciences, teaching) | 7 degrees (economics, computerScience, genderStudies, politicalScience, art, teaching, medical) | More entry paths, Medical Degree grants Doctor |
| Teaching degree requires 2nd University run | Teaching available on first run (D-22) | Simpler -- no second-run tracking needed |
| Declare degree before entering University | Degree chosen on path completion (D-10) | State flows differently -- degree is output, not input |
| DEI Officer (Tile 22) | People & Culture Specialist (D-16) | Rename in BOARD_TILES, handlers, client |
| Healthcare Hero career path | No such path -- Doctor via Medical Degree (D-20) | Eliminated a career path; Doctor is a degree-grant role |
| Disillusioned Academic career path | No such path -- Supply Teacher replaces it | Different name, same Teaching requirement |
| Career entry varies per spec version | CAREERS.md is canonical (D-14), GAME-DESIGN.md overrides REQUIREMENTS.md | Single source of truth for all path data |

**Deprecated/outdated in REQUIREMENTS.md:**
- COLL-02 (per-turn tuition): Not in CAREERS.md or GAME-DESIGN.md. Entry fee is one-time.
- COLL-04 (exit early with no degree): D-02 locks player in path. Forced exits (Hospital) give no degree.
- COLL-05 (2nd run = Teaching only): D-22 supersedes this.
- CAREER-04 (Healthcare Hero): Career does not exist.
- CAREER-05 (Disillusioned Academic): Career does not exist as named.
- CAREER-08 ("lose ALL happiness on entry"): GAME-DESIGN.md says lose 5 Happiness for Right-Wing Grifter alt entry.

## Open Questions

1. **Path traversal: exact landing vs. overshoot**
   - What we know: CAREERS.md defines tile counts (8-10 tiles per path). Player rolls 1d6 inside path.
   - What's unclear: If a player is on tile 6 of an 8-tile path and rolls 5, do they complete the path (overshoot to completion) or land exactly on tile 8? Board movement wraps with `% BOARD_SIZE`, but paths are linear.
   - Recommendation: Overshoot means completion. If `pathTile + roll >= tileCount`, clamp to last tile, apply its effects, then complete. This is simpler and avoids "stuck on last tile" scenarios. The player has effectively passed through remaining tiles.

2. **University re-entry: allowed or blocked?**
   - What we know: Max 1 degree per player (GAME-DESIGN.md). Entry costs $10k (waived from Tile 3). D-02 says player is locked once entered.
   - What's unclear: Can a player with a degree re-enter University? They would pay $10k, traverse tiles, get stat effects, but NOT get another degree.
   - Recommendation: Allow re-entry (pay fee, get tile effects, skip degree prompt on completion). This is consistent with GAME-DESIGN.md which says "max 1 degree" but does not say "max 1 University visit."

3. **Nepotism tile (Tile 26) career referral mechanic**
   - What we know: GAME-DESIGN.md Tile 26 says "Choose another player + a career path you have personally completed. That player is sent to start of that path with expenses paid."
   - What's unclear: This is a Tile 26 mechanic, not a career entry mechanic. Tile 26 is currently stubbed. It may interact with career paths but is NOT a Phase 8 deliverable -- it is a Phase 10 (remaining board tiles) deliverable.
   - Recommendation: Do NOT implement Nepotism referral in Phase 8. The `nepotism: true` flag in career configs is for future use. However, if a career's entry requirement lists "OR Nepotism", the entry handler should check for a `hasNepotismReferral` flag on the player (set by Tile 26 in a future phase). For now, this flag does not exist and Nepotism entry is not possible.

4. **Multiple players on same path tile (Goomba Stomp inside paths)**
   - What we know: STOMP-02 says stomping "applies on main loop and inside all career/college paths."
   - What's unclear: How does Goomba Stomp work inside paths? Two players can be on the same career path at different tiles, but they share the same main board position (the entry tile).
   - Recommendation: Goomba Stomp inside paths should compare `currentPath + pathTile`, not `position`. If two players are on the same path at the same path tile, stomping is possible. This requires modifying the stomp check logic for path players.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 29.7.0 + ts-jest 29.1.4 |
| Config file | package.json `jest` section |
| Quick run command | `npx jest --forceExit --testPathPattern=career` |
| Full suite command | `npx jest --forceExit` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COLL-01 | University entry from Tile 9 | unit | `npx jest tests/university-path.test.ts -t "entry" --forceExit` | Wave 0 |
| COLL-01 | Tile 3 redirect to University with waived fee | unit | `npx jest tests/university-path.test.ts -t "tile-3" --forceExit` | Wave 0 |
| COLL-03 | Degree selection on University completion (7 options) | unit | `npx jest tests/university-path.test.ts -t "degree" --forceExit` | Wave 0 |
| COLL-06 | Graduation cap color set on degree | unit | `npx jest tests/university-path.test.ts -t "cap" --forceExit` | Wave 0 |
| CAREER-01 | 1d6 roll inside path, path tile effect applied | unit | `npx jest tests/career-paths.test.ts -t "path-traversal" --forceExit` | Wave 0 |
| CAREER-01 | Path completion triggers exit | unit | `npx jest tests/career-paths.test.ts -t "completion" --forceExit` | Wave 0 |
| D-02 | Player locked in path (cannot roll on main board) | unit | `npx jest tests/career-paths.test.ts -t "locked" --forceExit` | Wave 0 |
| D-04 | Career entry prompt pauses turn | unit | `npx jest tests/career-paths.test.ts -t "entry-prompt" --forceExit` | Wave 0 |
| D-06 | Unmet requirements auto-advance | unit | `npx jest tests/career-paths.test.ts -t "unmet" --forceExit` | Wave 0 |
| D-08 | Cop entry: $15k + skip 1 turn | unit | `npx jest tests/career-paths.test.ts -t "cop-entry" --forceExit` | Wave 0 |
| D-09 | Streamer entry: roll mechanic | unit | `npx jest tests/career-paths.test.ts -t "streamer" --forceExit` | Wave 0 |
| D-13 | Cop Tile 7: Hospital + cancel progress | unit | `npx jest tests/career-paths.test.ts -t "cop-tile-7" --forceExit` | Wave 0 |
| D-16 | Tile 22 renamed DEI_OFFICER to PEOPLE_AND_CULTURE | unit | `npx jest tests/board-layout.test.ts -t "tile-22" --forceExit` | Wave 0 |
| D-18 | Cop completion sets isCop = true | unit | `npx jest tests/career-paths.test.ts -t "cop-complete" --forceExit` | Wave 0 |
| D-19 | Artist completion sets isArtist = true | unit | `npx jest tests/career-paths.test.ts -t "artist-complete" --forceExit` | Wave 0 |
| D-20 | Medical degree sets isDoctor + Hospital | unit | `npx jest tests/university-path.test.ts -t "medical" --forceExit` | Wave 0 |
| D-21 | Completion grants experience card stub | unit | `npx jest tests/career-paths.test.ts -t "experience" --forceExit` | Wave 0 |
| Mid-path | HP <= 0 cancels path, sends to Hospital | unit | `npx jest tests/career-paths.test.ts -t "mid-path-hospital" --forceExit` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npx jest --forceExit --testPathPattern="career|university|board-layout" -x`
- **Per wave merge:** `npx jest --forceExit`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/career-paths.test.ts` -- covers CAREER-01..10, D-02, D-04, D-06, D-08, D-09, D-13, D-18, D-19, D-21, mid-path Hospital
- [ ] `tests/university-path.test.ts` -- covers COLL-01, COLL-03, COLL-06, D-12, D-20
- [ ] Fix `server.ts` line 508 `</invoke>` corruption (blocks all test execution)
- [ ] Framework install: Not needed -- Jest already configured

## Critical Pre-Requisite: Fix Build Corruption

**server.ts line 508** contains `</invoke>` which prevents TypeScript compilation:

```
507     player.hp += 2;
508 </invoke>    const payment = Math.floor(player.salary / 2);
```

Must become:

```
507     player.hp += 2;
508     const payment = Math.floor(player.salary / 2);
```

This is committed to `main` branch (commit `fe13453`). All 83 existing tests fail until this is fixed.

## Sources

### Primary (HIGH confidence)

- `server.ts` (1602 lines) -- Full codebase review. Player interface, createPlayer factory, BOARD_TILES, dispatchTile switch, all socket handlers, getFullState serialization. All findings verified directly.
- `client/game.ts` (932 lines) -- Full client review. Property buy-prompt pattern at line 888-931 serves as exact template for career entry prompts.
- `public/player.html` (277 lines) -- Existing UI structure: `#property-choice`, `#stat-grid`, `#active-tile-instruction`, `#turn-indicator`.
- `.planning/CAREERS.md` -- Canonical path tile data for all 10 paths. 260 lines.
- `.planning/GAME-DESIGN.md` -- Board tile descriptions, career entry requirements table, role definitions. 296 lines.
- `.planning/phases/08-university-career-paths/08-CONTEXT.md` -- All 22 locked decisions (D-01 through D-22).
- `.planning/phases/08-university-career-paths/08-UI-SPEC.md` -- Component inventory, interaction contracts, copywriting.
- `memory/feedback_spec_authority.md` -- GAME-DESIGN.md overrides REQUIREMENTS.md.
- `memory/MEMORY.md` -- Career path config file preference.

### Secondary (MEDIUM confidence)

- Existing test patterns (`tests/properties.test.ts`, `tests/hospital.test.ts`) -- Pattern for `createMockRoom()`, exported function testing, `afterAll` server cleanup. Verified by reading.

### Tertiary (LOW confidence)

None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing tech
- Architecture: HIGH -- data-driven path config pattern is well-established and aligns with user preference (MEMORY.md)
- Pitfalls: HIGH -- all identified from direct codebase review and CAREERS.md analysis
- Build corruption: HIGH -- verified by running `npx jest` and reading line 508

**Research date:** 2026-04-04
**Valid until:** 2026-05-04 (stable project, no external dependency changes expected)

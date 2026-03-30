# Research Summary: Careers Party Game Architecture

**Domain:** Real-time multiplayer browser party game (Socket.io + Node.js + vanilla JS)
**Researched:** 2026-03-29
**Overall Confidence:** HIGH

## Executive Summary

Real-time multiplayer party games using Socket.io + Node.js follow a well-established architectural pattern: a centralized server maintains authoritative game state in memory, while clients are read-only spectators that send actions and receive state broadcasts. The architecture prioritizes simplicity (no database, in-memory only), correctness (server validates all moves, prevents cheating), and real-time synchronization (WebSocket pushes state to all room members).

For Careers, this means one server.js file manages a Map of game rooms (keyed by room code), each room holds a GameRoom object with nested player states, board state, and shared resources (investment pool, crypto holdings). When a player acts (rolls dice, plays card), the event handler routes to game logic, which validates and executes the action atomically, then broadcasts the new state to all players in that room.

The frontend is split into two views (host.html and player.html) sharing the same Socket.io client pattern and a utility module (game.js) for rendering. The host sees the board, all tokens, and stats; players see their own controls and a read-only view of the game. Both receive state broadcasts, but only the server mutates state.

This architecture is battle-tested by thousands of browser party games and has no surprising pitfalls for a locally-hosted, in-memory implementation like Careers.

## Key Findings

**Stack:** Node.js + Express + Socket.io (v4), vanilla JS frontend with no build toolchain. Socket.io rooms provide built-in isolation per game; express serves HTTP for initial page load. Standard architecture, no alternatives needed.

**Architecture:** Three-tier: Server (connection handling + game logic + state manager), Client (HTML views + shared utilities). Server owns truth, clients are read-only. Room-based isolation via Socket.io rooms. In-memory only, no persistence layer.

**Critical pitfall:** Optimistic client updates (client modifies state locally before server confirms). Must route all mutations through server. Single source of truth is non-negotiable.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation (Weeks 1-2)
**Build:** Socket.io room join + game state manager + state broadcast mechanism

**Why this order:**
- Every feature depends on room isolation (can't test without it)
- State manager defines data shape for all future features
- Broadcast mechanism is the plumbing; must work before game logic

**Avoids pitfall:** Building UI before state management is stable leads to client-side mutations and desync bugs.

**What gets unblocked:** Phase 2 (game loop can be tested immediately after)

### Phase 2: Core Game Loop (Weeks 3-4)
**Build:** Dice rolling + movement + turn progression + basic tile effects

**Why after Phase 1:**
- Requires stable state manager (room structure)
- Requires working broadcast (clients see moves)
- Tests fundamental game mechanic before complexity

**Dependencies:** Phase 1 complete; character portrait system can start in parallel

**Avoids pitfall:** Adding special tiles before turn order works creates confusion about what fails where.

### Phase 3: Board Complexity (Weeks 5-7)
**Build:** Career/college paths (branching), special tiles (investment pool, crypto, prison), character portrait system

**Why after Phase 2:**
- Turn progression stable, now add branching paths
- Shared resource tracking (investment pool) is orthogonal
- Character updates are read-only visual feedback

**Dependencies:** Phase 2 complete

**Avoids pitfall:** Building investment pool without working broadcast means updates don't reach all players.

### Phase 4: Interactions (Weeks 8-10)
**Build:** Mini-games (voting, bidding, trivia, reaction), card mechanics (career events, luck/hazard decks), success formula tracking

**Why after Phase 3:**
- Mini-games are synchronization-heavy; need stable tile system first
- Card decks are just data; drawing from them is a tile effect
- Success formula is tracking only; doesn't affect early game

**Dependencies:** Phase 3 complete; mini-games are high-complexity (own sub-phases)

**Avoids pitfall:** Mini-games without tile system means no clear trigger points; will be chaos.

### Phase 5: End Game (Weeks 11-12)
**Build:** Final Round trigger (win detection), Retirement Home showdown (multi-player mini-game), dramatic reveals

**Why last:**
- Win condition only matters after board is playable
- Retirement Home is a mini-game variant; mini-games must be solid
- Dramatic UI is polish; substance first

**Dependencies:** Phase 4 complete

**Avoids pitfall:** Designing end game before knowing how mini-games feel wastes time on redesigns.

## Phase Ordering Rationale

1. **Foundation first:** No shortcuts. Room isolation, state manager, broadcast mechanism. These are the skeleton; nothing attaches without them.

2. **Game loop second:** Verify core mechanic works (turn taking, moving, broadcasting). All subsequent features hang off this.

3. **Board features third:** Now that turns work, layer on complexity (branching paths, special resources). Character portrait system is visual feedback of stat changes, so it pairs naturally here.

4. **Interactions fourth:** Mini-games and cards are the flavor. Build after the skeleton and game loop are solid.

5. **Polish fifth:** End game scenario and dramatic reveals. Only matters after full game is playable.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Node.js + Socket.io is standard, no alternatives needed. WebSocket rooms are proven tech. |
| Architecture | HIGH | Event → Logic → Broadcast pattern is industry standard. In-memory state is simple and correct for local play. |
| Component boundaries | HIGH | Server/client split is non-negotiable in real-time games. game.js as utility module, not state, is clear. |
| Data flow | HIGH | Socket.io broadcast pattern is well-established. Server as source of truth is best practice. |
| Pitfalls | HIGH | Optimistic client updates is the #1 bug in browser multiplayer games; documented extensively. |
| Scalability | MEDIUM | For local party game (10-100 concurrent rooms), single-server in-memory is fine. Would need rethinking at 1M+ scale, but that's not a target. |

## Gaps to Address

- **Mini-game architecture:** Research needed on whether each mini-game is a state machine (server decides all), or if client side-effects (like reaction timing) are graded server-side. Phase 4 research.

- **Character portrait rendering:** CSS tier system makes sense (outfit, face, aura levels), but exact visual design (CSS classes, SVG, canvas) should be explored during Phase 3 implementation.

- **Concurrent room limits:** No hard constraint given, but worth testing memory/CPU at 10, 50, 100 concurrent rooms during Phase 1.

- **Disconnection UX:** What happens if host disconnects? Do remaining players continue? Transfer host role? Pause game? Phase 1 should clarify with product decision.

- **Card deck shuffling:** Deck definition (10+ cards per career × 7 careers, luck/hazard) is data. Implementation detail: single shared pool, or per-player drawn cards? Phase 4 detail.

## Recommendations for Roadmap

1. **Build phases sequentially, not in parallel:** Each phase unblocks the next. Attempting to build mini-games before the turn order works is lost effort.

2. **Validate Phase 2 (game loop) with stakeholders before Phase 3:** Does rolling, moving, and turn taking feel fun? If the core loop is boring, no amount of special tiles fixes it.

3. **Plan Phase 4 (mini-games) carefully:** This is the most complex subsystem. Each mini-game is a small game in itself (trivia: question generation + scoring; voting: anonymity + tally; bidding: auction logic). Worth sketching out before implementation.

4. **Phase 1 and Phase 3 can have parallel research:** While building Phase 1, someone can research character portrait CSS tiers for Phase 3, and card mechanics for Phase 4. Just don't code until predecessor phase is complete.

5. **Leave room for iteration:** Phase 5 will reveal if the game actually feels fun. Be prepared to loop back to Phase 2 or 3 with balance tweaks (e.g., "rolling twice feels too fast", "investment pool never reaches a fun threshold").

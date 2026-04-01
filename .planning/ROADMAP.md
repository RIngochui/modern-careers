# ROADMAP: GIG — Game of Inevitable Grind

**Project:** Jackbox-style multiplayer party game (Node.js + Socket.io + TypeScript)
**Target:** v1 release with 11 phases covering 74 requirements
**Granularity:** Fine (8-12 phases, 5-10 plans per phase)
**Last Updated:** 2026-03-30

---

## Phases

- [x] **Phase 1: Foundation & Setup** — Project scaffolding, npm, Express, Socket.io room infrastructure (completed 2026-03-30)
- [x] **Phase 2: Lobby & Room System** — Room creation/join, player connection, Success Formula submission (completed 2026-03-30)
- [ ] **Phase 3: Core Game Loop** — Dice rolling, token movement, turn progression, drains
- [ ] **Phase 4: Economic Tiles** — Sports Betting, Investment Pool, Crypto, Tax, Stimulus, Scratch, Nepotism, Union, Ponzi
- [ ] **Phase 5: Life Event Tiles** — Marriage, Kids, Burnout, Midlife Crisis, Therapy, Reality TV, Viral, Cancelled, Lawsuit, Luck/Hazard
- [ ] **Phase 6: Properties, Prison & Goomba Stomp** — Apartment, House, Prison escape, Goomba stomp mechanic
- [ ] **Phase 7: College & Career Paths** — College path with degrees, 7 career paths with event decks
- [ ] **Phase 8: Card System** — Luck/Hazard deck implementation, card effects, draw mechanics
- [ ] **Phase 9: Character Portraits & Real-Time Updates** — CSS-layered portraits, stat-based rendering, socket broadcasts
- [ ] **Phase 10: Mini Games** — 6 mini game types, rotation logic, winner determination, stat stealing
- [ ] **Phase 11: Win Condition & Final Round** — Success Formula detection, Final Round trigger, Retirement Home showdown

---

## Phase Details

### Phase 1: Foundation & Setup

**Goal:** Establish server infrastructure with Socket.io room isolation and state management foundation.

**Requirements:** SETUP-01, SETUP-02, SETUP-03, SETUP-04

### Plans

1. **Initialize Node.js project with npm** — Create `package.json`, set up `npm start` script, add dependencies (express@4.18.x, socket.io@4.7.x), ensure port 3000 is configured
2. **Create Express server skeleton** — Build `server.js` with HTTP server creation, static middleware for `/public` folder, CORS enabled for ngrok tunneling
3. **Implement Socket.io connection handler** — Set up Socket.io server with `io.on('connection')`, handle client connect/disconnect, log connection events
4. **Build room isolation foundation** — Create in-memory `Map<roomCode, GameRoom>` structure, implement room join/leave logic, broadcast per-room events with `io.to(roomCode).emit()`
5. **Create game state manager module** — Define GameRoom data structure (players, board, turn state, shared resources), immutable getter functions for state access
6. **Implement full-state-sync mechanism** — Create `getGameState()` broadcast function, implement handshake for new player joins (send full state immediately)
7. **Build player disconnect handler** — Remove player from room on socket disconnect, clean up empty rooms after 30-minute timeout, broadcast "playerLeft" event
8. **Add rate limiting per player** — Implement per-socket event frequency checks (max N events/sec per action type), silently ignore excess events
9. **Set up heartbeat/ping-pong** — Server sends ping every 30 seconds; client responds pong; disconnect socket if no pong after 60 seconds
10. **Create README with setup instructions** — Document `npm install`, `npm start`, `ngrok http 3000`, URLs for host and player HTML files

### Success Criteria

- [ ] `npm start` runs server on port 3000 without errors
- [ ] Host can create a room and receive a 4-letter room code via socket
- [ ] Multiple players can join the same room and see each other's names
- [ ] Player disconnect triggers cleanup; remaining players receive "playerLeft" notification
- [ ] Server handles 50 concurrent rooms with <100MB memory usage
- [ ] CORS headers allow ngrok tunneling (external URLs can reach server)
- [ ] Heartbeat prevents zombie sockets (orphaned clients after 60s inactivity)
- [ ] Rate limiting silently drops excess events; no server errors from spam

**UI hint**: yes

---

### Phase 2: Lobby & Room System

**Goal:** Players can join rooms, set secret Success Formulas, and initiate game start.

**Requirements:** LOBBY-01, LOBBY-02, LOBBY-03, LOBBY-04, LOBBY-05, LOBBY-06, LOBBY-07

### Plans

1. **Build room creation flow** — Implement `create-room` socket event, generate random 4-letter room code, store room in-memory with host designation, emit `roomCreated` back to host with code
2. **Build player join flow** — Implement `join-room` socket event, validate room exists and capacity <6 players, add player to room, broadcast `playerJoined` to all in room
3. **Render host lobby screen (host.html)** — Create HTML with room code display, connected players list, "Start Game" button (disabled until 2+ players + all submitted formulas), player name + formula indicators
4. **Render player lobby screen (player.html)** — Create HTML with name input, Success Formula sliders (Money/Fame/Happiness, sum=60), "Submit Formula" button, confirmation screen after submit
5. **Implement Success Formula submission** — Create `submit-formula` socket event, validate sum=60, store formula in player state (encrypted/hidden from other clients), broadcast formula-submitted flag (not the values) to host
6. **Validate game start conditions** — Implement `start-game` socket event, check 2+ players present + all submitted formulas + host is caller, if valid: broadcast `gameStarted` with initial board state
7. **Build turn order initialization** — Shuffle player order on game start, store turn order in game state, broadcast to all players, set first player as currentTurnPlayer
8. **Handle player disconnect in lobby** — Remove disconnected player from room, revert formula submission state, broadcast updated player list, re-enable "Start Game" button if conditions allow
9. **Create form validation UI** — Success Formula sliders must sum to exactly 60 (show live sum), show validation error if off, prevent submit if invalid
10. **Add player name validation** — Names 1-20 chars, alphanumeric + spaces, prevent duplicate names in same room, show error if taken

### Success Criteria

- [ ] Host creates room and receives unique 4-letter code
- [ ] Multiple players join same room via code and see each other's names on host screen
- [ ] Each player can set a Success Formula (60 points split across Money/Fame/Happiness) secretly
- [ ] Host "Start Game" button only enabled when 2+ players + all formulas submitted
- [ ] Clicking "Start Game" locks lobby, shuffles turn order, broadcasts to all players
- [ ] Player disconnect removes them from lobby; "Start Game" re-enables if conditions still met
- [ ] Game does NOT start until all players have submitted formulas
- [ ] Success Formulas are hidden from other players during and after game

**UI hint**: yes

---

### Phase 3: Core Game Loop

**Goal:** Players can roll dice, move tokens, advance turns, and have ongoing drains applied automatically.

**Requirements:** LOOP-01, LOOP-02, LOOP-03, LOOP-04, LOOP-05, LOOP-06, LOOP-07

**Plans:** 3/4 plans executed (plan 04 Tasks 1-2 complete, Task 3 checkpoint pending human-verify)

Plans:
- [x] 03-01-PLAN.md — BOARD_TILES constant (40 tiles), game-loop test scaffold, roll-dice handler with 2d6 + state guards
- [x] 03-02-PLAN.md — Drain logic, turn advancement, tile dispatch tests (LOOP-04/05/06 test coverage)
- [ ] 03-03-PLAN.md — Host game section: 40-tile board grid, player dots, turn history sidebar, turn counter
- [x] 03-04-PLAN.md (Tasks 1-2) — Player roll screen: Roll Dice button (turn-state-aware), drain notifications, money display

### Success Criteria

- [ ] Current player clicks "Roll Dice"; server rolls two dice, moves token, broadcasts new position
- [ ] All players see token move on host screen (smooth 500ms animation)
- [ ] Player token wraps board correctly (position % board_size)
- [ ] Turn advances to next player after tile effect completes
- [ ] Ongoing drains (marriage, kids, loans) deduct automatically at turn start
- [ ] Host screen shows current player, last roll, turn history
- [ ] Turn state machine prevents double rolls (state guards invalid actions)
- [ ] Career/college paths use 1-die rolls; main board uses 2-die rolls

**UI hint**: yes

---

### Phase 4: Economic Tiles

**Goal:** Implement all money-focused tiles with betting, pools, taxes, and wealth redistribution.

**Requirements:** ECON-01, ECON-02, ECON-03, ECON-04, ECON-05, ECON-06, ECON-07, ECON-08, ECON-09, ECON-10

**Plans:** 2/5 plans executed

Plans:
- [x] 04-00-PLAN.md — Test scaffold (tiles-econ.test.ts), Player.hasPonziFlag, BOARD_TILES economic tile types
- [x] 04-01-PLAN.md — Stateless tiles: Sports Betting, COVID Stimulus, Tax Audit, Scratch Ticket (ECON-01/03/04/05)
- [x] 04-02-PLAN.md — Stateful tiles: Investment Pool, Crypto two-landing cycle (ECON-02/06)
- [x] 04-03-PLAN.md — Social tiles: Nepotism (choice-based), Union Strike (redistribution) (ECON-07/08)
- [x] 04-04-PLAN.md — Complex tiles: Ponzi Scheme (fraud flag + repayment), Student Loan Payment (ECON-09/10)

### Success Criteria

- [ ] Landing on Sports Betting tile: player can bet, roll determines outcome, money updates immediately
- [ ] Landing on Investment Pool: correct payout logic (1=win all, else lose $500), pool total visible on host
- [ ] Landing on COVID Stimulus: all players in room receive $1,400 instantly
- [ ] Landing on Tax Audit: correct percentage deduction (roll × 5%), deduction visible
- [ ] Landing on Scratch Ticket: correct probabilities per die roll (1/$2k, 2-3/break even, 4-6/-$200)
- [ ] Landing on Crypto: investment tracked per-player, next visit applies correct multiplier or loss
- [ ] Landing on Nepotism: current player chooses victim, victim receives $500, beneficiary receives $1,000
- [ ] Landing on Union Strike: all players see average calculated, money redistributed equally
- [ ] Landing on Ponzi: player flagged, next player landing on money tile repays double, flag cleared
- [ ] Student Loan: correct deduction per loan type (if college path taken with loans)
---

### Phase 5: Life Event Tiles

**Goal:** Implement happiness-/fame-focused tiles with life events, drains, and character updates.

**Requirements:** LIFE-01, LIFE-02, LIFE-03, LIFE-04, LIFE-05, LIFE-06, LIFE-07, LIFE-08, LIFE-09, LIFE-10, LIFE-11

### Plans

1. **Implement Get Married tile** — On land: add +10 ❤️, apply -$2,000/turn ongoing drain (stored in status), add wedding ring layer to character, broadcast character update
2. **Implement Have a Kid tile** — On land: add +5 ❤️, apply -$1,000/turn per kid (stackable to 3+, shows "+3 Kids" after 3), add baby layer to character (stacking), broadcast updates
3. **Implement Therapy tile** — On land: prompt player choose pay $1,000 for +3 ❤️ or skip (no effect), broadcast choice + result
4. **Implement Burnout tile** — On land: subtract 3 ❤️ (floor at 0), skip next turn (cannot move, but drains still apply), visual indicator on player, broadcast burnout status + skip flag
5. **Implement Midlife Crisis tile** — On land: lose $5,000, gain +2 ⭐ and +2 ❤️, add sports car layer to character, broadcast character update
6. **Implement Reality TV Offer tile** — On land: prompt player pick 1-5, gain that many ⭐, lose same number ❤️ (floor at 0), broadcast choice + stat change
7. **Implement Viral Moment tile** — On land: roll 1d6, if=1 player chooses Streamer or Right-Wing Grifter path free (skip entry requirements), else gain (result × 100) ⭐, broadcast outcome
8. **Implement Cancelled tile** — On land: lose all current ⭐ instantly (set to 0), broadcast stat change
9. **Implement Lawsuit tile** — On land: current player picks any other player, both lose $2,000 (can go negative), broadcast transaction
10. **Implement Luck/Hazard tile routing** — On land: if Luck tile route to draw-luck-card event, if Hazard route to draw-hazard-card event (implemented in Phase 8)

### Success Criteria

- [ ] Landing on Get Married: happiness +10, marriage drain -$2k/turn activated, wedding ring appears on character
- [ ] Landing on Have a Kid: happiness +5, per-kid drain -$1k/turn added (stacks up to 3+), baby layer visible
- [ ] Landing on Therapy: player can choose to pay $1k for +3 happiness, confirmation shown
- [ ] Landing on Burnout: happiness -3, skip next turn flagged, player cannot roll on next turn
- [ ] Landing on Midlife Crisis: money -$5k, fame +2, happiness +2, sports car layer added
- [ ] Landing on Reality TV: player selects 1-5, fame increases by selection, happiness decreases by same
- [ ] Landing on Viral Moment: 1/6 chance to pick free career, else fame += roll×100
- [ ] Landing on Cancelled: all fame instantly set to 0
- [ ] Landing on Lawsuit: current player selects opponent, both lose $2k (money can go negative)
- [ ] Life event tiles trigger character portrait updates visible on all screens

---

### Phase 6: Properties, Prison & Goomba Stomp

**Goal:** Implement property ownership/rental, prison escape mechanics, and Goomba stomp tile collision.

**Requirements:** PROP-01, PROP-02, PROP-03, PRISON-01, PRISON-02, PRISON-03, PRISON-04, PRISON-05, PRISON-06, STOMP-01, STOMP-02

### Plans

1. **Implement Apartment Building tile** — On land: if not owned + player has 2× starting money, purchase automatically, add landlord top hat to character, set rent=25% of future landers' money; if owned, current lander pays rent to owner
2. **Implement House tile** — On land: if not owned + player has 4× starting money, purchase automatically, set rent=33% of future landers' money; if owned, current lander pays rent to owner
3. **Implement property ownership tracking** — Store owner socket ID + rent percentage per property tile, persist through game, prevent multiple owners per property
4. **Implement rent payment system** — When player lands on owned property, calculate rent (% of current money), deduct from lander, add to owner, broadcast transaction (source, dest, amount)
5. **Build Prison tile logic** — On land: move player to dedicated Prison tile, set status.inPrison=true, skip movement turns (but drains/income still apply), show prison icon on host screen
6. **Implement prison escape roll mechanic** — While imprisoned, player can attempt escape: roll 1d6, if=1 move to Prison Exit tile and clear inPrison flag; if not 1, stay imprisoned
7. **Implement prison fine escape** — While imprisoned, player can pay $5,000 fine to immediately exit to Prison Exit tile and clear inPrison flag
8. **Implement Goomba Stomp mechanic** — On move completion: check if landing tile already occupied, if yes: send all occupants to Prison immediately (goomba-stomp event), current player stays on tile
9. **Build prison UI on host screen** — Show prison icon next to imprisoned player names, display turns served counter, highlight Prison tile and Prison Exit tile
10. **Handle Luck/Hazard cards in prison** — Imprisoned players can still play Luck cards on their turn (but cannot move), restricted to card plays only

### Success Criteria

- [ ] Landing on Apartment Building: first affordable player buys automatically, future landers pay 25% rent to owner
- [ ] Landing on House: first affordable player buys automatically, future landers pay 33% rent to owner
- [ ] Property rent payments deduct from lander, add to owner, are visible on all screens
- [ ] Landing on Prison: player status set to imprisoned, skips movement turns, drains still apply
- [ ] Imprisoned player can roll 1d6 to escape (1=escape); if not, stays imprisoned
- [ ] Imprisoned player can pay $5,000 fine to escape immediately
- [ ] Goomba Stomp: moving player lands on occupied tile, sends all occupants to Prison, stomp player stays
- [ ] Host screen shows prison icons + turn counters for imprisoned players
- [ ] Imprisoned players cannot roll/move but can play Luck cards

**UI hint**: yes

---

### Phase 7: College & Career Paths

**Goal:** Implement branching paths with college degrees, 7 career paths, and unique event card decks per path.

**Requirements:** COLL-01, COLL-02, COLL-03, COLL-04, COLL-05, COLL-06, CAREER-01, CAREER-02, CAREER-03, CAREER-04, CAREER-05, CAREER-06, CAREER-07, CAREER-08, CAREER-09, CAREER-10

### Plans

1. **Build college path branching** — Create College entrance tile that routes to 4-space college path (separate track with 1d6 rolling per space), track player inside college, allow early exit
2. **Implement college tuition system** — Each turn inside college costs tuition (TBD amount), if insufficient funds auto-take loan tracked as debt, track total college debt per player
3. **Implement degree selection on exit** — On college path completion: prompt player choose Comp Sci (blue cap), Business (green cap), Health Sciences (red cap), or exit undeclared; add graduation cap layer to character
4. **Implement second college run** — Second college entrance only offers Teaching degree (purple cap), limit to one Teaching degree per game
5. **Build 7 career paths with entry requirements** — Define Tech Bro (needs Comp Sci), Finance Bro (needs Business), Precarious Healthcare Hero (needs Health Sciences), Disillusioned Academic (needs Teaching), Streamer (no degree, pay entry fee, roll 1d6 must be 1), McDonald's (no degree), Right-Wing Grifter (any degree); each path 8-10 tiles long
6. **Implement career entry fees & requirements** — Some careers require degree (block entry if not met), some require dice roll (fail=lose fee, can't enter), Streamer requires payment attempt
7. **Create per-career event card decks** — Define 10+ unique event cards per career (specific rewards, penalties, flavor), shuffle on entry, draw 1 on each space landing
8. **Implement career badge on character** — On entry to career path, add career badge/icon to character portrait
9. **Implement Unemployed state** — On career path exit before completion, set status.unemployed=true, add cardboard sign "will work for ⭐" to character
10. **Build career path UI on host screen** — Show all players' current career/college status, paths they're on, position within path

### Success Criteria

- [ ] Player lands on College entrance: routes to college track, 1d6 rolling per space, tuition deducted
- [ ] College debt tracked; second college run available; Teaching degree only on second run
- [ ] Each career path enforces entry requirements (degree, fee, dice roll success)
- [ ] Tech Bro path requires Comp Sci; Finance Bro requires Business; etc.
- [ ] Streamer requires payment + 1d6=1 to enter (else lose fee, can't enter this turn)
- [ ] Right-Wing Grifter loses all happiness on entry
- [ ] Each career path has 10+ unique event cards, shuffled on entry
- [ ] Career badge visible on character when in career path
- [ ] Unemployed state shows cardboard sign on character
- [ ] Host screen displays all players' current path status

**UI hint**: yes

---

### Phase 8: Card System

**Goal:** Implement Luck and Hazard card draws, effects, and hand management.

**Requirements:** CARD-01, CARD-02, CARD-03, CARD-04, CARD-05

### Plans

1. **Build Luck card deck structure** — Define 10+ general Luck cards (examples: "+$1k", "+2 ❤️", "+3 ⭐", "Steal $500 from chosen player", "Swap money with player", etc.), implement draw from deck (removes from circulation), return to hand
2. **Build Hazard card deck structure** — Define 10+ general Hazard cards (immediate effects: "Lose $2k", "Lose 2 ⭐", "Skip next turn", etc.), implement draw from deck, apply immediately (not held)
3. **Implement Luck card hand management** — Players hold Luck cards in hand, can play any time on their turn (not just tile landing), display hand on player screen
4. **Implement Hazard card immediate application** — On draw: apply effect immediately (no hold), broadcast effect to all players, card discarded
5. **Implement Cancel-a-Hazard Luck card** — Special Luck card: can be played anytime to cancel any Hazard drawn by any player (even other players' Hazards), broadcast cancellation
6. **Implement career-specific event decks** — Each career path has unique event deck (10+ cards), drawn on space landing, applied immediately, returned to career deck
7. **Implement play-luck-card socket event** — Player sends `play-luck-card {cardId}` on their turn, server validates card in hand + allowed timing, applies effect, removes from hand, broadcasts result
8. **Implement deck reshuffle logic** — When career/Luck deck empty, reshuffle discards back into deck, track reshuffle count for testing
9. **Build card UI on player screen** — Show Luck cards in hand (clickable during turn), card descriptions (text overlay), Cancel-a-Hazard highlighted if Hazard just drawn
10. **Build card animation on host screen** — Show Hazard drawn + effect applied, show Cancel-a-Hazard used, broadcast card effects with 2-second pause for clarity

### Success Criteria

- [ ] Landing on Luck tile: player draws Luck card, added to hand
- [ ] Luck cards can be played any time on player's turn; effect applies, card discarded
- [ ] Landing on Hazard tile: Hazard card drawn, effect applied immediately (not held)
- [ ] Cancel-a-Hazard card can cancel any Hazard drawn (by any player) during game
- [ ] Career paths have unique event decks (10+ cards per career) drawn on space landing
- [ ] Card effects correctly applied (money, stats, drains, effects)
- [ ] Deck reshuffle occurs when empty; discards reshuffled
- [ ] Player hand displayed on player screen with clickable cards
- [ ] No card in hand can be played multiple times without reshuffle
- [ ] Host screen shows card effects with 2-second pause for clarity

**UI hint**: yes

---

### Phase 9: Character Portraits & Real-Time Updates

**Goal:** Implement CSS-layered character portraits with stat-based rendering and real-time broadcast updates.

**Requirements:** CHAR-01, CHAR-02, CHAR-03, CHAR-04, CHAR-05, CHAR-06, CHAR-07, CHAR-08

### Plans

1. **Build base character portrait HTML structure** — Create layered div structure for each player (head, body, outfit, aura, accessories), 6-8 nested divs per portrait
2. **Implement money tier CSS classes** — Define 5 outfit tiers based on money: $0-2k (ripped jeans), $2k-10k (casual), $10k-25k (business casual), $25k-50k (suit), $50k+ (designer); apply class based on current money
3. **Implement happiness tier CSS classes** — Define 5 face tiers based on happiness: 0-5 (frowning/dark circles), 6-15 (neutral), 16-30 (smiling), 31-45 (happy), 46-60 (beaming/sparkles); apply class based on happiness
4. **Implement fame tier CSS classes** — Define 4 aura tiers based on fame: 0-5 (none), 6-20 (minor glow), 21-40 (medium aura), 41-60 (celebrity aura/floating stars); apply class based on fame
5. **Implement life event overlay layers** — Add CSS classes for: sports car (midlife crisis), wedding ring (married), baby (kids, stackable, shows "+3 Kids" after 3), prison jumpsuit, graduation cap (color per degree), landlord top hat, career badge, unemployed sign, bathrobe+rocking chair (Retirement Home)
6. **Build character-update socket event** — Implement server `character-update` broadcast whenever any stat or status changes, send updated player state to all clients
7. **Implement CSS animations on class changes** — Use `transition: all 300ms ease-in-out` for stat tier changes, color shifts, aura changes
8. **Batch DOM updates for performance** — On character-update event, collect all player changes, apply in single `requestAnimationFrame` call to minimize reflows
9. **Render character portraits on host screen** — Display all players' portraits in a row for comparison (small size ~100px), update in real-time on character-update events
10. **Render character portrait on player screen** — Display own portrait larger (~200px), updates in real-time

### Success Criteria

- [ ] Character portraits render with 6-8 layered divs (no image assets)
- [ ] Money tier changes outfit class based on 5 tiers (ripped → casual → business → suit → designer)
- [ ] Happiness tier changes face class based on 5 tiers (frowning → neutral → smiling → happy → beaming)
- [ ] Fame tier changes aura class based on 4 tiers (none → minor → medium → celebrity)
- [ ] Life event layers add visibly (ring, car, baby, jumpsuit, cap, hat, badge, sign, robe)
- [ ] Character-update event broadcasts on every stat/status change
- [ ] CSS transitions animate smoothly (300ms) between tiers
- [ ] Host screen shows all players' portraits; updates in real-time
- [ ] Player screen shows own portrait larger; updates in real-time
- [ ] DOM updates batched with `requestAnimationFrame`; no reflow thrashing

**UI hint**: yes

---

### Phase 10: Mini Games

**Goal:** Implement 6 mini game types with random rotation, server-authoritative timing, winner determination, and stat stealing.

**Requirements:** MINI-01, MINI-02, MINI-03, MINI-04, MINI-05, MINI-06, MINI-07, MINI-08, MINI-09, MINI-10, MINI-11

### Plans

1. **Build mini game rotation system** — Create shuffled deck of 6 game types, draw one after each full round (all players have taken a turn), no repeats until reshuffle, reshuffle when deck empty
2. **Implement mini game instructions card UI** — All players show fullscreen card with game name, rules, example (2-3 lines), 5-second countdown before play phase
3. **Build server-authoritative timer** — Mini game timer runs on server, not client; broadcast `startTime` and `durationMs` to all clients; client calculates remaining time from server timestamp
4. **Implement Trivia mini game** — 15+ questions with 4 options each; first correct tap wins; question shown fullscreen on all devices; server validates response vs correct answer; first correct wins (response timestamp < durationMs)
5. **Implement Reaction Speed mini game** — 5-second timer with at least one fake-out (red screen before actual "go"), fastest server-side tap timestamp wins, early tappers disqualified (taps before durationMs reached)
6. **Implement Voting mini game** — Prompt shown on host screen (e.g., "Who would survive longest in a zombie apocalypse?"); players vote for any other player (not themselves); most votes wins; ties split winner
7. **Implement Bluffing mini game** — One player secretly designated Liar (shown on their device only); statement shown; Liar claims true; others vote identify Liar; Liar wins if majority fooled, otherwise identify voters win
8. **Implement Bidding mini game** — Players secretly bid any amount (0 allowed, safe); highest bid wins $5,000 but loses bid; tie means both lose bids, nobody wins; show bids after reveal
9. **Implement Memory mini game** — Sequence of 6-8 emoji flashes on host screen (1-second per emoji); players recreate in order on player screen (click buttons or type); first correct submission wins; sequence grows by 1 each recurrence
10. **Implement mini game winner determination and stat stealing** — Winner chooses one steal: 1 ❤️, 1 ⭐, or $1,000 from chosen player (target can't go below 0); apply steal, broadcast result, return to board

### Success Criteria

- [ ] Mini games trigger after each full round (all players' turns completed)
- [ ] Mini game deck rotates randomly; no repeats until reshuffle; reshuffle on empty
- [ ] Instructions card shows 5-second countdown before play phase
- [ ] Trivia: 15+ questions with 4 options; first correct tap wins
- [ ] Reaction Speed: server-authoritative timer; fastest tap wins; early tappers disqualified
- [ ] Voting: prompt on host; players vote for others; most votes wins; ties handled
- [ ] Bluffing: Liar designation secret; vote to identify; Liar wins if fooled majority
- [ ] Bidding: secret bids; highest wins $5k but loses bid; $0 bid is safe; ties both lose
- [ ] Memory: emoji sequence flashes on host; players recreate on player screen; first correct wins
- [ ] Winner chooses stat steal: 1 ❤️, 1 ⭐, or $1k from any player (can't go negative)
- [ ] All players see mini game results and stat changes immediately

**UI hint**: yes

---

### Phase 11: Win Condition & Final Round

**Goal:** Detect when player meets Success Formula, trigger Final Round drama, and resolve winner via Retirement Home showdown.

**Requirements:** WIN-01, WIN-02, WIN-03, WIN-04, WIN-05, WIN-06, WIN-07, WIN-08, WIN-09

### Plans

1. **Implement Success Formula detection** — After every stat change (money, fame, happiness), check if player's totals >= their secret formula targets, if yes trigger Final Round
2. **Implement Final Round announcement** — Broadcast `FINAL ROUND 🚨` to all screens (fullscreen modal/banner), announce triggering player, show countdown (all other players get exactly 1 more turn), state transitions to `finalRound` phase
3. **Implement Retirement Home tile** — Triggering player immediately moves to Retirement Home tile (special non-playable tile), marked as `retired=true`, stays on board for visibility
4. **Implement final round turn progression** — After Final Round triggered, each other player gets exactly one more turn (roll, move, tile effect), then game proceeds to showdown resolution
5. **Implement mid-final-round formula detection** — If another player meets their formula during final round, they also move to Retirement Home and join showdown
6. **Implement elimination for non-meeters** — After final round turns complete, players who don't meet formula are eliminated from winning (stay visible on board, but can't win)
7. **Build Retirement Home sudden-death mechanism** — If 2+ players in Retirement Home, they play sudden-death Reaction Speed mini game to determine winner; server handles timing fairness
8. **Implement solo winner scenario** — If only 1 player meets formula, they win outright with solo Retirement Home cutscene (bathrobe + rocking chair overlay, "You Won!" announcement)
9. **Implement game-over screen** — Reveal all players' secret Success Formulas, final stats (money, fame, happiness), winner announced, game ends
10. **Build Final Round UI on host screen** — Show Final Round banner, whose turn next during final round, Retirement Home as destination, players in Retirement Home highlighted

### Success Criteria

- [ ] Player meets Success Formula (money/fame/happiness >= targets): Final Round announced on all screens
- [ ] Triggering player moves to Retirement Home, marked retired
- [ ] All other players get exactly one more turn after Final Round trigger
- [ ] If another player meets formula during final round, they also retire to Retirement Home
- [ ] Players who don't meet formula after final round are eliminated
- [ ] 2+ players in Retirement Home: sudden-death Reaction Speed mini game
- [ ] 1 player in Retirement Home: solo win with robe + rocking chair cutscene
- [ ] Game-over screen reveals all Success Formulas + final stats
- [ ] Host screen shows Final Round banner and Retirement Home status
- [ ] Winner clearly announced with dramatic presentation

**UI hint**: yes

---

## Progress Tracking

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Setup | 2/2 | Complete    | 2026-03-30 |
| 2. Lobby & Room System | 4/4 | Complete   | 2026-03-30 |
| 3. Core Game Loop | 3/4 | In Progress|  |
| 4. Economic Tiles | 2/5 | In Progress|  |
| 5. Life Event Tiles | 0/10 | Not started | - |
| 6. Properties, Prison & Stomp | 0/10 | Not started | - |
| 7. College & Career Paths | 0/10 | Not started | - |
| 8. Card System | 0/10 | Not started | - |
| 9. Character Portraits | 0/10 | Not started | - |
| 10. Mini Games | 0/10 | Not started | - |
| 11. Win Condition & Final Round | 0/10 | Not started | - |

---

## Key Research Insights Applied

### Architecture Principles
- **Server-authoritative state:** All mutations on server only; clients receive broadcasts
- **Socket.io room isolation:** Per-room game state with `io.to(roomCode).emit()`
- **In-memory only:** No database; sessions ephemeral; room cleanup on game end

### Critical Pitfalls Addressed

**Phase 1 (Foundation):**
- Stale client state after reconnection → full-state-sync on reconnect + version stamps
- Memory leaks → explicit cleanup on disconnect, 30-minute timeout for empty rooms
- Turn state corruption → state machine with atomic transitions
- No heartbeat → ping/pong every 30 seconds, 60-second timeout for zombie sockets

**Phase 2 (Lobby):**
- N/A (mostly frontend)

**Phase 3 (Core Loop):**
- State desynchronization → periodic full-state broadcast every 30 seconds
- CSS portrait performance → batch DOM updates with `requestAnimationFrame`, throttle broadcasts
- No UI feedback → disable buttons during async ops, show success/error

**Phase 10 (Mini Games):**
- Reaction Speed timing unfairness → server-authoritative timer, client syncs to server timestamp
- Mini game deck cheating → server-side deck state, immutable from client
- Mini game rotation breaks → deck reshuffle logic, no repeats until reshuffle

### Design Patterns
1. **Event → Logic → Broadcast:** Every player action routes through game logic, then broadcasts to room
2. **Atomic transactions:** All side effects of one action complete before next event processed
3. **Source of truth:** Server state is authoritative; clients never mutate directly
4. **Per-room isolation:** No data leaks between rooms; Socket.io rooms provide isolation
5. **Graceful degradation:** Player disconnects handled; game can pause/continue

---

## Next Steps

1. **Await approval** of this roadmap
2. **Plan Phase 1** via `/gsd:plan-phase 1` to generate detailed task breakdown
3. **Execute Phase 1** (Foundation) to establish multiplayer infrastructure
4. **Validate Phase 2** (Lobby) with stakeholders before proceeding
5. **Proceed sequentially:** Each phase unblocks the next

---

*Roadmap created: 2026-03-29*
*Last updated: 2026-03-30 after Phase 3 planning*

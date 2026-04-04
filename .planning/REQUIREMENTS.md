# Requirements: Modern Careers

**Defined:** 2026-03-29
**Core Value:** Fun, chaotic, real-time multiplayer party experience playable in a browser — host on big screen, players on phones, no install required.

---

## v1 Requirements

### Setup & Infrastructure

- [x] **SETUP-01**: Project has `package.json` with `npm start` script running Express on port 3000
- [x] **SETUP-02**: README documents: `npm install`, `npm start`, `ngrok http 3000`, host opens `/host.html`, players open `/player.html`
- [x] **SETUP-03**: Static files served from `/public/` (host.html, player.html, game.js, style.css)
- [x] **SETUP-04**: Server runs Socket.io with CORS enabled for ngrok URLs

### Lobby & Room System

- [x] **LOBBY-01**: Host can create a room, receives a 4-letter room code
- [x] **LOBBY-02**: Players can join a room by entering the room code
- [x] **LOBBY-03**: Host screen displays all connected players and their chosen names
- [x] **LOBBY-04**: Host can start the game once at least 2 players have joined
- [x] **LOBBY-05**: Each player secretly sets a Success Formula: 60 points split across Money/Fame/Happiness before game starts
- [x] **LOBBY-06**: Game cannot start until all players have submitted their Success Formula
- [x] **LOBBY-07**: Player disconnection during lobby removes them from the room

### Core Game Loop

- [x] **LOOP-01**: Turn order is determined at game start and shown on host screen
- [x] **LOOP-02**: Active player rolls 2 dice on the main loop; 1 die inside career/college paths
- [x] **LOOP-03**: Player token advances the rolled number of spaces on the board
- [x] **LOOP-04**: Landing on a tile triggers its effect automatically
- [x] **LOOP-05**: Turn advances to next player after all effects resolve
- [x] **LOOP-06**: Ongoing drains (marriage, kids, student loans) are applied automatically at the start of each player's turn
- [x] **LOOP-07**: Host screen shows whose turn it is, current dice roll, and turn history

### Board Tiles — Economic

- [x] **ECON-01**: **Sports Betting** — player bets up to current money, rolls 1 die; 1 = win 6×, else = lose entire bet
- [x] **ECON-02**: **Investment Pool** — all players who land must roll 1 die; 1 = win entire pool (resets to $0), else = lose $500 added to pool; pool amount always visible on host screen; big animation on pool win
- [x] **ECON-03**: **COVID Stimulus Check** — everyone receives $1,400 flat, no interaction required
- [x] **ECON-04**: **Tax Audit** — roll 1 die, lose (result × 5)% of current money
- [x] **ECON-05**: **Scratch Ticket** — pay $200, roll die; 1 = win $2,000 / 2–3 = break even / 4–6 = lose $200
- [x] **ECON-06**: **Crypto** — player invests any amount; next time they pass this tile, roll die: 1–2 = 3× return / 3–4 = break even / 5–6 = worthless; investment tracked per player
- [x] **ECON-07**: **Nepotism** — player gains $1,000, chooses any other player who also receives $500
- [x] **ECON-08**: **Union Strike** — all players' money is averaged and redistributed equally
- [x] **ECON-09**: **Ponzi Scheme** — steal $1,000 from every other player; Ponzi flag placed on player; next money tile landing repays double to each stolen player, flag removed; surviving to win = got away with it
- [x] **ECON-10**: **Student Loan Payment** — players who took college loans automatically deduct $1,000 each time they pass this tile

### Board Tiles — Life Events

- [ ] **LIFE-01**: **Get Married** — +10 ❤️, -$2,000/turn ongoing drain; wedding ring layer added to character
- [ ] **LIFE-02**: **Have a Kid** — +5 ❤️, -$1,000/turn per kid (stackable up to 3+); baby layer added to character (stacks, shows number after 3)
- [ ] **LIFE-03**: **Therapy** — optional; player chooses to pay $1,000 for +3 ❤️, or skip
- [ ] **LIFE-04**: **Burnout** — lose 3 ❤️, skip next turn; cannot be avoided
- [ ] **LIFE-05**: **Midlife Crisis** — lose $5,000, gain +2 ⭐ +2 ❤️; sports car layer added to character
- [ ] **LIFE-06**: **Reality TV Offer** — player picks 1–5: gain that many ⭐, lose same number of ❤️ (floors at 0)
- [ ] **LIFE-07**: **Viral Moment** — roll 1 die; 1 = player chooses Streamer or Right-Wing Grifter path for free; else = gain (result × 100) ⭐
- [ ] **LIFE-08**: **Cancelled** — lose all current ⭐ instantly
- [ ] **LIFE-09**: **Lawsuit** — player picks any other player; both lose $2,000
- [ ] **LIFE-10**: **Luck tile** — draw a Luck card
- [ ] **LIFE-11**: **Hazard tile** — draw a Hazard card

### Properties

- [x] **PROP-01**: **Apartment (Tile 6)** — buy for 50,000 (player choice prompt when landing on unowned tile); rent = 25% of visitor's Salary paid to owner; only one owner per property; owner landing on own tile pays nothing
- [x] **PROP-02**: **House (Tile 25)** — buy for 100,000 (player choice prompt when landing on unowned tile); rent = 50% of visitor's Salary paid to owner; only one owner per property; owner landing on own tile pays nothing
- [x] **PROP-03**: Visitor who can't afford rent: give all cash to owner, then sent to Prison (independent property-default mechanic — not shared with PRISON path)
- [x] **PROP-04**: Host board tile label updates to "[PlayerName]'s Apartment" / "[PlayerName]'s House" upon purchase; reverts to default name if ownership mechanic ever clears (future-proofing)

### Prison

- [x] **PRISON-01**: Dedicated Prison tile on the board
- [x] **PRISON-02**: Imprisoned players skip movement turns but still have drains and passive income applied
- [x] **PRISON-03**: Imprisoned players can play Luck cards on their turn
- [x] **PRISON-04**: Escape option A: roll 2d6 — escape on 9, 11, or 12, move to Prison Exit tile
- [x] **PRISON-05**: Escape option B: pay $5,000 fine, immediately move to Prison Exit tile
- [x] **PRISON-06**: Host screen shows prison icon next to imprisoned players and turns served

### Goomba Stomp

- [x] **STOMP-01**: If a player ends their move on an occupied tile, they may optionally Goomba Stomp: non-Cop sends target to Payday (Tile 0) –1 HP, skipNextPayday=true; Cop sends target to Prison (Tile 10) –2 HP. Stomping is a player choice — declining has no effect.
- [x] **STOMP-02**: Stomping player stays on the tile; applies on main loop and inside all career/college paths

### College Path

- [ ] **COLL-01**: College entrance tile lets player enter the College path
- [ ] **COLL-02**: Each turn inside college costs tuition money; if insufficient, a loan is automatically taken and tracked
- [ ] **COLL-03**: On exit, player chooses one degree: Comp Sci (blue cap), Business (green cap), Health Sciences (red cap)
- [ ] **COLL-04**: Player can exit early with no degree (undeclared)
- [ ] **COLL-05**: Second college run earns Teaching degree only (purple cap)
- [ ] **COLL-06**: Graduation cap layer added to character on degree earned

### Career Paths

- [ ] **CAREER-01**: All career paths branch off the main loop; roll 1 die per space inside
- [ ] **CAREER-02**: **Tech Bro** — requires Comp Sci degree; high 💰 rewards; 10+ event cards
- [ ] **CAREER-03**: **Finance Bro** — requires Business degree; high 💰 + some ⭐; 10+ event cards
- [ ] **CAREER-04**: **Precarious Healthcare Hero** — requires Health Sciences degree; low 💰 + some ⭐/❤️; 10+ event cards
- [ ] **CAREER-05**: **Disillusioned Academic** — requires Teaching degree (2nd college run); moderate ❤️ + low 💰; 10+ event cards
- [ ] **CAREER-06**: **Streamer** — no degree; pay entry fee + must roll a 1 to enter (miss = lose fee, can't enter); high ⭐ + volatile 💰; 10+ event cards
- [ ] **CAREER-07**: **McDonald's Employee** — no degree; very low 💰 + tiny ❤️; 10+ event cards
- [ ] **CAREER-08**: **Right-Wing Grifter** — any degree; high ⭐ + zero ❤️; lose ALL happiness on entry; 10+ event cards
- [ ] **CAREER-09**: Career badge added to character when in a career path
- [ ] **CAREER-10**: Unemployed state shows cardboard sign on character: "will work for ⭐"

### Cards

- [ ] **CARD-01**: Luck cards are held in hand (drawn on Luck tile); player can play any time on their turn
- [ ] **CARD-02**: Hazard cards have immediate effect when drawn (not held)
- [ ] **CARD-03**: At least 10 General Luck cards implemented with all specified effects
- [ ] **CARD-04**: At least 10 General Hazard cards implemented with all specified effects
- [ ] **CARD-05**: Cancel-a-Hazard Luck card can cancel any Hazard drawn by any player

### Character Portraits

- [ ] **CHAR-01**: Each player has a CSS-illustrated layered character portrait visible on host screen (small) and player screen (large)
- [ ] **CHAR-02**: Money tiers drive outfit layer: 5 tiers ($0–$2k ripped jeans, $2k–$10k clean casual, $10k–$25k business casual, $25k–$50k full suit, $50k+ designer)
- [ ] **CHAR-03**: Happiness tiers drive face layer: 5 tiers (0–5 frowning/dark circles → 46–60 beaming/sparkles)
- [ ] **CHAR-04**: Fame tiers drive aura layer: 4 tiers (0–5 nothing → 41–60 full celebrity aura/floating stars)
- [ ] **CHAR-05**: Life event overlay layers: sports car, wedding ring, baby (stacking), prison jumpsuit, graduation cap (color per degree), landlord top hat, career badge, unemployed sign, bathrobe+rocking chair
- [ ] **CHAR-06**: All character changes animate smoothly via CSS transitions
- [ ] **CHAR-07**: `character-update` socket event broadcasts whenever any stat or status changes; triggers re-render on all screens
- [ ] **CHAR-08**: Host screen shows all characters in a row for comparison

### Mini Games

- [ ] **MINI-01**: Mini games trigger automatically after every full round (all players have taken a turn)
- [ ] **MINI-02**: Mini games are picked randomly from a pool; no repeats until all have been played (then reshuffle)
- [ ] **MINI-03**: All player devices show a fullscreen instructions card before each mini game
- [ ] **MINI-04**: 5-second countdown runs on both host and player screens; no interaction until countdown hits 0
- [ ] **MINI-05**: **Trivia** — multiple choice question on all screens; first correct tap wins; 15+ questions with 4 options each
- [ ] **MINI-06**: **Reaction Speed** — countdown with at least one fake-out red screen; fastest server-side tap timestamp wins; early tappers disqualified
- [ ] **MINI-07**: **Voting/Social** — prompt on host screen; players vote for any other player (not themselves); most votes wins; 10+ prompts
- [ ] **MINI-08**: **Bluffing/Lie Detector** — one player secretly designated Liar (shown on their device only); statement shown; Liar claims true; others vote to identify Liar; 10+ statements
- [ ] **MINI-09**: **Bidding/Wagering** — players secretly bid any amount; highest bid wins $5,000 prize but loses bid; tie = both lose bids, nobody wins; $0 bid is safe
- [ ] **MINI-10**: **Memory** — sequence of 6–8 emoji flashes on host screen; players recreate in order; first correct submission wins; sequence grows by 1 each recurrence
- [ ] **MINI-11**: Winner chooses one steal: 1 ❤️, 1 ⭐, or $1,000 from any chosen player (target can't go below 0)

### Win Condition & Final Round

- [x] **WIN-01**: When a player meets their secret Success Formula (Money/Fame/Happiness totals reach their set targets), "FINAL ROUND 🚨" is announced dramatically on all screens
- [ ] **WIN-02**: Every other player gets exactly one more turn after the trigger
- [ ] **WIN-03**: Triggering player moves to Retirement Home tile and is done playing
- [ ] **WIN-04**: Any player who meets their formula during the final round also retires to Retirement Home
- [ ] **WIN-05**: Players who don't meet their formula are eliminated from winning (stay to watch)
- [ ] **WIN-06**: If 2+ players are in the Retirement Home, they play a sudden-death Reaction Speed mini game; fastest tap wins
- [ ] **WIN-07**: If only one player meets their formula, they win outright with a solo Retirement Home cutscene (robe, rocking chair)
- [ ] **WIN-08**: Host screen shows Final Round banner, whose turn is next, and Retirement Home as a destination
- [ ] **WIN-09**: Game-over screen reveals all players' secret Success Formulas and final stats

### Socket Events

- [ ] **SOCK-01**: All specified socket events implemented: `create-room`, `join-room`, `player-joined`, `submit-formula`, `start-game`, `roll-dice`, `move-token`, `enter-career`, `exit-career`, `enter-college`, `exit-college`, `choose-degree`, `draw-card`, `card-effect`, `play-luck-card`, `buy-property`, `pay-rent`, `place-bet`, `bet-result`, `investment-roll`, `investment-loss`, `investment-win`, `apply-drains`, `check-win`, `goomba-stomp`, `attempt-escape`, `pay-fine`, `released-from-prison`, `minigame-start`, `minigame-input`, `minigame-result`, `minigame-end`, `apply-steal`, `final-round`, `player-retired`, `retirement-showdown`, `game-over`, `character-update`

---

## v2 Requirements

### Audio & Polish

- **AUDIO-01**: Sound effects for key moments (dice roll, tile landing, mini game start, Final Round announcement)
- **AUDIO-02**: Background music during mini games
- **AUDIO-03**: Dramatic music swell on Final Round trigger

### Extended Content

- **CONTENT-01**: Additional mini game type: Drawing (players draw, others guess)
- **CONTENT-02**: More career event cards (20+ per career)
- **CONTENT-03**: Seasonal tile variants (e.g., holiday editions of COVID Stimulus)

### UX Improvements

- **UX-01**: Reconnection support — player can rejoin with same name/room code within 10 minutes
- **UX-02**: Host can kick a player from lobby
- **UX-03**: Spectator mode for players who join after game starts

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Persistent accounts / database | Explicit constraint — all state in memory; sessions die on restart |
| Mobile-native app | Browser-only by design |
| AI opponents | Party game is human-only |
| Monetization / cosmetics store | Free-to-host-locally philosophy |
| Cross-room lobbies | Single session, no persistent matchmaking needed |
| OAuth / authentication | No accounts = no auth |
| Cloud deployment / hosting | Local + ngrok is the distribution model |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SETUP-01–04 | Phase 1 | Pending |
| LOBBY-01–07 | Phase 2 | Pending |
| LOOP-01–07 | Phase 3 | Pending |
| ECON-01–10 | Phase 4 | Pending |
| LIFE-01–11 | Phase 5 | Pending |
| PROP-01–03 | Phase 7 | Complete (07-02) |
| PROP-04 | Phase 7 | Pending |
| PRISON-01–06 | Phase 6 | Pending |
| STOMP-01–02 | Phase 6 | Pending |
| COLL-01–06 | Phase 7 | Pending |
| CAREER-01–10 | Phase 7 | Pending |
| CARD-01–05 | Phase 8 | Pending |
| CHAR-01–08 | Phase 9 | Pending |
| MINI-01–11 | Phase 10 | Pending |
| WIN-01–09 | Phase 11 | Pending |
| SOCK-01 | Phase 1–11 | Pending |

**Coverage:**
- v1 requirements: 74 total
- Mapped to phases: 74
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-29*
*Last updated: 2026-03-29 after initial definition*

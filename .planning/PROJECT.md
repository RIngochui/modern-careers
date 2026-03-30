# GIG: Game of Inevitable Grind

## What This Is

A Jackbox-style multiplayer party game playable in a browser, inspired by the Careers board game, Monopoly, and The Game of Life. Players join via room code on separate devices — one player hosts, others play. Each player secretly sets a "Success Formula" of 60 points split between Money, Fame, and Happiness. First to meet their own formula triggers the Final Round; winner is revealed dramatically.

## Core Value

Fun, chaotic, real-time multiplayer party experience that plays in a browser with no install — host shows the board on a big screen, players control from their phones.

## Requirements

### Validated

- ✓ Project scaffold with npm start/test, Express on port 3000, Socket.io with CORS — Phase 1
- ✓ In-memory room store (Map<roomCode, GameRoom>), GameRoom/Player factories, domain constants — Phase 1
- ✓ Full-state-sync (immediate on join + 30s periodic broadcast) — Phase 1
- ✓ Disconnect cleanup with 30-minute room timeout — Phase 1
- ✓ Per-socket rate limiting and heartbeat/ping-pong zombie detection — Phase 1
- ✓ README with 4-step setup (npm install → npm start → ngrok → URLs) — Phase 1

### Active

- [ ] Room-based multiplayer: create/join via 4-letter room code
- [ ] Host screen shows live board with all player tokens, stats, and character portraits
- [ ] Player screen shows personal controls, stats, cards in hand, and own character
- [ ] Success Formula: each player secretly sets 60 pts across Money/Fame/Happiness before game starts
- [ ] Full board loop with all special tiles (Sports Betting, Investment, Get Married, Have a Kid, Apartment Building, House, Tax Audit, COVID Stimulus, Viral Moment, Cancelled, Reality TV Offer, Therapy, Burnout, Midlife Crisis, Lawsuit, Nepotism, Union Strike, Ponzi Scheme, Scratch Ticket, Crypto, Student Loan, Luck/Hazard, Retirement Home)
- [ ] College path with 4 degrees and auto-loan system
- [ ] 7 career paths with unique entry requirements and event card decks (10+ cards each)
- [ ] Prison tile with escape mechanics (roll or pay fine)
- [ ] Goomba stomp mechanic
- [ ] Ongoing drains: marriage (-$2k/turn), kids (-$1k/turn each), student loans (-$1k/turn)
- [ ] Investment pool tile with persistent jackpot visible on host screen
- [ ] Crypto tile with per-player tracked investment
- [ ] Layered CSS character portraits — stat-based outfit/face/aura tiers + life event overlays
- [ ] Character updates broadcast in real time via socket.io
- [ ] 6 mini games (Trivia, Reaction Speed, Voting, Bluffing, Bidding, Memory) with random rotation, no repeats until reshuffle
- [ ] Mini game instructions card + 5-second countdown before each mini game
- [ ] Mini game winner steals a stat (❤️/⭐/$1k) from chosen player
- [ ] Luck and Hazard card decks (10+ cards each)
- [ ] Final Round trigger with dramatic announcement on all screens
- [ ] Retirement Home tile + multi-player sudden-death Reaction Speed showdown
- [ ] Host screen: prison indicators, investment pool, Final Round banner, turn order
- [ ] In-memory state only (no database)
- [ ] Local testing via ngrok; npm start script; README with setup steps

### Out of Scope

- Persistent accounts/profiles — no database, all state in memory; session ends on server restart
- Mobile-native app — browser-only, no React Native or Capacitor
- Database or persistent storage — explicit constraint
- AI opponents — party game is human-only by design
- Spectator mode beyond what the host screen provides — host screen IS the spectator view
- Payment or monetization — party game, free to host locally

## Context

- Stack: Node.js + Express + Socket.io backend, vanilla HTML/CSS/JS frontend
- File layout: `/server.js`, `/public/host.html`, `/public/player.html`, `/public/game.js`, `/public/style.css`
- Local dev: `npm start` → port 3000, expose via ngrok for remote play
- Board uses looping track with branching paths; 2 dice on main loop, 1 die inside career/college
- Character visuals are pure CSS layered illustrations — no image assets needed
- All real-time sync via Socket.io room events; full event list defined in spec

## Constraints

- **Tech Stack**: Node.js + Express + Socket.io + vanilla JS — no frameworks, no database
- **State**: All game state lives in memory on the server; no persistence between sessions
- **Assets**: No external image assets — characters are CSS-drawn layered illustrations
- **Distribution**: Local run + ngrok; no cloud deployment required

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Vanilla JS frontend | No build toolchain, simpler for local party play, spec requires it | — Pending |
| In-memory state only | Simplest deployment — run locally, share via ngrok | — Pending |
| Socket.io for real-time | Industry standard for this use case, works well with Express | — Pending |
| CSS-only character portraits | No asset pipeline, instant updates via class toggles | — Pending |
| Budget AI model profile | User preference for cost efficiency | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-30 after Phase 1 completion + rename to GIG + TypeScript migration*

# Modern Careers — Technical Game Design Reference

*Authoritative mechanics reference for developers and designers. Numbers and formulas are exact.*

---

## Architecture Overview

- **Server-authoritative:** All state mutations happen on the server (`server.ts`). Clients receive broadcasts only.
- **Transport:** Socket.io room isolation via `io.to(roomCode).emit()`.
- **State:** In-memory only. No database. Sessions are ephemeral.
- **Pattern:** Event → Logic → Broadcast. Every player action routes through game logic, then broadcasts to the room.
- **Atomic transactions:** All side effects of one action complete before the next event is processed.

---

## Player Model

```typescript
interface Player {
  id: string               // socket.id
  name: string
  money: number            // cash on hand (starts 10,000; negative allowed)
  salary: number           // income per Payday (starts 10,000)
  fame: number             // starts 0
  happiness: number        // starts 0
  hp: number               // starts 10; ≤0 → Hospital
  position: number         // board tile index (0–39)
  inHospital: boolean      // true when on Tile 30 and stuck
  inPrison: boolean        // true when imprisoned
  inJapan: boolean         // true when staying in Japan Trip
  isDoctor: boolean        // true after Nursing Degree career completion
  isCop: boolean           // true after Cop career completion
  prisonTurns: number      // turns served in prison (incremented on failed escape)
  hasPonziFlag: boolean    // pending Ponzi repayment flag
  // future fields: degree, career, marriageActive, kidCount, gymMember, etc.
}
```

**Serialization note:** `getFullState()` broadcasts player state to clients. `successFormula` is never included in any emit payload.

---

## Core Formulas

### Life Total
```
Life Total = Fame + Happiness + MoneyPoints
MoneyPoints = floor(Cash / 10,000)
```

### Win Condition
Player wins when, after any stat change:
1. `Life Total >= 60`, AND
2. Their stats satisfy their secret Success Formula

### Secret Formula
Set before game starts. 60 points split across MoneyPoints / Fame / Happiness thresholds.
Formula values stored server-side only — never broadcast.

---

## Turn Flow

```
advanceTurn()
  → nextPlayer.inJapan? → handleJapanTurnStart()
  → nextPlayer.inHospital? → (player rolls on their turn)
  → nextPlayer.inPrison? → (player rolls on their turn)
  → apply drains (marriage, kids, gym, etc.)
  → broadcast game-state
  → player taps Roll
    → inHospital? → handleHospitalEscape()
    → inPrison? → handlePrisonEscape()
    → normal: roll 2d6, move player
      → update position
      → checkGoombaStomp()
      → dispatchTile()
      → checkWinCondition()
```

**Dice:**
- Main board: 2d6
- Inside career/college paths: 1d6

---

## Tile Mechanics

### Tile 0 — Payday
- **Pass through:** `player.money += player.salary`
- **Land exactly:** `player.money += player.salary * 2`

### Tile 1, 5, 11, 13, 16, 21, 24, 29, 32, 36, 39 — Opportunity Knocks
- Draw top card from shared room-level shuffled deck
- Deck reshuffles when empty
- Cannot draw while `inHospital`, `inPrison`, or `inJapan`

### Tile 2 — Pay Taxes
```
if (salary <= 30000)        tax = 0
else if (salary < 70000)    tax = salary * 0.5
else                        tax = salary * 0.9
player.money -= tax
```

### Tile 3 — Student Loan Payment
```
player.position = 9   // teleport to University
player.money -= 15000
// entry fee (10,000) is waived
```

### Tile 4 — McDonald's (Career Path Entry)
- Entry: free, no degree required
- Exits to Tile 6 on completion + `experienceCards += 1`

### Tile 6 — Apartment
```
if (room.apartmentOwner === null && player.money >= 50000)
  room.apartmentOwner = player.id
  player.money -= 50000
else if (room.apartmentOwner && room.apartmentOwner !== player.id)
  rent = Math.floor(player.salary * 0.25)
  if (player.money >= rent)
    player.money -= rent
    owner.money += rent
  else
    owner.money += player.money
    player.money = 0
    player.inPrison = true
    player.position = 10
```

### Tile 7 — Sports Betting
```
player decides to bet: player.money -= 10000
roll = Math.ceil(Math.random() * 6)
if (roll === 1) player.money += 60000
// else: stake lost, nothing returned
```

### Tile 8 — Cigarette Break
```
roll = Math.ceil(Math.random() * 6)  // = X
player.happiness += X
player.hp -= X
checkHpAndHospitalize(player)
```

### Tile 9 — University
```
if (!fromTile3) player.money -= 10000
if (player.degree === null) {
  player chooses degree
  player.degree = chosenDegree
}
// path events run (breakup tiles, party tiles, etc.)
// exits to Tile 11
```

### Tile 10 — Prison
See [Prison Mechanics](#prison-mechanics) section.

### Tile 12 — Finance Bro (Career Path Entry)
Entry: `degree === 'Economics' || degree === 'Business' || money -= 10000 || Nepotism`
Exits to Tile 13 + `experienceCards += 1`

### Tile 14 — Art Gallery / NFT
```
// player may buy 1+ NFTs at 20,000 each
for each purchase:
  payment = 20000
  roll = Math.ceil(Math.random() * 6)
  player.fame += roll
  if (room.artistPlayer) room.artistPlayer.money += payment
  else banker.money += payment  // (Banker = house funds)
```

### Tile 15 — Supply Teacher (Career Path Entry)
Entry: `degree === 'Teaching' || money -= 10000 || Nepotism`
Exits to Tile 16 + `experienceCards += 1`

### Tile 17 — Gym Membership
```
if (!player.gymMember && player.money >= 10000):
  player.gymMember = true
  player.money -= 10000
// On every subsequent pass (not land):
if (player.gymMember):
  player.money -= 5000
  player.hp += 1
  player.happiness += 1
```

### Tile 18 — Cop (Career Path Entry)
Entry: `(wait 1 turn + money -= 15000) || Nepotism`
Exits to Tile 21 + `experienceCards += 1` + `player.isCop = true`

### Tile 19 — Lottery
```
// room.lotteryPool starts at 50,000
maxRolls = 3
for i in 1..maxRolls (player may stop early):
  player.money -= 10000
  room.lotteryPool += 10000
  d1 = Math.ceil(Math.random() * 6)
  d2 = Math.ceil(Math.random() * 6)
  if (d1 === d2):
    player.money += room.lotteryPool
    room.lotteryPool = 50000
    break
```

### Tile 20 — Japan Trip
See [Japan Trip Mechanics](#japan-trip-mechanics) section.

### Tile 22 — People & Culture Specialist (Career Path Entry)
Entry: `degree === 'Gender Studies' || player.fame -= 20 || Nepotism`
Exits to Tile 24 + `experienceCards += 1`

### Tile 23 — Revolution
```
total = sum(p.money for all players)
share = Math.floor(total / playerCount)
remainder = total % playerCount  // → Banker
for each player: player.money = share
```

### Tile 25 — House
```
if (room.houseOwner === null && player.money >= 100000)
  room.houseOwner = player.id
  player.money -= 100000
else if (room.houseOwner && room.houseOwner !== player.id)
  rent = Math.floor(player.salary * 0.5)
  if (player.money >= rent)
    player.money -= rent
    owner.money += rent
  else
    owner.money += player.money
    player.money = 0
    player.inPrison = true
    player.position = 10
```

### Tile 26 — Nepotism
```
// player chooses: targetPlayer, completedCareerPath
// targetPlayer is teleported to start of that career path
// all entry requirements waived
// current player receives the career's associated money payout
```

### Tile 27 — COVID Stimulus
```
// player chooses hpToTrade (integer, 1 ≤ hpToTrade ≤ player.hp)
player.money += hpToTrade * 10000
player.hp -= hpToTrade
checkHpAndHospitalize(player)
```

### Tile 28 — Tech Bro (Career Path Entry)
Entry: `degree === 'Computer Science' || money -= 20000 || Nepotism`
Exits to Tile 29 + `experienceCards += 1`
Notable path tiles: Salary increase (die × 1,000 added to salary), +10 Fame, –HP, potential layoff (move to Payday, no Salary this pass).

### Tile 30 — Hospital
See [Hospital Mechanics](#hospital-mechanics) section.

### Tile 31 — Right-Wing Grifter (Career Path Entry)
Entry: `degree === 'Political Science' || player.happiness -= 25 || Nepotism`
Exits to Tile 32 + `experienceCards += 1`

### Tile 33 — Ozempic Session
```
maxTreatments = 3
for i in 1..maxTreatments (player may stop early):
  player.money -= 10000
  player.hp += 2
```

### Tile 34 — Starving Artist (Career Path Entry)
Entry: `degree === 'Art' || money -= 25000 || Nepotism`
Exits to Tile 36 + `experienceCards += 1` + `player.isArtist = true`

### Tile 35 — Yacht Harbor
```
// player chooses tier:
tier1: player.money -= 20000;  player.happiness += 4
tier2: player.money -= 80000;  player.happiness += 8
tier3: player.money -= 160000; player.happiness += 12
```

### Tile 37 — Buy Instagram Followers
```
tier1: player.money -= 20000;  player.fame += 4
tier2: player.money -= 80000;  player.fame += 10
tier3: player.money -= 160000; player.fame += 16
```

### Tile 38 — Streamer (Career Path Entry)
```
maxAttempts = 3
for i in 1..maxAttempts:
  player.money -= 10000
  roll = Math.ceil(Math.random() * 6)
  if (roll === 1) → enter path (exit to Tile 39 + experienceCards += 1)
  else → attempt consumed, player may retry or stop
// OR: Nepotism referral bypasses roll
```

---

## Hospital Mechanics

### Admission
```typescript
function checkHpAndHospitalize(player, room) {
  if (player.hp <= 0) {
    player.inHospital = true
    player.position = 30
    player.hp = 0
    // emit: 'hospital-entered'
    // turn pauses
  }
}
```

### Escape Attempt (on roll-dice while inHospital)
```typescript
function handleHospitalEscape(player, room) {
  const escapeRoll = Math.ceil(Math.random() * 6)
  if (escapeRoll <= 5) {
    // escape
    player.inHospital = false
    player.position = 31
    player.hp += 5
    const payment = Math.floor(player.salary / 2)
    player.money -= payment
    const doctor = [...room.players.values()].find(p => p.isDoctor)
    if (doctor) doctor.money += payment
    else room.bankerFunds += payment
    // emit: 'hospital-escaped'
  } else {
    // stay (roll === 6)
    // emit: 'hospital-stay'
  }
  advanceTurn(room)
}
```

**Guards:** Cannot use Opportunity/Experience cards while `inHospital`.

---

## Prison Mechanics

### Entry Triggers
- Landing on Tile 10 (and `!player.isCop`)
- Cop Goomba Stomp on target
- Rent default (Apartment or House)
- Sent by some career path tiles (Finance Bro tax evasion)

```typescript
player.inPrison = true
player.position = 10
player.prisonTurns = 0
// emit: 'prison-entered'
```

### Cop Immunity
```typescript
if (player.isCop) {
  // fine or HP penalty instead
  // emit: 'prison-cop-immune'
  advanceTurn(room)
}
```

### Turn Interception
```typescript
// in roll-dice handler, before any movement:
if (player.inPrison) return handlePrisonEscape(player, room)
```

### Escape by Roll (2d6)
```typescript
function handlePrisonEscape(player, room) {
  const d1 = Math.ceil(Math.random() * 6)
  const d2 = Math.ceil(Math.random() * 6)
  const prisonRoll = d1 + d2
  if (prisonRoll === 9 || prisonRoll === 11 || prisonRoll === 12) {
    player.inPrison = false
    player.position = 11
    player.prisonTurns = 0
    // emit: 'prison-escaped'
  } else {
    player.prisonTurns += 1
    // emit: 'prison-stay'
  }
  advanceTurn(room)
}
```

### Escape by Bail
```typescript
function handlePrisonBail(player, room) {
  const bail = 5000
  player.money -= bail
  room.bankerFunds += bail
  player.inPrison = false
  player.position = 11
  player.prisonTurns = 0
  // emit: 'prison-bailed'
  advanceTurn(room)
}
```

**While imprisoned:** No movement, no Salary. Drains still apply. Cards are allowed.

---

## Japan Trip Mechanics

### Landing (Tile 20)
```typescript
player.happiness += 1
player.inJapan = true
// emit: 'japan-trip-entered'
```

### Turn Start (intercepted by advanceTurn)
```typescript
function handleJapanTurnStart(player, room) {
  player.happiness += 2
  const drain = Math.ceil(player.salary / 5)
  player.money -= drain

  const d1 = Math.ceil(Math.random() * 6)
  const d2 = Math.ceil(Math.random() * 6)
  const japanRoll = d1 + d2

  if (japanRoll > 8) {
    // forced leave
    player.inJapan = false
    player.position = 21
    // emit: 'japan-forced-leave'
    advanceTurn(room)
  } else {
    // player chooses stay or leave
    // emit: 'japan-stay-choice' { roll: japanRoll }
    // await 'japan-stay' or 'japan-leave' socket events
  }
}
```

**'japan-stay':** advanceTurn, player stays at Tile 20.  
**'japan-leave':** `player.inJapan = false; player.position = 21; dispatchTile()`

**Guards:** Cannot use Opportunity/Experience cards while `inJapan`.

---

## Goomba Stomp Mechanics

**Optional** — stomper chooses whether to stomp. Called after position update when occupants detected; server emits a prompt to the stomper who accepts or declines.

```typescript
function checkGoombaStomp(stomper, room) {
  const targets = [...room.players.values()].filter(p =>
    p.id !== stomper.id &&
    p.position === stomper.position
  )
  if (targets.length === 0) return

  // stomper receives 'stomp-available' prompt; must accept to proceed
  for (const target of targets) {
    if (stomper.isCop) {
      target.position = 10   // Prison
      target.inPrison = true
      target.prisonTurns = 0
      target.hp -= 2
    } else {
      target.position = 0    // Payday
      target.skipNextPayday = true
      target.hp -= 1
    }
    // checkHpAndHospitalize(target) — may redirect to Hospital
  }
  // emit: 'goomba-stomped' { stomper, targets, destination: isCop ? 10 : 0 }
}
```

---

## Doctor Role

### Activation
`player.isDoctor = true` is set on completing the Nursing Degree career path (Phase 8).

### Passive Income
Triggered inside `handleHospitalEscape()` on successful escape:
```typescript
const doctor = [...room.players.values()].find(p => p.isDoctor)
const payment = Math.floor(player.salary / 2)
if (doctor) doctor.money += payment
else room.bankerFunds += payment
```

---

## Cop Role

### Activation
`player.isCop = true` is set on completing the Cop career path.

### Prison Immunity
In `dispatchTile()` → PRISON case:
```typescript
if (player.isCop) {
  // emit: 'prison-cop-immune'
  // apply fine or HP/Happiness penalty
  advanceTurn(room)
} else {
  player.inPrison = true
  player.prisonTurns = 0
}
```

### Enhanced Stomp
In `checkGoombaStomp()`: `if (stomper.isCop) → target to Prison (–2 HP)` instead of Payday (–1 HP).

---

## Artist Role

`player.isArtist = true` set on completing Starving Artist path.

In `dispatchTile()` → ART_GALLERY case:
```typescript
if (room.artistPlayer) room.artistPlayer.money += payment
else room.bankerFunds += payment
```

---

## Card System

### Experience Cards
- Earned: 1 per career path completion
- Usage: TBD (Phase 9+)
- Cannot use while `inHospital`, `inPrison`, or `inJapan`

### Opportunity Cards
- Shared room-level deck, shuffled at game start
- Draw on land at any Opportunity Knocks tile
- 15+ unique cards (money, fame, happiness, HP, movement effects)
- Deck reshuffles on empty
- Cannot draw while `inHospital`, `inPrison`, or `inJapan`

```typescript
function canPlayCard(player): boolean {
  if (player.inHospital) return false
  if (player.inJapan) return false
  return true
  // note: inPrison does NOT block card play
}
```

---

## Board Tile Index

| Tile | Type | Name |
|------|------|------|
| 0 | PAYDAY | Payday |
| 1 | OPPORTUNITY_KNOCKS | Opportunity Knocks |
| 2 | PAY_TAXES | Pay Taxes |
| 3 | STUDENT_LOAN_PAYMENT | Student Loan Payment |
| 4 | MCDONALDS | McDonald's Employee (Career) |
| 5 | OPPORTUNITY_KNOCKS | Opportunity Knocks |
| 6 | APARTMENT | Apartment |
| 7 | SPORTS_BETTING | Sports Betting |
| 8 | CIGARETTE_BREAK | Cigarette Break |
| 9 | UNIVERSITY | University (Career Path Entry) |
| 10 | PRISON | Prison |
| 11 | OPPORTUNITY_KNOCKS | Opportunity Knocks |
| 12 | FINANCE_BRO | Finance Bro (Career) |
| 13 | OPPORTUNITY_KNOCKS | Opportunity Knocks |
| 14 | ART_GALLERY | Art Gallery / NFT |
| 15 | SUPPLY_TEACHER | Supply Teacher (Career) |
| 16 | OPPORTUNITY_KNOCKS | Opportunity Knocks |
| 17 | GYM_MEMBERSHIP | Gym Membership |
| 18 | COP | Cop (Career Path Entry) |
| 19 | LOTTERY | Lottery |
| 20 | JAPAN_TRIP | Japan Trip |
| 21 | OPPORTUNITY_KNOCKS | Opportunity Knocks |
| 22 | DEI_OFFICER | People & Culture Specialist (Career) |
| 23 | REVOLUTION | Revolution |
| 24 | OPPORTUNITY_KNOCKS | Opportunity Knocks |
| 25 | HOUSE | House |
| 26 | NEPOTISM | Nepotism |
| 27 | COVID_STIMULUS | COVID Stimulus |
| 28 | TECH_BRO | Tech Bro (Career) |
| 29 | OPPORTUNITY_KNOCKS | Opportunity Knocks |
| 30 | HOSPITAL | Hospital |
| 31 | RIGHT_WING_GRIFTER | Right-Wing Grifter (Career) |
| 32 | OPPORTUNITY_KNOCKS | Opportunity Knocks |
| 33 | OZEMPIC | Ozempic Session |
| 34 | STARVING_ARTIST | Starving Artist (Career) |
| 35 | YACHT_HARBOR | Yacht Harbor |
| 36 | OPPORTUNITY_KNOCKS | Opportunity Knocks |
| 37 | INSTAGRAM_FOLLOWERS | Buy Instagram Followers |
| 38 | STREAMER | Streamer (Career) |
| 39 | OPPORTUNITY_KNOCKS | Opportunity Knocks |

---

## Career Entry Requirements

| Career | Entry Tile | Degree | Alt Cash | Alt Stat Cost | Nepotism |
|--------|-----------|--------|----------|--------------|----------|
| McDonald's | 4 | None | None | None | Yes |
| Finance Bro | 12 | Economics or Business | $10,000 | — | Yes |
| Supply Teacher | 15 | Teaching Degree | $10,000 | — | Yes |
| Cop | 18 | None | $15,000 + wait 1 turn | — | Yes |
| People & Culture Specialist | 22 | Gender Studies | — | –20 Fame | Yes |
| Tech Bro | 28 | Computer Science | $20,000 | — | Yes |
| Right-Wing Grifter | 31 | Political Science | — | –25 Happiness | Yes |
| Starving Artist | 34 | Art | $25,000 | — | Yes |
| Streamer | 38 | None | $10k/attempt (max 3, roll 1) | — | Yes |
| University | 9 | N/A | $10,000 (waived from Tile 3) | — | — |

---

## Final Round & Win

### Trigger
After any stat change, `checkWinCondition()` runs:
```typescript
const lifeTotal = player.fame + player.happiness + Math.floor(player.money / 10000)
if (lifeTotal >= 60 && formulaSatisfied(player)) {
  // emit: 'final-round' to all
  // player.position = RETIREMENT_HOME
  // mark player retired
}
```

### Final Round Sequence
1. Triggering player retires to Retirement Home — done playing.
2. Every other player gets exactly **one more turn**.
3. Players meeting their formula during Final Round also retire.
4. Players who don't meet formula are eliminated.

### Retirement Resolution
```
if (retirees.length >= 2) → sudden-death Reaction Speed mini game (fastest tap wins)
if (retirees.length === 1) → solo win (robe + rocking chair animation)
```

Game-over screen reveals all secret formulas and final stats.

---

## Drain Schedule

Applied at start of each player's turn:

| Condition | Drain |
|-----------|-------|
| `marriageActive === true` | –$2,000 |
| `kidCount === 1` | –$1,000 |
| `kidCount === 2` | –$2,000 |
| `kidCount >= 3` | –$1,000 × kidCount |
| `gymMember && passing Tile 17` | –$5,000, +1 HP, +1 Happiness |
| `inJapan` (turn start) | +2 Happiness, –Math.ceil(salary/5) |

---

## Implementation Status

| System | Status | Phase |
|--------|--------|-------|
| Server infrastructure | Complete | 1 |
| Lobby / room system | Complete | 2 |
| Core game loop | Complete | 3 |
| Economic tiles (legacy) | Superseded | 4 |
| Board reset (40 tiles) + HP | Complete | 5 |
| Hospital / Prison / Japan Trip / Goomba Stomp | Complete (gap pending) | 6 |
| Properties (Apartment, House) | Planned | 7 |
| University + Career paths | Planned | 8 |
| Opportunity Knocks cards | Planned | 9 |
| Remaining tile mechanics | Planned | 10 |
| Full player + host UI | Planned | 11 |
| Win condition + Final Round | Planned | 12 |

---

*Modern Careers — Technical Reference v1.0*  
*Last updated: 2026-04-03*

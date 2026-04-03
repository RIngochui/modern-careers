# Modern Careers — Player Rulebook

*A chaotic multiplayer board game about money, fame, and questionable life choices.*

---

## What Is This Game?

Modern Careers is a digital party board game for 2–8 players. One player hosts on a big screen (TV or laptop). Everyone else plays on their phones — no app, no install. Just open a link.

The goal is to hit a **Life Total of 60** while satisfying a secret personal formula you write before the game starts. First player to do it triggers the Final Round. Then it's a race.

---

## Setup

**Host:**
1. Open `/host.html` on the big screen.
2. A 4-letter **room code** appears — share it with everyone.

**Players:**
1. Open `/player.html` on your phone.
2. Enter the room code and pick a name.

**Before the game starts:**
- Each player secretly sets their **Success Formula** — 60 points split across:
  - **Money** (MoneyPoints)
  - **Fame**
  - **Happiness**
- Example: `Money 30 / Fame 20 / Happiness 10` (must total 60)
- Nobody else sees your formula. Keep it hidden.

The host can start once all players have submitted.

---

## Your Stats

| Stat | Starting Value | What It Means |
|------|---------------|---------------|
| **HP** | 10 | Health. Drop to 0 → Hospital. |
| **Cash** | $10,000 | Actual money on hand. |
| **Salary** | $10,000 | Your recurring income (collected on Payday). |
| **Fame** | 0 | Celebrity score. |
| **Happiness** | 0 | Life satisfaction score. |

**MoneyPoints** = floor(Cash ÷ 10,000)
So $50,000 cash = 5 MoneyPoints.

**Life Total** = Fame + Happiness + MoneyPoints

---

## Taking a Turn

1. **Roll dice** — tap the Roll button on your phone. 2 dice on the main board; 1 die inside career/college paths.
2. **Move** — your token advances that many spaces.
3. **Tile effect** — wherever you land, something happens automatically.
4. **Turn ends** — next player goes.

**Ongoing drains** are applied at the *start* of your turn each round:
- Marriage costs $2,000/turn
- Each kid costs $1,000/turn
- Active Gym Membership costs $5,000/pass
- Japan Trip: +2 Happiness, pay Salary ÷ 5

---

## The Board

40 tiles. You loop around indefinitely until someone wins.

### Payday (Tile 0)
- **Pass through:** Collect your Salary.
- **Land exactly:** Collect 2× Salary.

### Opportunity Knocks (Tiles 1, 5, 11, 13, 16, 21, 24, 29, 32, 36, 39)
Draw an Opportunity card from the shared deck. Effects vary — could be good, bad, or weird.

### Pay Taxes (Tile 2)
Based on your Salary:
- ≤ $30,000 → pay nothing
- $30,001–$69,999 → pay 50% of one year's Salary
- ≥ $70,000 → pay 90% of one year's Salary

### Student Loan Payment (Tile 3)
Instantly teleport to University (Tile 9) — entry fee waived. Also lose $15,000 immediately.

### McDonald's Employee Path (Tile 4)
Career path entry. No degree needed, no fee. Anyone can enter.

### Apartment (Tile 6)
- **First player who can afford it:** Buy for $50,000.
- **Visitors:** Pay rent = 25% of your Salary to the owner.
- **Can't pay rent?** Hand over all your cash to the owner → go to Prison.

### Sports Betting (Tile 7)
Pay $10,000 to place a parlay. Roll 1 die:
- **1** → win $60,000
- **2–6** → lose your $10,000 stake

### Cigarette Break (Tile 8)
Roll 1 die = X. Gain X Happiness, lose X HP. Fun until it isn't.

### University (Tile 9)
Pay $10,000 to enter. Choose a degree:

| Degree | Opens Career Path |
|--------|------------------|
| Economics | Finance Bro |
| Computer Science | Tech Bro |
| Gender Studies | DEI Officer |
| Political Science | Right-Wing Grifter |
| Art | Starving Artist |
| Teaching Degree | Supply Teacher |
| Nursing Degree | Doctor (career path) |

**Rules:** Maximum 1 degree per player, ever. Completing University exits you to Tile 11.

### Prison (Tile 10)
See [Prison](#prison) section below.

### Finance Bro Path (Tile 12)
Entry: Economics/Business degree OR pay $10,000 OR Nepotism referral.

### Art Gallery / NFT (Tile 14)
Buy NFTs for $20,000 each. Each purchase: roll 1 die → gain Fame equal to the result. Payment goes to the Artist (if one exists) or the Banker.

### Supply Teacher Path (Tile 15)
Entry: Teaching Degree OR pay $10,000 OR Nepotism.

### Gym Membership (Tile 17)
- **First visit:** Sign up for $10,000.
- **Subsequent passes (if a member):** Pay $5,000 → gain +1 HP and +1 Happiness.

### Cop Path (Tile 18)
Entry: Wait 1 extra turn + pay $15,000 OR Nepotism referral.

### Lottery (Tile 19)
A shared global pool starts at $50,000.
- Roll 2 dice up to 3 times. Each roll costs $10,000 (added to the pool).
- **Roll a pair (any matching dice)?** Win the entire pool. Pool resets to $50,000.
- **No pair?** Your money goes into the pool. Better luck next time.

### Japan Trip (Tile 20)
See [Japan Trip](#japan-trip) section below.

### DEI Officer Path (Tile 22)
Entry: Gender Studies degree OR lose 20 Fame OR Nepotism.

### Revolution (Tile 23)
Everyone's cash on hand is totalled and split equally among all players. Leftover cents go to the Banker.

### House (Tile 25)
- **First player who can afford it:** Buy for $100,000.
- **Visitors:** Pay rent = 50% of your Salary to the owner.
- **Can't pay rent?** Hand over all your cash → go to Prison.

### Nepotism (Tile 26)
Choose another player and a career path *you've personally completed*. That player teleports to the start of that path with all entry fees waived. You collect the associated career money.

### COVID Stimulus (Tile 27)
Trade your HP for cash: $10,000 per HP spent.
Example: spend 5 HP → gain $50,000. Your call.

### Tech Bro Path (Tile 28)
Entry: Computer Science degree OR pay $20,000 OR Nepotism.

### Hospital (Tile 30)
See [Hospital](#hospital) section below.

### Right-Wing Grifter Path (Tile 31)
Entry: Political Science degree OR lose 25 Happiness OR Nepotism.

### Ozempic Session (Tile 33)
Buy up to 3 treatments. Each treatment: pay $10,000, gain +2 HP.

### Starving Artist Path (Tile 34)
Entry: Art degree OR pay $25,000 OR Nepotism.

### Yacht Harbor (Tile 35)
Tiered Happiness purchases:
- $20,000 → +4 Happiness
- $80,000 → +8 Happiness
- $160,000 → +12 Happiness

### Buy Instagram Followers (Tile 37)
Tiered Fame purchases:
- $20,000 → +4 Fame
- $80,000 → +10 Fame
- $160,000 → +16 Fame

### Streamer Path (Tile 38)
Entry: Roll a 1 (each attempt costs $10,000, max 3 tries per visit) OR Nepotism. Hardest entry in the game — but worth it.

---

## Special Locations

### Hospital

HP ≤ 0? You're hospitalized immediately. Turn pauses.

**While hospitalized:**
- Cannot use Opportunity or Experience cards.
- Cannot move.

**To escape (choose one):**
- Roll 1 die on your turn. Roll ≤ 5 → you're out. Roll 6 → stuck another turn.
- Pay ½ Salary → immediately released.

**On release:** Gain +5 HP. Payment goes to the Doctor (if one exists) or the Banker.

---

### Prison

Sent to Prison by landing on Tile 10, stomped by a Cop, or defaulting on rent.

**While imprisoned:**
- Cannot move or collect Salary.
- Drains still apply.
- Can still play Opportunity/Experience cards.

**To escape (choose one):**
- Roll 2 dice on your turn. Roll 9, 11, or 12 → you're free.
- Pay $5,000 bail → immediately released (payment goes to Banker).

**Cops are immune.** If a Cop would be sent to Prison, they take a fine/HP loss instead.

---

### Japan Trip

Land on Tile 20: gain +1 Happiness. You're now on vacation.

**Each turn you stay:**
- +2 Happiness
- Pay Salary ÷ 5

**Rolling to leave:**
- Roll ≤ 8: your choice — stay or leave
- Roll > 8: you must leave (move to Tile 21)

**While in Japan:** Cannot use Opportunity or Experience cards.

---

## Goomba Stomp

Land on a tile already occupied by another player? You may **stomp** them.

- **Standard stomp** → target sent to Japan Trip (Tile 20)
- **Cop stomp** → target sent to Prison (Tile 10)

The stomper stays. The stomped player resumes play from their new location.

---

## Career Paths

Career paths branch off the main board. Inside a career path, you roll **1 die** per space (not 2). Each path has event tiles with unique effects.

**Completing any career path grants +1 Experience card.**

| Career | Tile | Entry | Theme |
|--------|------|-------|-------|
| McDonald's | 4 | Free | Low money, flavor events, Manager promotion |
| Finance Bro | 12 | Economics/Business degree or $10k or Nepotism | High money, one Prison tile (tax evasion), no Fame |
| Supply Teacher | 15 | Teaching degree or $10k or Nepotism | Big Happiness, low money |
| Cop | 18 | Wait 1 turn + $15k or Nepotism | +HP, –Fame, –Happiness; special powers on completion |
| DEI Officer | 22 | Gender Studies or –20 Fame or Nepotism | PvP: reduce other players' stats |
| Tech Bro | 28 | Computer Science or $20k or Nepotism | High money, Salary boosts, Fame, HP drain, potential layoff |
| Right-Wing Grifter | 31 | Political Science or –25 Happiness or Nepotism | Max Fame |
| Starving Artist | 34 | Art degree or $25k or Nepotism | Happiness, Fame, painful money drain, one big auction tile |
| Streamer | 38 | Roll a 1 ($10k/attempt, max 3) or Nepotism | High Fame and money, volatile |

---

## Special Roles

### Doctor
**How to become one:** Complete the Nursing Degree path.
- On graduation: immediately sent to Hospital.
- **Passive income:** Whenever any player pays to leave Hospital, you receive ½ of their Salary.

### Cop
**How to become one:** Complete the Cop career path.
- **Prison immunity:** If you'd go to Prison, you take a fine or HP/Happiness penalty instead.
- **Enhanced Goomba Stomp:** Your stomps send targets to Prison instead of Japan Trip.

### Artist (Starving Artist)
**How to become one:** Complete the Starving Artist path.
- **Art Gallery passive:** When anyone buys NFTs at Tile 14, payment comes to you instead of the Banker.

---

## Opportunity Cards

Drawn from a shared shuffled deck whenever you land on an Opportunity Knocks tile. 15+ unique cards — some give you money, some steal from others, some move you around the board. Deck reshuffles when empty.

**You cannot draw or play cards while in Hospital, Prison, or Japan Trip.**

---

## The Win Condition

**Life Total** = Fame + Happiness + MoneyPoints (where MoneyPoints = floor(Cash ÷ 10,000))

**You win when:**
1. Your Life Total reaches **60**, AND
2. Your current stats satisfy your **secret formula**

The moment this happens, **FINAL ROUND** is declared on all screens. Every other player gets exactly one more turn.

After the Final Round:
- Players who also reached their formula during that round join you at the **Retirement Home**.
- **2+ retirees?** Sudden-death Reaction Speed mini game — first to tap wins.
- **Only one retiree?** You win outright.

The game-over screen reveals everyone's secret formulas and final stats.

---

## Quick Reference

| Situation | What Happens |
|-----------|-------------|
| HP drops to 0 | Immediately sent to Hospital |
| Land on Prison tile | Imprisoned (can't move, no Salary) |
| Land on occupied tile | Can Goomba stomp the occupants |
| Pass Payday | Collect Salary |
| Land exactly on Payday | Collect 2× Salary |
| Can't pay rent | Give all cash to landlord → Prison |
| Career path complete | +1 Experience card |
| Life Total ≥ 60 + formula met | FINAL ROUND triggered |

---

*Modern Careers — v1.0*

# Modern Careers — Game Design Reference

*Authoritative design doc. Last updated: 2026-04-02*

---

## Core Stats

| Stat | Starting Value | Notes |
|------|---------------|-------|
| HP | 10 | ≤0 sends player to Hospital immediately |
| Salary | 10,000 | Gained on passing Payday |
| Cash | 10,000 | |
| Fame | 0 | |
| Happiness | 0 | |
| Degrees | 0 | Max 1 per player for entire game |
| Experience cards | 0 | Gained on career path completion |

---

## Win Condition

**Life Total** = Fame + Happiness + MoneyPoints  
where **MoneyPoints** = floor(Cash / 10,000)

A player wins on their turn if:
- Life Total ≥ 60, AND
- Their current stats satisfy their secret formula

**Secret formula** — written before game starts. References Fame, Happiness, and/or MoneyPoints.  
Examples:
- Fame ≥ 25 AND Happiness ≥ 15
- MoneyPoints ≥ 30 AND Happiness ≥ 10

---

## Goomba Stomp

If you end movement on a tile already occupied by another player:
- You may Goomba stomp them → sends target to **Japan Trip (Tile 20)**
- **Cops** (completed Cop path) may instead send target to **Prison (Tile 10)**
- Does not inherently change stats

---

## Degrees & Careers

**Hard rule:** Each player can hold at most one degree for the entire game. Going through University again does not grant a second degree.

**University (Tile 9) entry:**
- Pay 10,000 flat fee
- Declare degree before entering

**Degree options:**
- Economics
- Computer Science
- Gender Studies
- Political Science
- Art
- Teaching Degree
- Nursing Degree

**University path tiles:**
- Negative Happiness (breakup events)
- Positive Happiness + negative HP (parties, weed)
- Positive HP (sports/track)
- Skip-turn tile ("skip class")

**Completion:** 1 degree (if no prior degree) + exits to Opportunity Knocks (Tile 11)

**Career path completion always grants:** +1 Experience card

---

## HP & Hospital

- HP ≤ 0 at any time → immediately sent to Hospital (Tile 30)
- Cannot use Experience/Opportunity cards while in Hospital
- To leave Hospital: roll ≤ 5 on your turn, OR pay ½ Salary
- On leaving: +5 HP
- If Doctor exists, payment goes to Doctor; otherwise to Banker

---

## Prison (Tile 10)

- Cannot use Experience/Opportunity cards
- Cannot move or collect Salary while imprisoned
- To escape: roll 9, 11, or 12 OR pay bail (amount TBD, goes to Banker)
- **Cops are immune** to Prison (take fine/HP loss instead)

---

## Special Roles

### Doctor
- Path: Nursing Degree → complete relevant career path
- On graduation: immediately sent to Hospital
- Passive: whenever any player pays to leave Hospital, ½ Salary goes to Doctor (if present), else Banker

### Cop (Tile 18 path)
- Entry: wait 1 extra turn + pay 15,000, OR Nepotism referral
- Path: +HP tiles, –Fame, –Happiness, neutral Money
- Contains 2 tiles that send you to Hospital AND cancel Cop completion (must restart)
- Completion powers:
  - Immune to Prison (fine or HP/Happiness loss instead)
  - Enhanced Goomba stomp: send target to Prison instead of Japan Trip

### Artist (Starving Artist Tile 34 path completion)
- Art Gallery/NFT tile (Tile 14): buyer pays Artist instead of Banker

---

## Board Tiles (0–39)

### 0 — Payday
- Pass: +Salary
- Land exactly: +2 × Salary

### 1 — Opportunity Knocks
- Draw an Opportunity card

### 2 — Pay Taxes
- Salary ≤ 30,000 → pay 0
- 30,001–69,999 → pay 50% of 1 year's salary
- ≥ 70,000 → pay 90% of 1 year's salary

### 3 — Student Loan Payment
- Instant move to University (Tile 9) — entry fee waived
- Lose 15,000 cash immediately

### 4 — McDonald's Employee (Career Path Entry)
- Entry: no degree, no fee; anyone can enter
- Path: low Money, flavor tiles, Manager promotion (+10,000 Salary), 1 big tile
- Completion: exit to Opportunity Knocks (Tile 6), +1 Experience card

### 5 — Opportunity Knocks

### 6 — Apartment (Housing)
- Buy for 50,000 if unowned
- Rent: visitor pays 25% of their Salary to owner
- If visitor can't pay: give all cash to owner → sent to Prison

### 7 — Sports Betting
- May buy parlay for 10,000
- Roll 1d6: 1 → gain 60,000; any other → lose 10,000 stake

### 8 — Cigarette Break
- Roll 1d6 = X
- Gain X Happiness, Lose X HP

### 9 — University (Career Path Entry)
- Pay 10,000 to enter (waived if from Tile 3)
- Choose degree, path events, exit to Opportunity Knocks (Tile 11)
- Max 1 degree total per player

### 10 — Prison
- Escape: roll 9, 11, or 12 OR pay bail → Banker
- No movement, no Salary, no Experience/Opportunity cards

### 11 — Opportunity Knocks

### 12 — Finance Bro (Career Path Entry)
- Entry: Economics/Business degree OR pay 10,000 OR Nepotism
- Path: lots of Money, one roll-bonus tile (die × 1,000 instant cash), no Fame, negative Happiness, one Prison tile (tax evasion)
- Completion: exit to Opportunity Knocks (Tile 13), +1 Experience card

### 13 — Opportunity Knocks

### 14 — Art Gallery / NFT
- Buy NFT(s) for 20,000 each
- Each purchase: roll 1d6, gain Fame = roll × 1
- Payment → Artist (if exists, buyer chooses which) else Banker

### 15 — Supply Teacher (Career Path Entry)
- Entry: Teaching Degree OR pay 10,000 OR Nepotism
- Path: big Happiness gains, low Money
- Completion: exit to Opportunity Knocks (Tile 16), +1 Experience card

### 16 — Opportunity Knocks

### 17 — Gym Membership
- First visit: may sign up for 10,000
- Every subsequent pass (as member): pay 5,000, gain +1 HP and +1 Happiness

### 18 — Cop (Career Path Entry)
- Entry: wait 1 extra turn + pay 15,000 OR Nepotism
- Path: +HP, –Fame, –Happiness, neutral Money; 2 tiles that send to Hospital + cancel Cop progress
- Completion: exit to Opportunity Knocks (Tile 21), +1 Experience card, gain Cop role

### 19 — Lottery
- Global pool starts at 50,000
- On land: roll 2 dice up to 3 times; each roll costs 10,000 (added to pool)
- Roll any pair → win entire pool; pool resets to 50,000
- No pair within limit → contribute to pool, gain nothing

### 20 — Japan Trip
- On land: +1 Happiness
- Start of each turn here: +2 Happiness if staying; pay Salary/5 per turn staying
- Roll ≤ 8: may choose stay or leave; roll > 8: must leave
- Cannot use Experience/Opportunity cards here

### 21 — Opportunity Knocks

### 22 — DEI Officer (Career Path Entry)
- Entry: Gender Studies degree OR lose 20 Fame OR Nepotism
- Path: negative Money, PvP tiles (reduce other players' Happiness/Fame/Money, "cancel" people)
- Completion: exit to Opportunity Knocks (Tile 24), +1 Experience card

### 23 — Revolution
- Sum all players' Cash on Hand
- Split evenly among all players (floor division; leftover → Banker)

### 24 — Opportunity Knocks

### 25 — House (Housing)
- Buy for 100,000 if unowned
- Rent: visitor pays 50% of their Salary to owner
- If visitor can't pay: give all cash to owner → sent to Prison

### 26 — Nepotism
- Choose another player + a career path you have personally completed
- That player is sent to start of that path with expenses paid (degree/entry fee waived)
- You receive the money associated with that career path

### 27 — COVID Stimulus
- Trade HP for cash at 10,000 per HP
- Example: spend 5 HP → gain 50,000

### 28 — Tech Bro (Career Path Entry)
- Entry: Computer Science degree OR pay 20,000 OR Nepotism
- Path: lots of Money, Salary increase tile (die × 1,000 added to Salary), negative Happiness, +10 Fame tile, –HP tile, "laid off due to AI" tile (go to Payday but no Salary this time)
- Completion: exit to Opportunity Knocks (Tile 29), +1 Experience card

### 29 — Opportunity Knocks

### 30 — Hospital
- Stuck until roll ≤ 5 OR pay ½ Salary
- On leaving: +5 HP
- Payment → Doctor (if exists) else Banker
- Cannot use Experience/Opportunity cards here

### 31 — Right-Wing Grifter (Career Path Entry)
- Entry: Political Science degree OR lose 25 Happiness OR Nepotism
- Path: Fame maxxing, high Fame gains
- Completion: exit to Opportunity Knocks (Tile 32), +1 Experience card

### 32 — Opportunity Knocks

### 33 — Ozempic Session
- Buy up to 3 treatments
- Each treatment: pay 10,000, gain +2 HP

### 34 — Starving Artist (Career Path Entry)
- Entry: Art degree OR pay 25,000 OR Nepotism
- Path: positive Happiness, positive Fame, lots of negative Money, one big tile (gain 2 × current Salary — auction famous painting)
- Completion: exit to Opportunity Knocks (Tile 36), +1 Experience card, gain Artist role

### 35 — Yacht Harbor
- Pay 20,000 → +4 Happiness
- Pay 80,000 → +8 Happiness
- Pay 160,000 → +12 Happiness

### 36 — Opportunity Knocks

### 37 — Buy Instagram Followers
- Pay 20,000 → +4 Fame
- Pay 80,000 → +10 Fame
- Pay 160,000 → +16 Fame

### 38 — Streamer (Career Path Entry)
- Entry: roll a 1 (each attempt costs 10,000, max 3 per visit) OR Nepotism
- Path: high Fame, high Money, negative Happiness, negative HP
- Completion: exit to Opportunity Knocks (Tile 39), +1 Experience card

### 39 — Opportunity Knocks

---

## Career Entry Requirements Summary

| Career | Tile | Degree | Alt Cash | Alt Cost | Nepotism |
|--------|------|--------|----------|----------|----------|
| McDonald's | 4 | None | None | None | Yes |
| Finance Bro | 12 | Economics or Business | 10,000 | — | Yes |
| Supply Teacher | 15 | Teaching | 10,000 | — | Yes |
| Cop | 18 | None | 15,000 + wait 1 turn | — | Yes |
| DEI Officer | 22 | Gender Studies | — | –20 Fame | Yes |
| Tech Bro | 28 | Computer Science | 20,000 | — | Yes |
| Right-Wing Grifter | 31 | Political Science | — | –25 Happiness | Yes |
| Starving Artist | 34 | Art | 25,000 | — | Yes |
| Streamer | 38 | None | 10,000/attempt (max 3, must roll 1) | — | Yes |
| University | 9 | N/A | 10,000 | — | — |

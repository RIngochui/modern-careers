# Phase 6: Hospital, Prison & Japan Trip - Research

**Researched:** 2026-04-03
**Domain:** Game mechanics — special locations with player state flags and turn-flow modifications
**Confidence:** HIGH

## Summary

Phase 6 implements three interconnected special location mechanics: Hospital (HP-triggered, roll-to-leave or pay), Prison (escape/bail, no movement), and Japan Trip (voluntary stay loop with Happiness/cost). It also adds Goomba Stomp (landing on occupied tile sends target to a special location) and introduces the Doctor role (passive income from Hospital). These are logical extensions of the existing game loop with minimal new socket events — all state changes are server-side flag updates and position moves.

**Primary recommendation:** Implement Hospital first (blocking mechanics + payment routing), then Prison (simpler escape logic), then Japan Trip (stay/leave loop with forced leave on roll), then Goomba Stomp detection (tile occupancy check at movement end), then Doctor role (passive income tracking). Start with pure state/mechanics, then add client-side UI feedback.

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HP-02 | HP ≤ 0 → immediate move to Hospital | Player.inHospital flag; immediate position redirect in HP check |
| HOSP-01 | Hospital: stuck until roll ≤ 5 or pay ½ Salary | inHospital flag blocks advanceTurn; must implement conditional turn flow |
| HOSP-02 | Leaving Hospital: +5 HP; payment → Doctor or Banker | Payment routing based on Doctor existence; Player.inDoctor flag |
| HOSP-03 | Cannot use cards in Hospital | Card play validation checks inHospital flag |
| HOSP-04 | Payment logic: only exits on roll ≤ 5 or after payment | Turn flow wrapping for Hospital-specific logic |
| DOC-01 | Doctor role: Nursing Degree completion sends to Hospital | Career path completion hook (Phase 8) |
| DOC-02 | Doctor passive: ½ Salary when any player leaves Hospital | Broadcast payment event captured by Doctor's socket |
| PRISON-01 | Prison tile (Tile 10) exists and is accessible | BOARD_TILES[10] = PRISON (already present) |
| PRISON-02 | Imprisoned: no movement/salary while imprisoned | inPrison flag blocks advanceTurn and salary collection |
| PRISON-03 | Can play cards in Prison (unlike Hospital) | Card play validation does NOT check inPrison |
| PRISON-04 | Escape: roll 9, 11, or 12 | Prison-specific roll logic: 2d6 rolls until escape |
| PRISON-05 | Escape: pay bail (→ Banker) | Bail amount TBD; payment removes inPrison flag |
| PRISON-06 | Cops immune to Prison | Cop role check in jail-landing logic; routes to fine instead |
| JAPAN-01 | Japan Trip (+1 Happiness on land) | inJapan flag; happiness +1 on position move to Tile 20 |
| JAPAN-02 | Stay mechanics: +2 Happiness, pay Salary/5 each turn | inJapan flag; turn-start drain + happiness gain |
| JAPAN-03 | Leave: roll ≤ 8 (choice), roll > 8 (forced leave) | inJapan flag; turn-start roll determines stay/leave |
| STOMP-01 | Landing on occupied tile → stomp target to Japan Trip (Tile 20) | Tile occupancy check after position update; send target to 20 |
| STOMP-02 | Cop Goomba Stomp → target to Prison (Tile 10) | Cop role routing: stomp sends to 10 instead of 20 |

---

## Current Codebase State

### Player State Model
```typescript
// Existing fields in Player interface (server.ts, line 18+)
interface Player {
  socketId: string;
  name: string;
  isHost: boolean;
  money: number;
  fame: number;
  happiness: number;
  hp: number;                    // Already present; starts at 10
  salary: number;                // Already present; starts at 10,000
  position: number;              // Current tile (0–39)
  inPrison: boolean;             // Already present; starts false
  skipNextTurn: boolean;
  retired: boolean;
  unemployed: boolean;
  isMarried: boolean;
  kids: number;
  collegeDebt: number;
  degree: string | null;
  career: string | null;
  hasStudentLoans: boolean;
  hasWeddingRing: boolean;
  hasSportsCar: boolean;
  hasLandlordHat: boolean;
  graduationCapColor: string | null;
  careerBadge: string | null;
  successFormula: SuccessFormula | null;
  hasSubmittedFormula: boolean;
  luckCards: string[];
  lastPong: number;
}
```

### Fields Needed for Phase 6
- **inHospital: boolean** — player stuck in Hospital; separate from inPrison
- **inJapan: boolean** — player voluntarily staying in Japan Trip
- **isDoctor: boolean** — player completed Nursing Degree path (set in Phase 8)
- **isCop: boolean** — player completed Cop path (set in Phase 8)
- Existing `inPrison` flag is already present — reuse it
- Existing `hp` and `salary` are already present

---

## Turn Flow Changes

### Current Flow (Phase 3–5)
```
WAITING_FOR_ROLL
→ roll-dice event
→ MID_ROLL
→ move-token broadcast
→ LANDED
→ tile-landed broadcast
→ dispatchTile() → tile handler
→ advanceTurn()
→ WAITING_FOR_ROLL (next player)
```

### Hospital Modification
```
WAITING_FOR_ROLL
→ roll-dice event
→ IF inHospital:
   • Roll 1d6
   • IF roll ≤ 5:
     – Player leaves Hospital: position = current, +5 HP, pay ½ Salary
     – Broadcast leave-hospital event
     – advanceTurn()
   • ELSE (roll > 5):
     – Player stays in Hospital
     – Broadcast hospital-stay event
     – advanceTurn() [with no position change]
→ ELSE (not in hospital):
   • [normal roll-and-move flow]
```

Key: Hospital player's roll does NOT cause movement; it's a roll-to-leave gate.

### Prison Modification
```
WAITING_FOR_ROLL
→ roll-dice event
→ IF inPrison:
   • Roll 2d6
   • IF roll ∈ {9, 11, 12}:
     – Player exits Prison: position = Prison + 1 (or Tile 11), undo inPrison
     – Broadcast escape-prison event
     – advanceTurn()
   • ELSE (escape failed):
     – Broadcast prison-stay event
     – advanceTurn() [no position change]
→ ELSE (not in prison):
   • [normal roll-and-move flow]
```

Key: Prison player also does not move on failed escape rolls.

### Japan Trip Modification (Stay Loop)
```
Turn Start (advanceTurn):
→ IF inJapan:
   • happiness += 2
   • money -= salary / 5
   • Roll 1d6
   • IF roll > 8:
     – FORCED leave: inJapan = false, position += 1 (advance to next tile)
     – Broadcast forced-leave-japan
   • ELSE (roll ≤ 8):
     – Player can choose: stay or leave
     – Emit japan-stay-choice event to player device
     – [paused turn pending response]
   • Broadcast updated state
→ ELSE:
   • [normal turn start]
```

Key: Japan Trip is a **voluntary loop** — player stays until forced out by high roll or chooses to leave.

---

## Goomba Stomp Detection

### Where to Check
In `roll-dice` event handler, **after position update, before tile dispatch**:

```typescript
const player = room.players.get(socket.id)!;
const fromPosition = player.position;
const newPos = (fromPosition + roll) % BOARD_SIZE;
player.position = newPos;

// ← GOOMBA STOMP CHECK GOES HERE
const occupants = Array.from(room.players.values())
  .filter(p => p.socketId !== socket.id && p.position === newPos);

if (occupants.length > 0) {
  // Stomp each occupant
  for (const target of occupants) {
    if (player.isCop) {
      target.inPrison = true;
      target.position = PRISON_TILE; // Tile 10
    } else {
      target.inJapan = true;
      target.position = JAPAN_TRIP_TILE; // Tile 20
    }
    // Broadcast target's position change
  }
  // Broadcast all changes, then continue
}

// ← Then emit move-token and tile-landed
```

### Collision Scenarios
- **Multiple targets on same tile:** stomp all of them
- **Stomper is Cop:** all targets → Prison
- **Stomper is not Cop:** all targets → Japan Trip
- **Career paths:** Goomba Stomp applies in career/college paths too (paths are subroutines of movement; check applies same way)

---

## Doctor Role Implementation

### Passive Income Mechanic
1. **Setup:** When player completes Nursing Degree path (Phase 8), set `isDoctor = true`
2. **Trigger:** When any player leaves Hospital, they pay ½ Salary to Doctor (if exists) or Banker (if not)
3. **Socket event:** `hospital-payment` emitted with `{ fromPlayerName, amount, recipientRole }`
4. **Doctor receives:** Listen for `hospital-payment`, add amount to money if `recipientRole === 'Doctor'`

### Payment Routing Logic
```typescript
// In Hospital leave handler:
const paymentAmount = player.salary / 2;

// Find Doctor in room
const doctorPlayer = Array.from(room.players.values())
  .find(p => p.isDoctor === true);

if (doctorPlayer) {
  doctorPlayer.money += paymentAmount;
  recipientRole = 'Doctor';
} else {
  // Add to Banker (game bank — probably just subtract from total without assigning)
  recipientRole = 'Banker';
}

io.to(roomCode).emit('hospital-payment', {
  fromPlayerName: player.name,
  amount: paymentAmount,
  recipientRole,
  newRecipientMoney: doctorPlayer?.money
});
```

---

## Architectural Decisions to Make

### 1. Bail Amount for Prison
- **GAME-DESIGN.md states:** "amount TBD"
- **Recommendation:** $5,000 (reasonable risk/reward; catching up is possible but costs a turn's salary)
- **Alternative:** Bracket it to salary ($5,000 default, or 50% salary if higher)

### 2. Hospital Payment Rounding
- ½ Salary might not divide evenly (e.g., 10,001 → 5,000.5)
- **Recommendation:** Use `Math.floor(salary / 2)` for consistency

### 3. Japan Trip Salary Drain
- Salary / 5 might not divide evenly
- **Recommendation:** `Math.ceil(salary / 5)` to avoid free stays (round up, player loses more)

### 4. Forced Leave from Japan (Roll > 8)
- Roll 1d6 produces 1–6 (never > 8)
- **Interpretation:** GAME-DESIGN.md likely means roll ≥ 9 on 2d6 (but player is rolling 1d6 for stay check)
- **Recommendation:** Use 2d6 for Japan stay check (roll once at turn start, ≥ 9 forces leave)
- **OR:** Use 1d6 with threshold of "roll ≥ 5" (simpler; 50% chance to leave)
- **Decision needed from planner:** Check with design doc intent

### 5. Goomba Stomp: Can Multiple Players Land on Same Tile?
- Current code uses modulo 40, so two players can land on same tile via different paths
- **Confirmation:** Yes, Goomba Stomp applies when ANY player ends movement on occupied tile
- **Edge case:** Stomper lands on empty tile → no one to stomp (correctly handled by filter)

### 6. Hospital vs. Prison vs. Japan: Player can have multiple flags?
- **Design intent:** Only one special location at a time
- **Recommendation:** When a player is moved to Hospital/Prison/Japan, clear the other two flags:
  ```typescript
  player.inHospital = true;
  player.inPrison = false;
  player.inJapan = false;
  ```

---

## Common Pitfalls to Avoid

### Pitfall 1: Hospital/Prison Roll Does NOT Consume Movement
**What goes wrong:** Player rolls, moves normally, then checks if in Hospital — incorrect order
**Why it happens:** Mixing up "roll to escape" with "roll and move"
**How to avoid:** In roll-dice handler, check `inHospital` or `inPrison` BEFORE calculating position change. Hospital/Prison rolls replace the normal move-roll; they don't follow it.
**Warning signs:** Hospital players moving around the board; Prison players taking turns normally

### Pitfall 2: Payment Not Subtracted When Player Can't Afford It
**What goes wrong:** Player in Hospital can't pay ½ Salary, leaves anyway (should force roll-to-leave path)
**Why it happens:** Forgetting to check `player.money >= paymentAmount` before allowing payment exit
**How to avoid:** In Hospital leave handler, check balance before offering payment option. If insufficient: "You can't afford the payment. Roll to escape instead."
**Warning signs:** Hospital payments leaving negative balances without game-rule justification

### Pitfall 3: Goomba Stomp Doesn't Check Current Occupants
**What goes wrong:** Stomp mechanic never fires; players stack on tiles
**Why it happens:** Forgetting to query occupants after position update in movement handler
**How to avoid:** Add occupancy check in roll-dice, between `player.position = newPos` and `dispatchTile()`. Reuse filter pattern from elsewhere.
**Warning signs:** Multiple players on same tile with no stomp broadcast; test asserts position mismatch

### Pitfall 4: Japan Trip Forced Leave Doesn't Advance Position
**What goes wrong:** Player forced to leave Japan but stays on Tile 20
**Why it happens:** Clearing `inJapan` flag but forgetting `position += 1`
**How to avoid:** Forced leave is a **position change event** — emit move-token broadcast and dispatch the new tile. Same as normal movement.
**Warning signs:** Player stays at Japan Trip tile after forced leave; subsequent moves skip Tile 20

### Pitfall 5: Doctor Never Receives Payments (Wrong Role Check)
**What goes wrong:** Doctor's money never increases; payments go to Banker always
**Why it happens:** `isDoctor` flag not set correctly during career completion, OR payment check uses wrong flag name
**How to avoid:** Verify Doctor flag is set in Phase 8 (career Nursing Degree completion). Use exact flag name in Hospital leave handler.
**Warning signs:** Doctor's balance unchanged after payments; test assertion fails for Doctor passive

### Pitfall 6: Cards Used While In Hospital/Prison/Japan
**What goes wrong:** Player plays card from hospital; mechanic applies, breaks game state
**Why it happens:** Card play handler doesn't check location flags
**How to avoid:** In play-luck-card and experience-card handlers, add guards: `if (player.inHospital || player.inPrison || player.inJapan) return error()`
**Warning signs:** Test shows Hospital player using cards; game state corrupted by card + location effect

---

## Code Examples

### Hospital Leave Handler
```typescript
// Source: server.ts, dispatchTile() function, Phase 6 addition
case 'HOSPITAL': {
  if (!player.inHospital) {
    // Arrived at Hospital (HP ≤ 0 move); mark as in hospital
    player.inHospital = true;
    io.to(roomCode).emit('enteredHospital', {
      playerName: player.name,
      newHp: player.hp
    });
    advanceTurn(room, roomCode, playerId, player.name, 0, fromPosition, tileIndex, 'HOSPITAL');
  } else {
    // Already in Hospital; this is a turn handler (roll-dice with inHospital flag)
    // Handled separately in roll-dice event; this case shouldn't be reached
  }
  break;
}

// In roll-dice handler (NEW):
if (player.inHospital) {
  const escapeRoll = Math.floor(Math.random() * 6) + 1;
  if (escapeRoll <= 5) {
    // ESCAPE!
    player.inHospital = false;
    player.hp += 5;
    const payment = Math.floor(player.salary / 2);
    player.money -= payment;
    
    const doctorPlayer = Array.from(room.players.values())
      .find(p => p.isDoctor === true);
    
    if (doctorPlayer) {
      doctorPlayer.money += payment;
      recipientRole = 'Doctor';
    } else {
      recipientRole = 'Banker'; // Subtract from game bank (implicit)
    }
    
    io.to(roomCode).emit('leftHospital', {
      playerName: player.name,
      escapeRoll,
      hpGained: 5,
      paymentAmount: payment,
      recipientRole,
      newHp: player.hp,
      newMoney: player.money
    });
    
    advanceTurn(room, roomCode, playerId, player.name, escapeRoll, tileIndex, tileIndex, 'HOSPITAL_ESCAPE');
  } else {
    // STAY in hospital
    io.to(roomCode).emit('hospitalRollFailed', {
      playerName: player.name,
      escapeRoll,
      daysInHospital: player.hospitalizationDays + 1
    });
    advanceTurn(room, roomCode, playerId, player.name, escapeRoll, tileIndex, tileIndex, 'HOSPITAL_STAY');
  }
  return; // Don't proceed to normal roll-and-move
}
```

### Goomba Stomp Detection
```typescript
// Source: server.ts, roll-dice handler, Phase 6 addition
const newPos = (fromPosition + roll) % BOARD_SIZE;
player.position = newPos;

// GOOMBA STOMP CHECK
const occupants = Array.from(room.players.values())
  .filter(p => p.socketId !== socket.id && p.position === newPos);

if (occupants.length > 0) {
  const stompedPlayerIds: string[] = [];
  for (const target of occupants) {
    target.inHospital = false;
    target.inPrison = false;
    target.inJapan = false;
    
    if (player.isCop) {
      target.position = 10; // PRISON
      target.inPrison = true;
    } else {
      target.position = 20; // JAPAN_TRIP
      target.inJapan = true;
    }
    stompedPlayerIds.push(target.socketId);
  }
  
  io.to(roomCode).emit('goombaStomp', {
    stomperName: player.name,
    stompedNames: occupants.map(o => o.name),
    isCopStomp: player.isCop,
    sendingTo: player.isCop ? 10 : 20
  });
}

// Continue with normal move-token / tile-landed broadcasts
```

### Japan Trip Stay/Leave Loop
```typescript
// Source: server.ts, start of advanceTurn(), Phase 6 addition
if (player.inJapan) {
  player.happiness += 2;
  const japaneseDrain = Math.ceil(player.salary / 5);
  player.money -= japaneseDrain;
  
  const stayRoll = Math.floor(Math.random() * 6) + 1;
  
  if (stayRoll > 5) { // Threshold TBD; could be > 4, >= 5, etc.
    // FORCED LEAVE
    player.inJapan = false;
    player.position = (player.position + 1) % BOARD_SIZE;
    
    io.to(roomCode).emit('japanForcedLeave', {
      playerName: player.name,
      roll: stayRoll,
      newPosition: player.position,
      newTileName: BOARD_TILES[player.position].name
    });
    
    // Dispatch the new tile player just moved to
    dispatchTile(room, roomCode, playerId, player.position, 1, 20);
    return;
  } else {
    // Player can choose to stay or leave
    room.turnPhase = TURN_PHASES.JAPAN_STAY_CHOICE;
    io.sockets.sockets.get(playerId)?.emit('japanStayChoice', {
      playerName: player.name,
      roll: stayRoll,
      happinessGained: 2,
      costPaid: japaneseDrain
    });
    // Paused; waiting for japan-stay-choice or japan-leave-choice event
    return;
  }
}
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| **Multi-step state transitions (Hospital → leave → payment)** | Custom state machine | Existing `dispatchTile()` → special case in `roll-dice` | Single switch/if handles all paths; existing patterns work |
| **Tracking multiple concurrent special locations** | Custom enum or bitfield | Boolean flags (inHospital, inPrison, inJapan) | Only one location at a time; booleans sufficient; false by default |
| **Occupancy detection** | Custom tile-to-players map | Array.from(room.players.values()).filter() | Reuses existing pattern; efficient for small player counts (2–6) |
| **Role-based routing (Cop vs. non-Cop stomp)** | Custom role system | Simple `isDoctor`, `isCop` boolean flags | Phases 6–8 only need binary flags; full role inheritance deferred |

---

## Environment Availability

Step 2.6 SKIPPED (no external dependencies identified).

Phase 6 is pure game logic — no database, no CLI tools, no external services required. All mechanics are computed server-side and broadcast via Socket.io.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7.0 |
| Config file | jest.config.js (ts-jest) |
| Quick run command | `npm test -- --testNamePattern="Hospital\|Prison\|Japan\|Stomp" --forceExit` |
| Full suite command | `npm test -- --forceExit` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HP-02 | HP ≤ 0 → move to Hospital (Tile 30) | unit | `npm test -- --testNamePattern="moves player to hospital on hp <= 0" -t "hp-check"` | ❌ Wave 0 |
| HOSP-01 | Hospital: roll ≤ 5 escapes; roll > 5 stays | unit | `npm test -- --testNamePattern="hospital escape roll" -t "hospital"` | ❌ Wave 0 |
| HOSP-02 | Leaving Hospital: +5 HP; ½ Salary payment | unit | `npm test -- --testNamePattern="hospital leave payment" -t "hospital"` | ❌ Wave 0 |
| HOSP-03 | Cards cannot be played in Hospital | unit | `npm test -- --testNamePattern="card play blocked in hospital" -t "hospital"` | ❌ Wave 0 |
| HOSP-04 | Hospital payment routes to Doctor if exists | unit | `npm test -- --testNamePattern="hospital payment to doctor" -t "hospital"` | ❌ Wave 0 |
| PRISON-02 | inPrison player: no movement, no salary | unit | `npm test -- --testNamePattern="prison blocks movement" -t "prison"` | ❌ Wave 0 |
| PRISON-04 | Escape: roll 2d6 ∈ {9,11,12} | unit | `npm test -- --testNamePattern="prison escape roll" -t "prison"` | ❌ Wave 0 |
| PRISON-05 | Bail payment exits Prison | unit | `npm test -- --testNamePattern="prison bail payment" -t "prison"` | ❌ Wave 0 |
| JAPAN-01 | Landing: +1 Happiness | unit | `npm test -- --testNamePattern="japan landing happiness" -t "japan"` | ❌ Wave 0 |
| JAPAN-02 | Stay turn: +2 Happiness, Salary/5 drain | unit | `npm test -- --testNamePattern="japan stay drain" -t "japan"` | ❌ Wave 0 |
| JAPAN-03 | Roll > threshold forces leave | unit | `npm test -- --testNamePattern="japan forced leave" -t "japan"` | ❌ Wave 0 |
| STOMP-01 | Goomba Stomp: occupant → Tile 20 | unit | `npm test -- --testNamePattern="goomba stomp japan" -t "stomp"` | ❌ Wave 0 |
| STOMP-02 | Cop Stomp: occupant → Tile 10 (Prison) | unit | `npm test -- --testNamePattern="cop stomp prison" -t "stomp"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- --testNamePattern="hospital\|prison\|japan\|stomp" --forceExit`
- **Per wave merge:** `npm test -- --forceExit` (full suite must pass)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/hospital.test.ts` — covers HOSP-01..04, HP-02 (6 assertions)
  - HP ≤ 0 triggers hospital entry
  - Roll ≤ 5 escapes; roll > 5 stays
  - Escape grants +5 HP, ½ Salary payment
  - Doctor receives payment if exists, Banker otherwise
  - Card play blocked in hospital
- [ ] `tests/prison.test.ts` — covers PRISON-02, 04..06 (4 assertions)
  - inPrison blocks normal movement (player doesn't advance position)
  - inPrison blocks salary collection
  - Escape roll: must be 9, 11, or 12 (2d6)
  - Bail payment (amount TBD) exits prison
  - Cop immunity: Cop landing on Prison sends no one
- [ ] `tests/japan-trip.test.ts` — covers JAPAN-01..03 (3 assertions)
  - Landing on Tile 20: +1 Happiness
  - Each stay turn: +2 Happiness, Salary/5 drain
  - Roll > threshold: forced leave, position += 1
  - Roll ≤ threshold: player can choose stay/leave
- [ ] `tests/goomba-stomp.test.ts` — covers STOMP-01..02 (2 assertions)
  - Non-Cop stomp: target → Tile 20 (Japan Trip)
  - Cop stomp: target → Tile 10 (Prison)
  - Multiple occupants on same tile: all stomped
- [ ] `tests/doctor-role.test.ts` — covers DOC-01..02 (1 assertion)
  - Doctor receives ½ Salary on any player's hospital exit

**Nothing found in category:** All required test files are new (Wave 0 scaffolding).

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js + TypeScript | Latest LTS | Server-side type-safe game logic | Established in Phase 1 |
| Socket.io | 4.5+ | Real-time state broadcast | Established in Phase 1 |
| Jest + ts-jest | 29.7.0 | Test runner, TS compilation | Established in Phase 1 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None for Phase 6 | — | Game mechanics are pure TypeScript | No external dependencies needed |

---

## Architecture Patterns

### Recommended Project Structure
Phase 6 does not change the file structure. All mechanics are added to existing `server.ts` and test files.

```
server.ts
├── Player interface (add inHospital, inJapan, isDoctor, isCop booleans)
├── roll-dice handler (add Hospital/Prison escape logic)
├── dispatchTile() function (add Hospital case; Goomba Stomp before dispatch)
└── advanceTurn() function (add Japan Trip turn-start logic)

tests/
├── hospital.test.ts (new)
├── prison.test.ts (new)
├── japan-trip.test.ts (new)
├── goomba-stomp.test.ts (new)
└── doctor-role.test.ts (new)
```

### Pattern 1: Location-Specific Turn Flow Wrapping
**What:** Special locations (Hospital, Prison, Japan Trip) intercept the normal roll-and-move flow, replacing it with location-specific logic.

**When to use:** When a player status flag requires different turn behavior (can't move, roll has different meaning, etc.)

**Example:**
```typescript
if (player.inHospital) {
  // Hospital logic: roll 1d6 to escape, don't move
  const escapeRoll = Math.floor(Math.random() * 6) + 1;
  if (escapeRoll <= 5) { /* leave */ } else { /* stay */ }
  return; // Don't execute normal movement
}
// Normal movement continues here
```

### Pattern 2: Post-Movement Occupancy Check
**What:** After position is updated, check if other players are on the same tile. If so, apply side effects (stomp).

**When to use:** When landing triggers effects on other players (stealing, sending elsewhere, etc.)

**Example:**
```typescript
player.position = newPos;

const occupants = Array.from(room.players.values())
  .filter(p => p.socketId !== socket.id && p.position === newPos);

if (occupants.length > 0) {
  // Apply stomp to all occupants
}
```

### Pattern 3: Conditional Payment Routing
**What:** Player owes money; recipient depends on role (Doctor, Banker, property owner, etc.)

**When to use:** When multiple parties might receive payment based on game state.

**Example:**
```typescript
const doctorPlayer = Array.from(room.players.values())
  .find(p => p.isDoctor === true);

if (doctorPlayer) {
  doctorPlayer.money += amount;
} else {
  // Add to bank (subtract from total, no one gets it)
}
```

### Anti-Patterns to Avoid
- **Multi-role flags on same player:** Don't set `inHospital = true` AND `inPrison = true` simultaneously. Use guard: `if (inHospital || inPrison || inJapan) { can't enter different location }`
- **Forgetting position update after forced move:** If Japan Trip forces leave, must update position AND dispatch new tile. Don't just clear flag.
- **Payment without balance check:** Always verify `player.money >= amount` before subtracting. Negative money is allowed (debt), but don't let payment mechanics force it unintentionally.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tiles trigger on any movement | Phase 5: tiles are now dispatched after position update | Phase 5 (board reset) | Hospital/Prison can now override movement; Goomba Stomp has clear insertion point |
| All tile effects immediate | Phase 6: Hospital/Prison use turn-flow wrapping | Phase 6 | Multi-turn locations (stay loops) are now possible |
| Single-flag status tracking | Phase 6: multiple boolean flags per location | Phase 6 | Cleaner than enum; extensible for future roles |

**Deprecated/outdated:**
- Phase 4 `investmentPool`, `cryptoInvestments` (removed in Phase 5) — don't reuse those patterns

---

## Open Questions

1. **Japan Trip Forced Leave Threshold**
   - What we know: Roll > 8 is mentioned; 1d6 max is 6
   - What's unclear: Should it be 2d6 (rolls 1–12), or 1d6 with adjusted threshold?
   - Recommendation: **Clarify with planner** — likely intent is 2d6 (standard game roll) with threshold ≥ 9. If 1d6 (simpler), threshold should be ≥ 5 (50% chance).

2. **Prison Bail Amount**
   - What we know: Amount is "TBD" in GAME-DESIGN.md
   - What's unclear: Should bail be flat (e.g., $5,000) or tied to salary (e.g., 50% salary)?
   - Recommendation: **Clarify with planner** — $5,000 flat is simple and balanced; 50% salary is dynamic but might be too punishing.

3. **Occupancy Stacking Edge Case**
   - What we know: Multiple players can land on same tile
   - What's unclear: If 3 players land on same tile (e.g., via Goomba Stomp chain), does the 3rd stomp the 1st or all?
   - Recommendation: **Current assumption:** Only stompers currently landing stomp; targets that are already there when someone lands are the ones stomped (not chained). Verify with planner.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Phase 5 & 3 established patterns; no new libraries
- Architecture: HIGH — Patterns are clear extensions of existing roll-dice / advanceTurn flow
- Pitfalls: HIGH — Common mistakes identified by testing Phase 3–5 game loop; Hospital/Prison similar to skipNextTurn pattern already working
- Validation: MEDIUM — Tests are straightforward (mocking rooms + players); Jest is working; no new test patterns needed

**Research date:** 2026-04-03
**Valid until:** 2026-04-20 (Phase 6 mechanics are stable; board design locked in Phase 5)

---

## Sources

### Primary (HIGH confidence)
- `.planning/GAME-DESIGN.md` — Hospital (Tile 30), Prison (Tile 10), Japan Trip (Tile 20), Goomba Stomp, Doctor role, all mechanics and thresholds
- `.planning/ROADMAP.md` — Phase 6 success criteria and requirements
- `server.ts` (Phase 5 codebase) — Player interface, BOARD_TILES, roll-dice handler, dispatchTile pattern, advanceTurn signature

### Secondary (MEDIUM confidence)
- `tests/game-loop.test.ts` — Jest patterns used for previous phases; mocking room/player structure
- Memory.md (auto-memory) — Phase 5 architectural decisions (factory patterns, socket isolation) inform Phase 6 similar changes

### Tertiary (noted for validation)
- Open questions list above — confirm Japan roll threshold and bail amount with planner before implementation


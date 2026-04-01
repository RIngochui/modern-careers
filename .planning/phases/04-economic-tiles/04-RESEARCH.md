# Phase 4: Economic Tiles - Research

**Researched:** 2026-04-01
**Domain:** Real-time multiplayer game tile effects for money mechanics — betting, pooling, taxation, wealth redistribution, investment tracking, and fraud flagging
**Confidence:** HIGH

## Summary

Phase 4 implements 10 economic tile effects that manipulate player money through gambling, communal pools, taxes, and wealth redistribution. The architecture leverages the existing tile dispatch router scaffolded in Phase 3: each tile effect becomes a case in the `dispatchTile` switch statement, applies game logic atomically, and broadcasts results to all players.

Key patterns:
1. **Stateless tiles** — Sports Betting, Tax Audit, COVID Stimulus, Scratch Ticket apply immediately; state persists in player money only
2. **Stateful tiles** — Investment Pool and Crypto require tracking shared/per-player state across multiple landings
3. **Transactional tiles** — Ponzi Scheme and Union Strike redistribute money between players; require atomic updates to prevent race conditions
4. **Social tiles** — Nepotism and Union Strike involve choices or calculation across all players

All tiles route through `dispatchTile()` which already exists and calls `advanceTurn()` at the end. Phase 4 populates the `switch` cases before `advanceTurn()` is called.

**Primary recommendation:** Implement stateless tiles first (easier tests), then stateful tiles with shared state tracking, then social/transactional tiles. Consolidate broadcasts into a single `money-changed` event per tile landing.

## User Constraints (from CONTEXT.md)

No CONTEXT.md exists for Phase 4 yet. Constraints inherited from Phase 3:
- **Server-authoritative:** All money mutations on server only; clients broadcast-receive
- **Atomic tile effects:** No partial state updates; all side effects complete before turn advances
- **Existing dispatch router:** Phase 4 fills in switch cases in existing `dispatchTile()` function
- **Per-room isolation:** All state mutations scoped to `room.players` and `room.sharedResources`

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ECON-01 | Sports Betting — player bets (0–current money), rolls 1d6: 1=win 6×, else=lose bet | Single die roll, deduct/add based on result, broadcast outcome |
| ECON-02 | Investment Pool — roll 1d6, 1=win all (reset to $0), else=lose $500 added to pool | `room.sharedResources.investmentPool` tracking; pool visible on host |
| ECON-03 | COVID Stimulus — all players in room receive $1,400 flat, no interaction | Loop all players in room, add $1,400 to each, broadcast bulk update |
| ECON-04 | Tax Audit — roll 1d6, lose (result × 5)% of current money | Floor result at 0; percentage calculation: `Math.floor(money * (roll * 5) / 100)` |
| ECON-05 | Scratch Ticket — pay $200, roll 1d6: 1=$2,000 / 2-3=break even / 4-6=-$200 | Go negative allowed; net change = (outcome - 200); broadcast if negative |
| ECON-06 | Crypto — invest any amount, next landing: roll 1d6, 1-2=3× / 3-4=break even / 5-6=worthless | `cryptoInvestments` per-player; flag to track if invested; two-landing cycle |
| ECON-07 | Nepotism — current player gains $1,000, chooses other player who receives $500 | Client prompts selection, handler validates choice is valid other player |
| ECON-08 | Union Strike — average all players' money, redistribute equally to all | Calculation: `total / playerCount`; apply to all atomically |
| ECON-09 | Ponzi Scheme — steal $1,000 from each other player, flag player; next money tile repays 2× | New flag `hasPonziFlag`; next money tile triggers repayment logic, clears flag |
| ECON-10 | Student Loan Payment — deduct $1,000 per loan (if `hasStudentLoans`), every landing re-deducts | Leverages existing `hasStudentLoans` flag; no special tracking |

## Standard Stack

### Core (Inherited from Phases 1–3)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | 20.x+ | Runtime | Server-side game logic |
| Express | 4.18.2 | HTTP server | Static file serving |
| Socket.io | 4.7.2 | Real-time multiplayer | Room-scoped broadcasts |
| TypeScript | 5.4.3 | Type safety | Enforces Player/GameRoom shape, prevents money mutations outside handlers |
| ts-jest | 29.1.4 | Test runner | CommonJS compilation, existing test infrastructure |

### No New Packages Required
Phase 4 uses only `Math.random()` for dice rolls and standard arithmetic for money calculations. All infrastructure (room isolation, player tracking, broadcast) inherited from Phase 3.

**Version verification:** All versions current as of Feb 2025 (time of training cutoff).

## Architecture Patterns

### Recommended Project Structure (Additions to Phase 3)
```
server.ts
  - TURN_PHASES           # Existing
  - BOARD_TILES           # Existing (40 tiles defined)
  - Player interface      # ADD: hasPonziFlag (boolean, tracks fraud state)
  - SharedResources       # Existing: investmentPool, cryptoInvestments
  - dispatchTile()        # Existing router; FILL IN 10 cases for ECON tiles
    - SPORTS_BETTING case
    - INVESTMENT_POOL case
    - COVID_STIMULUS case
    - TAX_AUDIT case
    - SCRATCH_TICKET case
    - CRYPTO case (first landing)
    - CRYPTO_PAYOUT case (second landing for same player)
    - NEPOTISM case
    - UNION_STRIKE case
    - PONZI_SCHEME case
    - STUDENT_LOAN_PAYMENT case

tests/
  - [NEW] tiles-econ.test.ts  # Test each tile type independently with mock room/player
```

### Pattern 1: Stateless Tile Handler (Immediate Effect, Money-Only)
**What:** Land on tile, apply money change based on roll, broadcast result, advance turn.

**When to use:** Tiles with no persistent state (Sports Betting, Tax Audit, COVID Stimulus, Scratch Ticket).

**Example: Sports Betting**
```typescript
case 'SPORTS_BETTING':
  // Prompts player to place bet (handled by client); event: 'place-sports-bet'
  // Once bet amount received from client:
  const betAmount = 1000; // from event handler
  const roll = Math.floor(Math.random() * 6) + 1; // 1d6
  let resultMoney = player.money;
  
  if (roll === 1) {
    resultMoney = player.money + (betAmount * 6);
  } else {
    resultMoney = Math.max(0, player.money - betAmount);
  }
  
  player.money = resultMoney;
  
  io.to(roomCode).emit('sports-bet-result', {
    playerName: player.name,
    betAmount,
    roll,
    winnings: resultMoney - player.money,
    newMoney: resultMoney
  });
  
  advanceTurn(room, roomCode, playerId, player.name, roll, fromPosition, tileIndex, 'SPORTS_BETTING');
  break;
```

**Why atomic:** All side effects (money update + broadcast) complete before `advanceTurn()` runs. No race condition where player sees stale money while turn advances.

### Pattern 2: Stateful Tile Handler (Multi-Landing Tracking)
**What:** First landing stores state; subsequent landings check state and trigger different logic.

**When to use:** Tiles where behavior differs on second visit (Crypto investment rounds).

**Example: Crypto**
```typescript
case 'CRYPTO':
  // Check if player already invested
  const cryptoInvestment = room.sharedResources.cryptoInvestments.get(playerId);
  
  if (!cryptoInvestment || cryptoInvestment === 0) {
    // First landing: prompt player to invest (0 to current money)
    // Client sends: 'invest-crypto { amount }'
    const investAmount = 5000; // from event
    player.money = Math.max(0, player.money - investAmount);
    room.sharedResources.cryptoInvestments.set(playerId, investAmount);
    
    io.to(roomCode).emit('crypto-invested', {
      playerName: player.name,
      investAmount,
      newMoney: player.money
    });
  } else {
    // Second landing: payout based on roll
    const roll = Math.floor(Math.random() * 6) + 1;
    let payout = 0;
    
    if (roll === 1 || roll === 2) {
      payout = cryptoInvestment * 3; // 3× return
    } else if (roll === 3 || roll === 4) {
      payout = cryptoInvestment; // break even
    } else {
      payout = 0; // 5-6: worthless
    }
    
    player.money += payout;
    room.sharedResources.cryptoInvestments.set(playerId, 0); // reset
    
    io.to(roomCode).emit('crypto-payout', {
      playerName: player.name,
      originalInvestment: cryptoInvestment,
      roll,
      payout,
      newMoney: player.money
    });
  }
  
  advanceTurn(...);
  break;
```

**Why two landings:** Crypto requires round-trip investment → payout. First landing captures investment choice; second landing resolves it. Prevents forced payout without player consent.

### Pattern 3: Shared State Handler (Pool-Based)
**What:** Multiple players contribute to shared pool; one player may win it all.

**When to use:** Investment Pool — tracked in `room.sharedResources.investmentPool`.

**Example: Investment Pool**
```typescript
case 'INVESTMENT_POOL':
  const roll = Math.floor(Math.random() * 6) + 1;
  
  if (roll === 1) {
    // Player wins entire pool
    player.money += room.sharedResources.investmentPool;
    const winnings = room.sharedResources.investmentPool;
    room.sharedResources.investmentPool = 0;
    
    io.to(roomCode).emit('pool-won', {
      playerName: player.name,
      winnings,
      newMoney: player.money
    });
  } else {
    // Player loses $500, added to pool
    player.money = Math.max(0, player.money - 500);
    room.sharedResources.investmentPool += 500;
    
    io.to(roomCode).emit('pool-loss', {
      playerName: player.name,
      poolTotal: room.sharedResources.investmentPool,
      newMoney: player.money
    });
  }
  
  // Broadcast updated pool to host for display
  io.to(roomCode).emit('pool-update', {
    poolTotal: room.sharedResources.investmentPool
  });
  
  advanceTurn(...);
  break;
```

**Key insight:** Pool persists across landings. Every landing updates it. Host screen always displays current pool value.

### Pattern 4: All-Player Handler (Broadcast-to-All Logic)
**What:** Single player lands, but effect applies to all players in the room.

**When to use:** COVID Stimulus, Union Strike.

**Example: COVID Stimulus**
```typescript
case 'COVID_STIMULUS':
  const awardAmount = 1400;
  const awardedPlayers: string[] = [];
  
  // Award all players in room
  for (const [pid, p] of room.players) {
    p.money += awardAmount;
    awardedPlayers.push(p.name);
  }
  
  io.to(roomCode).emit('stimulus-awarded', {
    awardAmount,
    awardedPlayers,
    playerBalances: Array.from(room.players.values()).map(p => ({
      name: p.name,
      newMoney: p.money
    }))
  });
  
  advanceTurn(...);
  break;
```

**Why atomic:** All players updated before broadcast. No partial visibility.

### Pattern 5: Choice-Based Handler (Deferred Action via Client Event)
**What:** Tile effect requires player choice; emit prompt to client, wait for response event.

**When to use:** Nepotism, Therapy (optional), Ponzi repayment (choose victims).

**Example: Nepotism (two phases)**
```typescript
// Phase 1: Land on tile, current player gains $1,000, then prompt for selection
case 'NEPOTISM':
  player.money += 1000;
  
  // Get list of other players for client to choose from
  const otherPlayers = Array.from(room.players.values())
    .filter(p => p.socketId !== playerId)
    .map(p => ({ socketId: p.socketId, name: p.name }));
  
  // Emit to current player's socket only: select a beneficiary
  socket.emit('nepotism-choose-beneficiary', {
    otherPlayers,
    benefactorName: player.name
  });
  
  // CRITICAL: Don't call advanceTurn() yet. Wait for response.
  room.turnPhase = TURN_PHASES.TILE_RESOLVING; // Hold turn until client responds
  break;

// Phase 2: Client sends 'nepotism-select' { chosenPlayerId }
socket.on('nepotism-select', ({ chosenPlayerId }: { chosenPlayerId: string }) => {
  const roomCode = findRoomCodeBySocketId(socket.id);
  const room = getRoom(roomCode);
  const beneficiary = room.players.get(chosenPlayerId);
  
  if (!beneficiary) {
    socket.emit('error', { message: 'Invalid beneficiary' });
    return;
  }
  
  beneficiary.money += 500;
  
  io.to(roomCode).emit('nepotism-completed', {
    benefactorName: player.name,
    beneficiaryName: beneficiary.name,
    benefactorNewMoney: player.money,
    beneficiaryNewMoney: beneficiary.money
  });
  
  // NOW advance turn
  advanceTurn(room, roomCode, socket.id, player.name, 0, player.position, player.position, 'NEPOTISM');
});
```

**Why deferred:** Waits for player input before advancing turn. Uses `turn_phase` guard to prevent double-actions.

### Pattern 6: Multi-Transaction Handler (Ponzi Scheme)
**What:** Steal from all players, flag attacker, reset on next money tile landing.

**When to use:** Ponzi Scheme (fraud mechanic).

**Example: Ponzi Scheme**
```typescript
case 'PONZI_SCHEME':
  const stealAmount = 1000;
  const stealFrom: { playerName: string; amount: number }[] = [];
  
  // Steal from all other players
  for (const [pid, p] of room.players) {
    if (pid !== playerId) {
      const stolen = Math.min(stealAmount, p.money); // Can't steal more than they have
      p.money -= stolen;
      stealFrom.push({ playerName: p.name, amount: stolen });
      player.money += stolen;
    }
  }
  
  // Flag player as Ponzi schemer
  player.hasPonziFlag = true;
  
  io.to(roomCode).emit('ponzi-executed', {
    playerName: player.name,
    stealFrom,
    totalStolen: stealFrom.reduce((s, t) => s + t.amount, 0),
    newMoney: player.money
  });
  
  advanceTurn(...);
  break;
```

**Important:** On next money tile landing by ANY player:
```typescript
// Inside dispatchTile, before advanceTurn, check for Ponzi flag
const ponziPlayer = Array.from(room.players.values()).find(p => p.hasPonziFlag);
if (ponziPlayer) {
  const repayAmount = 2000; // 2× the original $1,000 steal
  
  // Find victims (players who were stolen from)
  // This requires tracking in the Ponzi event above — include victim IDs
  // For simplicity: repay all non-Ponzi players proportionally
  
  for (const [pid, p] of room.players) {
    if (pid !== ponziPlayer.socketId) {
      const repay = repayAmount; // Simplified: each victim gets $2k
      p.money += repay;
      ponziPlayer.money -= repay;
    }
  }
  
  ponziPlayer.hasPonziFlag = false;
  
  io.to(roomCode).emit('ponzi-repaid', {
    playerName: ponziPlayer.name,
    totalRepaid: repayAmount * (room.players.size - 1),
    newMoney: ponziPlayer.money
  });
}
```

**Critical detail:** Ponzi flag is persistent across turns. Next money tile landing (by any player) checks it and triggers repayment. **NOT triggered by non-money tiles.**

### Anti-Patterns to Avoid
- **Partial updates:** Don't update player A's money, then broadcast, then update player B. Atomicity matters for multi-player transactions.
- **Client-side choices as authoritative:** Always re-validate client input on server (e.g., chosen beneficiary is in room).
- **Forgetting to reset transient state:** Crypto investment must be reset to 0 after payout. Ponzi flag must clear after repayment.
- **Broadcasting before all mutations:** Wait for all player updates to complete, then single `io.to(roomCode).emit()`.
- **Money going negative unintentionally:** Use `Math.max(0, money - deduction)` unless requirement explicitly allows negative (Lawsuit does).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dice probability logic | Custom percentage calcs | `Math.floor(Math.random() * 6) + 1` | Single 1d6 is canonical; 6-sided die is built-in |
| Money floor logic | Manual boundary checks everywhere | `Math.max(0, money - deduction)` or allow negative per spec | Spec defines when negative is allowed (Lawsuit, Scratch); use consistent guard |
| Percentage calculation | Division/multiplication order wrong | `Math.floor(money * (roll * 5) / 100)` | Prevents rounding errors; order of operations critical for Tax Audit |
| Player selection validation | Trust client choice | Lookup in `room.players.get(chosenId)` | Client sends attacker socket ID; validate exists and is not current player |
| Pool aggregation | Manual loop with += | `room.sharedResources.investmentPool` Map | Centralized, prevents double-counts |
| Per-player investment tracking | Store in player.money as negative | `room.sharedResources.cryptoInvestments.get(playerId)` | Separates concern; crypto investment ≠ money |
| Multi-player broadcast consistency | Emit per-player | Single `io.to(roomCode).emit()` after all updates | Race condition: if emit fires per-player, other clients see intermediate state |

## Common Pitfalls

### Pitfall 1: Race Condition — Shared State Update Without Atomicity
**What goes wrong:** Investment Pool or Union Strike broadcasts old state because broadcast fires before all player updates complete.

**Why it happens:** Developer updates players one at a time, emits for each update, then other updates happen. Clients see intermediate states.

**How to avoid:** Collect all mutations in local variables, apply all at once, emit once. Example:
```typescript
const newBalances: { playerId: string; newMoney: number }[] = [];
for (const [pid, p] of room.players) {
  p.money = calculateNewMoney(p);
  newBalances.push({ playerId: pid, newMoney: p.money });
}
io.to(roomCode).emit('all-balances-updated', newBalances);
```

**Warning signs:** Multiple `io.to(roomCode).emit()` calls in same handler; or emit inside a loop.

### Pitfall 2: Ponzi Flag Persists After Game Ends
**What goes wrong:** Player played Ponzi, never landed on another money tile, game ends. Flag remains in player object; if room reused (shouldn't happen, but future-proofing), flag bleeds into next game.

**Why it happens:** Flag set in `dispatchTile()` but only cleared when next money tile lands. If game ends, no clear path runs.

**How to avoid:** Clear all flags on game-end event. Document that Ponzi flag is transient (per-game).

**Warning signs:** Testing shows stale flags in re-used rooms (shouldn't happen if rooms deleted on game-end, but verify).

### Pitfall 3: Crypto Investment Cycles Without Reset
**What goes wrong:** Player lands on Crypto twice in same game. First landing invests $5k. Second landing should show payout, but code doesn't reset the investment. Third landing tries to invest again, but old investment is still there.

**Why it happens:** Forgot to set `cryptoInvestments.set(playerId, 0)` after payout.

**How to avoid:** Add explicit reset on payout:
```typescript
room.sharedResources.cryptoInvestments.set(playerId, 0); // ALWAYS do this
```

**Warning signs:** Test: land on Crypto, invest $1k. Advance turns. Land again, should show payout. If payout logic doesn't fire, investment wasn't reset.

### Pitfall 4: Tax Audit Percentage Calculation Off By One
**What goes wrong:** Player with $10,000 lands on Tax Audit, rolls 3. Expected deduction: `(3 × 5)% = 15%` = $1,500. Code calculates wrong due to order of operations.

**Why it happens:** `(roll * 5) / 100` calculated before `* money` or vice versa.

**How to avoid:** Use parentheses explicitly: `Math.floor(player.money * (roll * 5) / 100)`. Test with known values:
```typescript
expect(Math.floor(10000 * (3 * 5) / 100)).toBe(1500);
```

**Warning signs:** Off-by-factor-of-100 errors in tests (e.g., expected $1,500 deduction but got $15).

### Pitfall 5: Scratch Ticket Negative Money Not Handled
**What goes wrong:** Player with $100 lands on Scratch Ticket, pays $200 (goes to -$100), rolls 4-6 (lose $200 more). Should end up at -$300, but code tries to floor at 0.

**Why it happens:** Requirement allows negative money on Scratch Ticket. Developer adds `Math.max(0, ...)` guard, defeating the spec.

**How to avoid:** Allow negative money ONLY where spec says. Scratch Ticket spec says "even if insufficient, go negative" — don't floor.

**Warning signs:** Test expects negative balance but code floors to 0.

### Pitfall 6: All-Player Broadcast Misses One Player
**What goes wrong:** COVID Stimulus awarded to 5/6 players. One player didn't get $1,400.

**Why it happens:** Loop uses `Array.from(room.players.values()).slice()` instead of direct map iteration, or player joined late and isn't in the map yet.

**How to avoid:** Always iterate `room.players.get(pid)` inside a for loop. Never filter the players map except for explicit exclusion (e.g., "not current player" in Ponzi).

**Warning signs:** Test: COVID Stimulus in 3-player room. Assert all 3 players gained $1,400. If assertion fails, loop didn't cover all players.

## Code Examples

### Complete: Sports Betting Tile Handler
Source: Invocation via `dispatchTile()` switch case.

```typescript
// In dispatchTile() switch:
case 'SPORTS_BETTING':
  const betAmount = player.money; // Default: bet all money (client overrides)
  const sbRoll = Math.floor(Math.random() * 6) + 1;
  
  if (sbRoll === 1) {
    player.money += betAmount * 6;
  } else {
    player.money = Math.max(0, player.money - betAmount);
  }
  
  io.to(roomCode).emit('tile-sports-betting', {
    playerName: player.name,
    betAmount,
    roll: sbRoll,
    won: sbRoll === 1,
    newMoney: player.money
  });
  
  advanceTurn(room, roomCode, playerId, player.name, sbRoll, fromPosition, tileIndex, 'SPORTS_BETTING');
  break;
```

### Complete: Union Strike (All-Player Redistribution)
Source: Invocation via `dispatchTile()` switch case.

```typescript
case 'UNION_STRIKE':
  const totalMoney = Array.from(room.players.values()).reduce((sum, p) => sum + p.money, 0);
  const playerCount = room.players.size;
  const equalShare = Math.floor(totalMoney / playerCount);
  
  const beforeBalances = new Map<string, number>();
  for (const [pid, p] of room.players) {
    beforeBalances.set(pid, p.money);
    p.money = equalShare; // All get equal share
  }
  
  const afterBalances = new Map<string, number>();
  for (const [pid, p] of room.players) {
    afterBalances.set(pid, p.money);
  }
  
  io.to(roomCode).emit('tile-union-strike', {
    playerCount,
    totalMoney,
    equalShare,
    beforeBalances: Object.fromEntries(beforeBalances),
    afterBalances: Object.fromEntries(afterBalances)
  });
  
  advanceTurn(room, roomCode, playerId, player.name, 0, fromPosition, tileIndex, 'UNION_STRIKE');
  break;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Client-side money mutations | Server-only mutations, broadcast updates | Phase 1 | Prevents cheating; source of truth is server |
| Per-tile socket events | Unified `dispatchTile()` router | Phase 3 | Single entry point; easier to test and extend |
| Manual turn advancement | Atomic state machine (`advanceTurn()` at end) | Phase 3 | Prevents race conditions; guaranteed turn advances after tile resolves |
| Floating-point money calculations | Integer arithmetic (`Math.floor()`) | v1 design | Prevents fractional cent errors |

**Deprecated/outdated:**
- Client-authoritative tile landing: Now server-authoritative; client waits for broadcast
- Ad-hoc state tracking: Now centralized in `GameRoom.sharedResources` and `Player` fields

## Open Questions

1. **Ponzi Scheme victim tracking — should it be exact or approximate?**
   - What we know: Spec says "repay stolen amount double to each victim" on next money tile
   - What's unclear: If victim lost $800 (due to insufficient funds), does attacker repay $1,600 or $2,000?
   - Recommendation: Exact repayment per victim. Store `stolenFrom: { [victimId]: amountStolen }` in Ponzi flag. Repay exactly double of what was stolen from each.

2. **Crypto investment — what if player lands on Crypto, invests, but dies before payout?**
   - What we know: Crypto requires two landings; investment must persist
   - What's unclear: If player goes bankrupt before second landing, do they lose their investment or still get payout?
   - Recommendation: Investment persists regardless of player state. Payout fires when player lands again, even if they're negative. This is a game mechanic, not a real financial rule.

3. **Investment Pool — what if player can't afford $500 loss?**
   - What we know: Spec says "lose $500 added to pool"
   - What's unclear: If player has $200, do they lose $200 or $500 (going negative)?
   - Recommendation: Allow negative. Investment Pool is a shared bet; losers go negative if necessary. This increases risk/drama. Spec says "loss" not "loss up to available", so allow negative.

4. **Tax Audit — rounding down or banker's rounding?**
   - What we know: (roll × 5)% deduction
   - What's unclear: $10,234 at 15% = $1,535.10. Should we `Math.floor()` to $1,535 or `Math.round()` to $1,535?
   - Recommendation: `Math.floor()` (always round down). Matches "Tax Audit" theme — government always rounds down in player's favor (rare positive spin on taxes). Consistent with integer-only money model.

## Environment Availability

**SKIPPED** (No external dependencies identified)

Phase 4 is purely backend logic changes to `dispatchTile()` with no external tools, CLIs, or services required.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | jest + ts-jest (existing from Phase 3) |
| Config file | `jest.config.json` (in package.json) |
| Quick run command | `npm test -- tiles-econ.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ECON-01 | Sports Betting: roll 1 = win 6×, else = lose entire bet | unit | `npm test -- tiles-econ.test.ts -t "ECON-01"` | ❌ Wave 0 |
| ECON-02 | Investment Pool: 1 = win all, else = lose $500 to pool | unit | `npm test -- tiles-econ.test.ts -t "ECON-02"` | ❌ Wave 0 |
| ECON-03 | COVID Stimulus: all players +$1,400 flat | unit | `npm test -- tiles-econ.test.ts -t "ECON-03"` | ❌ Wave 0 |
| ECON-04 | Tax Audit: deduct (roll × 5)% of money | unit | `npm test -- tiles-econ.test.ts -t "ECON-04"` | ❌ Wave 0 |
| ECON-05 | Scratch Ticket: pay $200, roll 1=$2k / 2-3=break even / 4-6=-$200 | unit | `npm test -- tiles-econ.test.ts -t "ECON-05"` | ❌ Wave 0 |
| ECON-06 | Crypto: invest on first landing, payout on second (1-2=3×, 3-4=break even, 5-6=0) | unit | `npm test -- tiles-econ.test.ts -t "ECON-06"` | ❌ Wave 0 |
| ECON-07 | Nepotism: current +$1,000, chosen other +$500 | unit | `npm test -- tiles-econ.test.ts -t "ECON-07"` | ❌ Wave 0 |
| ECON-08 | Union Strike: all players' money averaged and redistributed equally | unit | `npm test -- tiles-econ.test.ts -t "ECON-08"` | ❌ Wave 0 |
| ECON-09 | Ponzi Scheme: steal $1,000 from each, flag player, repay 2× on next money tile | unit | `npm test -- tiles-econ.test.ts -t "ECON-09"` | ❌ Wave 0 |
| ECON-10 | Student Loan Payment: deduct $1,000 per loan every landing | unit | `npm test -- tiles-econ.test.ts -t "ECON-10"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- tiles-econ.test.ts` (isolates Phase 4 tests, runs in <5 seconds)
- **Per wave merge:** `npm test` (full suite including Phases 1–4)
- **Phase gate:** All ECON-01..10 tests passing + no regressions in Phase 3 tests

### Wave 0 Gaps
- [ ] `tests/tiles-econ.test.ts` — covers ECON-01..10 with 10–15 test cases each (stateless, stateful, social, transactional patterns)
- [ ] `server.ts`: Update `Player` interface to add `hasPonziFlag: boolean` field
- [ ] `server.ts`: Update `BOARD_TILES` to include `SPORTS_BETTING`, `INVESTMENT_POOL`, `COVID_STIMULUS`, `TAX_AUDIT`, `SCRATCH_TICKET`, `CRYPTO`, `NEPOTISM`, `UNION_STRIKE`, `PONZI_SCHEME`, `STUDENT_LOAN_PAYMENT` tile types in correct positions (Phase 4 plans will decide exact board placement)

## Sources

### Primary (HIGH confidence)
- Existing codebase: `server.ts` BOARD_TILES structure, Player interface, GameRoom with sharedResources (verified 2026-04-01)
- Phase 3 RESEARCH.md: Established tile dispatch router pattern, turn state machine, server-authoritative architecture (dated 2026-03-30, still current)
- REQUIREMENTS.md: ECON-01..10 specifications copied verbatim (dated 2026-03-29)
- ROADMAP.md Phase 4 plans: Money tile descriptions, success criteria (dated 2026-03-30)

### Secondary (MEDIUM confidence)
- Phase 3 game-loop.test.ts: Test patterns for dispatchTile() mocks and turn advancement assertions (dated 2026-03-30, provides test structure reusable for Phase 4)

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — no new packages; all deps inherited from Phase 1
- Architecture: HIGH — tile dispatch pattern fully defined in Phase 3; Phase 4 fills in switch cases
- Pitfalls: HIGH — patterns well-established (all-player broadcasts, shared state, atomic transactions proven in Phase 2–3)

**Research date:** 2026-04-01
**Valid until:** 2026-04-15 (14 days; stable domain, no fast-moving dependencies)

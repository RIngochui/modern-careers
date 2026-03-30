# Architecture Patterns: Real-Time Multiplayer Browser Party Games

**Domain:** Real-time multiplayer party games (Socket.io + Node.js + vanilla JS frontend)
**Researched:** 2026-03-29
**Confidence:** HIGH (standard patterns from Socket.io design, tested by thousands of multiplayer games)

## Recommended Architecture

For a room-based multiplayer party game like Careers, the architecture separates concerns into three distinct tiers:

```
┌─────────────────────────────────────────────────────────┐
│                    Node.js Server                       │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Express HTTP + Socket.io WebSocket Layer        │  │
│  │  - Connection handling                           │  │
│  │  - Room management                               │  │
│  │  - Event routing                                 │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Game State Manager (in-memory)                  │  │
│  │  - Map<roomCode, GameRoom>                       │  │
│  │  - Per-room: players, board state, turn order    │  │
│  │  - Mutation only via validated events            │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Game Logic Engine (rules)                       │  │
│  │  - Dice rolls & movement                         │  │
│  │  - Tile effects                                  │  │
│  │  - Mini-game triggers                            │  │
│  │  - Win condition checks                          │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
         WebSocket & HTTP        WebSocket & HTTP
              ↓                          ↓
┌────────────────────────┐    ┌────────────────────────────┐
│   Browser (Host)       │    │  Browser (Player Device)   │
│  ┌──────────────────┐  │    │  ┌──────────────────────┐  │
│  │ host.html        │  │    │  │ player.html          │  │
│  │ - Board canvas   │  │    │  │ - Controls           │  │
│  │ - All tokens     │  │    │  │ - Personal stats     │  │
│  │ - Game state     │  │    │  │ - Action buttons     │  │
│  │ - Read-only view │  │    │  │ - Spectator of game  │  │
│  └──────────────────┘  │    │  └──────────────────────┘  │
│  ┌──────────────────┐  │    │  ┌──────────────────────┐  │
│  │  game.js         │  │    │  │  game.js             │  │
│  │ Shared game      │  │    │  │ Shared game          │  │
│  │ logic (same code)│  │    │  │ logic (same code)    │  │
│  └──────────────────┘  │    │  └──────────────────────┘  │
└────────────────────────┘    └────────────────────────────┘
```

## Component Boundaries

### Server-Side Components

#### 1. Socket.io Connection Handler (server.js)
**Responsibility:** Manage WebSocket connections, authenticate room joins, route events to game logic
**Inputs:**
- Socket connection events (connect, disconnect)
- Player actions (dice roll, card play, game start)
- Administrative events (room creation)

**Outputs:**
- Emit state updates to room members
- Broadcast game events to all players
- Handle disconnections and cleanup

**Does NOT:** Validate game rules, mutate game state directly

**Example responsibilities:**
```typescript
io.on('connection', (socket) => {
  socket.on('joinRoom', ({ roomCode, playerName }) => {
    // Route to game logic, don't validate here
    gameEngine.addPlayerToRoom(roomCode, playerName, socket.id);
  });

  socket.on('rollDice', ({ roomCode }) => {
    // Route to game logic
    const result = gameEngine.processTurn(roomCode, socket.id);
    // Broadcast back to room
    io.to(roomCode).emit('stateUpdate', result);
  });
});
```

#### 2. Game State Manager (server.js, separate module)
**Responsibility:** Store and access game state, provide immutable views for broadcast
**Structure:**
```typescript
Map<roomCode, GameRoom> {
  roomCode: {
    hostSocketId: string;
    createdAt: timestamp;
    gamePhase: 'lobby' | 'playing' | 'finalRound' | 'ended';
    players: Map<socketId, Player> {
      socketId: {
        id: string;
        name: string;
        position: number;
        money: number;
        fame: number;
        happiness: number;
        successFormula: { money, fame, happiness };
        character: { outfit, face, aura };
        status: { inPrison, married, children };
        hand: Card[];
        createdAt: timestamp;
      }
    };
    board: {
      tiles: Tile[];
      currentTurnPlayer: socketId;
      turnOrder: socketId[];
    };
    shared: {
      investmentPool: number;
      cryptoInvestments: Map<socketId, number>;
      diceState: { lastRoll: number; pending: boolean };
    };
  }
}
```

**Key property:** State is mutable ONLY via validated game logic; no direct mutations from event handlers

#### 3. Game Logic Engine (server.js, separate module)
**Responsibility:** Execute game rules, validate moves, mutate state atomically
**Owns:**
- Dice roll logic and movement
- Tile effect processing (draw card, pay tax, property acquisition)
- Mini-game execution
- Win condition evaluation
- Turn progression

**Pattern:** Every action is a transaction:
```typescript
function processDiceRoll(roomCode: string, socketId: string): GameStateUpdate {
  // 1. Validate game state allows this action
  if (!canRollDice(roomCode, socketId)) throw new InvalidMove();

  // 2. Execute deterministic game logic
  const roll = dice.roll();
  const newPosition = calculateNewPosition(roomCode, socketId, roll);

  // 3. Apply all side effects atomically
  updateGameState(roomCode, {
    playerPosition: newPosition,
    tileEffect: processTile(newPosition),
    nextTurn: rotateToNextPlayer(roomCode),
  });

  // 4. Return broadcast-ready update
  return {
    type: 'DICE_ROLL_RESOLVED',
    roll,
    newPosition,
    tileEffect,
    nextPlayer: getNextPlayer(roomCode),
  };
}
```

### Client-Side Components

#### 1. HTML Views (host.html, player.html)
**host.html: Read-only spectator view**
- Board visualization with all player tokens
- Live stat updates
- Character portraits
- Investment pool display
- Prison indicators
- Turn order

**player.html: Active participant view**
- Personal controls (dice roll button during turn)
- Character portrait
- Personal stats (money, fame, happiness)
- Success formula display
- Hand of cards
- Action prompts (vote, bid, react)

**Connection:** Both views connect to same room via Socket.io, receive same state updates

#### 2. Shared Game Logic (game.js)
**Responsibility:** Client-side game state representation and local computation
**Important:** This is SHARED between host and player, but used differently:

**What game.js provides:**
- Character CSS class generation (outfit, face, aura tiers)
- Board position calculation
- Card data and descriptions
- Mini-game rules and grading logic
- Character portrait rendering

**What game.js does NOT do:**
- Validate moves (server does this)
- Mutate server state
- Determine winners (server does this)
- Randomize outcomes (server does this)

**Pattern:** Utility functions, not state management:
```typescript
// game.js
export function getCharacterClasses(player) {
  return {
    outfit: player.money > 50000 ? 'rich' : 'poor',
    face: player.happiness > 30 ? 'happy' : 'sad',
    aura: player.fame > 30 ? 'famous' : 'unknown',
  };
}

export function calculateBoardPosition(boardSize, position) {
  return position % boardSize; // Handle wrapping
}

export function gradeReactionSpeed(clientLatency) {
  return clientLatency < 200 ? 'fast' : 'slow';
}
```

**Both host and player use game.js identically** — they render the same character differently (canvas vs control screen), but both use the same logic

#### 3. Socket.io Client (embedded in host.html / player.html)
**Responsibility:** Connect to room, listen for state updates, send player actions
**Event flow:**
```typescript
// Player emits action
socket.emit('rollDice', { roomCode });

// Server processes and broadcasts
io.to(roomCode).emit('stateUpdate', {...});

// Client receives and re-renders
socket.on('stateUpdate', (state) => {
  updateBoardPosition(state.player.position);
  updateStats(state.player);
  render();
});
```

## Data Flow

### State Broadcast Pattern (One-Way Push)

```
Client Action
     ↓
[socket.emit('action', payload)]
     ↓
Server Event Handler (route only)
     ↓
Game Logic Engine (validate + execute)
     ↓
Game State Manager (atomic update)
     ↓
[io.to(room).emit('stateUpdate', newState)]
     ↓
All Clients Receive (host + all players)
     ↓
Client Re-render
```

**Key principle:** Server is source of truth. Clients are read-only views. No client-side mutations are broadcast.

### Critical Events (Turn-Based Flow)

```
1. Player clicks "Roll Dice"
   socket.emit('rollDice')
   → Server validates: is this player's turn?
   → Server rolls dice
   → Server moves token
   → Server processes tile
   → Server advances turn
   → [io.to(room).emit('stateUpdate', { roll, newPosition, tileEffect, nextPlayer })]
   → All clients re-render

2. Player votes in mini-game
   socket.emit('submitVote', { targetPlayerId, voteValue })
   → Server validates: is mini-game active?
   → Server records vote
   → Server checks if all votes in
   → If complete, server calculates winner
   → [io.to(room).emit('miniGameResult', { winner, stat, amount })]
   → All clients show result

3. Investment pool accumulates
   [Every time investment tile is landed on]
   → Server adds to investmentPool
   → [io.to(room).emit('investmentPoolUpdate', { newTotal })]
   → Host screen updates pool display
```

### Disconnection Handling

```
Client Disconnects
     ↓
socket.on('disconnect')
     ↓
Remove player from game (if game in progress, may end)
     ↓
[io.to(room).emit('playerLeft', { playerName, remainingPlayers })]
     ↓
Remaining clients show notification
```

## Game State Organization

### In-Memory Structure (Server)

```javascript
// server.js initialization
const gameRooms = new Map(); // roomCode → GameRoom object

function initializeRoom(roomCode, hostSocketId) {
  gameRooms.set(roomCode, {
    // Identity
    roomCode,
    hostSocketId,
    createdAt: Date.now(),

    // Game phase
    gamePhase: 'lobby', // 'lobby' → 'playing' → 'finalRound' → 'ended'
    gameStartedAt: null,

    // Players
    players: new Map([
      [socketId, {
        id: socketId,
        name: 'Alice',
        position: 0,
        money: 50000,
        fame: 0,
        happiness: 0,
        successFormula: { money: 50, fame: 5, happiness: 5 }, // 60 total
        character: { outfit: 1, face: 1, aura: 1 }, // CSS tier levels
        status: {
          inPrison: false,
          married: false,
          children: 0,
          career: null,
          college: null,
        },
        hand: [], // Array of card objects
        createdAt: Date.now(),
      }],
      // ... more players
    ]),

    // Board state
    board: {
      tiles: getTileDefinitions(), // Immutable tile data
      currentTurnPlayer: socketId, // Who's rolling now
      turnOrder: [socketId1, socketId2, socketId3], // Order of play
      turnCount: 0,
    },

    // Shared resources
    shared: {
      investmentPool: 5000, // Accumulates from investment tile
      cryptoInvestments: new Map([ // Per-player crypto holdings
        [socketId, 1000],
      ]),
      diceState: {
        lastRoll: [3, 4], // Two dice on main board
        pending: false, // Player hasn't moved yet
      },
    },

    // Mini-game state (active during mini-game only)
    activeMinigame: null, // { type: 'trivia', startedAt, votes: Map, deadline }

    // Victory tracking
    finalRoundTriggered: false,
    finalRoundTriggeredBy: socketId,
    finalRoundDeadline: null,
  });
}
```

### Memory Growth Considerations

- **Per player:** ~500 bytes (name, stats, position, character tiers)
- **Per room:** ~2KB baseline + players
- **Max concurrent:** Assume 10-100 rooms, 4-8 players per room → ~50-100 MB total

**Cleanup strategy:** Remove room 30 minutes after all players leave (or after last player leaves + timeout)

## Suggested Build Order

This ordering captures dependencies. A feature cannot be built until its prerequisite is stable:

### Phase 1: Foundation
1. **Socket.io connection + room join**
   - Prerequisite for everything
   - Host creates room → players join via code
   - Dependency: None

2. **Game state manager structure**
   - Data representation
   - Dependency: Phase 1.1

3. **State broadcast mechanism**
   - Every change emits to room
   - Dependency: Phase 1.2

### Phase 2: Core Game Loop
4. **Dice rolling + movement**
   - Turn-based mechanic
   - Dependency: Phase 1.3

5. **Tile processing (static tiles)**
   - Basic money/stat changes
   - Dependency: Phase 2.1

6. **Turn progression**
   - Next player's turn
   - Dependency: Phase 2.1

### Phase 3: Board Complexity
7. **Career/College paths** (branching)
   - Path selection UI
   - Dependency: Phase 2.2

8. **Special tiles** (investment pool, crypto, prison)
   - State tracking
   - Dependency: Phase 2.2

9. **Character portrait system** (CSS tiers)
   - Visual feedback of stats
   - Dependency: Phase 3.2

### Phase 4: Interactions
10. **Mini-games** (voting, bidding, trivia, reaction)
    - Server-side grading
    - Dependency: Phase 2.3

11. **Card mechanics** (career events, luck/hazard)
    - Per-career decks
    - Dependency: Phase 3.2

12. **Success formula** (secret, revealed at end)
    - Tracking and validation
    - Dependency: Phase 3.2

### Phase 5: End Game
13. **Final Round trigger** (first to meet formula)
    - Win detection
    - Dependency: Phase 4.3

14. **Retirement Home showdown** (multi-player mini-game)
    - Reaction speed mini-game at end
    - Dependency: Phase 4.1

## Component Interaction Sequence

### Game Start (Lobby → Playing)

```
Host clicks "Start Game"
     ↓
socket.emit('startGame', { roomCode })
     ↓
Server:
  1. Validate all players have set success formula
  2. Set gamePhase to 'playing'
  3. Shuffle turn order
  4. Set currentTurnPlayer to first
  5. Initialize board positions
     ↓
io.to(roomCode).emit('gameStarted', {
  gamePhase: 'playing',
  turnOrder,
  currentPlayer,
  initialBoardState
})
     ↓
Host renders board, tokens at position 0
Player screens lock inputs, watch board
```

### Dice Roll to Tile Effect (Mid-Game)

```
Current Player clicks "Roll"
     ↓
socket.emit('rollDice', { roomCode, socketId })
     ↓
Server (game logic):
  1. Verify this player's turn
  2. Roll two dice
  3. Calculate new position (with wrapping)
  4. Trigger tile effect at new position
  5. Potentially trigger mini-game
  6. Set turn to next player
     ↓
io.to(roomCode).emit('diceRolled', {
  roller: socketId,
  roll: [3, 4],
  newPosition: 7,
  tileEffect: { type: 'draw_career_card', career: 'doctor' },
  nextPlayer: socketId2,
  timestamp
})
     ↓
All clients:
  - Animate token from position 0 → 7
  - Show tile effect card
  - Possibly show mini-game prompt
  - Update turn indicator
```

### Investment Pool Broadcast

```
Player lands on Investment tile
     ↓
Server:
  1. Add landing fee to investmentPool
  2. Mutate gameState[roomCode].shared.investmentPool
     ↓
io.to(roomCode).emit('investmentPoolUpdated', {
  newTotal: 45000,
  addedBy: playerName,
  addedAmount: 2000
})
     ↓
Host screen:
  - Updates pool display in corner
  - Animates +2000 label
  ↓
Player screens:
  - Receive same event
  - Update any pool indicator on their screen
```

## Server vs Client Responsibility

### Server (server.js) — Always

- Validate moves (prevent cheating)
- Generate randomness (dice, card draws)
- Mutate game state
- Determine outcomes (mini-game winners, tile effects)
- Broadcast state to all players
- Manage connections and room lifecycle
- Enforce turn order
- Calculate final winner

### Client (host.html / player.html) — Never

- Validate moves (trust server)
- Generate randomness (trust server)
- Mutate game state (receive from server)
- Determine outcomes (trust server)
- Decide who plays next (trust server)
- Calculate winner (trust server)

### Client (game.js utilities) — Helper Only

- Render character portraits (from server data)
- Format stat displays
- Calculate board position visually (server already did this)
- Provide card descriptions (data tables)
- Grade local mini-game interactions (server validates true result)

## Anti-Patterns to Avoid

### Anti-Pattern 1: Optimistic Client Updates
**What goes wrong:** Client updates board position locally, assumes server agrees
**Why bad:** Network lag causes disagreement; disconnection leaves client out of sync; cheating opportunity (client sends fake position)
**Instead:** Client receives authoritative state from server before rendering

**Bad code:**
```typescript
// WRONG
socket.emit('rollDice', { roomCode });
// Assume success
updateLocalPosition(position + roll);
render();
```

**Good code:**
```typescript
// RIGHT
socket.emit('rollDice', { roomCode });
socket.once('stateUpdate', (state) => {
  updateLocalPosition(state.player.position);
  render();
});
```

### Anti-Pattern 2: Client-Side Validation
**What goes wrong:** Client validates move is legal, sends it; server trusts client
**Why bad:** Attacker modifies client code, bypasses validation
**Instead:** Server validates every move, rejects invalid ones

**Bad code:**
```typescript
// WRONG - server trusts client validation
socket.on('rollDice', ({ roomCode }) => {
  // No validation, assumes client checked
  const newPosition = processRoll(roomCode);
  broadcast(newPosition);
});
```

**Good code:**
```typescript
// RIGHT - server validates
socket.on('rollDice', ({ roomCode, socketId }) => {
  const gameState = gameRooms.get(roomCode);
  if (gameState.board.currentTurnPlayer !== socketId) {
    socket.emit('error', 'Not your turn');
    return;
  }
  const newPosition = processRoll(roomCode);
  broadcast(newPosition);
});
```

### Anti-Pattern 3: Direct State Mutations from Event Handlers
**What goes wrong:** Event handler mutates game state directly, bypasses rule validation
**Why bad:** Rules are scattered across handlers; race conditions if two events fire together; bugs hard to track
**Instead:** Route all mutations through game logic engine

**Bad code:**
```typescript
// WRONG
socket.on('addMoney', ({ amount }) => {
  gameState.players.get(socketId).money += amount; // Direct mutation!
  broadcast(gameState);
});
```

**Good code:**
```typescript
// RIGHT
socket.on('addMoney', ({ amount }) => {
  const result = gameEngine.awardMoney(roomCode, socketId, amount);
  broadcast(result);
});
```

### Anti-Pattern 4: Broadcasting Partial State
**What goes wrong:** Server broadcasts only changed fields; clients maintain their own state merge
**Why bad:** Clients can desync if they miss updates or interpret changes differently
**Instead:** Server broadcasts full game state for all UI elements that changed

**Bad code:**
```typescript
// WRONG - partial broadcast
io.to(roomCode).emit('moneyChanged', { socketId, newAmount: 75000 });
```

**Good code:**
```typescript
// RIGHT - full state snapshot
io.to(roomCode).emit('stateUpdate', {
  players: allPlayersWithUpdatedStats,
  board: currentBoardState,
  shared: investmentPool,
  timestamp: now,
});
```

### Anti-Pattern 5: No Cleanup on Disconnect
**What goes wrong:** Player disconnects, but game room stays in memory forever
**Why bad:** Server memory grows unbounded; ghost rooms cause confusion
**Instead:** Cleanup rooms when all players leave

**Good code:**
```typescript
socket.on('disconnect', () => {
  removePlayerFromRoom(roomCode, socketId);
  const room = gameRooms.get(roomCode);

  if (room.players.size === 0) {
    // Set cleanup timer
    setTimeout(() => {
      if (gameRooms.get(roomCode)?.players.size === 0) {
        gameRooms.delete(roomCode);
      }
    }, 30 * 60 * 1000); // 30 minutes
  }
});
```

## Patterns to Follow

### Pattern 1: Event → Logic → Broadcast

Every user action follows this chain. No shortcuts.

```typescript
socket.on('userAction', (payload) => {
  // 1. Route to game logic (no mutation here)
  const gameUpdate = gameEngine.processAction(roomCode, socketId, payload);

  // 2. Broadcast complete state to room
  io.to(roomCode).emit('stateUpdate', gameUpdate);
});
```

### Pattern 2: Atomic Game State Transactions

All side effects of one action complete before broadcasting.

```typescript
function landOnTile(roomCode, socketId, tileType) {
  const transaction = {
    playerMoney: player.money + tileCost,
    playerPosition: newPosition,
    boardTileVisited: true,
    tileEffect: { type: tileType, ... },
    nextPlayer: rotatePlayer(),
  };

  // Apply all at once
  applyTransaction(roomCode, transaction);

  // Broadcast complete state
  return getGameState(roomCode);
}
```

### Pattern 3: Server as Source of Truth

Clients never have authoritative data until server confirms.

```typescript
// Client sends action
socket.emit('action');

// Client does NOT assume success

// Client waits for server confirmation
socket.on('stateUpdate', (state) => {
  // NOW render (this is the truth)
  render(state);
});
```

### Pattern 4: Per-Room Isolation

No game room data leaks to another room.

```typescript
io.on('connection', (socket) => {
  socket.on('joinRoom', ({ roomCode }) => {
    socket.join(roomCode); // Socket.io isolates to room

    // Only broadcast to this room
    io.to(roomCode).emit('playerJoined', { ... });
  });
});
```

### Pattern 5: Graceful Degradation

Game can recover from connection loss.

```typescript
// On disconnect
socket.on('disconnect', () => {
  // Pause game (don't auto-continue turn)
  gameState.gamePhase = 'paused';

  // Broadcast to remaining players
  io.to(roomCode).emit('playerLeft', { socketId, remainingCount });

  // If host disconnects, maybe transfer host role
  if (socketId === gameState.hostSocketId && gameState.players.size > 0) {
    const newHost = gameState.players.keys().next().value;
    gameState.hostSocketId = newHost;
    io.to(roomCode).emit('hostChanged', { newHostId: newHost });
  }
});
```

## Scalability Considerations

This architecture assumes local single-server deployment (no clustering).

| Concern | At 10 rooms (40 players) | At 50 rooms (200 players) | Mitigation at 1M+ scale |
|---------|-------------------------|--------------------------|------------------------|
| Memory footprint | ~20 MB | ~100 MB | Implement room persistence to database; shard by region |
| Event throughput | ~100 events/sec | ~500 events/sec | Use Redis pub/sub; scale Socket.io with multiple processes |
| CPU (state mutations) | <5% | ~15% | Batch updates; reduce broadcast frequency |
| Broadcast latency | <50ms | <200ms | Move game logic to workers; use binary protocol (not JSON) |

For this project (local party game): Single Node.js process on localhost or small VPS is sufficient.

## Sources

- Socket.io architecture patterns (Socket.io v4 documentation and ecosystem guides)
- Industry standard for browser multiplayer games (Jackbox, Playroom, Phasmophobia)
- Event-driven architecture best practices for real-time games
- Turn-based game state management patterns

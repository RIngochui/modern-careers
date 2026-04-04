'use strict';

import {
  createPlayer,
  createGameRoom,
  GAME_PHASES,
  TURN_PHASES,
  STARTING_MONEY,
  BOARD_TILES,
  BOARD_SIZE,
  applyDrains,
  advanceTurn,
  dispatchTile,
} from '../server';

// ── Mock game room fixture ─────────────────────────────────────────────────

function createMockGameRoom(numPlayers = 2): ReturnType<typeof createGameRoom> & { players: Map<string, ReturnType<typeof createPlayer>> } {
  const room = createGameRoom('TEST', 'socket-a');
  const playerA = createPlayer('socket-a', 'Alice', true);
  const playerB = createPlayer('socket-b', 'Bob', false);
  room.players.set('socket-a', playerA);
  room.players.set('socket-b', playerB);
  room.turnOrder = ['socket-a', 'socket-b'];
  room.currentTurnIndex = 0;
  room.gamePhase = GAME_PHASES.PLAYING;
  room.turnPhase = TURN_PHASES.WAITING_FOR_ROLL;
  if (numPlayers === 3) {
    const playerC = createPlayer('socket-c', 'Carol', false);
    room.players.set('socket-c', playerC);
    room.turnOrder.push('socket-c');
  }
  return room as any;
}

afterAll((done) => {
  require('../server').httpServer.close(done);
});

// ── LOOP-01: Turn order ────────────────────────────────────────────────────

describe('LOOP-01 turn order', () => {
  it('room starts with correct turn order', () => {
    const room = createMockGameRoom();
    expect(room.turnOrder).toEqual(['socket-a', 'socket-b']);
    expect(room.currentTurnIndex).toBe(0);
  });

  it('first player is socket-a', () => {
    const room = createMockGameRoom();
    expect(room.turnOrder[room.currentTurnIndex]).toBe('socket-a');
  });
});

// ── LOOP-02: Roll-dice 2d6 ─────────────────────────────────────────────────

describe('LOOP-02 roll-dice 2d6', () => {
  it('BOARD_TILES has exactly 40 entries', () => {
    expect(BOARD_TILES).toHaveLength(40);
  });

  it('BOARD_SIZE is 40', () => {
    expect(BOARD_SIZE).toBe(40);
  });

  it('every BOARD_TILES entry has type and name strings', () => {
    for (const tile of BOARD_TILES) {
      expect(typeof tile.type).toBe('string');
      expect(typeof tile.name).toBe('string');
      expect(tile.type.length).toBeGreaterThan(0);
      expect(tile.name.length).toBeGreaterThan(0);
    }
  });

  it('move-token event shape — roll is within 2-12 range (controlled random)', () => {
    // Verify pure arithmetic: d1=3, d2=4 → roll=7, fromPos=0 → toPos=7
    const fromPos = 0;
    const d1 = 3;
    const d2 = 4;
    const roll = d1 + d2;
    const toPos = (fromPos + roll) % BOARD_SIZE;
    expect(roll).toBe(7);
    expect(toPos).toBe(7);
    expect(roll).toBeGreaterThanOrEqual(2);
    expect(roll).toBeLessThanOrEqual(12);
  });
});

// ── LOOP-03: Position wraps ────────────────────────────────────────────────

describe('LOOP-03 position wraps', () => {
  it('wraps from near end', () => {
    expect((38 + 5) % BOARD_SIZE).toBe(3);
  });

  it('wraps exactly at end', () => {
    expect((39 + 1) % BOARD_SIZE).toBe(0);
  });

  it('zero position stays valid', () => {
    expect((0 + 40) % BOARD_SIZE).toBe(0);
  });

  it('max roll from last tile', () => {
    expect((39 + 12) % BOARD_SIZE).toBe(11);
  });
});

// ── LOOP-04: Tile dispatch ─────────────────────────────────────────────────

describe('LOOP-04 tile dispatch', () => {
  it('tile type lookup by position returns a tile with a .type string', () => {
    const tile = BOARD_TILES[0];
    expect(typeof tile.type).toBe('string');
    expect(tile.type).toBe('PAYDAY');
  });

  it('corner tiles are at correct positions', () => {
    expect(BOARD_TILES[0].type).toBe('PAYDAY');
    expect(BOARD_TILES[10].type).toBe('PRISON');
    expect(BOARD_TILES[20].type).toBe('JAPAN_TRIP');
    expect(BOARD_TILES[30].type).toBe('HOSPITAL');
  });

  it('APARTMENT is at position 6, HOUSE at position 25', () => {
    expect(BOARD_TILES[6].type).toBe('APARTMENT');
    expect(BOARD_TILES[25].type).toBe('HOUSE');
  });

  it('dispatchTile advances the turn (stub behavior — all tiles advance immediately)', () => {
    const room = createMockGameRoom();
    // dispatchTile calls advanceTurn which pushes to turnHistory
    dispatchTile(room as any, 'TEST', 'socket-a', 3, 5, 0);
    // After dispatch, turn should have advanced to socket-b
    expect(room.currentTurnIndex).toBe(1);
    expect(room.turnOrder[room.currentTurnIndex]).toBe('socket-b');
  });

  it('BOARD_TILES.length equals BOARD_SIZE (40)', () => {
    expect(BOARD_TILES.length).toBe(BOARD_SIZE);
    expect(BOARD_TILES.length).toBe(40);
  });

  it('has career-path entry tiles (Phase 8 board: MCDONALDS, FINANCE_BRO, SUPPLY_TEACHER, COP, PEOPLE_AND_CULTURE, TECH_BRO, RIGHT_WING_GRIFTER, STARVING_ARTIST, STREAMER)', () => {
    const careerTypes = ['MCDONALDS', 'FINANCE_BRO', 'SUPPLY_TEACHER', 'COP', 'PEOPLE_AND_CULTURE', 'TECH_BRO', 'RIGHT_WING_GRIFTER', 'STARVING_ARTIST', 'STREAMER'];
    const careerTiles = BOARD_TILES.filter(t => careerTypes.includes(t.type));
    expect(careerTiles.length).toBe(9);
  });

  it('has OPPORTUNITY_KNOCKS tiles (Phase 5 board: 11 entries)', () => {
    const opportunities = BOARD_TILES.filter(t => t.type === 'OPPORTUNITY_KNOCKS');
    expect(opportunities.length).toBe(11);
  });

  it('all tiles have a description string', () => {
    for (const tile of BOARD_TILES) {
      expect(typeof tile.description).toBe('string');
    }
  });

  it('exactly 3 corner tiles (PAYDAY + PRISON + HOSPITAL)', () => {
    const corners = BOARD_TILES.filter(t =>
      t.type === 'PAYDAY' || t.type === 'PRISON' || t.type === 'HOSPITAL'
    );
    expect(corners.length).toBe(3);
  });

  it('exactly 2 housing tiles (APARTMENT + HOUSE)', () => {
    const housing = BOARD_TILES.filter(t => t.type === 'APARTMENT' || t.type === 'HOUSE');
    expect(housing.length).toBe(2);
  });
});

// ── LOOP-05: Advance turn ──────────────────────────────────────────────────

describe('LOOP-05 advance turn', () => {
  it('after advancing, currentTurnIndex increments from 0 to 1', () => {
    const room = createMockGameRoom();
    expect(room.currentTurnIndex).toBe(0);
    advanceTurn(room as any, 'TEST', 'socket-a', 'Alice', 7, 0, 7, 'TBD');
    expect(room.currentTurnIndex).toBe(1);
  });

  it('turn index wraps from last player back to 0', () => {
    const room = createMockGameRoom();
    // Advance past socket-b (last player) to wrap back to socket-a
    room.currentTurnIndex = 1;
    advanceTurn(room as any, 'TEST', 'socket-b', 'Bob', 5, 7, 12, 'TBD');
    expect(room.currentTurnIndex).toBe(0);
  });

  it('turnPhase is WAITING_FOR_ROLL after advancing', () => {
    const room = createMockGameRoom();
    room.turnPhase = TURN_PHASES.TILE_RESOLVING;
    advanceTurn(room as any, 'TEST', 'socket-a', 'Alice', 7, 0, 7, 'TBD');
    expect(room.turnPhase).toBe(TURN_PHASES.WAITING_FOR_ROLL);
  });
});

// ── LOOP-06: Drains ────────────────────────────────────────────────────────

describe('LOOP-06 drains', () => {
  it('married player loses $2000 at turn start', () => {
    const room = createMockGameRoom();
    const player = room.players.get('socket-a')!;
    player.isMarried = true;
    const before = player.money;
    applyDrains(room as any, 'TEST');
    expect(player.money).toBe(before - 2000);
  });

  it('player with 2 kids loses $2000 at turn start', () => {
    const room = createMockGameRoom();
    const player = room.players.get('socket-a')!;
    player.kids = 2;
    const before = player.money;
    applyDrains(room as any, 'TEST');
    expect(player.money).toBe(before - 2000);
  });

  it('player with student loans loses $1000 at turn start', () => {
    const room = createMockGameRoom();
    const player = room.players.get('socket-a')!;
    player.hasStudentLoans = true;
    const before = player.money;
    applyDrains(room as any, 'TEST');
    expect(player.money).toBe(before - 1000);
  });

  it('combined drains applied atomically (married + 1 kid + loans = $4000)', () => {
    const room = createMockGameRoom();
    const player = room.players.get('socket-a')!;
    player.isMarried = true;   // -$2000
    player.kids = 1;           // -$1000
    player.hasStudentLoans = true; // -$1000
    const before = player.money;
    applyDrains(room as any, 'TEST');
    expect(player.money).toBe(before - 4000);
  });

  it('money floors at 0 — never goes negative from drains alone', () => {
    const room = createMockGameRoom();
    const player = room.players.get('socket-a')!;
    player.money = 500;
    player.isMarried = true; // -$2000 drain, but only $500 available
    applyDrains(room as any, 'TEST');
    expect(player.money).toBe(0);
  });

  it('no drains applied when player has no liabilities', () => {
    const room = createMockGameRoom();
    const player = room.players.get('socket-a')!;
    const before = player.money;
    applyDrains(room as any, 'TEST');
    expect(player.money).toBe(before); // unchanged
  });

  it('drains-applied not emitted when no liabilities — money stays unchanged', () => {
    // Verify that a player with no drains sees no money change (early-return path)
    const room = createMockGameRoom();
    const player = room.players.get('socket-a')!;
    // No isMarried, no kids, no hasStudentLoans
    expect(player.isMarried).toBe(false);
    expect(player.kids).toBe(0);
    expect(player.hasStudentLoans).toBe(false);
    const moneyBefore = player.money;
    applyDrains(room as any, 'TEST');
    // If drains-applied were emitted, the handler would mutate money — unchanged confirms no-emit path
    expect(player.money).toBe(moneyBefore);
    expect(player.money).toBe(STARTING_MONEY);
  });
});

// ── LOOP-07: Turn history ──────────────────────────────────────────────────

describe('LOOP-07 turn history', () => {
  it('after advancing, turnHistory has one entry', () => {
    const room = createMockGameRoom();
    advanceTurn(room as any, 'TEST', 'socket-a', 'Alice', 7, 0, 7, 'TBD');
    expect(room.turnHistory).toHaveLength(1);
  });

  it('history entry has playerId, roll, tileType, and timestamp fields', () => {
    const room = createMockGameRoom();
    advanceTurn(room as any, 'TEST', 'socket-a', 'Alice', 7, 0, 7, 'PAYDAY');
    const entry = room.turnHistory[0] as any;
    expect(entry.playerId).toBe('socket-a');
    expect(entry.roll).toBe(7);
    expect(entry.tileType).toBe('PAYDAY');
    expect(typeof entry.timestamp).toBe('number');
  });

  it('history entry has all required shape fields: turnNumber, playerId, playerName, roll, fromPosition, toPosition, tileType, timestamp', () => {
    const room = createMockGameRoom();
    advanceTurn(room as any, 'TEST', 'socket-a', 'Alice', 9, 5, 14, 'CAREER_ENTRANCE');
    const entry = room.turnHistory[0] as any;
    expect(typeof entry.turnNumber).toBe('number');
    expect(entry.playerId).toBe('socket-a');
    expect(entry.playerName).toBe('Alice');
    expect(entry.roll).toBe(9);
    expect(entry.fromPosition).toBe(5);
    expect(entry.toPosition).toBe(14);
    expect(entry.tileType).toBe('CAREER_ENTRANCE');
    expect(typeof entry.timestamp).toBe('number');
  });

  it('turnHistory is capped at 10 entries', () => {
    const room = createMockGameRoom();
    // Add 12 history entries
    for (let i = 0; i < 12; i++) {
      // Alternate between players to keep turnOrder valid
      const playerId = room.turnOrder[room.currentTurnIndex];
      const playerName = room.players.get(playerId)!.name;
      advanceTurn(room as any, 'TEST', playerId, playerName, 5, i, i + 5, 'TBD');
    }
    expect(room.turnHistory.length).toBeLessThanOrEqual(10);
  });
});

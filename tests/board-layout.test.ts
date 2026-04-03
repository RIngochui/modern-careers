'use strict';
import {
  createPlayer,
  createGameRoom,
  STARTING_MONEY,
  STARTING_HP,
  BOARD_TILES,
  BOARD_SIZE,
  dispatchTile,
  checkWinCondition,
} from '../server';

afterAll((done) => {
  require('../server').httpServer.close(done);
});

// ── BOARD-01: Board layout — 40 tiles ─────────────────────────────────────

describe('BOARD-01 board layout — 40 tiles', () => {
  it('has exactly 40 entries', () => {
    expect(BOARD_TILES).toHaveLength(40);
  });

  it('every tile has a type string', () => {
    BOARD_TILES.forEach((tile, i) => expect(typeof tile.type).toBe('string'));
  });

  it('every tile has a name string', () => {
    BOARD_TILES.forEach((tile, i) => expect(typeof tile.name).toBe('string'));
  });

  it('no tile has type TBD', () => {
    BOARD_TILES.forEach((tile, i) => expect(tile.type).not.toBe('TBD'));
  });

  const EXPECTED_TILES: { index: number; type: string; name: string }[] = [
    { index: 0,  type: 'PAYDAY',                name: 'Payday' },
    { index: 1,  type: 'OPPORTUNITY_KNOCKS',    name: 'Opportunity Knocks' },
    { index: 2,  type: 'PAY_TAXES',             name: 'Pay Taxes' },
    { index: 3,  type: 'STUDENT_LOAN_REDIRECT', name: 'Student Loan Payment' },
    { index: 4,  type: 'MCDONALDS',             name: "McDonald's" },
    { index: 5,  type: 'OPPORTUNITY_KNOCKS',    name: 'Opportunity Knocks' },
    { index: 6,  type: 'APARTMENT',             name: 'Apartment' },
    { index: 7,  type: 'SPORTS_BETTING',        name: 'Sports Betting' },
    { index: 8,  type: 'CIGARETTE_BREAK',       name: 'Cigarette Break' },
    { index: 9,  type: 'UNIVERSITY',            name: 'University' },
    { index: 10, type: 'PRISON',                name: 'Prison' },
    { index: 11, type: 'OPPORTUNITY_KNOCKS',    name: 'Opportunity Knocks' },
    { index: 12, type: 'FINANCE_BRO',           name: 'Finance Bro' },
    { index: 13, type: 'OPPORTUNITY_KNOCKS',    name: 'Opportunity Knocks' },
    { index: 14, type: 'ART_GALLERY',           name: 'Art Gallery' },
    { index: 15, type: 'SUPPLY_TEACHER',        name: 'Supply Teacher' },
    { index: 16, type: 'OPPORTUNITY_KNOCKS',    name: 'Opportunity Knocks' },
    { index: 17, type: 'GYM_MEMBERSHIP',        name: 'Gym Membership' },
    { index: 18, type: 'COP',                   name: 'Cop' },
    { index: 19, type: 'LOTTERY',               name: 'Lottery' },
    { index: 20, type: 'JAPAN_TRIP',            name: 'Japan Trip' },
    { index: 21, type: 'OPPORTUNITY_KNOCKS',    name: 'Opportunity Knocks' },
    { index: 22, type: 'DEI_OFFICER',           name: 'DEI Officer' },
    { index: 23, type: 'REVOLUTION',            name: 'Revolution' },
    { index: 24, type: 'OPPORTUNITY_KNOCKS',    name: 'Opportunity Knocks' },
    { index: 25, type: 'HOUSE',                 name: 'House' },
    { index: 26, type: 'NEPOTISM',              name: 'Nepotism' },
    { index: 27, type: 'COVID_STIMULUS',        name: 'COVID Stimulus' },
    { index: 28, type: 'TECH_BRO',              name: 'Tech Bro' },
    { index: 29, type: 'OPPORTUNITY_KNOCKS',    name: 'Opportunity Knocks' },
    { index: 30, type: 'HOSPITAL',              name: 'Hospital' },
    { index: 31, type: 'RIGHT_WING_GRIFTER',    name: 'Right-Wing Grifter' },
    { index: 32, type: 'OPPORTUNITY_KNOCKS',    name: 'Opportunity Knocks' },
    { index: 33, type: 'OZEMPIC',               name: 'Ozempic' },
    { index: 34, type: 'STARVING_ARTIST',       name: 'Starving Artist' },
    { index: 35, type: 'YACHT_HARBOR',          name: 'Yacht Harbor' },
    { index: 36, type: 'OPPORTUNITY_KNOCKS',    name: 'Opportunity Knocks' },
    { index: 37, type: 'INSTAGRAM_FOLLOWERS',   name: 'Instagram Followers' },
    { index: 38, type: 'STREAMER',              name: 'Streamer' },
    { index: 39, type: 'OPPORTUNITY_KNOCKS',    name: 'Opportunity Knocks' },
  ];

  it.each(EXPECTED_TILES)('tile $index has type $type', ({ index, type }) => {
    expect(BOARD_TILES[index].type).toBe(type);
  });
});

// ── HP-01: Player HP initialization ───────────────────────────────────────

describe('HP-01 player HP initialization', () => {
  it('createPlayer initializes hp to STARTING_HP', () => {
    const p = createPlayer('s1', 'Alice');
    expect(p.hp).toBe(STARTING_HP);
  });

  it('STARTING_HP is 10', () => {
    expect(STARTING_HP).toBe(10);
  });

  it('createPlayer initializes salary to 10000', () => {
    const p = createPlayer('s1', 'Alice');
    expect(p.salary).toBe(10000);
  });
});

// ── D-11: STARTING_MONEY is 10000 ─────────────────────────────────────────

describe('D-11 STARTING_MONEY is 10000', () => {
  it('STARTING_MONEY equals 10000', () => {
    expect(STARTING_MONEY).toBe(10000);
  });

  it('createPlayer money equals 10000', () => {
    const p = createPlayer('s1', 'Alice');
    expect(p.money).toBe(10000);
  });
});

// ── WIN-01: Win condition formula ──────────────────────────────────────────

describe('WIN-01 win condition formula', () => {
  function createMockRoom(overrides: Partial<{ fame: number; happiness: number; money: number }> = {}) {
    const room = createGameRoom('TEST', 's1');
    const player = createPlayer('s1', 'Alice');
    player.fame = overrides.fame ?? 0;
    player.happiness = overrides.happiness ?? 0;
    player.money = overrides.money ?? 0;
    player.successFormula = { money: 0, fame: 0, happiness: 60 };
    room.players.set('s1', player);
    room.turnOrder = ['s1'];
    return { room, player };
  }

  it('Life Total = fame + happiness + floor(money/10000)', () => {
    const { player, room } = createMockRoom({ fame: 20, happiness: 15, money: 250000 });
    player.successFormula = { money: 0, fame: 20, happiness: 15 };
    expect(checkWinCondition(player, room)).toBe(true);
  });

  it('returns false when Life Total < 60', () => {
    const { player, room } = createMockRoom({ fame: 10, happiness: 10, money: 100000 });
    player.successFormula = { money: 0, fame: 10, happiness: 10 };
    expect(checkWinCondition(player, room)).toBe(false);
  });

  it('returns false when Life Total >= 60 but formula not satisfied', () => {
    const { player, room } = createMockRoom({ fame: 20, happiness: 20, money: 200000 });
    player.successFormula = { money: 30, fame: 20, happiness: 10 };
    // money formula: need 300000, only have 200000
    expect(checkWinCondition(player, room)).toBe(false);
  });

  it('returns false when successFormula is null', () => {
    const { player, room } = createMockRoom({ fame: 30, happiness: 20, money: 100000 });
    player.successFormula = null;
    expect(checkWinCondition(player, room)).toBe(false);
  });

  it('floor(9999 / 10000) = 0 (truncates, no rounding)', () => {
    const { player, room } = createMockRoom({ fame: 30, happiness: 20, money: 9999 });
    player.successFormula = { money: 0, fame: 30, happiness: 20 };
    // 30+20+0 = 50, not 60
    expect(checkWinCondition(player, room)).toBe(false);
  });
});

// ── BOARD-01: Stub tiles reach advanceTurn without throwing ────────────────

describe('BOARD-01 stub tiles reach advanceTurn without throwing', () => {
  function createMockRoomWithPlayer(): { room: ReturnType<typeof createGameRoom>; playerId: string } {
    const room = createGameRoom('STUB', 's1');
    const player = createPlayer('s1', 'Alice');
    room.players.set('s1', player);
    room.turnOrder = ['s1'];
    room.currentTurnIndex = 0;
    return { room, playerId: 's1' };
  }

  const STUB_TILE_INDICES = [1, 2, 3, 8, 9, 14, 15, 17, 18, 19, 20, 22, 23, 33, 34, 35, 37, 38, 39];

  it.each(STUB_TILE_INDICES)('tile at index %i does not throw', (index) => {
    const { room, playerId } = createMockRoomWithPlayer();
    expect(() => dispatchTile(room, 'STUB', playerId, index, 6, 0)).not.toThrow();
  });
});

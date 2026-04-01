'use strict';

import {
  createPlayer,
  createGameRoom,
  GAME_PHASES,
  TURN_PHASES,
  STARTING_MONEY,
  BOARD_TILES,
  advanceTurn,
  dispatchTile,
} from '../server';

// ── Fixture helpers ────────────────────────────────────────────────────────

function createMockRoom() {
  const room = createGameRoom('TEST', 'socket-a');
  const alice = createPlayer('socket-a', 'Alice', true);
  const bob   = createPlayer('socket-b', 'Bob', false);
  room.players.set('socket-a', alice);
  room.players.set('socket-b', bob);
  room.turnOrder = ['socket-a', 'socket-b'];
  room.currentTurnIndex = 0;
  room.gamePhase = GAME_PHASES.PLAYING;
  room.turnPhase = TURN_PHASES.WAITING_FOR_ROLL;
  return room;
}

function createMockRoom3Players() {
  const room = createMockRoom();
  const carol = createPlayer('socket-c', 'Carol', false);
  room.players.set('socket-c', carol);
  room.turnOrder.push('socket-c');
  return room;
}

afterAll((done) => {
  require('../server').httpServer.close(done);
});

// ── ECON-01: Sports Betting ────────────────────────────────────────────────
describe('ECON-01 Sports Betting', () => {
  it('roll=1 gives player 6× their bet (starting money doubled + 5× on top)', () => {
    const room = createMockRoom();
    const alice = room.players.get('socket-a')!;
    const originalMoney = alice.money; // 50000
    // Inject controlled roll via Math.random mock
    const mockRandom = jest.spyOn(Math, 'random').mockReturnValueOnce(0); // 0 * 6 + 1 = 1
    const tileIdx = BOARD_TILES.findIndex(t => t.type === 'SPORTS_BETTING');
    alice.position = tileIdx;
    dispatchTile(room, 'TEST', 'socket-a', tileIdx, 7, 0);
    expect(alice.money).toBe(originalMoney + originalMoney * 6); // bet=50000, win=300000, total=350000
    mockRandom.mockRestore();
  });

  it('roll!=1 deducts entire bet (money floors at 0)', () => {
    const room = createMockRoom();
    const alice = room.players.get('socket-a')!;
    const mockRandom = jest.spyOn(Math, 'random').mockReturnValueOnce(1/6); // ~0.166 → floor(0.166*6)+1 = 2
    const tileIdx = BOARD_TILES.findIndex(t => t.type === 'SPORTS_BETTING');
    alice.position = tileIdx;
    dispatchTile(room, 'TEST', 'socket-a', tileIdx, 7, 0);
    expect(alice.money).toBe(0); // lost entire bet of 50000
    mockRandom.mockRestore();
  });

  it('player with $0 bet loses nothing', () => {
    const room = createMockRoom();
    const alice = room.players.get('socket-a')!;
    alice.money = 0;
    const mockRandom = jest.spyOn(Math, 'random').mockReturnValueOnce(1/6);
    const tileIdx = BOARD_TILES.findIndex(t => t.type === 'SPORTS_BETTING');
    dispatchTile(room, 'TEST', 'socket-a', tileIdx, 7, 0);
    expect(alice.money).toBe(0);
    mockRandom.mockRestore();
  });
});

// ── ECON-02: Investment Pool ───────────────────────────────────────────────
describe('ECON-02 Investment Pool', () => {
  it('roll!=1 deducts $500 from player and adds to pool', () => {
    const room = createMockRoom();
    const alice = room.players.get('socket-a')!;
    const mockRandom = jest.spyOn(Math, 'random').mockReturnValueOnce(1/6); // roll=2
    const tileIdx = BOARD_TILES.findIndex(t => t.type === 'INVESTMENT_POOL');
    dispatchTile(room, 'TEST', 'socket-a', tileIdx, 7, 0);
    expect(alice.money).toBe(STARTING_MONEY - 500);
    expect(room.sharedResources.investmentPool).toBe(500);
    mockRandom.mockRestore();
  });

  it('roll=1 wins entire pool and resets pool to 0', () => {
    const room = createMockRoom();
    const alice = room.players.get('socket-a')!;
    room.sharedResources.investmentPool = 5000; // pre-seed pool
    const mockRandom = jest.spyOn(Math, 'random').mockReturnValueOnce(0); // roll=1
    const tileIdx = BOARD_TILES.findIndex(t => t.type === 'INVESTMENT_POOL');
    dispatchTile(room, 'TEST', 'socket-a', tileIdx, 7, 0);
    expect(alice.money).toBe(STARTING_MONEY + 5000);
    expect(room.sharedResources.investmentPool).toBe(0);
    mockRandom.mockRestore();
  });

  it('pool accumulates across multiple non-winning landings', () => {
    const room = createMockRoom3Players();
    const tileIdx = BOARD_TILES.findIndex(t => t.type === 'INVESTMENT_POOL');
    // Alice rolls 2
    const mock1 = jest.spyOn(Math, 'random').mockReturnValueOnce(1/6);
    dispatchTile(room, 'TEST', 'socket-a', tileIdx, 7, 0);
    mock1.mockRestore();
    expect(room.sharedResources.investmentPool).toBe(500);

    // Bob rolls 3
    room.currentTurnIndex = 1;
    const mock2 = jest.spyOn(Math, 'random').mockReturnValueOnce(2/6);
    dispatchTile(room, 'TEST', 'socket-b', tileIdx, 7, 0);
    mock2.mockRestore();
    expect(room.sharedResources.investmentPool).toBe(1000);
  });
});

// ── ECON-03: COVID Stimulus ────────────────────────────────────────────────
describe('ECON-03 COVID Stimulus', () => {
  it('all 2 players receive $1,400 flat', () => {
    const room = createMockRoom();
    const alice = room.players.get('socket-a')!;
    const bob   = room.players.get('socket-b')!;
    const tileIdx = BOARD_TILES.findIndex(t => t.type === 'COVID_STIMULUS');
    dispatchTile(room, 'TEST', 'socket-a', tileIdx, 7, 0);
    expect(alice.money).toBe(STARTING_MONEY + 1400);
    expect(bob.money).toBe(STARTING_MONEY + 1400);
  });

  it('all 3 players receive $1,400 (including current player)', () => {
    const room = createMockRoom3Players();
    const alice = room.players.get('socket-a')!;
    const bob   = room.players.get('socket-b')!;
    const carol = room.players.get('socket-c')!;
    const tileIdx = BOARD_TILES.findIndex(t => t.type === 'COVID_STIMULUS');
    dispatchTile(room, 'TEST', 'socket-a', tileIdx, 7, 0);
    expect(alice.money).toBe(STARTING_MONEY + 1400);
    expect(bob.money).toBe(STARTING_MONEY + 1400);
    expect(carol.money).toBe(STARTING_MONEY + 1400);
  });
});

// ── ECON-04: Tax Audit ─────────────────────────────────────────────────────
describe('ECON-04 Tax Audit', () => {
  it('TODO: deduction = Math.floor(money * (roll * 5) / 100)', () => {
    expect(true).toBe(false); // STUB — implement in plan 01
  });
  it('TODO: roll=6 deducts 30% of current money', () => {
    expect(true).toBe(false); // STUB — implement in plan 01
  });
  it('TODO: result never goes below 0', () => {
    expect(true).toBe(false); // STUB — implement in plan 01
  });
});

// ── ECON-05: Scratch Ticket ────────────────────────────────────────────────
describe('ECON-05 Scratch Ticket', () => {
  it('TODO: roll=1 results in net +$1,800 (win $2,000 minus $200 cost)', () => {
    expect(true).toBe(false); // STUB — implement in plan 01
  });
  it('TODO: roll=2 or roll=3 results in net -$200 (break even after paying $200)', () => {
    expect(true).toBe(false); // STUB — implement in plan 01
  });
  it('TODO: roll=4 through roll=6 results in net -$400 (lose $200 cost + lose $200)', () => {
    expect(true).toBe(false); // STUB — implement in plan 01
  });
  it('TODO: money can go negative on scratch ticket (no floor)', () => {
    expect(true).toBe(false); // STUB — implement in plan 01
  });
});

// ── ECON-06: Crypto ────────────────────────────────────────────────────────
describe('ECON-06 Crypto', () => {
  it('first landing: deducts invest amount and stores in cryptoInvestments', () => {
    const room = createMockRoom();
    const alice = room.players.get('socket-a')!;
    alice.money = 10000;
    const tileIdx = BOARD_TILES.findIndex(t => t.type === 'CRYPTO');
    dispatchTile(room, 'TEST', 'socket-a', tileIdx, 7, 0);
    expect(alice.money).toBe(0); // invested all
    expect(room.sharedResources.cryptoInvestments.get('socket-a')).toBe(10000);
  });

  it('second landing roll=1: returns 3× investment', () => {
    const room = createMockRoom();
    const alice = room.players.get('socket-a')!;
    room.sharedResources.cryptoInvestments.set('socket-a', 10000); // pre-invest
    alice.money = 0; // already invested

    const mockRandom = jest.spyOn(Math, 'random').mockReturnValueOnce(0); // roll=1
    const tileIdx = BOARD_TILES.findIndex(t => t.type === 'CRYPTO');
    room.currentTurnIndex = 0; // Alice's turn
    dispatchTile(room, 'TEST', 'socket-a', tileIdx, 7, 0);
    expect(alice.money).toBe(30000); // 10000 * 3
    expect(room.sharedResources.cryptoInvestments.get('socket-a')).toBe(0);
    mockRandom.mockRestore();
  });

  it('second landing roll=3: returns original investment (break even)', () => {
    const room = createMockRoom();
    const alice = room.players.get('socket-a')!;
    room.sharedResources.cryptoInvestments.set('socket-a', 10000);
    alice.money = 0;

    const mockRandom = jest.spyOn(Math, 'random').mockReturnValueOnce(2/6); // floor(2/6*6)+1=3
    const tileIdx = BOARD_TILES.findIndex(t => t.type === 'CRYPTO');
    dispatchTile(room, 'TEST', 'socket-a', tileIdx, 7, 0);
    expect(alice.money).toBe(10000); // got money back
    expect(room.sharedResources.cryptoInvestments.get('socket-a')).toBe(0);
    mockRandom.mockRestore();
  });

  it('second landing roll=5: investment worthless (payout=0)', () => {
    const room = createMockRoom();
    const alice = room.players.get('socket-a')!;
    room.sharedResources.cryptoInvestments.set('socket-a', 10000);
    alice.money = 0;

    const mockRandom = jest.spyOn(Math, 'random').mockReturnValueOnce(4/6); // floor(4/6*6)+1=5
    const tileIdx = BOARD_TILES.findIndex(t => t.type === 'CRYPTO');
    dispatchTile(room, 'TEST', 'socket-a', tileIdx, 7, 0);
    expect(alice.money).toBe(0); // worthless
    expect(room.sharedResources.cryptoInvestments.get('socket-a')).toBe(0);
    mockRandom.mockRestore();
  });

  it('cryptoInvestments reset to 0 after payout (third landing is new cycle)', () => {
    const room = createMockRoom();
    const alice = room.players.get('socket-a')!;
    // First landing: invest
    alice.money = 5000;
    const tileIdx = BOARD_TILES.findIndex(t => t.type === 'CRYPTO');
    dispatchTile(room, 'TEST', 'socket-a', tileIdx, 7, 0);
    expect(room.sharedResources.cryptoInvestments.get('socket-a')).toBe(5000);

    // Second landing: payout (roll=6 = worthless)
    const mockRandom = jest.spyOn(Math, 'random').mockReturnValueOnce(5/6); // roll=6
    room.currentTurnIndex = 0;
    dispatchTile(room, 'TEST', 'socket-a', tileIdx, 7, 0);
    expect(room.sharedResources.cryptoInvestments.get('socket-a')).toBe(0);
    mockRandom.mockRestore();

    // Third landing: treated as new first landing (invest again)
    alice.money = 2000;
    dispatchTile(room, 'TEST', 'socket-a', tileIdx, 7, 0);
    expect(room.sharedResources.cryptoInvestments.get('socket-a')).toBe(2000);
  });
});

// ── ECON-07: Nepotism ─────────────────────────────────────────────────────
describe('ECON-07 Nepotism', () => {
  it('TODO: current player gains $1,000', () => {
    expect(true).toBe(false); // STUB — implement in plan 03
  });
  it('TODO: chosen beneficiary gains $500', () => {
    expect(true).toBe(false); // STUB — implement in plan 03
  });
  it('TODO: invalid beneficiary (self or nonexistent) is rejected', () => {
    expect(true).toBe(false); // STUB — implement in plan 03
  });
});

// ── ECON-08: Union Strike ─────────────────────────────────────────────────
describe('ECON-08 Union Strike', () => {
  it('TODO: total money is redistributed equally to all players', () => {
    expect(true).toBe(false); // STUB — implement in plan 03
  });
  it('TODO: each player receives Math.floor(total / playerCount)', () => {
    expect(true).toBe(false); // STUB — implement in plan 03
  });
  it('TODO: all updates are applied before broadcast (atomic)', () => {
    expect(true).toBe(false); // STUB — implement in plan 03
  });
});

// ── ECON-09: Ponzi Scheme ─────────────────────────────────────────────────
describe('ECON-09 Ponzi Scheme', () => {
  it('TODO: steals $1,000 from each other player', () => {
    expect(true).toBe(false); // STUB — implement in plan 04
  });
  it('TODO: sets hasPonziFlag to true on attacker', () => {
    expect(true).toBe(false); // STUB — implement in plan 04
  });
  it('TODO: repays exactly 2× stolen amount to each victim on next money tile landing', () => {
    expect(true).toBe(false); // STUB — implement in plan 04
  });
  it('TODO: hasPonziFlag cleared after repayment', () => {
    expect(true).toBe(false); // STUB — implement in plan 04
  });
  it('TODO: Ponzi player cannot steal more than victim has', () => {
    expect(true).toBe(false); // STUB — implement in plan 04
  });
});

// ── ECON-10: Student Loan Payment ─────────────────────────────────────────
describe('ECON-10 Student Loan Payment', () => {
  it('TODO: player with hasStudentLoans=true loses $1,000 on landing', () => {
    expect(true).toBe(false); // STUB — implement in plan 04
  });
  it('TODO: player with hasStudentLoans=false is unaffected on landing', () => {
    expect(true).toBe(false); // STUB — implement in plan 04
  });
  it('TODO: every landing re-deducts (no one-time immunity)', () => {
    expect(true).toBe(false); // STUB — implement in plan 04
  });
});

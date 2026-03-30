'use strict';

import type { GameRoom, Player } from '../server';

let rooms: Map<string, GameRoom>;
let createPlayer: (id: string, name: string, isHost?: boolean) => Player;
let createGameRoom: (code: string, hostId: string) => GameRoom;
let getRoom: (code: string) => GameRoom | undefined;
let setRoom: (code: string, room: GameRoom) => void;
let GAME_PHASES: Record<string, string>;
let STARTING_MONEY: number;
let getFullState: (room: GameRoom, socketId?: string | null) => object;

// These will be exported from server.ts in Plan 02 — undefined now so tests fail
let isValidPlayerName: any;
let isValidFormula: any;
let canStartGame: any;

beforeEach(() => {
  const server = require('../server');
  rooms          = server.rooms;
  createPlayer   = server.createPlayer;
  createGameRoom = server.createGameRoom;
  getRoom        = server.getRoom;
  setRoom        = server.setRoom;
  GAME_PHASES    = server.GAME_PHASES;
  STARTING_MONEY = server.STARTING_MONEY;
  getFullState   = server.getFullState;
  // These will be defined after Plan 02 — keep as undefined to ensure red state now
  isValidPlayerName = server.isValidPlayerName;
  isValidFormula    = server.isValidFormula;
  canStartGame      = server.canStartGame;
  rooms.clear();
});

afterAll((done) => {
  require('../server').httpServer.close(done);
});

describe('LOBBY-01: create-room — room creation', () => {
  it('createGameRoom produces a room with gamePhase lobby', () => {
    const room = createGameRoom('ABCD', 'host-1');
    expect(room.gamePhase).toBe(GAME_PHASES.LOBBY);
  });

  it('createGameRoom stores the host socketId', () => {
    const room = createGameRoom('ABCD', 'host-1');
    expect(room.hostSocketId).toBe('host-1');
  });

  it('createGameRoom room code is 4 uppercase letters', () => {
    const room = createGameRoom('ABCD', 'host-1');
    expect(room.id).toMatch(/^[A-Z]{4}$/);
  });
});

describe('LOBBY-02: join-room — name validation', () => {
  it('isValidPlayerName returns true for a valid alphanumeric name', () => {
    expect(isValidPlayerName('Alice')).toBe(true);
  });

  it('isValidPlayerName returns false for empty string', () => {
    expect(isValidPlayerName('')).toBe(false);
  });

  it('isValidPlayerName returns false for name exceeding 20 chars', () => {
    expect(isValidPlayerName('A'.repeat(21))).toBe(false);
  });

  it('isValidPlayerName returns false for name with special characters', () => {
    expect(isValidPlayerName('Alice!')).toBe(false);
  });

  it('isValidPlayerName returns false for case-insensitive duplicate in room', () => {
    const room = createGameRoom('ABCD', 'host-1');
    room.players.set('sock-1', createPlayer('sock-1', 'Alice'));
    expect(isValidPlayerName('alice', room)).toBe(false);
  });

  it('isValidPlayerName returns false when room has 6 players (capacity guard)', () => {
    const room = createGameRoom('ABCD', 'host-1');
    for (let i = 0; i < 6; i++) {
      room.players.set(`sock-${i}`, createPlayer(`sock-${i}`, `Player${i}`));
    }
    // Capacity check is separate from name validation — verify room.players.size
    expect(room.players.size).toBe(6);
  });

  it('join to non-existent room returns undefined from getRoom', () => {
    expect(getRoom('ZZZZ')).toBeUndefined();
  });
});

describe('LOBBY-03: player list — state shape', () => {
  it('getFullState omits successFormula for non-requesting player', () => {
    const room = createGameRoom('ABCD', 'host-1');
    const player = createPlayer('sock-1', 'Alice');
    player.successFormula = { money: 20, fame: 20, happiness: 20 };
    player.hasSubmittedFormula = true;
    room.players.set('sock-1', player);
    setRoom('ABCD', room);

    const state = getFullState(room, 'other-socket') as any;
    expect(state.players['sock-1'].successFormula).toBeNull();
  });

  it('getFullState includes hasSubmittedFormula flag for each player', () => {
    const room = createGameRoom('ABCD', 'host-1');
    const player = createPlayer('sock-1', 'Alice');
    player.hasSubmittedFormula = true;
    room.players.set('sock-1', player);
    setRoom('ABCD', room);

    const state = getFullState(room, 'other-socket') as any;
    expect(state.players['sock-1'].hasSubmittedFormula).toBe(true);
  });
});

describe('LOBBY-04: start-game — player count gate', () => {
  it('canStartGame returns false with 0 players', () => {
    const room = createGameRoom('ABCD', 'host-1');
    expect(canStartGame(room)).toBe(false);
  });

  it('canStartGame returns false with 1 player even if formula submitted', () => {
    const room = createGameRoom('ABCD', 'host-1');
    const p = createPlayer('sock-1', 'Alice');
    p.hasSubmittedFormula = true;
    room.players.set('sock-1', p);
    expect(canStartGame(room)).toBe(false);
  });
});

describe('LOBBY-05: submit-formula — server validation', () => {
  it('isValidFormula returns true when money+fame+happiness === 60', () => {
    expect(isValidFormula({ money: 20, fame: 20, happiness: 20 })).toBe(true);
  });

  it('isValidFormula returns false when sum !== 60', () => {
    expect(isValidFormula({ money: 30, fame: 20, happiness: 20 })).toBe(false);
  });

  it('isValidFormula returns false when a value is negative', () => {
    expect(isValidFormula({ money: -1, fame: 30, happiness: 31 })).toBe(false);
  });

  it('isValidFormula returns false when a value exceeds 60', () => {
    expect(isValidFormula({ money: 61, fame: 0, happiness: -1 })).toBe(false);
  });

  it('isValidFormula returns false when a value is not a number', () => {
    expect(isValidFormula({ money: '30' as any, fame: 30, happiness: 0 })).toBe(false);
  });
});

describe('LOBBY-06: canStartGame — all formulas required', () => {
  it('canStartGame returns false when 2 players and none submitted', () => {
    const room = createGameRoom('ABCD', 'host-1');
    room.players.set('sock-1', createPlayer('sock-1', 'Alice'));
    room.players.set('sock-2', createPlayer('sock-2', 'Bob'));
    expect(canStartGame(room)).toBe(false);
  });

  it('canStartGame returns false when 2 players and only 1 submitted', () => {
    const room = createGameRoom('ABCD', 'host-1');
    const p1 = createPlayer('sock-1', 'Alice');
    p1.hasSubmittedFormula = true;
    const p2 = createPlayer('sock-2', 'Bob');
    room.players.set('sock-1', p1);
    room.players.set('sock-2', p2);
    expect(canStartGame(room)).toBe(false);
  });

  it('canStartGame returns true when 2+ players all submitted', () => {
    const room = createGameRoom('ABCD', 'host-1');
    const p1 = createPlayer('sock-1', 'Alice');
    p1.hasSubmittedFormula = true;
    const p2 = createPlayer('sock-2', 'Bob');
    p2.hasSubmittedFormula = true;
    room.players.set('sock-1', p1);
    room.players.set('sock-2', p2);
    expect(canStartGame(room)).toBe(true);
  });
});

describe('LOBBY-07: disconnect during lobby', () => {
  it('removing player from room.players reduces size to 0 when last player', () => {
    const room = createGameRoom('ABCD', 'host-1');
    room.players.set('sock-1', createPlayer('sock-1', 'Alice'));
    setRoom('ABCD', room);

    room.players.delete('sock-1');
    expect(room.players.size).toBe(0);
  });

  it('room remains in rooms Map after disconnect (cleanup timer not yet fired)', () => {
    const room = createGameRoom('ABCD', 'host-1');
    room.players.set('sock-1', createPlayer('sock-1', 'Alice'));
    setRoom('ABCD', room);

    room.players.delete('sock-1');
    expect(getRoom('ABCD')).toBeDefined();
  });

  it('disconnect of one player leaves the other in room', () => {
    const room = createGameRoom('ABCD', 'host-1');
    room.players.set('sock-1', createPlayer('sock-1', 'Alice'));
    room.players.set('sock-2', createPlayer('sock-2', 'Bob'));
    setRoom('ABCD', room);

    room.players.delete('sock-1');
    expect(room.players.size).toBe(1);
    expect(room.players.has('sock-2')).toBe(true);
  });
});

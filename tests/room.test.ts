'use strict';

import type { GameRoom } from '../server';

let generateRoomCode: () => string;
let getRoom: (code: string) => GameRoom | undefined;
let setRoom: (code: string, room: GameRoom) => void;
let deleteRoom: (code: string) => boolean;
let findRoomCodeBySocketId: (id: string) => string | undefined;
let rooms: Map<string, GameRoom>;

beforeEach(() => {
  const server = require('../server');
  generateRoomCode = server.generateRoomCode;
  getRoom = server.getRoom;
  setRoom = server.setRoom;
  deleteRoom = server.deleteRoom;
  findRoomCodeBySocketId = server.findRoomCodeBySocketId;
  rooms = server.rooms;
  rooms.clear();
});

afterAll(() => {
  const { httpServer } = require('../server');
  httpServer.close();
});

describe('generateRoomCode', () => {
  test('returns a 4-character uppercase string', () => {
    const code = generateRoomCode();
    expect(code).toMatch(/^[A-Z]{4}$/);
  });

  test('returns unique codes across 100 calls (no immediate collision)', () => {
    const codes = new Set(Array.from({ length: 100 }, () => generateRoomCode()));
    expect(codes.size).toBe(100);
  });

  test('skips codes already in rooms Map', () => {
    setRoom('AAAA', {} as GameRoom);
    for (let i = 0; i < 50; i++) {
      const code = generateRoomCode();
      expect(code).not.toBe('AAAA');
    }
  });
});

describe('getRoom / setRoom / deleteRoom', () => {
  test('setRoom stores and getRoom retrieves', () => {
    setRoom('WXYZ', { id: 'WXYZ' } as GameRoom);
    expect(getRoom('WXYZ')).toEqual({ id: 'WXYZ' });
  });

  test('getRoom returns undefined for missing code', () => {
    expect(getRoom('ZZZZ')).toBeUndefined();
  });

  test('deleteRoom removes entry', () => {
    setRoom('WXYZ', { id: 'WXYZ' } as GameRoom);
    deleteRoom('WXYZ');
    expect(getRoom('WXYZ')).toBeUndefined();
  });
});

describe('findRoomCodeBySocketId', () => {
  test('finds socketId in room players Map', () => {
    const players = new Map();
    players.set('socket-abc', { name: 'Alice' });
    setRoom('ABCD', { players } as GameRoom);
    expect(findRoomCodeBySocketId('socket-abc')).toBe('ABCD');
  });

  test('returns undefined for unknown socketId', () => {
    expect(findRoomCodeBySocketId('socket-unknown')).toBeUndefined();
  });
});

'use strict';

// Import helpers directly without starting HTTP server
// server.js uses module.exports — safe to require in test
let generateRoomCode, getRoom, setRoom, deleteRoom, findRoomCodeBySocketId, rooms;

beforeEach(() => {
  // Re-require on each test to get a fresh rooms Map would require cache clearing.
  // Instead, import once and clear rooms manually between tests.
  const server = require('../server.js');
  generateRoomCode = server.generateRoomCode;
  getRoom = server.getRoom;
  setRoom = server.setRoom;
  deleteRoom = server.deleteRoom;
  findRoomCodeBySocketId = server.findRoomCodeBySocketId;
  rooms = server.rooms;
  rooms.clear(); // ensure clean state
});

afterAll(() => {
  // Close server to avoid open handles
  const { httpServer } = require('../server.js');
  httpServer.close();
});

describe('generateRoomCode', () => {
  test('returns a 4-character uppercase string', () => {
    const code = generateRoomCode();
    expect(code).toMatch(/^[A-Z]{4}$/);
  });

  test('returns unique codes across 100 calls (no immediate collision)', () => {
    const codes = new Set(Array.from({ length: 100 }, () => generateRoomCode()));
    // With 26^4=456976 possibilities, 100 calls must all be unique
    expect(codes.size).toBe(100);
  });

  test('skips codes already in rooms Map', () => {
    setRoom('AAAA', {});
    // Can't force collision deterministically, but verify code is not 'AAAA'
    // Run 50 times to increase probability of detecting the guard
    for (let i = 0; i < 50; i++) {
      const code = generateRoomCode();
      expect(code).not.toBe('AAAA');
    }
  });
});

describe('getRoom / setRoom / deleteRoom', () => {
  test('setRoom stores and getRoom retrieves', () => {
    setRoom('WXYZ', { id: 'WXYZ' });
    expect(getRoom('WXYZ')).toEqual({ id: 'WXYZ' });
  });

  test('getRoom returns undefined for missing code', () => {
    expect(getRoom('ZZZZ')).toBeUndefined();
  });

  test('deleteRoom removes entry', () => {
    setRoom('WXYZ', { id: 'WXYZ' });
    deleteRoom('WXYZ');
    expect(getRoom('WXYZ')).toBeUndefined();
  });
});

describe('findRoomCodeBySocketId', () => {
  test('finds socketId in room players Map', () => {
    const players = new Map();
    players.set('socket-abc', { name: 'Alice' });
    setRoom('ABCD', { players });
    expect(findRoomCodeBySocketId('socket-abc')).toBe('ABCD');
  });

  test('returns undefined for unknown socketId', () => {
    expect(findRoomCodeBySocketId('socket-unknown')).toBeUndefined();
  });
});

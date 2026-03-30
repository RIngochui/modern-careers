'use strict';

import type { GameRoom, Player } from '../server';

let getRoom: (code: string) => GameRoom | undefined;
let setRoom: (code: string, room: GameRoom) => void;
let deleteRoom: (code: string) => boolean;
let findRoomCodeBySocketId: (id: string) => string | undefined;
let cancelCleanup: (code: string) => void;
let createPlayer: (id: string, name: string, isHost?: boolean) => Player;
let createGameRoom: (code: string, hostId: string) => GameRoom;
let rooms: Map<string, GameRoom>;

beforeEach(() => {
  const server = require('../server');
  getRoom = server.getRoom;
  setRoom = server.setRoom;
  deleteRoom = server.deleteRoom;
  findRoomCodeBySocketId = server.findRoomCodeBySocketId;
  cancelCleanup = server.cancelCleanup;
  createPlayer = server.createPlayer;
  createGameRoom = server.createGameRoom;
  rooms = server.rooms;
  rooms.clear();
});

afterAll(() => {
  require('../server').httpServer.close();
});

describe('disconnect cleanup logic', () => {
  test('removing last player from room sets players.size to 0', () => {
    const room = createGameRoom('DISC', 'host-1');
    room.players.set('host-1', createPlayer('host-1', 'Alice', true));
    setRoom('DISC', room);

    room.players.delete('host-1');
    expect(room.players.size).toBe(0);
  });

  test('room remains in rooms Map after player leaves (until cleanup timer fires)', () => {
    const room = createGameRoom('DISC', 'host-1');
    room.players.set('host-1', createPlayer('host-1', 'Alice', true));
    setRoom('DISC', room);

    room.players.delete('host-1');
    expect(getRoom('DISC')).toBeDefined();
  });

  test('findRoomCodeBySocketId returns undefined after player removed', () => {
    const room = createGameRoom('DISC', 'host-1');
    room.players.set('host-1', createPlayer('host-1', 'Alice', true));
    setRoom('DISC', room);

    room.players.delete('host-1');
    expect(findRoomCodeBySocketId('host-1')).toBeUndefined();
  });

  test('second player disconnect: remaining player still in room', () => {
    const room = createGameRoom('DISC', 'host-1');
    room.players.set('host-1', createPlayer('host-1', 'Alice', true));
    room.players.set('guest-1', createPlayer('guest-1', 'Bob'));
    setRoom('DISC', room);

    room.players.delete('guest-1');
    expect(room.players.size).toBe(1);
    expect(room.players.has('host-1')).toBe(true);
  });
});

describe('cancelCleanup', () => {
  test('cancelCleanup clears cleanupTimer and sets to null', () => {
    const room = createGameRoom('DISC', 'host-1');
    setRoom('DISC', room);
    room.cleanupTimer = setTimeout(() => {}, 999999);

    cancelCleanup('DISC');
    expect(room.cleanupTimer).toBeNull();
  });

  test('cancelCleanup is safe to call when no timer is set', () => {
    const room = createGameRoom('DISC', 'host-1');
    setRoom('DISC', room);
    room.cleanupTimer = null;

    expect(() => cancelCleanup('DISC')).not.toThrow();
  });

  test('cancelCleanup is safe to call for non-existent room', () => {
    expect(() => cancelCleanup('XXXX')).not.toThrow();
  });
});

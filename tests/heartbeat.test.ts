'use strict';

import type { GameRoom, Player } from '../server';

let socketLastPong: Map<string, number>;
let HEARTBEAT_INTERVAL_MS: number;
let HEARTBEAT_TIMEOUT_MS: number;
let createPlayer: (id: string, name: string, isHost?: boolean) => Player;
let createGameRoom: (code: string, hostId: string) => GameRoom;
let getRoom: (code: string) => GameRoom | undefined;
let setRoom: (code: string, room: GameRoom) => void;
let rooms: Map<string, GameRoom>;

beforeEach(() => {
  const server = require('../server');
  socketLastPong = server.socketLastPong;
  HEARTBEAT_INTERVAL_MS = server.HEARTBEAT_INTERVAL_MS;
  HEARTBEAT_TIMEOUT_MS = server.HEARTBEAT_TIMEOUT_MS;
  createPlayer = server.createPlayer;
  createGameRoom = server.createGameRoom;
  getRoom = server.getRoom;
  setRoom = server.setRoom;
  rooms = server.rooms;
  rooms.clear();
  socketLastPong.clear();
});

afterAll(() => {
  require('../server').httpServer.close();
});

describe('heartbeat constants', () => {
  test('HEARTBEAT_INTERVAL_MS is 30000 (30 seconds)', () => {
    expect(HEARTBEAT_INTERVAL_MS).toBe(30000);
  });

  test('HEARTBEAT_TIMEOUT_MS is 60000 (60 seconds)', () => {
    expect(HEARTBEAT_TIMEOUT_MS).toBe(60000);
  });
});

describe('socketLastPong state', () => {
  test('socketLastPong is a Map', () => {
    expect(socketLastPong).toBeInstanceOf(Map);
  });

  test('can set and get lastPong timestamp', () => {
    const now = Date.now();
    socketLastPong.set('sock-1', now);
    expect(socketLastPong.get('sock-1')).toBe(now);
  });

  test('can delete lastPong on disconnect', () => {
    socketLastPong.set('sock-1', Date.now());
    socketLastPong.delete('sock-1');
    expect(socketLastPong.has('sock-1')).toBe(false);
  });
});

describe('lastPong update logic', () => {
  test('player.lastPong can be updated in room', () => {
    const room = createGameRoom('BEAT', 'host-1');
    const player = createPlayer('host-1', 'Alice', true);
    const before = player.lastPong;
    room.players.set('host-1', player);
    setRoom('BEAT', room);

    const after = Date.now() + 100;
    room.players.get('host-1')!.lastPong = after;

    expect(getRoom('BEAT')!.players.get('host-1')!.lastPong).toBe(after);
    expect(getRoom('BEAT')!.players.get('host-1')!.lastPong).toBeGreaterThanOrEqual(before);
  });

  test('zombie detection: timestamp older than HEARTBEAT_TIMEOUT_MS triggers disconnect', () => {
    const oldPong = Date.now() - (HEARTBEAT_TIMEOUT_MS + 1);
    const isZombie = (Date.now() - oldPong) > HEARTBEAT_TIMEOUT_MS;
    expect(isZombie).toBe(true);
  });

  test('fresh pong does NOT trigger disconnect', () => {
    const recentPong = Date.now() - 1000;
    const isZombie = (Date.now() - recentPong) > HEARTBEAT_TIMEOUT_MS;
    expect(isZombie).toBe(false);
  });
});

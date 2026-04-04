'use strict';

import {
  createPlayer,
  createGameRoom,
  GAME_PHASES,
  TURN_PHASES,
} from '../server';

// ── Mock game room fixture ─────────────────────────────────────────────────

function createMockRoom(numPlayers = 2) {
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

// ── STOMP-01: Non-Cop stomp sends target to Tile 0 (Payday), –1 HP ────────

describe('STOMP-01 non-Cop stomp sends target to Tile 0 (Payday)', () => {
  it('stomper landing on occupied tile sends target to position 0 with skipNextPayday=true and –1 HP', () => {
    const room = createMockRoom();
    const stomper = room.players.get('socket-a') as any;
    const target = room.players.get('socket-b') as any;

    // Both players on same tile
    stomper.position = 5;
    target.position = 5;
    target.hp = 5;

    // Stomper is NOT a cop
    stomper.isCop = false;

    const { checkGoombaStomp } = require('../server');
    checkGoombaStomp(room, 'TEST', 'socket-a');

    // Target should be sent to Payday (Tile 0)
    expect(target.position).toBe(0);
    expect(target.skipNextPayday).toBe(true);
    expect(target.inJapan).toBe(false);
    expect(target.hp).toBe(4); // –1 HP
  });
});

// ── STOMP-02: Cop stomp sends target to Tile 10 (Prison), –2 HP ──────────

describe('STOMP-02 Cop stomp sends target to Tile 10 (Prison)', () => {
  it('Cop stomper landing on occupied tile sends target to position 10 with inPrison=true and –2 HP', () => {
    const room = createMockRoom();
    const stomper = room.players.get('socket-a') as any;
    const target = room.players.get('socket-b') as any;

    // Both players on same tile
    stomper.position = 5;
    target.position = 5;
    target.hp = 5;

    // Stomper IS a cop
    stomper.isCop = true;

    const { checkGoombaStomp } = require('../server');
    checkGoombaStomp(room, 'TEST', 'socket-a');

    // Target should be sent to Prison (Tile 10)
    expect(target.position).toBe(10);
    expect(target.inPrison).toBe(true);
    expect(target.hp).toBe(3); // –2 HP
  });
});

// ── STOMP-01b: Multiple occupants on same tile are all stomped ────────────

describe('STOMP-01b multiple occupants on same tile are all stomped', () => {
  it('both targets are sent to Payday (Tile 0) when stomper lands on their tile', () => {
    const room = createMockRoom(3); // 3-player room
    const stomper = room.players.get('socket-a') as any;
    const target1 = room.players.get('socket-b') as any;
    const target2 = room.players.get('socket-c') as any;

    // All three on same tile — stomper lands on tile with 2 occupants
    stomper.position = 7;
    target1.position = 7;
    target2.position = 7;
    target1.hp = 5;
    target2.hp = 5;

    // Stomper is NOT a cop
    stomper.isCop = false;

    const { checkGoombaStomp } = require('../server');
    checkGoombaStomp(room, 'TEST', 'socket-a');

    // Both targets should be sent to Payday (Tile 0)
    expect(target1.position).toBe(0);
    expect(target1.skipNextPayday).toBe(true);
    expect(target1.hp).toBe(4);
    expect(target2.position).toBe(0);
    expect(target2.skipNextPayday).toBe(true);
    expect(target2.hp).toBe(4);
  });
});

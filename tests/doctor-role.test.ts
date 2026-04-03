'use strict';

import {
  createPlayer,
  createGameRoom,
  GAME_PHASES,
  TURN_PHASES,
  STARTING_MONEY,
} from '../server';

// ── Mock game room fixture ─────────────────────────────────────────────────

function createMockRoom() {
  const room = createGameRoom('TEST', 'socket-a');
  const playerA = createPlayer('socket-a', 'Alice', true);
  const playerB = createPlayer('socket-b', 'Bob', false);
  room.players.set('socket-a', playerA);
  room.players.set('socket-b', playerB);
  room.turnOrder = ['socket-a', 'socket-b'];
  room.currentTurnIndex = 0;
  room.gamePhase = GAME_PHASES.PLAYING;
  room.turnPhase = TURN_PHASES.WAITING_FOR_ROLL;
  return room as any;
}

afterAll((done) => {
  require('../server').httpServer.close(done);
});

// ── DOC-02: Doctor passive income from hospital exit ──────────────────────

describe('DOC-02 isDoctor player receives Math.floor(salary/2) when patient exits hospital', () => {
  it('doctor money increases by Math.floor(10000 / 2) = 5000 when patient escapes hospital', () => {
    const room = createMockRoom();
    const patient = room.players.get('socket-a') as any;
    const doctor = room.players.get('socket-b') as any;

    // Setup patient in hospital with salary 10000
    patient.inHospital = true;
    patient.position = 30;
    patient.salary = 10000;

    // Setup doctor role (field doesn't exist yet → cast)
    doctor.isDoctor = true;

    const doctorMoneyBefore = doctor.money;
    const expectedPayment = Math.floor(10000 / 2); // 5000

    // Mock Math.random so 1d6 roll = 1 (escape, roll <= 5)
    const origRandom = Math.random;
    Math.random = () => 0; // floor(0 * 6) + 1 = 1

    // handleHospitalEscape will be exported in Plan 02;
    // it does not exist yet → this call will throw "not a function"
    const { handleHospitalEscape } = require('../server');
    handleHospitalEscape(room, 'TEST', 'socket-a');

    Math.random = origRandom;

    // Doctor (isDoctor=true) should have received the payment
    expect(doctor.money).toBe(doctorMoneyBefore + expectedPayment);
    expect(doctor.money).toBe(STARTING_MONEY + 5000);
  });
});

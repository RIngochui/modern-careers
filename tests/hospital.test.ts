'use strict';

import {
  createPlayer,
  createGameRoom,
  GAME_PHASES,
  TURN_PHASES,
  STARTING_MONEY,
  STARTING_HP,
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

// ── HP-02: HP <= 0 triggers hospital entry ─────────────────────────────────

describe('HP-02 hp <= 0 triggers hospital entry', () => {
  it('setting hp to 0 and calling hp check sends player to tile 30 with inHospital=true', () => {
    const room = createMockRoom();
    const player = room.players.get('socket-a') as any;

    // Manually simulate what the HP-check path will do in Plan 02:
    // Player hp hits 0 → server sets inHospital = true, position = 30
    player.hp = 0;

    // The handleHpCheck function will be exported in Plan 02:
    const { handleHpCheck } = require('../server');
    handleHpCheck(room, 'TEST', 'socket-a');

    // After hp check: player should be in hospital at tile 30
    expect((player as any).inHospital).toBe(true);
    expect(player.position).toBe(30);
  });
});

// ── HOSP-01a: roll <= 5 escapes hospital ──────────────────────────────────

describe('HOSP-01a roll <= 5 escapes hospital', () => {
  it('escape roll of 1 (1d6) exits hospital and sets inHospital=false', () => {
    const room = createMockRoom();
    const player = room.players.get('socket-a') as any;
    player.inHospital = true;
    player.position = 30;

    // Mock Math.random so 1d6 roll = 1 (escape)
    const origRandom = Math.random;
    Math.random = () => 0; // floor(0 * 6) + 1 = 1 → escape

    const { handleHospitalEscape } = require('../server');
    handleHospitalEscape(room, 'TEST', 'socket-a');

    Math.random = origRandom;

    expect((player as any).inHospital).toBe(false);
  });
});

// ── HOSP-01b: roll of 6 stays in hospital ─────────────────────────────────

describe('HOSP-01b roll 6 stays in hospital', () => {
  it('escape roll of 6 (1d6) keeps player in hospital (inHospital=true)', () => {
    const room = createMockRoom();
    const player = room.players.get('socket-a') as any;
    player.inHospital = true;
    player.position = 30;

    // Mock Math.random so 1d6 roll = 6 (stay)
    const origRandom = Math.random;
    Math.random = () => 5 / 6; // floor((5/6) * 6) + 1 = 6 → stay

    const { handleHospitalEscape } = require('../server');
    handleHospitalEscape(room, 'TEST', 'socket-a');

    Math.random = origRandom;

    expect((player as any).inHospital).toBe(true);
  });
});

// ── HOSP-02: escape grants +5 HP and deducts Math.floor(salary/2) ────────

describe('HOSP-02 escape grants +5 HP and deducts Math.floor(salary/2)', () => {
  it('player with salary=10000 gains +5 HP and loses $5000 on escape', () => {
    const room = createMockRoom();
    const player = room.players.get('socket-a') as any;
    player.inHospital = true;
    player.position = 30;
    player.salary = 10000;
    const hpBefore = player.hp;
    const moneyBefore = player.money;

    // Mock Math.random so 1d6 roll = 1 (escape)
    const origRandom = Math.random;
    Math.random = () => 0; // roll = 1 → escape

    const { handleHospitalEscape } = require('../server');
    handleHospitalEscape(room, 'TEST', 'socket-a');

    Math.random = origRandom;

    // +5 HP on escape
    expect(player.hp).toBe(hpBefore + 5);
    // Math.floor(10000 / 2) = 5000 deducted
    expect(player.money).toBe(moneyBefore - 5000);
  });
});

// ── HOSP-03: card play blocked when inHospital=true ──────────────────────

describe('HOSP-03 card play blocked in hospital', () => {
  it('canPlayCard returns false (or error) when player.inHospital is true', () => {
    const room = createMockRoom();
    const player = room.players.get('socket-a') as any;
    player.inHospital = true;

    const { canPlayCard } = require('../server');
    const result = canPlayCard(room, 'TEST', 'socket-a');

    // The validator must reject card play when inHospital=true
    expect(result).toBeFalsy();
  });
});

// ── HOSP-04: payment routes to Doctor when isDoctor exists ───────────────

describe('HOSP-04 hospital payment routes to doctor when isDoctor exists', () => {
  it('doctor.money increases by Math.floor(salary/2) when patient escapes', () => {
    const room = createMockRoom();
    const patient = room.players.get('socket-a') as any;
    const doctor = room.players.get('socket-b') as any;

    patient.inHospital = true;
    patient.position = 30;
    patient.salary = 10000;
    doctor.isDoctor = true;

    const doctorMoneyBefore = doctor.money;

    // Mock Math.random so 1d6 roll = 1 (escape)
    const origRandom = Math.random;
    Math.random = () => 0; // roll = 1 → escape

    const { handleHospitalEscape } = require('../server');
    handleHospitalEscape(room, 'TEST', 'socket-a');

    Math.random = origRandom;

    // Doctor should receive Math.floor(10000 / 2) = 5000
    expect(doctor.money).toBe(doctorMoneyBefore + 5000);
  });
});

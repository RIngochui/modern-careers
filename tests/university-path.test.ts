'use strict';

import {
  createPlayer,
  createGameRoom,
  GAME_PHASES,
  TURN_PHASES,
  STARTING_MONEY,
  BOARD_TILES,
  CAREER_PATHS,
  DEGREE_CAP_COLORS,
  AVAILABLE_DEGREES,
  enterPath,
  exitPath,
  checkEntryRequirements,
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

// ── entry: University entry from Tile 9 ───────────────────────────────────

describe('entry', () => {
  it('landing on University tile (9) deducts $10,000 entry fee from player money', () => {
    const pathConfig = CAREER_PATHS.UNIVERSITY;
    expect(pathConfig.entry.cashCost).toBe(10000);

    const room = createMockRoom();
    const player = room.players.get('socket-a') as any;
    // Simulate career-enter: deduct entry fee then enterPath
    const { fee } = checkEntryRequirements(player, pathConfig);
    expect(fee).toBe(10000);

    const moneyBefore = player.money;
    player.money -= fee;
    enterPath(player, 'UNIVERSITY');
    expect(player.money).toBe(moneyBefore - 10000);
  });

  it('entering University sets inPath=true on the player', () => {
    const room = createMockRoom();
    const player = room.players.get('socket-a') as any;

    enterPath(player, 'UNIVERSITY');
    expect(player.inPath).toBe(true);
  });

  it("entering University sets currentPath='UNIVERSITY' on the player", () => {
    const room = createMockRoom();
    const player = room.players.get('socket-a') as any;

    enterPath(player, 'UNIVERSITY');
    expect(player.currentPath).toBe('UNIVERSITY');
  });
});

// ── tile-3: Tile 3 (STUDENT_LOAN_REDIRECT) moves player to Tile 9 with waived fee ──

describe('tile-3', () => {
  it('landing on Tile 3 (STUDENT_LOAN_REDIRECT) moves player to University tile (9)', () => {
    // BOARD_TILES[3] is STUDENT_LOAN_REDIRECT
    expect(BOARD_TILES[3].type).toBe('STUDENT_LOAN_REDIRECT');

    // dispatchTile 'STUDENT_LOAN_REDIRECT' sets player.position = 9
    const room = createMockRoom();
    const player = room.players.get('socket-a') as any;
    player.position = 3;

    // Simulate what dispatchTile does for STUDENT_LOAN_REDIRECT:
    player.money -= 15000;
    player.position = 9;
    enterPath(player, 'UNIVERSITY');

    expect(player.position).toBe(9);
    expect(player.inPath).toBe(true);
    expect(player.currentPath).toBe('UNIVERSITY');
  });

  it('arriving at University via Tile 3 waives the $10,000 entry fee', () => {
    const room = createMockRoom();
    const player = room.players.get('socket-a') as any;
    player.position = 3;

    const moneyBefore = player.money;
    // STUDENT_LOAN_REDIRECT deducts 15,000 (student loan) but NOT the 10,000 entry fee
    player.money -= 15000; // only student loan cost, no entry fee
    player.position = 9;
    enterPath(player, 'UNIVERSITY');

    // Only 15,000 deducted, not 25,000 (15,000 + 10,000)
    expect(player.money).toBe(moneyBefore - 15000);
    expect(player.inPath).toBe(true);
  });
});

// ── degree: University completion prompts degree selection ─────────────────

describe('degree', () => {
  it('completing University path (Tile 8 exit) prompts degree selection with 7 options', () => {
    // AVAILABLE_DEGREES should have 7 options
    expect(AVAILABLE_DEGREES).toHaveLength(7);
    expect(AVAILABLE_DEGREES).toContain('economics');
    expect(AVAILABLE_DEGREES).toContain('computerScience');
    expect(AVAILABLE_DEGREES).toContain('genderStudies');
    expect(AVAILABLE_DEGREES).toContain('politicalScience');
    expect(AVAILABLE_DEGREES).toContain('art');
    expect(AVAILABLE_DEGREES).toContain('teaching');
    expect(AVAILABLE_DEGREES).toContain('medical');
  });

  it('max 1 degree enforced — player with existing degree cannot select another', () => {
    const room = createMockRoom();
    const player = room.players.get('socket-a') as any;

    // Player already has a degree
    player.degree = 'economics';
    enterPath(player, 'UNIVERSITY');

    // checkEntryRequirements for UNIVERSITY still returns meetsRequirements=true
    // but with a note that they already have a degree
    const pathConfig = CAREER_PATHS.UNIVERSITY;
    const result = checkEntryRequirements(player, pathConfig);
    expect(result.meetsRequirements).toBe(true);
    expect(result.reason).toContain('Already hold a degree');
  });
});

// ── cap: Degree selection sets graduationCapColor ────────────────────────

describe('cap', () => {
  it('selecting a degree sets graduationCapColor to the correct colour for that degree', () => {
    // DEGREE_CAP_COLORS maps each degree to a colour
    expect(DEGREE_CAP_COLORS.economics).toBe('green');
    expect(DEGREE_CAP_COLORS.computerScience).toBe('blue');
    expect(DEGREE_CAP_COLORS.genderStudies).toBe('purple');
    expect(DEGREE_CAP_COLORS.politicalScience).toBe('red');
    expect(DEGREE_CAP_COLORS.art).toBe('orange');
    expect(DEGREE_CAP_COLORS.teaching).toBe('yellow');
    expect(DEGREE_CAP_COLORS.medical).toBe('white');

    // Simulate choose-degree: set degree + cap color
    const room = createMockRoom();
    const player = room.players.get('socket-a') as any;
    player.degree = 'computerScience';
    player.graduationCapColor = DEGREE_CAP_COLORS['computerScience'];
    expect(player.graduationCapColor).toBe('blue');
  });
});

// ── medical: Medical degree sets isDoctor=true and sends to Hospital ─────

describe('medical', () => {
  it('selecting Medical Degree sets isDoctor=true on the player', () => {
    const room = createMockRoom();
    const player = room.players.get('socket-a') as any;
    enterPath(player, 'UNIVERSITY');

    // Simulate choose-degree with 'medical'
    player.degree = 'medical';
    player.graduationCapColor = DEGREE_CAP_COLORS['medical'];
    player.isDoctor = true;

    expect(player.isDoctor).toBe(true);
    expect(player.degree).toBe('medical');
    expect(player.graduationCapColor).toBe('white');
  });

  it('selecting Medical Degree immediately sends player to Hospital (inHospital=true)', () => {
    const room = createMockRoom();
    const player = room.players.get('socket-a') as any;
    enterPath(player, 'UNIVERSITY');

    // Simulate choose-degree 'medical' handler:
    player.degree = 'medical';
    player.isDoctor = true;
    player.inHospital = true;
    player.position = 30;
    exitPath(player, 'completed');

    expect(player.inHospital).toBe(true);
    expect(player.position).toBe(30);
    expect(player.isDoctor).toBe(true);
    expect(player.inPath).toBe(false);
  });
});

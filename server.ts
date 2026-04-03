import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import compression from 'compression';
import cors from 'cors';
import path from 'path';

const PORT: number = parseInt(process.env.PORT ?? '3000', 10);

// ── Types ──────────────────────────────────────────────────────────────────

export interface SuccessFormula {
  money: number;
  fame: number;
  happiness: number;
}

export interface Player {
  socketId: string;
  name: string;
  isHost: boolean;
  // Stats
  money: number;
  fame: number;
  happiness: number;
  hp: number;
  salary: number;
  // Board position
  position: number;
  // Status flags
  inPrison: boolean;
  prisonTurns: number;
  skipNextTurn: boolean;
  retired: boolean;
  unemployed: boolean;
  // Life events
  isMarried: boolean;
  kids: number;
  collegeDebt: number;
  degree: string | null;         // null | 'compSci' | 'business' | 'healthSciences' | 'teaching'
  career: string | null;         // null | career path name
  hasStudentLoans: boolean;
  // Character portrait overlays
  hasWeddingRing: boolean;
  hasSportsCar: boolean;
  hasLandlordHat: boolean;
  graduationCapColor: string | null;  // null | 'blue' | 'green' | 'red' | 'purple'
  careerBadge: string | null;
  // Success Formula (set in lobby, kept secret)
  successFormula: SuccessFormula | null;
  hasSubmittedFormula: boolean;
  // Cards in hand
  luckCards: string[];
  // Phase 6 location flags
  inHospital: boolean;
  inJapan: boolean;
  isDoctor: boolean;
  isCop: boolean;
  // Heartbeat
  lastPong: number;
}

export interface SharedResources {
  lotteryPool: number;
}

export interface GameRoom {
  id: string;
  hostSocketId: string;
  players: Map<string, Player>;
  turnOrder: string[];
  currentTurnIndex: number;
  gamePhase: string;
  turnPhase: string;
  board: unknown[];
  sharedResources: SharedResources;
  cleanupTimer: ReturnType<typeof setTimeout> | null;
  turnHistory: unknown[];
  createdAt: number;
  startedAt: number | null;
  propertyOwners: Map<number, string>;
}

export interface RateLimit {
  maxCalls: number;
  windowMs: number;
}

// ── Express app ────────────────────────────────────────────────────────────
const app = express();
app.use(compression());
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── HTTP server ────────────────────────────────────────────────────────────
const httpServer = http.createServer(app);

// ── Socket.io server ───────────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// ── In-memory rooms store ──────────────────────────────────────────────────
const rooms = new Map<string, GameRoom>();

// ── Room store helpers ─────────────────────────────────────────────────────

/**
 * Generate a 4-uppercase-letter room code not already in use.
 */
function generateRoomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code: string;
  do {
    code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * 26)]).join('');
  } while (rooms.has(code));
  return code;
}

function getRoom(roomCode: string): GameRoom | undefined {
  return rooms.get(roomCode);
}

function setRoom(roomCode: string, room: GameRoom): void {
  rooms.set(roomCode, room);
}

function deleteRoom(roomCode: string): boolean {
  return rooms.delete(roomCode);
}

/**
 * Find the roomCode for a given socketId.
 */
function findRoomCodeBySocketId(socketId: string): string | undefined {
  for (const [code, room] of rooms) {
    if (room.hostSocketId === socketId) return code;
    if (room.players && room.players.has(socketId)) return code;
  }
  return undefined;
}

/**
 * Cancel a scheduled room cleanup (called when a player rejoins).
 */
function cancelCleanup(roomCode: string): void {
  const room = getRoom(roomCode);
  if (room && room.cleanupTimer) {
    clearTimeout(room.cleanupTimer);
    room.cleanupTimer = null;
    console.log(`[cleanup] Room ${roomCode} cleanup cancelled (player rejoined)`);
  }
}

// ── Domain constants ───────────────────────────────────────────────────────

const GAME_PHASES = {
  LOBBY: 'lobby',
  PLAYING: 'playing',
  FINAL_ROUND: 'finalRound',
  ENDED: 'ended'
} as const;

const TURN_PHASES = {
  WAITING_FOR_ROLL: 'WAITING_FOR_ROLL',
  MID_ROLL: 'MID_ROLL',
  LANDED: 'LANDED',
  TILE_RESOLVING: 'TILE_RESOLVING',
  WAITING_FOR_NEXT_TURN: 'WAITING_FOR_NEXT_TURN',
  WAITING_FOR_PROPERTY_DECISION: 'WAITING_FOR_PROPERTY_DECISION'
} as const;

const STARTING_MONEY = 10000;
export const STARTING_HP = 10;

// ── Board definition ───────────────────────────────────────────────────────

export const BOARD_SIZE = 40;

export const BOARD_TILES: Array<{ type: string; name: string; description: string }> = [
  { type: 'PAYDAY',                name: 'Payday',              description: 'Pass: +Salary. Land exactly: +2× Salary.' },
  { type: 'OPPORTUNITY_KNOCKS',    name: 'Opportunity Knocks',  description: 'Draw an Opportunity card.' },
  { type: 'PAY_TAXES',             name: 'Pay Taxes',           description: 'Salary ≤30k: pay 0. ≤70k: pay 50% salary. ≥70k: pay 90% salary.' },
  { type: 'STUDENT_LOAN_REDIRECT', name: 'Student Loan Payment',description: 'Move to University (Tile 9). Entry fee waived. Lose 15,000.' },
  { type: 'MCDONALDS',             name: "McDonald's",          description: 'Career path entry. No degree required. Low salary, flavor tiles.' },
  { type: 'OPPORTUNITY_KNOCKS',    name: 'Opportunity Knocks',  description: 'Draw an Opportunity card.' },
  { type: 'APARTMENT',             name: 'Apartment',           description: 'Buy for 50,000 if unowned. Rent: pay 25% Salary to owner.' },
  { type: 'SPORTS_BETTING',        name: 'Sports Betting',      description: 'Buy parlay for 10,000. Roll 1d6: 1 wins 60,000; else lose stake.' },
  { type: 'CIGARETTE_BREAK',       name: 'Cigarette Break',     description: 'Roll 1d6=X. Gain X Happiness, lose X HP.' },
  { type: 'UNIVERSITY',            name: 'University',          description: 'Pay 10,000 to enter (waived from Tile 3). Choose degree. Max 1 per game.' },
  { type: 'PRISON',                name: 'Prison',              description: 'Escape: roll 9, 11, or 12, OR pay bail. No movement or Salary.' },
  { type: 'OPPORTUNITY_KNOCKS',    name: 'Opportunity Knocks',  description: 'Draw an Opportunity card.' },
  { type: 'FINANCE_BRO',           name: 'Finance Bro',         description: 'Career path entry. Requires Economics/Business degree, OR pay 10,000, OR Nepotism.' },
  { type: 'OPPORTUNITY_KNOCKS',    name: 'Opportunity Knocks',  description: 'Draw an Opportunity card.' },
  { type: 'ART_GALLERY',           name: 'Art Gallery',         description: 'Buy NFT for 20,000 each. Roll 1d6 → gain Fame. Payment → Artist or Banker.' },
  { type: 'SUPPLY_TEACHER',        name: 'Supply Teacher',      description: 'Career path entry. Requires Teaching degree, OR pay 10,000, OR Nepotism.' },
  { type: 'OPPORTUNITY_KNOCKS',    name: 'Opportunity Knocks',  description: 'Draw an Opportunity card.' },
  { type: 'GYM_MEMBERSHIP',        name: 'Gym Membership',      description: 'Sign up for 10,000. Each pass as member: pay 5,000, +1 HP, +1 Happiness.' },
  { type: 'COP',                   name: 'Cop',                 description: 'Career path entry. Wait 1 turn + pay 15,000, OR Nepotism.' },
  { type: 'LOTTERY',               name: 'Lottery',             description: 'Pool starts at 50,000. Roll 2d6 (costs 10,000/roll, max 3). Pair = win pool.' },
  { type: 'JAPAN_TRIP',            name: 'Japan Trip',          description: '+1 Happiness on land. Each turn staying: +2 Happiness, pay Salary/5. Roll >8 = must leave.' },
  { type: 'OPPORTUNITY_KNOCKS',    name: 'Opportunity Knocks',  description: 'Draw an Opportunity card.' },
  { type: 'DEI_OFFICER',           name: 'DEI Officer',         description: 'Career path entry. Requires Gender Studies, OR lose 20 Fame, OR Nepotism.' },
  { type: 'REVOLUTION',            name: 'Revolution',          description: 'Sum all Cash. Split evenly. Leftover → Banker.' },
  { type: 'OPPORTUNITY_KNOCKS',    name: 'Opportunity Knocks',  description: 'Draw an Opportunity card.' },
  { type: 'HOUSE',                 name: 'House',               description: 'Buy for 100,000 if unowned. Rent: pay 50% Salary to owner.' },
  { type: 'NEPOTISM',              name: 'Nepotism',            description: 'Choose another player + a career you completed. They enter that path free. You receive path bonus.' },
  { type: 'COVID_STIMULUS',        name: 'COVID Stimulus',      description: 'Trade HP for cash: 10,000 per HP.' },
  { type: 'TECH_BRO',              name: 'Tech Bro',            description: 'Career path entry. Requires Computer Science, OR pay 20,000, OR Nepotism.' },
  { type: 'OPPORTUNITY_KNOCKS',    name: 'Opportunity Knocks',  description: 'Draw an Opportunity card.' },
  { type: 'HOSPITAL',              name: 'Hospital',            description: 'Stuck until roll ≤5 OR pay ½ Salary. On leaving: +5 HP.' },
  { type: 'RIGHT_WING_GRIFTER',    name: 'Right-Wing Grifter',  description: 'Career path entry. Requires Political Science, OR lose 25 Happiness, OR Nepotism.' },
  { type: 'OPPORTUNITY_KNOCKS',    name: 'Opportunity Knocks',  description: 'Draw an Opportunity card.' },
  { type: 'OZEMPIC',               name: 'Ozempic',             description: 'Buy up to 3 treatments. Each: pay 10,000, gain +2 HP.' },
  { type: 'STARVING_ARTIST',       name: 'Starving Artist',     description: 'Career path entry. Requires Art degree, OR pay 25,000, OR Nepotism.' },
  { type: 'YACHT_HARBOR',          name: 'Yacht Harbor',        description: 'Pay 20,000 → +4 Happiness. Pay 80,000 → +8. Pay 160,000 → +12.' },
  { type: 'OPPORTUNITY_KNOCKS',    name: 'Opportunity Knocks',  description: 'Draw an Opportunity card.' },
  { type: 'INSTAGRAM_FOLLOWERS',   name: 'Instagram Followers', description: 'Pay 20,000 → +4 Fame. Pay 80,000 → +10. Pay 160,000 → +16.' },
  { type: 'STREAMER',              name: 'Streamer',            description: 'Career path entry. Roll a 1 (costs 10,000/attempt, max 3) OR Nepotism.' },
  { type: 'OPPORTUNITY_KNOCKS',    name: 'Opportunity Knocks',  description: 'Draw an Opportunity card.' },
];

// ── Player factory ─────────────────────────────────────────────────────────

function createPlayer(socketId: string, name: string, isHost = false): Player {
  return {
    socketId,
    name,
    isHost,
    money: STARTING_MONEY,
    fame: 0,
    happiness: 0,
    hp: STARTING_HP,
    salary: 10000,
    position: 0,
    inPrison: false,
    prisonTurns: 0,
    skipNextTurn: false,
    retired: false,
    unemployed: false,
    isMarried: false,
    kids: 0,
    collegeDebt: 0,
    degree: null,
    career: null,
    hasStudentLoans: false,
    hasWeddingRing: false,
    hasSportsCar: false,
    hasLandlordHat: false,
    graduationCapColor: null,
    careerBadge: null,
    successFormula: null,
    hasSubmittedFormula: false,
    luckCards: [],
    inHospital: false,
    inJapan: false,
    isDoctor: false,
    isCop: false,
    lastPong: Date.now()
  };
}

// ── GameRoom factory ───────────────────────────────────────────────────────

function createGameRoom(roomCode: string, hostSocketId: string): GameRoom {
  return {
    id: roomCode,
    hostSocketId,
    players: new Map<string, Player>(),
    turnOrder: [],
    currentTurnIndex: 0,
    gamePhase: GAME_PHASES.LOBBY,
    turnPhase: TURN_PHASES.WAITING_FOR_ROLL,
    board: [],
    sharedResources: {
      lotteryPool: 50000,
    },
    cleanupTimer: null,
    turnHistory: [],
    createdAt: Date.now(),
    startedAt: null,
    propertyOwners: new Map<number, string>()
  };
}

// ── Lobby validation helpers ───────────────────────────────────────────────

/**
 * Validate a player name: 1-20 chars, alphanumeric + spaces only.
 * If room is provided, also performs case-insensitive duplicate check.
 */
function isValidPlayerName(name: string, room?: GameRoom): boolean {
  if (typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 20) return false;
  if (!/^[a-zA-Z0-9 ]+$/.test(trimmed)) return false;
  if (room) {
    const lower = trimmed.toLowerCase();
    const dup = Array.from(room.players.values()).some(p => p.name.toLowerCase() === lower);
    if (dup) return false;
  }
  return true;
}

/**
 * Validate a Success Formula payload: all values must be numbers, 0-60 inclusive,
 * and sum to exactly 60.
 */
function isValidFormula(formula: { money: unknown; fame: unknown; happiness: unknown }): boolean {
  const { money, fame, happiness } = formula;
  if (typeof money !== 'number' || typeof fame !== 'number' || typeof happiness !== 'number') return false;
  if (money < 0 || fame < 0 || happiness < 0) return false;
  if (money > 60 || fame > 60 || happiness > 60) return false;
  return money + fame + happiness === 60;
}

/**
 * Check whether the game can be started:
 * at least 2 players in the room AND all have submitted their Success Formula.
 */
function canStartGame(room: GameRoom): boolean {
  if (room.players.size < 2) return false;
  return Array.from(room.players.values()).every(p => p.hasSubmittedFormula);
}

const connectedSockets = new Set<string>();

// ── Per-socket rate limiting ───────────────────────────────────────────────

const RATE_LIMITS: Record<string, RateLimit> = {
  'create-room':    { maxCalls: 5,  windowMs: 60000 },
  'join-room':      { maxCalls: 10, windowMs: 60000 },
  'submit-formula': { maxCalls: 10, windowMs: 60000 },
  'play-luck-card': { maxCalls: 5,  windowMs: 5000  },
  'requestSync':    { maxCalls: 10, windowMs: 10000 }
};

const rateLimitState = new Map<string, Map<string, number[]>>();

function checkRateLimit(socketId: string, eventName: string): boolean {
  const limit = RATE_LIMITS[eventName];
  if (!limit) return true;

  const now = Date.now();

  if (!rateLimitState.has(socketId)) {
    rateLimitState.set(socketId, new Map<string, number[]>());
  }
  const socketEvents = rateLimitState.get(socketId)!;

  if (!socketEvents.has(eventName)) {
    socketEvents.set(eventName, []);
  }
  const timestamps = socketEvents.get(eventName)!;

  const windowStart = now - limit.windowMs;
  const recent = timestamps.filter(ts => ts >= windowStart);

  if (recent.length >= limit.maxCalls) {
    return false;
  }

  recent.push(now);
  socketEvents.set(eventName, recent);
  return true;
}

function clearRateLimitState(socketId: string): void {
  rateLimitState.delete(socketId);
}

// ── State serialisation ────────────────────────────────────────────────────

function getFullState(room: GameRoom, requestingSocketId: string | null = null): object {
  const playersSnapshot: Record<string, object> = {};
  for (const [socketId, player] of room.players) {
    playersSnapshot[socketId] = {
      socketId: player.socketId,
      name: player.name,
      isHost: player.isHost,
      money: player.money,
      fame: player.fame,
      happiness: player.happiness,
      hp: player.hp,
      salary: player.salary,
      position: player.position,
      inPrison: player.inPrison,
      prisonTurns: player.prisonTurns,
      skipNextTurn: player.skipNextTurn,
      retired: player.retired,
      unemployed: player.unemployed,
      isMarried: player.isMarried,
      kids: player.kids,
      degree: player.degree,
      career: player.career,
      hasStudentLoans: player.hasStudentLoans,
      hasWeddingRing: player.hasWeddingRing,
      hasSportsCar: player.hasSportsCar,
      hasLandlordHat: player.hasLandlordHat,
      graduationCapColor: player.graduationCapColor,
      careerBadge: player.careerBadge,
      hasSubmittedFormula: player.hasSubmittedFormula,
      luckCardCount: player.luckCards.length,
      // Only reveal own Success Formula — never others'
      successFormula: socketId === requestingSocketId ? player.successFormula : null,
      // Phase 6 location flags
      inHospital: player.inHospital,
      inJapan: player.inJapan,
      isDoctor: player.isDoctor,
      isCop: player.isCop
    };
  }

  return {
    roomId: room.id,
    hostSocketId: room.hostSocketId,
    players: playersSnapshot,
    turnOrder: room.turnOrder,
    currentTurnIndex: room.currentTurnIndex,
    currentTurnPlayer: room.turnOrder[room.currentTurnIndex] ?? null,
    gamePhase: room.gamePhase,
    turnPhase: room.turnPhase,
    sharedResources: {
      lotteryPool: room.sharedResources.lotteryPool,
    },
    turnHistory: room.turnHistory,
    propertyOwners: Object.fromEntries(room.propertyOwners),
    timestamp: Date.now()
  };
}

// ── Win condition check ────────────────────────────────────────────────────

export function checkWinCondition(player: Player, room: GameRoom): boolean {
  if (!player.successFormula) return false;
  const lifeTotal = player.fame + player.happiness + Math.floor(player.money / 10000);
  if (lifeTotal < 60) return false;

  // Check formula satisfaction
  // successFormula.money is a point allocation (0-60), represents MoneyPoints needed
  // successFormula.fame is Fame points needed
  // successFormula.happiness is Happiness points needed
  const moneyPoints = Math.floor(player.money / 10000);
  const formulaMoneyOk = moneyPoints >= player.successFormula.money;
  const formulaFameOk = player.fame >= player.successFormula.fame;
  const formulaHappinessOk = player.happiness >= player.successFormula.happiness;

  return formulaMoneyOk && formulaFameOk && formulaHappinessOk;
}

// ── Phase 6: Hospital helpers ──────────────────────────────────────────────

/**
 * Check if a player's HP has dropped to 0 or below, and if so,
 * move them to Hospital (Tile 30) immediately.
 * Call this after any HP-modifying operation.
 */
function checkHpAndHospitalize(player: Player, room: GameRoom, roomCode: string): void {
  if (player.hp <= 0) {
    player.hp = 0;
    player.inHospital = true;
    player.inJapan = false;
    player.inPrison = false;
    player.position = 30;
    io.to(roomCode).emit('hospital-entered', {
      playerName: player.name,
      reason: 'hp_zero',
      newHp: 0
    });
  }
}

/**
 * Alias for checkHpAndHospitalize — called by hospital tests as handleHpCheck.
 * Only triggers if hp <= 0.
 */
function handleHpCheck(room: GameRoom, roomCode: string, playerId: string): void {
  const player = room.players.get(playerId);
  if (!player) return;
  checkHpAndHospitalize(player, room, roomCode);
}

/**
 * Hospital turn handler: roll 1d6.
 * - Roll 1–5 (≤ 5): escape — inHospital=false, +5 HP, pay Math.floor(salary/2) to Doctor or Banker.
 * - Roll 6: stay — emit 'hospital-stayed', call advanceTurn.
 * Call this inside roll-dice when player.inHospital is true.
 */
function handleHospitalEscape(room: GameRoom, roomCode: string, playerId: string): void {
  const player = room.players.get(playerId);
  if (!player) return;

  const escapeRoll = Math.floor(Math.random() * 6) + 1;

  if (escapeRoll <= 5) {
    // ESCAPE
    player.inHospital = false;
    player.hp += 5;
    const payment = Math.floor(player.salary / 2);
    player.money -= payment;

    // Route payment to Doctor if one exists, else Banker
    const doctorPlayer = Array.from(room.players.values()).find(p => p.isDoctor === true);
    let recipientRole: string;
    if (doctorPlayer) {
      doctorPlayer.money += payment;
      recipientRole = 'Doctor';
    } else {
      recipientRole = 'Banker';
    }

    io.to(roomCode).emit('hospital-escaped', {
      playerName: player.name,
      escapeRoll,
      hpGained: 5,
      payment,
      recipientRole,
      newHp: player.hp,
      newMoney: player.money
    });

    advanceTurn(room, roomCode, playerId, player.name, escapeRoll, player.position, player.position, 'HOSPITAL_ESCAPE');
  } else {
    // STAY
    io.to(roomCode).emit('hospital-stayed', {
      playerName: player.name,
      escapeRoll,
      message: 'Roll was 6 — patient stays in hospital'
    });

    advanceTurn(room, roomCode, playerId, player.name, escapeRoll, player.position, player.position, 'HOSPITAL_STAY');
  }
}

// ── Phase 6: Prison helpers ────────────────────────────────────────────────

/**
 * Prison turn handler: roll 2d6.
 * - Roll ∈ {9, 11, 12}: escape — inPrison=false, position=11.
 * - Any other roll: stay — emit 'prison-stayed', call advanceTurn.
 * Call this inside roll-dice when player.inPrison is true.
 */
function handlePrisonEscape(room: GameRoom, roomCode: string, playerId: string): void {
  const player = room.players.get(playerId);
  if (!player) return;

  const pd1 = Math.floor(Math.random() * 6) + 1;
  const pd2 = Math.floor(Math.random() * 6) + 1;
  const prisonRoll = pd1 + pd2;

  if (prisonRoll === 9 || prisonRoll === 11 || prisonRoll === 12) {
    // ESCAPE
    player.inPrison = false;
    player.prisonTurns = 0;
    player.position = 11; // Prison Exit — Opportunity Knocks tile after Prison
    io.to(roomCode).emit('prison-escaped', {
      playerName: player.name,
      roll: prisonRoll,
      method: 'roll',
      newPosition: 11
    });
    advanceTurn(room, roomCode, playerId, player.name, prisonRoll, 10, 11, 'PRISON_ESCAPE');
  } else {
    // STAY
    player.prisonTurns += 1;
    io.to(roomCode).emit('prison-stayed', {
      playerName: player.name,
      roll: prisonRoll,
      message: `Roll was ${prisonRoll} — not in {9, 11, 12}, staying in prison`,
      turnsServed: player.prisonTurns
    });
    advanceTurn(room, roomCode, playerId, player.name, prisonRoll, player.position, player.position, 'PRISON_STAY');
  }
}

/**
 * Prison bail handler: player pays $5,000 to leave prison immediately.
 * Deducts $5,000, sets inPrison=false, moves to Tile 11.
 */
function handlePrisonBail(room: GameRoom, roomCode: string, playerId: string): void {
  const player = room.players.get(playerId);
  if (!player) return;

  const BAIL_AMOUNT = 5000;
  player.money -= BAIL_AMOUNT;
  player.inPrison = false;
  player.prisonTurns = 0;
  player.position = 11; // Prison Exit

  io.to(roomCode).emit('prison-escaped', {
    playerName: player.name,
    method: 'bail',
    bailAmount: BAIL_AMOUNT,
    newMoney: player.money,
    newPosition: 11
  });
  advanceTurn(room, roomCode, playerId, player.name, 0, 10, 11, 'PRISON_BAIL');
}

// ── Phase 6: Card-play guard ───────────────────────────────────────────────

/**
 * Returns false if a player cannot play cards (in Hospital or Japan Trip).
 * Prison does NOT block card play (per PRISON-03).
 * Returns true if card play is allowed.
 */
function canPlayCard(room: GameRoom, roomCode: string, playerId: string): boolean {
  const player = room.players.get(playerId);
  if (!player) return false;

  if (player.inHospital || player.inJapan) {
    io.to(roomCode).emit('error', { message: 'Cannot play cards in Hospital or Japan Trip' });
    return false;
  }
  return true;
}

// ── Phase 6: Japan Trip helpers ────────────────────────────────────────────

/**
 * Japan Trip turn-start handler.
 * Called at the start of a turn for a player who is inJapan.
 * - Applies +2 Happiness and Math.ceil(salary/5) drain.
 * - Rolls 2d6:
 *   - Roll >= 9: forced leave → position advances to position+1, inJapan=false, dispatchTile.
 *   - Roll < 9:  emit 'japan-stay-choice' to player socket; turn pauses for response.
 */
function handleJapanTurnStart(room: GameRoom, roomCode: string, playerId: string): void {
  const player = room.players.get(playerId);
  if (!player) return;

  // Apply happiness and drain
  player.happiness += 2;
  const drain = Math.ceil(player.salary / 5);
  player.money -= drain;

  // Roll 2d6 for forced leave check
  const jd1 = Math.floor(Math.random() * 6) + 1;
  const jd2 = Math.floor(Math.random() * 6) + 1;
  const japanRoll = jd1 + jd2;

  if (japanRoll >= 9) {
    // FORCED LEAVE
    player.inJapan = false;
    player.position = (player.position + 1) % BOARD_SIZE;

    io.to(roomCode).emit('japan-forced-leave', {
      playerName: player.name,
      roll: japanRoll,
      newPosition: player.position,
      happinessGained: 2,
      costPaid: drain
    });

    // Dispatch the new tile, then normal turn advance happens inside dispatchTile → advanceTurn
    dispatchTile(room, roomCode, playerId, player.position, japanRoll, 20);
  } else {
    // STAY CHOICE — roll <= 8, player can choose
    room.turnPhase = TURN_PHASES.TILE_RESOLVING;
    io.sockets.sockets.get(playerId)?.emit('japan-stay-choice', {
      playerName: player.name,
      roll: japanRoll,
      happinessGained: 2,
      costPaid: drain
    });
    // Turn is paused — waiting for 'japan-stay' or 'japan-leave' socket event
  }
}

// ── Phase 6: Goomba Stomp helper ───────────────────────────────────────────

/**
 * Check for Goomba Stomp after a player moves to newPos.
 * Finds all other players on the same tile and sends them to:
 *   - Japan Trip (Tile 20) if stomper is NOT a Cop.
 *   - Prison (Tile 10) if stomper IS a Cop.
 * Returns the array of stomped players (for testability).
 */
function checkGoombaStomp(room: GameRoom, roomCode: string, stomperId: string): Player[] {
  const stomper = room.players.get(stomperId);
  if (!stomper) return [];

  const stompTargets = Array.from(room.players.values())
    .filter(p => p.socketId !== stomperId && p.position === stomper.position);

  if (stompTargets.length > 0) {
    for (const target of stompTargets) {
      target.inHospital = false;
      target.inJapan = false;
      target.inPrison = false;

      if (stomper.isCop) {
        target.position = 10; // PRISON_TILE
        target.inPrison = true;
        target.prisonTurns = 0;
      } else {
        target.position = 20; // JAPAN_TRIP_TILE
        target.inJapan = true;
      }
    }

    io.to(roomCode).emit('goomba-stomped', {
      stomperName: stomper.name,
      stompedNames: stompTargets.map(t => t.name),
      isCopStomp: stomper.isCop ?? false,
      destination: stomper.isCop ? 10 : 20
    });
  }

  return stompTargets;
}

// ── Heartbeat state ────────────────────────────────────────────────────────
const socketLastPong = new Map<string, number>();

const HEARTBEAT_INTERVAL_MS = 30000;
const HEARTBEAT_TIMEOUT_MS  = 60000;

// ── Game loop helpers ──────────────────────────────────────────────────────

function applyDrains(room: GameRoom, roomCode: string): void {
  const currentPlayerId = room.turnOrder[room.currentTurnIndex];
  const player = room.players.get(currentPlayerId);
  if (!player) return;

  const deductions: { type: string; amount: number }[] = [];
  let totalDeduction = 0;

  if (player.isMarried) {
    deductions.push({ type: 'marriage', amount: 2000 });
    totalDeduction += 2000;
  }
  if (player.kids > 0) {
    deductions.push({ type: 'kids', amount: player.kids * 1000 });
    totalDeduction += player.kids * 1000;
  }
  if (player.hasStudentLoans) {
    deductions.push({ type: 'student_loans', amount: 1000 });
    totalDeduction += 1000;
  }

  if (deductions.length === 0) return;

  player.money = Math.max(0, player.money - totalDeduction);
  io.to(roomCode).emit('drains-applied', {
    playerId: currentPlayerId,
    deductions,
    newMoney: player.money
  });
}

function advanceTurn(
  room: GameRoom,
  roomCode: string,
  prevPlayerId: string,
  prevPlayerName: string,
  roll: number,
  fromPosition: number,
  toPosition: number,
  tileType: string
): void {
  // Record turn history entry
  const entry = {
    turnNumber: room.turnHistory.length + 1,
    playerId: prevPlayerId,
    playerName: prevPlayerName,
    roll,
    fromPosition,
    toPosition,
    tileType,
    timestamp: Date.now()
  };
  room.turnHistory.push(entry);
  if (room.turnHistory.length > 10) room.turnHistory.shift();

  // Advance to next player
  room.currentTurnIndex = (room.currentTurnIndex + 1) % room.turnOrder.length;
  room.turnPhase = TURN_PHASES.WAITING_FOR_ROLL;

  // Apply drains to the new current player before they roll
  applyDrains(room, roomCode);

  const nextPlayerId = room.turnOrder[room.currentTurnIndex];
  const nextPlayer = room.players.get(nextPlayerId);

  // Phase 6: Japan Trip turn-start — if next player is inJapan, handle their Japan turn
  if (nextPlayer && nextPlayer.inJapan) {
    handleJapanTurnStart(room, roomCode, nextPlayerId);
    return; // Japan turn-start handles its own flow (emit/dispatch)
  }

  // Check skipNextTurn for new current player
  if (nextPlayer && nextPlayer.skipNextTurn) {
    nextPlayer.skipNextTurn = false;
    io.to(roomCode).emit('turnSkipped', {
      playerId: nextPlayerId,
      playerName: nextPlayer.name,
      reason: 'burnout'
    });
    // Recurse to advance again (skip counts as a turn used)
    advanceTurn(room, roomCode, nextPlayerId, nextPlayer.name, 0, nextPlayer.position, nextPlayer.position, 'SKIPPED');
    return;
  }

  io.to(roomCode).emit('nextTurn', {
    currentTurnIndex: room.currentTurnIndex,
    currentPlayer: nextPlayerId,
    currentPlayerName: nextPlayer?.name ?? '',
    turnNumber: room.turnHistory.length + 1
  });

  // Broadcast full state after every turn so clients can update stat grids immediately
  io.to(roomCode).emit('gameState', getFullState(room));
}


function dispatchTile(
  room: GameRoom,
  roomCode: string,
  playerId: string,
  tileIndex: number,
  roll: number,
  fromPosition: number
): void {
  const tile = BOARD_TILES[tileIndex];
  const tileType = tile?.type ?? 'UNKNOWN';
  const tileName = tile?.name ?? 'Unknown';
  const player = room.players.get(playerId);
  if (!player) return;

  room.turnPhase = TURN_PHASES.TILE_RESOLVING;
  console.log(`[tile] ${player.name} landed on ${tileType} (${tileName}) at index ${tileIndex}`);

  switch (tileType) {
    case 'SPORTS_BETTING': {
      // Phase 5: buy parlay for 10,000. Roll 1d6: 1 → gain 60,000; else → lose 10,000 stake
      const sbStake = 10000;
      player.money -= sbStake; // pay stake (negative allowed)
      const sbRoll = Math.floor(Math.random() * 6) + 1;
      if (sbRoll === 1) {
        player.money += 60000; // win 6× = 60,000
      }
      io.to(roomCode).emit('tile-sports-betting', {
        playerName: player.name,
        stake: sbStake,
        roll: sbRoll,
        won: sbRoll === 1,
        winAmount: sbRoll === 1 ? 60000 : 0,
        newMoney: player.money
      });
      advanceTurn(room, roomCode, playerId, player.name, roll, fromPosition, tileIndex, 'SPORTS_BETTING');
      break;
    }

    case 'COVID_STIMULUS': {
      // Phase 5 stub: mechanic changes to HP→cash trade in Phase 10
      // Full mechanic: player trades HP for 10,000 per HP spent
      console.log(`[tile] ${player.name} landed on COVID Stimulus (stub)`);
      advanceTurn(room, roomCode, playerId, player.name, roll, fromPosition, tileIndex, 'COVID_STIMULUS');
      break;
    }

    case 'NEPOTISM': {
      // ECON-07: current player gains $1,000; chooses another player who receives $500
      player.money += 1000;
      const otherPlayers = Array.from(room.players.values())
        .filter(p => p.socketId !== playerId)
        .map(p => ({ socketId: p.socketId, name: p.name }));
      io.sockets.sockets.get(playerId)?.emit('nepotism-choose-beneficiary', {
        otherPlayers,
        benefactorName: player.name,
        benefactorNewMoney: player.money
      });
      room.turnPhase = TURN_PHASES.TILE_RESOLVING;
      break;
    }

    case 'JAPAN_TRIP': {
      // Phase 6: Landing on Japan Trip — +1 Happiness, set inJapan=true
      player.happiness += 1;
      player.inJapan = true;
      player.inHospital = false;
      player.inPrison = false;
      io.to(roomCode).emit('japan-landed', {
        playerName: player.name,
        happinessGained: 1,
        newHappiness: player.happiness
      });
      advanceTurn(room, roomCode, playerId, player.name, roll, fromPosition, tileIndex, 'JAPAN_TRIP');
      break;
    }

    case 'PRISON': {
      // Phase 6: Landing on Prison — Cop immunity check
      if (player.isCop) {
        // Cops are immune to Prison — take fine/HP instead (stub for now; no fine yet)
        io.to(roomCode).emit('prison-cop-immune', {
          playerName: player.name,
          message: 'Cop is immune to Prison'
        });
        advanceTurn(room, roomCode, playerId, player.name, roll, fromPosition, tileIndex, 'PRISON_COP_IMMUNE');
      } else {
        // Normal player: enter prison
        player.inPrison = true;
        player.prisonTurns = 0;
        player.inHospital = false;
        player.inJapan = false;
        io.to(roomCode).emit('prison-entered', {
          playerName: player.name,
          position: tileIndex
        });
        advanceTurn(room, roomCode, playerId, player.name, roll, fromPosition, tileIndex, 'PRISON_ENTERED');
      }
      break;
    }

    case 'HOSPITAL': {
      // Phase 6: Landing on Hospital tile (e.g. moved here due to HP = 0)
      // Player is already flagged inHospital=true by checkHpAndHospitalize
      // This case handles direct landing (no HP-zero trigger) — just advance turn
      io.to(roomCode).emit('hospital-entered', {
        playerName: player.name,
        reason: 'landed',
        newHp: player.hp
      });
      advanceTurn(room, roomCode, playerId, player.name, roll, fromPosition, tileIndex, 'HOSPITAL');
      break;
    }

    case 'OPPORTUNITY_KNOCKS':
    case 'PAY_TAXES':
    case 'STUDENT_LOAN_REDIRECT':
    case 'CIGARETTE_BREAK':
    case 'UNIVERSITY':
    case 'MCDONALDS':
    case 'FINANCE_BRO':
    case 'ART_GALLERY':
    case 'SUPPLY_TEACHER':
    case 'GYM_MEMBERSHIP':
    case 'COP':
    case 'LOTTERY':
    case 'DEI_OFFICER':
    case 'REVOLUTION':
    case 'TECH_BRO':
    case 'RIGHT_WING_GRIFTER':
    case 'OZEMPIC':
    case 'STARVING_ARTIST':
    case 'YACHT_HARBOR':
    case 'INSTAGRAM_FOLLOWERS':
    case 'STREAMER': {
      // Phase 5 stub: no effect yet — full mechanics in Phases 6–10
      console.log(`[tile] ${player.name} landed on ${tileName} (stub)`);
      advanceTurn(room, roomCode, playerId, player.name, roll, fromPosition, tileIndex, tileType);
      break;
    }

    case 'PAYDAY':
    case 'APARTMENT':
    case 'HOUSE':
    default:
      advanceTurn(room, roomCode, playerId, player.name, roll, fromPosition, tileIndex, tileType);
      break;
  }
}

// ── Connection handler ─────────────────────────────────────────────────────
io.on('connection', (socket) => {
  connectedSockets.add(socket.id);
  console.log(`[connect]  ${socket.id}  (total: ${connectedSockets.size})`);

  socketLastPong.set(socket.id, Date.now());

  socket.emit('connected', { socketId: socket.id });

  socket.on('pong', () => {
    const roomCode = findRoomCodeBySocketId(socket.id);
    if (roomCode) {
      const room = getRoom(roomCode);
      if (room) {
        const player = room.players.get(socket.id);
        if (player) {
          player.lastPong = Date.now();
        }
      }
    }
    socketLastPong.set(socket.id, Date.now());
  });

  socket.on('requestSync', ({ roomCode }: { roomCode: string }) => {
    const room = getRoom(roomCode);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    socket.emit('gameState', getFullState(room, socket.id));
  });

  socket.on('create-room', () => {
    if (!checkRateLimit(socket.id, 'create-room')) return;

    const roomCode = generateRoomCode();
    const room = createGameRoom(roomCode, socket.id);
    setRoom(roomCode, room);
    socket.join(roomCode);

    socket.emit('roomCreated', { roomCode, hostSocketId: socket.id });
    console.log(`[create-room] ${roomCode} created by ${socket.id}`);
  });

  socket.on('join-room', ({ roomCode, playerName }: { roomCode: string; playerName: string }) => {
    if (!checkRateLimit(socket.id, 'join-room')) return;

    const code = (roomCode ?? '').trim().toUpperCase();
    const room = getRoom(code);

    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    if (room.gamePhase !== GAME_PHASES.LOBBY) {
      socket.emit('error', { message: 'Game already in progress' });
      return;
    }
    if (room.players.size >= 6) {
      socket.emit('error', { message: 'Room is full (max 6 players)' });
      return;
    }

    const trimmed = (playerName ?? '').trim();
    if (!trimmed || trimmed.length < 1 || trimmed.length > 20 || !/^[a-zA-Z0-9 ]+$/.test(trimmed)) {
      socket.emit('error', { message: 'Name must be 1-20 alphanumeric characters (spaces OK)' });
      return;
    }
    const lower = trimmed.toLowerCase();
    const isDup = Array.from(room.players.values()).some(p => p.name.toLowerCase() === lower);
    if (isDup) {
      socket.emit('error', { message: 'Name already taken in this room' });
      return;
    }

    const player = createPlayer(socket.id, trimmed, false);
    room.players.set(socket.id, player);
    socket.join(code);
    cancelCleanup(code);

    const playerList = Array.from(room.players.values()).map(p => ({
      name: p.name,
      hasSubmittedFormula: p.hasSubmittedFormula
    }));

    io.to(code).emit('playerJoined', {
      playerName: trimmed,
      connectedCount: room.players.size,
      playerList
    });

    socket.emit('roomState', getFullState(room, socket.id));
    console.log(`[join-room] ${trimmed} joined ${code} (${room.players.size} players)`);
  });

  socket.on('submit-formula', ({ money, fame, happiness }: { money: unknown; fame: unknown; happiness: unknown }) => {
    if (!checkRateLimit(socket.id, 'submit-formula')) return;

    const roomCode = findRoomCodeBySocketId(socket.id);
    if (!roomCode) { socket.emit('error', { message: 'You are not in a room' }); return; }

    const room = getRoom(roomCode);
    if (!room) { socket.emit('error', { message: 'Room was deleted' }); return; }

    const player = room.players.get(socket.id);
    if (!player) { socket.emit('error', { message: 'You are not in this room' }); return; }

    if (!isValidFormula({ money, fame, happiness })) {
      const sum = typeof money === 'number' && typeof fame === 'number' && typeof happiness === 'number'
        ? money + fame + happiness : 'invalid';
      socket.emit('error', { message: `Formula must sum to exactly 60 (received: ${sum})` });
      return;
    }

    // Store server-side — NEVER broadcast these values
    player.successFormula = { money: money as number, fame: fame as number, happiness: happiness as number };
    player.hasSubmittedFormula = true;

    const submittedCount = Array.from(room.players.values()).filter(p => p.hasSubmittedFormula).length;

    io.to(roomCode).emit('formulaSubmitted', {
      playerName: player.name,
      submittedCount,
      totalPlayerCount: room.players.size
    });

    socket.emit('formulaAccepted', { message: 'Your Success Formula has been set' });
    console.log(`[submit-formula] ${player.name} in ${roomCode} (${submittedCount}/${room.players.size})`);
  });

  socket.on('start-game', () => {
    const roomCode = findRoomCodeBySocketId(socket.id);
    if (!roomCode) { socket.emit('error', { message: 'You are not in a room' }); return; }

    const room = getRoom(roomCode);
    if (!room) { socket.emit('error', { message: 'Room was deleted' }); return; }

    if (room.hostSocketId !== socket.id) {
      socket.emit('error', { message: 'Only the host can start the game' });
      return;
    }
    if (room.players.size < 2) {
      socket.emit('error', { message: `Need at least 2 players (currently ${room.players.size})` });
      return;
    }

    const notReady = Array.from(room.players.values()).filter(p => !p.hasSubmittedFormula);
    if (notReady.length > 0) {
      socket.emit('error', {
        message: `Waiting for ${notReady.length} player(s) to submit formula: ${notReady.map(p => p.name).join(', ')}`
      });
      return;
    }

    // Fisher-Yates shuffle
    const playerIds = Array.from(room.players.keys());
    const turnOrder = playerIds.sort(() => Math.random() - 0.5);

    room.gamePhase = GAME_PHASES.PLAYING;
    room.turnOrder = turnOrder;
    room.currentTurnIndex = 0;
    room.startedAt = Date.now();

    const firstId = turnOrder[0];

    io.to(roomCode).emit('gameStarted', {
      gamePhase: GAME_PHASES.PLAYING,
      turnOrder: turnOrder.map(id => room.players.get(id)!.name),
      currentPlayerName: room.players.get(firstId)!.name,
      currentPlayerSocketId: firstId,
      players: Array.from(room.players.values()).map(p => ({
        socketId: p.socketId,
        name: p.name,
        position: 0,
        money: STARTING_MONEY,
        fame: 0,
        happiness: 0
        // successFormula intentionally omitted
      })),
      boardTiles: BOARD_TILES,
      timestamp: Date.now()
    });

    console.log(`[start-game] ${roomCode} started. Order: ${turnOrder.map(id => room.players.get(id)!.name).join(' => ')}`);
  });

  // ── Game loop socket handlers ────────────────────────────────────────────

  socket.on('roll-dice', () => {
    if (!checkRateLimit(socket.id, 'roll-dice')) return;

    const roomCode = findRoomCodeBySocketId(socket.id);
    if (!roomCode) { socket.emit('error', { message: 'You are not in a room' }); return; }

    const room = getRoom(roomCode);
    if (!room) { socket.emit('error', { message: 'Room was deleted' }); return; }

    if (room.gamePhase !== GAME_PHASES.PLAYING) {
      socket.emit('error', { message: 'Game is not in progress' }); return;
    }

    const currentPlayerId = room.turnOrder[room.currentTurnIndex];
    if (socket.id !== currentPlayerId) {
      socket.emit('error', { message: 'Not your turn' }); return;
    }

    if (room.turnPhase !== TURN_PHASES.WAITING_FOR_ROLL) {
      socket.emit('error', { message: 'Cannot roll now' }); return;
    }

    const player = room.players.get(socket.id)!;

    // Handle skipNextTurn flag — skip movement but still advance turn
    if (player.skipNextTurn) {
      player.skipNextTurn = false;
      io.to(roomCode).emit('turnSkipped', {
        playerId: socket.id,
        playerName: player.name,
        reason: 'burnout'
      });
      advanceTurn(room, roomCode, socket.id, player.name, 0, player.position, player.position, 'SKIPPED');
      return;
    }

    // Phase 6: Hospital intercept — roll 1d6 to escape instead of normal movement
    if (player.inHospital) {
      handleHospitalEscape(room, roomCode, socket.id);
      return;
    }

    // Phase 6: Prison intercept — roll 2d6 to escape instead of normal movement
    if (player.inPrison) {
      handlePrisonEscape(room, roomCode, socket.id);
      return;
    }

    // Server-authoritative 2d6 roll (main board; 1d6 for career paths deferred to Phase 7)
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    const roll = d1 + d2;

    const fromPosition = player.position;
    const newPos = (fromPosition + roll) % BOARD_SIZE;
    player.position = newPos;

    // Phase 6: Goomba Stomp check — after position update, before dispatchTile
    checkGoombaStomp(room, roomCode, socket.id);

    room.turnPhase = TURN_PHASES.MID_ROLL;

    io.to(roomCode).emit('move-token', {
      playerId: socket.id,
      playerName: player.name,
      roll,
      d1,
      d2,
      fromPosition,
      toPosition: newPos
    });

    room.turnPhase = TURN_PHASES.LANDED;

    io.to(roomCode).emit('tile-landed', {
      playerId: socket.id,
      tileIndex: newPos,
      tileType: BOARD_TILES[newPos].type,
      tileName: BOARD_TILES[newPos].name
    });

    console.log(`[roll-dice] ${player.name} rolled ${roll} (${d1}+${d2}): pos ${fromPosition} → ${newPos} (${BOARD_TILES[newPos].name})`);

    dispatchTile(room, roomCode, socket.id, newPos, roll, fromPosition);
  });

  socket.on('nepotism-select', ({ chosenPlayerId }: { chosenPlayerId: string }) => {
    const roomCode = findRoomCodeBySocketId(socket.id);
    if (!roomCode) { socket.emit('error', { message: 'You are not in a room' }); return; }
    const room = getRoom(roomCode);
    if (!room) { socket.emit('error', { message: 'Room was deleted' }); return; }
    if (room.gamePhase !== GAME_PHASES.PLAYING) { socket.emit('error', { message: 'Game is not in progress' }); return; }
    if (room.turnPhase !== TURN_PHASES.TILE_RESOLVING) { socket.emit('error', { message: 'No nepotism pending' }); return; }
    const currentPlayerId = room.turnOrder[room.currentTurnIndex];
    if (socket.id !== currentPlayerId) { socket.emit('error', { message: 'Not your turn' }); return; }
    if (chosenPlayerId === socket.id) { socket.emit('error', { message: 'Cannot choose yourself as beneficiary' }); return; }
    const beneficiary = room.players.get(chosenPlayerId);
    if (!beneficiary) { socket.emit('error', { message: 'Chosen player not found in room' }); return; }
    const benefactor = room.players.get(socket.id)!;
    beneficiary.money += 500;
    io.to(roomCode).emit('tile-nepotism-completed', {
      benefactorName: benefactor.name, benefactorNewMoney: benefactor.money,
      beneficiaryName: beneficiary.name, beneficiaryNewMoney: beneficiary.money
    });
    advanceTurn(room, roomCode, socket.id, benefactor.name, 0, benefactor.position, benefactor.position, 'NEPOTISM');
  });

  // Phase 6: Prison bail payment handler
  socket.on('prison-bail', () => {
    const roomCode = findRoomCodeBySocketId(socket.id);
    if (!roomCode) { socket.emit('error', { message: 'You are not in a room' }); return; }
    const room = getRoom(roomCode);
    if (!room) { socket.emit('error', { message: 'Room was deleted' }); return; }
    const player = room.players.get(socket.id);
    if (!player) { socket.emit('error', { message: 'You are not in this room' }); return; }
    if (!player.inPrison) { socket.emit('error', { message: 'You are not in prison' }); return; }
    handlePrisonBail(room, roomCode, socket.id);
  });

  // Phase 6: Japan Trip — player chooses to stay
  socket.on('japan-stay', () => {
    const roomCode = findRoomCodeBySocketId(socket.id);
    if (!roomCode) { socket.emit('error', { message: 'You are not in a room' }); return; }
    const room = getRoom(roomCode);
    if (!room) { socket.emit('error', { message: 'Room was deleted' }); return; }
    const player = room.players.get(socket.id);
    if (!player) { socket.emit('error', { message: 'You are not in this room' }); return; }
    if (!player.inJapan) { socket.emit('error', { message: 'You are not in Japan Trip' }); return; }
    // Player stays — inJapan remains true, just advance the turn
    advanceTurn(room, roomCode, socket.id, player.name, 0, player.position, player.position, 'JAPAN_STAY');
  });

  // Phase 6: Japan Trip — player chooses to leave
  socket.on('japan-leave', () => {
    const roomCode = findRoomCodeBySocketId(socket.id);
    if (!roomCode) { socket.emit('error', { message: 'You are not in a room' }); return; }
    const room = getRoom(roomCode);
    if (!room) { socket.emit('error', { message: 'Room was deleted' }); return; }
    const player = room.players.get(socket.id);
    if (!player) { socket.emit('error', { message: 'You are not in this room' }); return; }
    if (!player.inJapan) { socket.emit('error', { message: 'You are not in Japan Trip' }); return; }
    // Player leaves — advance position and dispatch new tile
    player.inJapan = false;
    player.position = (player.position + 1) % BOARD_SIZE;
    io.to(roomCode).emit('japan-left', {
      playerName: player.name,
      newPosition: player.position
    });
    dispatchTile(room, roomCode, socket.id, player.position, 0, 20);
  });

  socket.on('disconnect', (reason: string) => {
    clearRateLimitState(socket.id);
    socketLastPong.delete(socket.id);
    connectedSockets.delete(socket.id);
    console.log(`[disconnect] ${socket.id} — ${reason}  (total: ${connectedSockets.size})`);

    const roomCode = findRoomCodeBySocketId(socket.id);
    if (!roomCode) return;

    const room = getRoom(roomCode);
    if (!room) return;

    const player = room.players.get(socket.id);
    const playerName = player ? player.name : 'Unknown';

    room.players.delete(socket.id);

    if (room.players.size === 0) {
      room.cleanupTimer = setTimeout(() => {
        const currentRoom = getRoom(roomCode);
        if (currentRoom && currentRoom.players.size === 0) {
          deleteRoom(roomCode);
          console.log(`[cleanup] Room ${roomCode} deleted after 30-minute timeout`);
        }
      }, 30 * 60 * 1000);
    } else {
      io.to(roomCode).emit('playerLeft', {
        socketId: socket.id,
        playerName,
        remainingPlayers: room.players.size,
        playerList: Array.from(room.players.values()).map(p => ({
          name: p.name,
          hasSubmittedFormula: p.hasSubmittedFormula
        })),
        timestamp: Date.now()
      });
      io.to(roomCode).emit('gameState', getFullState(room));
    }
  });
});

// ── Periodic full-state broadcast (every 30s) ─────────────────────────────
const STATE_BROADCAST_INTERVAL = setInterval(() => {
  for (const [roomCode, room] of rooms) {
    if (room.players.size > 0) {
      io.to(roomCode).emit('gameState', getFullState(room));
    }
  }
}, 10000);

STATE_BROADCAST_INTERVAL.unref();

// ── Heartbeat loop (every 30s) ────────────────────────────────────────────
const HEARTBEAT_LOOP = setInterval(() => {
  const now = Date.now();

  for (const [socketId, socket] of io.sockets.sockets) {
    socket.emit('ping');

    const lastPong = socketLastPong.get(socketId) ?? 0;
    if (now - lastPong > HEARTBEAT_TIMEOUT_MS) {
      console.log(`[heartbeat] Disconnecting zombie socket ${socketId} (no pong for ${HEARTBEAT_TIMEOUT_MS}ms)`);
      socket.disconnect(true);
    }
  }
}, HEARTBEAT_INTERVAL_MS);

HEARTBEAT_LOOP.unref();

// ── Start ──────────────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`Modern Careers server running on http://localhost:${PORT}`);
});

// ── Exports (used by tests) ────────────────────────────────────────────────
export {
  app, httpServer, io, rooms, connectedSockets,
  generateRoomCode, getRoom, setRoom, deleteRoom, findRoomCodeBySocketId, cancelCleanup,
  createPlayer, createGameRoom,
  GAME_PHASES, TURN_PHASES, STARTING_MONEY,
  getFullState,
  RATE_LIMITS, checkRateLimit, clearRateLimitState, rateLimitState,
  socketLastPong, HEARTBEAT_INTERVAL_MS, HEARTBEAT_TIMEOUT_MS,
  isValidPlayerName, isValidFormula, canStartGame,
  applyDrains, advanceTurn, dispatchTile,
  // Phase 6 exports
  handleHospitalEscape, handlePrisonBail, handlePrisonEscape,
  handleJapanTurnStart, checkGoombaStomp, canPlayCard,
  checkHpAndHospitalize, handleHpCheck
};


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
  // Board position
  position: number;
  // Status flags
  inPrison: boolean;
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
  // Heartbeat
  lastPong: number;
}

export interface SharedResources {
  investmentPool: number;
  cryptoInvestments: Map<string, number>;
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
  WAITING_FOR_NEXT_TURN: 'WAITING_FOR_NEXT_TURN'
} as const;

const STARTING_MONEY = 50000;

// ── Board definition ───────────────────────────────────────────────────────

export const BOARD_SIZE = 40;

export const BOARD_TILES: Array<{ type: string; name: string; careerName?: string }> = [
  { type: 'PAYDAY',          name: 'Payday' },                                             // 0  — corner
  { type: 'CAREER_ENTRANCE', name: 'Tech Bro',             careerName: 'techBro' },        // 1
  { type: 'OPPORTUNITY',     name: 'Opportunity',          careerName: 'techBro' },        // 2
  { type: 'TBD',             name: 'TBD...' },                                             // 3
  { type: 'CAREER_ENTRANCE', name: 'Finance Bro',          careerName: 'financeBro' },     // 4
  { type: 'APARTMENT',       name: 'Apartment' },                                          // 5
  { type: 'OPPORTUNITY',     name: 'Opportunity',          careerName: 'financeBro' },     // 6
  { type: 'TBD',             name: 'TBD...' },                                             // 7
  { type: 'CAREER_ENTRANCE', name: 'Healthcare Hero',      careerName: 'healthcare' },     // 8
  { type: 'OPPORTUNITY',     name: 'Opportunity',          careerName: 'healthcare' },     // 9
  { type: 'PRISON',          name: 'Prison' },                                             // 10 — corner
  { type: 'CAREER_ENTRANCE', name: 'Disillusioned Academic', careerName: 'academic' },    // 11
  { type: 'OPPORTUNITY',     name: 'Opportunity',          careerName: 'academic' },       // 12
  { type: 'TBD',             name: 'TBD...' },                                             // 13
  { type: 'CAREER_ENTRANCE', name: 'Streamer',             careerName: 'streamer' },       // 14
  { type: 'TBD',             name: 'TBD...' },                                             // 15
  { type: 'OPPORTUNITY',     name: 'Opportunity',          careerName: 'streamer' },       // 16
  { type: 'TBD',             name: 'TBD...' },                                             // 17
  { type: 'CAREER_ENTRANCE', name: "McDonald's Employee",  careerName: 'mcdonalds' },      // 18
  { type: 'OPPORTUNITY',     name: 'Opportunity',          careerName: 'mcdonalds' },      // 19
  { type: 'PARK_BENCH',      name: 'Park Bench' },                                         // 20 — corner
  { type: 'CAREER_ENTRANCE', name: 'Right-Wing Grifter',   careerName: 'grifter' },        // 21
  { type: 'OPPORTUNITY',     name: 'Opportunity',          careerName: 'grifter' },        // 22
  { type: 'TBD',             name: 'TBD...' },                                             // 23
  { type: 'CAREER_ENTRANCE', name: 'Cop',                  careerName: 'cop' },            // 24
  { type: 'HOUSE',           name: 'House' },                                              // 25
  { type: 'OPPORTUNITY',     name: 'Opportunity',          careerName: 'cop' },            // 26
  { type: 'TBD',             name: 'TBD...' },                                             // 27
  { type: 'CAREER_ENTRANCE', name: 'Artist',               careerName: 'artist' },         // 28
  { type: 'OPPORTUNITY',     name: 'Opportunity',          careerName: 'artist' },         // 29
  { type: 'HOSPITAL',        name: 'Hospital' },                                           // 30 — corner
  { type: 'CAREER_ENTRANCE', name: 'D&I Officer',          careerName: 'diOfficer' },      // 31
  { type: 'OPPORTUNITY',     name: 'Opportunity',          careerName: 'diOfficer' },      // 32
  { type: 'TBD',             name: 'TBD...' },                                             // 33
  { type: 'TBD',             name: 'TBD...' },                                             // 34
  { type: 'TBD',             name: 'TBD...' },                                             // 35
  { type: 'TBD',             name: 'TBD...' },                                             // 36
  { type: 'TBD',             name: 'TBD...' },                                             // 37
  { type: 'TBD',             name: 'TBD...' },                                             // 38
  { type: 'TBD',             name: 'TBD...' },                                             // 39
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
    position: 0,
    inPrison: false,
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
      investmentPool: 0,
      cryptoInvestments: new Map<string, number>()
    },
    cleanupTimer: null,
    turnHistory: [],
    createdAt: Date.now(),
    startedAt: null
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
  'roll-dice':      { maxCalls: 1,  windowMs: 3000  },
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
      position: player.position,
      inPrison: player.inPrison,
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
      successFormula: socketId === requestingSocketId ? player.successFormula : null
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
      investmentPool: room.sharedResources.investmentPool,
      cryptoInvestments: Object.fromEntries(room.sharedResources.cryptoInvestments)
    },
    turnHistory: room.turnHistory,
    timestamp: Date.now()
  };
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
    case 'PAYDAY':
    case 'PRISON':
    case 'PARK_BENCH':
    case 'HOSPITAL':
    case 'APARTMENT':
    case 'HOUSE':
    case 'CAREER_ENTRANCE':
    case 'OPPORTUNITY':
    case 'TBD':
    default:
      // Phase 3 stub: all tile types advance turn immediately.
      // Phases 4–8 replace these stubs with real handlers.
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

    // Server-authoritative 2d6 roll (main board; 1d6 for career paths deferred to Phase 7)
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    const roll = d1 + d2;

    const fromPosition = player.position;
    const newPos = (fromPosition + roll) % BOARD_SIZE;
    player.position = newPos;

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
}, 30000);

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
  console.log(`GIG server running on http://localhost:${PORT}`);
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
  applyDrains, advanceTurn, dispatchTile
};

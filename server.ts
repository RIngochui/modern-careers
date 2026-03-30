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
  socketLastPong, HEARTBEAT_INTERVAL_MS, HEARTBEAT_TIMEOUT_MS
};

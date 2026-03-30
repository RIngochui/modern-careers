'use strict';

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const compression = require('compression');
const cors = require('cors');
const path = require('path');

const PORT = process.env.PORT || 3000;

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

// ── In-memory rooms store (populated in later tasks) ──────────────────────
const rooms = new Map(); // Map<roomCode, GameRoom>

// ── Room store helpers ─────────────────────────────────────────────────────

/**
 * Generate a 4-uppercase-letter room code that is not already in use.
 * Uses crypto.randomBytes for randomness (no external dep).
 * @returns {string} e.g. "KBZQ"
 */
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code;
  do {
    code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * 26)]).join('');
  } while (rooms.has(code));
  return code;
}

/** @returns {object|undefined} */
function getRoom(roomCode) {
  return rooms.get(roomCode);
}

/** @param {object} room */
function setRoom(roomCode, room) {
  rooms.set(roomCode, room);
}

/** @returns {boolean} true if deleted */
function deleteRoom(roomCode) {
  return rooms.delete(roomCode);
}

/**
 * Find the roomCode for a given socketId.
 * Returns undefined if socket is not in any room.
 * @param {string} socketId
 * @returns {string|undefined}
 */
function findRoomCodeBySocketId(socketId) {
  for (const [code, room] of rooms) {
    if (room.players && room.players.has(socketId)) return code;
  }
  return undefined;
}

/**
 * Cancel a scheduled room cleanup (called when a player rejoins the room).
 * @param {string} roomCode
 */
function cancelCleanup(roomCode) {
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
};

const TURN_PHASES = {
  WAITING_FOR_ROLL: 'WAITING_FOR_ROLL',
  MID_ROLL: 'MID_ROLL',
  LANDED: 'LANDED',
  TILE_RESOLVING: 'TILE_RESOLVING',
  WAITING_FOR_NEXT_TURN: 'WAITING_FOR_NEXT_TURN'
};

const STARTING_MONEY = 50000;

// ── Player factory ────────────────────────────────────────────────────────

/**
 * Create a new Player state object.
 * @param {string} socketId
 * @param {string} name
 * @param {boolean} isHost
 * @returns {object}
 */
function createPlayer(socketId, name, isHost = false) {
  return {
    socketId,
    name,
    isHost,
    // Stats
    money: STARTING_MONEY,
    fame: 0,
    happiness: 0,
    // Board position
    position: 0,
    // Status flags
    inPrison: false,
    skipNextTurn: false,
    retired: false,
    unemployed: false,
    // Life events
    isMarried: false,
    kids: 0,
    collegeDebt: 0,
    degree: null,          // null | 'compSci' | 'business' | 'healthSciences' | 'teaching'
    career: null,          // null | string (career path name)
    hasStudentLoans: false,
    // Overlays for character portrait
    hasWeddingRing: false,
    hasSportsCar: false,
    hasLandlordHat: false,
    graduationCapColor: null,  // null | 'blue' | 'green' | 'red' | 'purple'
    careerBadge: null,
    // Success Formula (set in lobby, kept secret)
    successFormula: null,   // null | { money: number, fame: number, happiness: number }
    hasSubmittedFormula: false,
    // Cards in hand
    luckCards: [],
    // Heartbeat
    lastPong: Date.now()
  };
}

// ── GameRoom factory ──────────────────────────────────────────────────────

/**
 * Create a new GameRoom state object.
 * @param {string} roomCode
 * @param {string} hostSocketId
 * @returns {object}
 */
function createGameRoom(roomCode, hostSocketId) {
  return {
    id: roomCode,
    hostSocketId,
    // Map<socketId, Player>
    players: new Map(),
    // Turn order — array of socketIds shuffled at game start
    turnOrder: [],
    currentTurnIndex: 0,
    // Game phase
    gamePhase: GAME_PHASES.LOBBY,
    // Turn phase (within a player's turn)
    turnPhase: TURN_PHASES.WAITING_FOR_ROLL,
    // Board state (populated in Phase 3+)
    board: [],
    // Shared resources
    sharedResources: {
      investmentPool: 0,      // grows when players miss on Investment Pool tile
      cryptoInvestments: new Map()  // Map<socketId, amount>
    },
    // Cleanup timer reference (set on empty room)
    cleanupTimer: null,
    // Turn history (last 10 turns)
    turnHistory: [],
    // Game metadata
    createdAt: Date.now(),
    startedAt: null
  };
}

const connectedSockets = new Set();

// ── Per-socket rate limiting ───────────────────────────────────────────────

/**
 * Maximum allowed calls per event type, per socket, per window.
 * Key = event name, Value = { maxCalls, windowMs }
 */
const RATE_LIMITS = {
  'roll-dice':      { maxCalls: 1,  windowMs: 3000  },  // 1 roll per 3s
  'create-room':    { maxCalls: 5,  windowMs: 60000 },  // 5 room creates per minute
  'join-room':      { maxCalls: 10, windowMs: 60000 },  // 10 join attempts per minute
  'submit-formula': { maxCalls: 10, windowMs: 60000 },
  'play-luck-card': { maxCalls: 5,  windowMs: 5000  },
  'requestSync':    { maxCalls: 10, windowMs: 10000 }
};

/**
 * Track per-socket event call timestamps.
 * Map<socketId, Map<eventName, number[]>> — array of timestamps within window.
 */
const rateLimitState = new Map();

/**
 * Check whether a socket is allowed to fire an event.
 * Silently returns false (caller must drop the event) if over limit.
 * Side effect: prunes expired timestamps and records current call.
 *
 * @param {string} socketId
 * @param {string} eventName
 * @returns {boolean} true = allowed, false = rate limited (drop silently)
 */
function checkRateLimit(socketId, eventName) {
  const limit = RATE_LIMITS[eventName];
  if (!limit) return true; // No limit defined for this event — always allow

  const now = Date.now();

  if (!rateLimitState.has(socketId)) {
    rateLimitState.set(socketId, new Map());
  }
  const socketEvents = rateLimitState.get(socketId);

  if (!socketEvents.has(eventName)) {
    socketEvents.set(eventName, []);
  }
  const timestamps = socketEvents.get(eventName);

  // Prune timestamps outside the window
  const windowStart = now - limit.windowMs;
  const recent = timestamps.filter(ts => ts >= windowStart);

  if (recent.length >= limit.maxCalls) {
    // Over limit — silently reject
    return false;
  }

  // Record this call
  recent.push(now);
  socketEvents.set(eventName, recent);
  return true;
}

/**
 * Clear rate limit state for a socket (called on disconnect to free memory).
 * @param {string} socketId
 */
function clearRateLimitState(socketId) {
  rateLimitState.delete(socketId);
}

// ── State serialisation ────────────────────────────────────────────────────

/**
 * Produce a JSON-serialisable snapshot of a room's full state.
 * Maps are converted to plain objects; sensitive fields (successFormula) are
 * redacted — the server NEVER sends raw Success Formulas to clients.
 *
 * @param {object} room  — a GameRoom object
 * @param {string|null} requestingSocketId — if provided, success formula is
 *   only included for THIS socket (own formula visible to self only)
 * @returns {object}
 */
function getFullState(room, requestingSocketId = null) {
  const playersSnapshot = {};
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
      // Only reveal own Success Formula, never others'
      successFormula: socketId === requestingSocketId ? player.successFormula : null
    };
  }

  return {
    roomId: room.id,
    hostSocketId: room.hostSocketId,
    players: playersSnapshot,
    turnOrder: room.turnOrder,
    currentTurnIndex: room.currentTurnIndex,
    currentTurnPlayer: room.turnOrder[room.currentTurnIndex] || null,
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

// ── Connection handler ────────────────────────────────────────────────────
io.on('connection', (socket) => {
  connectedSockets.add(socket.id);
  console.log(`[connect]  ${socket.id}  (total: ${connectedSockets.size})`);

  // Confirm connection to client
  socket.emit('connected', { socketId: socket.id });

  // Send full state immediately when a socket requests sync (on join/reconnect)
  socket.on('requestSync', ({ roomCode }) => {
    const room = getRoom(roomCode);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    socket.emit('gameState', getFullState(room, socket.id));
  });

  socket.on('disconnect', (reason) => {
    clearRateLimitState(socket.id);
    connectedSockets.delete(socket.id);
    console.log(`[disconnect] ${socket.id} — ${reason}  (total: ${connectedSockets.size})`);

    // Find which room this socket was in
    const roomCode = findRoomCodeBySocketId(socket.id);
    if (!roomCode) return; // Socket wasn't in any game room

    const room = getRoom(roomCode);
    if (!room) return;

    const player = room.players.get(socket.id);
    const playerName = player ? player.name : 'Unknown';

    // Remove player from room
    room.players.delete(socket.id);

    if (room.players.size === 0) {
      // Room is empty — schedule cleanup after 30 minutes (allow rejoin window)
      room.cleanupTimer = setTimeout(() => {
        const currentRoom = getRoom(roomCode);
        if (currentRoom && currentRoom.players.size === 0) {
          deleteRoom(roomCode);
          console.log(`[cleanup] Room ${roomCode} deleted after 30-minute timeout`);
        }
      }, 30 * 60 * 1000);
    } else {
      // Broadcast to remaining players
      io.to(roomCode).emit('playerLeft', {
        socketId: socket.id,
        playerName,
        remainingPlayers: room.players.size,
        timestamp: Date.now()
      });

      // Send updated game state to remaining players
      io.to(roomCode).emit('gameState', getFullState(room));
    }
  });
});

// ── Periodic full-state broadcast (every 30s) ─────────────────────────────
// Keeps all clients in sync even if an event was missed.
const STATE_BROADCAST_INTERVAL = setInterval(() => {
  for (const [roomCode, room] of rooms) {
    if (room.players.size > 0) {
      io.to(roomCode).emit('gameState', getFullState(room));
    }
  }
}, 30000);

// Prevent Jest from hanging: expose for cleanup
STATE_BROADCAST_INTERVAL.unref(); // Allow process to exit even if interval is active

// ── Start ──────────────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`Careers server running on http://localhost:${PORT}`);
});

module.exports = {
  app, httpServer, io, rooms, connectedSockets,
  generateRoomCode, getRoom, setRoom, deleteRoom, findRoomCodeBySocketId, cancelCleanup,
  createPlayer, createGameRoom,
  GAME_PHASES, TURN_PHASES, STARTING_MONEY,
  getFullState,
  RATE_LIMITS, checkRateLimit, clearRateLimitState, rateLimitState
};

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

const connectedSockets = new Set();

// ── Connection handler ────────────────────────────────────────────────────
io.on('connection', (socket) => {
  connectedSockets.add(socket.id);
  console.log(`[connect]  ${socket.id}  (total: ${connectedSockets.size})`);

  // Confirm connection to client
  socket.emit('connected', { socketId: socket.id });

  socket.on('disconnect', (reason) => {
    connectedSockets.delete(socket.id);
    console.log(`[disconnect] ${socket.id} — ${reason}  (total: ${connectedSockets.size})`);
  });
});

// ── Start ──────────────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`Careers server running on http://localhost:${PORT}`);
});

module.exports = { app, httpServer, io, rooms, connectedSockets, generateRoomCode, getRoom, setRoom, deleteRoom, findRoomCodeBySocketId };

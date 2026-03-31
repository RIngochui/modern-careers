"use strict";
// client/game.ts — Shared client entry point
// Host lobby logic runs on host.html; player lobby logic runs on player.html (added in Plan 04)
// ── Host Lobby Logic ─────────────────────────────────────────────────────────
(function initHostLobby() {
    // Guard: only run on host.html (has #room-code element)
    if (!document.getElementById('room-code'))
        return;
    const socket = io();
    // DOM refs
    const roomCodeEl = document.getElementById('room-code');
    const playerListEl = document.getElementById('player-list');
    const statusEl = document.getElementById('status-text');
    const startBtn = document.getElementById('start-btn');
    const errorMsgEl = document.getElementById('error-msg');
    // Lobby state — recomputed from server events, never mutated locally outside handlers
    let playerList = [];
    function renderPlayerList() {
        playerListEl.innerHTML = '';
        playerList.forEach(p => {
            const li = document.createElement('li');
            const nameSpan = document.createElement('span');
            nameSpan.textContent = p.name;
            const flagSpan = document.createElement('span');
            flagSpan.textContent = p.hasSubmittedFormula ? '✓' : '○';
            flagSpan.className = p.hasSubmittedFormula ? 'check' : 'pending';
            flagSpan.title = p.hasSubmittedFormula ? 'Formula submitted' : 'Waiting for formula';
            li.appendChild(nameSpan);
            li.appendChild(flagSpan);
            playerListEl.appendChild(li);
        });
    }
    function updateLobbyStatus() {
        const total = playerList.length;
        const ready = playerList.filter(p => p.hasSubmittedFormula).length;
        if (total === 0) {
            statusEl.textContent = 'Waiting for players to join...';
        }
        else if (ready < total) {
            statusEl.textContent = `${total} player${total !== 1 ? 's' : ''} connected — ${ready}/${total} formulas submitted`;
        }
        else {
            statusEl.textContent = `${total} player${total !== 1 ? 's' : ''} ready — all formulas submitted!`;
        }
        // Enable Start only when 2+ players and all submitted
        startBtn.disabled = !(total >= 2 && ready === total);
        errorMsgEl.textContent = '';
    }
    // ── Socket event handlers ───────────────────────────────────────────────────
    socket.on('connected', () => {
        statusEl.textContent = 'Creating room...';
        socket.emit('create-room');
    });
    socket.on('roomCreated', ({ roomCode }) => {
        roomCodeEl.textContent = roomCode;
        statusEl.textContent = 'Waiting for players to join...';
    });
    socket.on('playerJoined', ({ playerList: list }) => {
        playerList = list;
        renderPlayerList();
        updateLobbyStatus();
    });
    socket.on('formulaSubmitted', ({ playerName }) => {
        const p = playerList.find(pl => pl.name === playerName);
        if (p)
            p.hasSubmittedFormula = true;
        renderPlayerList();
        updateLobbyStatus();
    });
    socket.on('playerLeft', ({ playerName, playerList: list }) => {
        if (list) {
            playerList = list;
        }
        else {
            playerList = playerList.filter(p => p.name !== playerName);
        }
        renderPlayerList();
        updateLobbyStatus();
    });
    socket.on('gameStarted', ({ turnOrder, currentPlayerName }) => {
        const lobbySection = document.getElementById('lobby-section');
        const gameSection = document.getElementById('game-section');
        if (lobbySection)
            lobbySection.style.display = 'none';
        if (gameSection)
            gameSection.style.display = 'block';
        // Phase 3 will populate game-section
        console.log('[host] Game started. Turn order:', turnOrder.join(' → '), '— First:', currentPlayerName);
    });
    socket.on('error', ({ message }) => {
        errorMsgEl.textContent = message;
        // Re-enable start button if it was in "Starting..." state
        if (startBtn.textContent === 'Starting...') {
            startBtn.textContent = 'Start Game';
            updateLobbyStatus(); // re-evaluates disabled state
        }
        console.error('[host error]', message);
    });
    // ── Start Game button ────────────────────────────────────────────────────────
    startBtn.addEventListener('click', () => {
        if (startBtn.disabled)
            return;
        startBtn.disabled = true;
        startBtn.textContent = 'Starting...';
        errorMsgEl.textContent = '';
        socket.emit('start-game');
    });
})();
// ── Player Lobby Logic ────────────────────────────────────────────────────────
(function initPlayerLobby() {
    // Guard: only run on player.html (has #formula-money element)
    if (!document.getElementById('formula-money'))
        return;
    const socket = io();
    // DOM refs — join section
    const roomCodeInput = document.getElementById('room-code-input');
    const playerNameInput = document.getElementById('player-name');
    const joinBtn = document.getElementById('join-btn');
    const joinError = document.getElementById('join-error');
    // DOM refs — formula section
    const moneySlider = document.getElementById('formula-money');
    const fameSlider = document.getElementById('formula-fame');
    const happySlider = document.getElementById('formula-happiness');
    const moneyVal = document.getElementById('money-value');
    const fameVal = document.getElementById('fame-value');
    const happyVal = document.getElementById('happiness-value');
    const sumDisplay = document.getElementById('formula-sum-display');
    const formulaHint = document.getElementById('formula-hint');
    const formulaError = document.getElementById('formula-error');
    const submitBtn = document.getElementById('formula-submit');
    // DOM refs — section visibility
    const joinSection = document.getElementById('join-section');
    const formulaSection = document.getElementById('formula-section');
    const waitingSection = document.getElementById('waiting-section');
    const waitingStatus = document.getElementById('waiting-status');
    // ── Join form validation ────────────────────────────────────────────────────
    function validateJoinForm() {
        const name = playerNameInput.value.trim();
        const code = roomCodeInput.value.trim();
        joinBtn.disabled = !(name.length >= 1 && code.length === 4);
    }
    // Auto-uppercase room code input in real time
    roomCodeInput.addEventListener('input', () => {
        const pos = roomCodeInput.selectionStart ?? 0;
        roomCodeInput.value = roomCodeInput.value.toUpperCase();
        roomCodeInput.setSelectionRange(pos, pos);
        validateJoinForm();
    });
    playerNameInput.addEventListener('input', validateJoinForm);
    joinBtn.addEventListener('click', (e) => {
        e.preventDefault();
        joinError.textContent = '';
        const roomCode = roomCodeInput.value.trim().toUpperCase();
        const playerName = playerNameInput.value.trim();
        // Client-side UX guard (server validates authoritatively)
        if (roomCode.length !== 4) {
            joinError.textContent = 'Room code must be 4 letters';
            return;
        }
        if (playerName.length < 1 || playerName.length > 20) {
            joinError.textContent = 'Name must be 1-20 characters';
            return;
        }
        if (!/^[a-zA-Z0-9 ]+$/.test(playerName)) {
            joinError.textContent = 'Name must contain only letters, numbers, and spaces';
            return;
        }
        joinBtn.disabled = true;
        joinBtn.textContent = 'Joining...';
        socket.emit('join-room', { roomCode, playerName });
    });
    // ── Formula slider validation ───────────────────────────────────────────────
    function updateFormulaSum() {
        const money = parseInt(moneySlider.value, 10);
        const fame = parseInt(fameSlider.value, 10);
        const happiness = parseInt(happySlider.value, 10);
        const sum = money + fame + happiness;
        // Update live value labels
        moneyVal.textContent = String(money);
        fameVal.textContent = String(fame);
        happyVal.textContent = String(happiness);
        // Update sum display
        sumDisplay.textContent = `${sum} / 60`;
        if (sum === 60) {
            sumDisplay.className = 'valid';
            formulaHint.textContent = 'Ready to submit!';
            submitBtn.disabled = false;
            formulaError.textContent = '';
        }
        else if (sum < 60) {
            sumDisplay.className = 'invalid';
            const diff = 60 - sum;
            formulaHint.textContent = `${diff} more point${diff !== 1 ? 's' : ''} needed`;
            submitBtn.disabled = true;
        }
        else {
            sumDisplay.className = 'invalid';
            const over = sum - 60;
            formulaHint.textContent = `${over} point${over !== 1 ? 's' : ''} over limit`;
            submitBtn.disabled = true;
        }
    }
    moneySlider.addEventListener('input', updateFormulaSum);
    fameSlider.addEventListener('input', updateFormulaSum);
    happySlider.addEventListener('input', updateFormulaSum);
    // Run once on load — sliders default to 20/20/20 = 60, Submit enabled
    updateFormulaSum();
    submitBtn.addEventListener('click', (e) => {
        e.preventDefault();
        formulaError.textContent = '';
        const money = parseInt(moneySlider.value, 10);
        const fame = parseInt(fameSlider.value, 10);
        const happiness = parseInt(happySlider.value, 10);
        // Client-side guard — server validates again
        if (money + fame + happiness !== 60) {
            formulaError.textContent = 'Formula must sum to exactly 60';
            return;
        }
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';
        socket.emit('submit-formula', { money, fame, happiness });
    });
    // ── Socket event handlers ────────────────────────────────────────────────────
    socket.on('connected', () => {
        // Wait for user to fill in the join form
        validateJoinForm();
    });
    socket.on('roomState', (_state) => {
        // Join success — transition to formula screen
        joinSection.style.display = 'none';
        formulaSection.style.display = 'block';
        joinBtn.textContent = 'Join Game';
        joinBtn.disabled = false;
        updateFormulaSum(); // ensure initial state is correct
    });
    socket.on('formulaAccepted', (_data) => {
        // Formula stored — show waiting screen
        formulaSection.style.display = 'none';
        waitingSection.style.display = 'block';
        waitingStatus.textContent = 'Waiting for host to start the game...';
    });
    socket.on('formulaSubmitted', ({ submittedCount, totalPlayerCount }) => {
        // Another player submitted — update waiting text if visible
        if (waitingSection.style.display !== 'none') {
            waitingStatus.textContent = `${submittedCount} of ${totalPlayerCount} formulas submitted. Waiting for host...`;
        }
    });
    socket.on('gameStarted', ({ currentPlayerName }) => {
        // Transition to game screen (Phase 3 populates this)
        waitingSection.style.display = 'none';
        formulaSection.style.display = 'none';
        document.getElementById('game-section').style.display = 'block';
        console.log('[player] Game started. First player:', currentPlayerName);
    });
    socket.on('error', ({ message }) => {
        if (joinSection.style.display !== 'none') {
            joinError.textContent = message;
            joinBtn.textContent = 'Join Game';
            joinBtn.disabled = false;
            validateJoinForm();
        }
        else if (formulaSection.style.display !== 'none') {
            formulaError.textContent = message;
            submitBtn.textContent = 'Submit Formula';
            updateFormulaSum(); // re-evaluates disabled state
        }
        console.error('[player error]', message);
    });
})();
// ── Host Game Logic ───────────────────────────────────────────────────────────
(function initHostGame() {
    // Guard: only run on host.html game phase (has #board-track element)
    if (!document.getElementById('board-track'))
        return;
    const socket = io();
    // ── State ──────────────────────────────────────────────────────────────────
    const PLAYER_COLORS = ['#4ade80', '#f87171', '#60a5fa', '#fbbf24', '#a78bfa', '#fb923c'];
    let playerColorMap = {}; // socketId → color
    let playerPositions = {}; // socketId → tile index
    let currentPlayerId = null;
    let turnHistoryItems = [];
    const MAX_HISTORY = 5;
    // ── Board initialization ───────────────────────────────────────────────────
    function initBoard(players) {
        const track = document.getElementById('board-track');
        track.innerHTML = '';
        // Create 40 tile divs — labels start as index; tile-landed event updates with type abbreviation
        for (let i = 0; i < 40; i++) {
            const div = document.createElement('div');
            div.className = 'tile';
            div.dataset.index = String(i);
            const label = document.createElement('span');
            label.className = 'tile-label';
            label.textContent = `${i}`; // index only until gameState provides type
            div.appendChild(label);
            const dots = document.createElement('div');
            dots.className = 'tile-dots';
            dots.id = `tile-dots-${i}`;
            div.appendChild(dots);
            track.appendChild(div);
        }
        // Assign colors and initial positions
        players.forEach((p, idx) => {
            playerColorMap[p.socketId] = PLAYER_COLORS[idx % PLAYER_COLORS.length];
            playerPositions[p.socketId] = p.position;
        });
        renderAllDots();
    }
    // ── Dot rendering ──────────────────────────────────────────────────────────
    function renderAllDots() {
        // Clear all dot containers
        document.querySelectorAll('.tile-dots').forEach(d => (d.innerHTML = ''));
        // Re-render each player's dot at their position
        for (const [socketId, pos] of Object.entries(playerPositions)) {
            const dotsContainer = document.getElementById(`tile-dots-${pos}`);
            if (!dotsContainer)
                continue;
            const dot = document.createElement('span');
            dot.className = 'player-dot' + (socketId === currentPlayerId ? ' active' : '');
            dot.style.backgroundColor = playerColorMap[socketId] ?? '#eee';
            dot.title = socketId; // show socketId on hover for debugging
            dotsContainer.appendChild(dot);
        }
    }
    // ── Helper functions ───────────────────────────────────────────────────────
    function updateCurrentPlayerDisplay(name) {
        const el = document.getElementById('current-player-display');
        if (el)
            el.textContent = `${name}'s Turn`;
    }
    function addTurnHistory(text) {
        turnHistoryItems.unshift(text); // newest first
        if (turnHistoryItems.length > MAX_HISTORY)
            turnHistoryItems.pop();
        const list = document.getElementById('turn-history-list');
        list.innerHTML = '';
        turnHistoryItems.forEach(item => {
            const li = document.createElement('li');
            li.textContent = item;
            list.appendChild(li);
        });
    }
    // ── Socket event handlers ──────────────────────────────────────────────────
    socket.on('gameStarted', ({ turnOrder, currentPlayerSocketId, currentPlayerName, players }) => {
        // initHostLobby's gameStarted handler already handles section visibility;
        // this IIFE focuses on board initialization
        currentPlayerId = currentPlayerSocketId;
        updateCurrentPlayerDisplay(currentPlayerName);
        initBoard(players);
        console.log('[host-game] Board initialized. Turn order:', turnOrder.join(' → '));
    });
    socket.on('move-token', ({ playerId, playerName, roll, toPosition, tileName }) => {
        playerPositions[playerId] = toPosition;
        renderAllDots();
        // Highlight landing tile briefly
        const tile = document.querySelector(`.tile[data-index="${toPosition}"]`);
        if (tile) {
            tile.style.borderColor = '#f0c040';
            setTimeout(() => { tile.style.borderColor = ''; }, 1500);
        }
        // Update history
        addTurnHistory(`${playerName} rolled ${roll} → ${tileName ?? `tile ${toPosition}`}`);
    });
    socket.on('nextTurn', ({ currentPlayer, currentPlayerName, turnNumber }) => {
        // nextTurn: advance current player and update turn counter
        currentPlayerId = currentPlayer;
        updateCurrentPlayerDisplay(currentPlayerName);
        const turnCounter = document.getElementById('turn-counter');
        if (turnCounter)
            turnCounter.textContent = `Turn ${turnNumber}`;
        renderAllDots(); // re-render to update active dot highlight
    });
    socket.on('tile-landed', ({ tileIndex, tileType }) => {
        // Update tile label with type abbreviation if it was previously just an index
        const tile = document.querySelector(`.tile[data-index="${tileIndex}"]`);
        if (tile) {
            const label = tile.querySelector('.tile-label');
            if (label && label.textContent === String(tileIndex)) {
                const ABBR = {
                    PAYDAY: 'PAYDAY', PRISON: 'PRISON', PARK_BENCH: 'BENCH', HOSPITAL: 'HOSP',
                    APARTMENT: 'APART', HOUSE: 'HOUSE', CAREER_ENTRANCE: 'CAREER', OPPORTUNITY: 'OPP', TBD: 'TBD'
                };
                label.textContent = ABBR[tileType] ?? tileType.slice(0, 6);
            }
        }
    });
    socket.on('drains-applied', ({ playerId, deductions, newMoney }) => {
        // Show drain summary as a transient notice in the current player display area
        const drainText = deductions.map(d => `-$${d.amount.toLocaleString()} ${d.type}`).join(' | ');
        const display = document.getElementById('current-player-display');
        if (display) {
            const notice = document.createElement('span');
            notice.style.cssText = 'color:#f87171;font-size:0.8rem;margin-left:8px;';
            notice.textContent = `Drains: ${drainText}`;
            display.appendChild(notice);
            setTimeout(() => notice.remove(), 3000);
        }
        console.log(`[host] drains applied to ${playerId}: ${drainText} → $${newMoney.toLocaleString()}`);
    });
    socket.on('gameState', (state) => {
        // Sync positions and current player from periodic broadcast
        if (state.players) {
            for (const [socketId, player] of Object.entries(state.players)) {
                playerPositions[socketId] = player.position;
            }
        }
        if (state.currentTurnPlayer)
            currentPlayerId = state.currentTurnPlayer;
        renderAllDots();
    });
})();

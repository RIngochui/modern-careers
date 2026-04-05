// client/game.ts — Shared client entry point
// Host lobby logic runs on host.html; player lobby logic runs on player.html (added in Plan 04)

// Single shared socket for the entire page — all IIFEs use this connection
const socket = io();

// Respond to server heartbeat so sockets aren't killed as zombies
socket.on('ping', () => { socket.emit('pong'); });

// ── Host Lobby Logic ─────────────────────────────────────────────────────────

(function initHostLobby() {
  // Guard: only run on host.html (has #room-code element)
  if (!document.getElementById('room-code')) return;

  // DOM refs
  const roomCodeEl   = document.getElementById('room-code') as HTMLElement;
  const playerListEl = document.getElementById('player-list') as HTMLUListElement;
  const statusEl     = document.getElementById('status-text') as HTMLElement;
  const startBtn     = document.getElementById('start-btn') as HTMLButtonElement;
  const errorMsgEl   = document.getElementById('error-msg') as HTMLElement;

  // Lobby state — recomputed from server events, never mutated locally outside handlers
  let playerList: Array<{ name: string; hasSubmittedFormula: boolean }> = [];

  function renderPlayerList(): void {
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

  function updateLobbyStatus(): void {
    const total = playerList.length;
    const ready = playerList.filter(p => p.hasSubmittedFormula).length;

    if (total === 0) {
      statusEl.textContent = 'Waiting for players to join...';
    } else if (ready < total) {
      statusEl.textContent = `${total} player${total !== 1 ? 's' : ''} connected — ${ready}/${total} formulas submitted`;
    } else {
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

  socket.on('roomCreated', ({ roomCode }: { roomCode: string }) => {
    roomCodeEl.textContent = roomCode;
    statusEl.textContent = 'Waiting for players to join...';
  });

  socket.on('playerJoined', ({ playerList: list }: { playerList: Array<{ name: string; hasSubmittedFormula: boolean }> }) => {
    playerList = list;
    renderPlayerList();
    updateLobbyStatus();
  });

  socket.on('formulaSubmitted', ({ playerName }: { playerName: string }) => {
    const p = playerList.find(pl => pl.name === playerName);
    if (p) p.hasSubmittedFormula = true;
    renderPlayerList();
    updateLobbyStatus();
  });

  socket.on('playerLeft', ({ playerName, playerList: list }: { playerName: string; playerList?: Array<{ name: string; hasSubmittedFormula: boolean }> }) => {
    if (list) {
      playerList = list;
    } else {
      playerList = playerList.filter(p => p.name !== playerName);
    }
    renderPlayerList();
    updateLobbyStatus();
  });

  socket.on('gameStarted', ({ turnOrder, currentPlayerName }: { turnOrder: string[]; currentPlayerName: string }) => {
    const lobbySection = document.getElementById('lobby-section');
    const gameSection  = document.getElementById('game-section');
    if (lobbySection) lobbySection.style.display = 'none';
    if (gameSection)  gameSection.style.display  = 'block';
    // Phase 3 will populate game-section
    console.log('[host] Game started. Turn order:', turnOrder.join(' → '), '— First:', currentPlayerName);
  });

  socket.on('error', ({ message }: { message: string }) => {
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
    if (startBtn.disabled) return;
    startBtn.disabled = true;
    startBtn.textContent = 'Starting...';
    errorMsgEl.textContent = '';
    socket.emit('start-game');
  });

})();

// ── Player Lobby Logic ────────────────────────────────────────────────────────

(function initPlayerLobby() {
  // Guard: only run on player.html (has #formula-money element)
  if (!document.getElementById('formula-money')) return;

  // DOM refs — join section
  const roomCodeInput  = document.getElementById('room-code-input') as HTMLInputElement;
  const playerNameInput = document.getElementById('player-name') as HTMLInputElement;
  const joinBtn        = document.getElementById('join-btn') as HTMLButtonElement;
  const joinError      = document.getElementById('join-error') as HTMLElement;

  // DOM refs — formula section
  const moneySlider    = document.getElementById('formula-money') as HTMLInputElement;
  const fameSlider     = document.getElementById('formula-fame') as HTMLInputElement;
  const happySlider    = document.getElementById('formula-happiness') as HTMLInputElement;
  const moneyVal       = document.getElementById('money-value') as HTMLElement;
  const fameVal        = document.getElementById('fame-value') as HTMLElement;
  const happyVal       = document.getElementById('happiness-value') as HTMLElement;
  const sumDisplay     = document.getElementById('formula-sum-display') as HTMLElement;
  const formulaHint    = document.getElementById('formula-hint') as HTMLElement;
  const formulaError   = document.getElementById('formula-error') as HTMLElement;
  const submitBtn      = document.getElementById('formula-submit') as HTMLButtonElement;

  // DOM refs — section visibility
  const joinSection    = document.getElementById('join-section') as HTMLElement;
  const formulaSection = document.getElementById('formula-section') as HTMLElement;
  const waitingSection = document.getElementById('waiting-section') as HTMLElement;
  const waitingStatus  = document.getElementById('waiting-status') as HTMLElement;

  // ── Join form validation ────────────────────────────────────────────────────

  function validateJoinForm(): void {
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

    const roomCode   = roomCodeInput.value.trim().toUpperCase();
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

  function updateFormulaSum(): void {
    const moneyDollars = parseInt(moneySlider.value, 10);  // slider in dollars ($0–$600,000)
    const moneyPoints  = moneyDollars / 10000;             // convert to points (0–60)
    const fame         = parseInt(fameSlider.value, 10);
    const happiness    = parseInt(happySlider.value, 10);
    const sum          = moneyPoints + fame + happiness;

    // Update live value labels
    moneyVal.textContent  = '$' + moneyDollars.toLocaleString();
    fameVal.textContent   = String(fame);
    happyVal.textContent  = String(happiness);

    // Update sum display
    sumDisplay.textContent = `${sum} / 60`;

    if (sum === 60) {
      sumDisplay.className   = 'valid';
      formulaHint.textContent = 'Ready to submit!';
      submitBtn.disabled     = false;
      formulaError.textContent = '';
    } else if (sum < 60) {
      sumDisplay.className   = 'invalid';
      const diff = 60 - sum;
      formulaHint.textContent = `${diff} more point${diff !== 1 ? 's' : ''} needed`;
      submitBtn.disabled     = true;
    } else {
      sumDisplay.className   = 'invalid';
      const over = sum - 60;
      formulaHint.textContent = `${over} point${over !== 1 ? 's' : ''} over limit`;
      submitBtn.disabled     = true;
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

    const moneyDollars = parseInt(moneySlider.value, 10);
    const moneyPoints  = moneyDollars / 10000;  // convert back to points for server
    const fame         = parseInt(fameSlider.value, 10);
    const happiness    = parseInt(happySlider.value, 10);

    // Client-side guard — server validates again
    if (moneyPoints + fame + happiness !== 60) {
      formulaError.textContent = 'Formula must sum to exactly 60';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
    socket.emit('submit-formula', { money: moneyPoints, fame, happiness });
  });

  // ── Socket event handlers ────────────────────────────────────────────────────

  socket.on('connected', () => {
    // Wait for user to fill in the join form
    validateJoinForm();
  });

  socket.on('roomState', (_state: object) => {
    // Join success — transition to formula screen
    joinSection.style.display    = 'none';
    formulaSection.style.display = 'block';
    joinBtn.textContent = 'Join Game';
    joinBtn.disabled    = false;
    updateFormulaSum(); // ensure initial state is correct
  });

  socket.on('formulaAccepted', (_data: { message: string }) => {
    // Formula stored — show waiting screen
    formulaSection.style.display = 'none';
    waitingSection.style.display = 'block';
    waitingStatus.textContent    = 'Waiting for host to start the game...';
  });

  socket.on('formulaSubmitted', ({ submittedCount, totalPlayerCount }: { playerName: string; submittedCount: number; totalPlayerCount: number }) => {
    // Another player submitted — update waiting text if visible
    if (waitingSection.style.display !== 'none') {
      waitingStatus.textContent = `${submittedCount} of ${totalPlayerCount} formulas submitted. Waiting for host...`;
    }
  });

  socket.on('gameStarted', ({ currentPlayerName }: { currentPlayerName: string }) => {
    // Transition to game screen (Phase 3 populates this)
    waitingSection.style.display = 'none';
    formulaSection.style.display = 'none';
    document.getElementById('game-section')!.style.display = 'block';
    console.log('[player] Game started. First player:', currentPlayerName);
  });

  socket.on('error', ({ message }: { message: string }) => {
    if (joinSection.style.display !== 'none') {
      joinError.textContent  = message;
      joinBtn.textContent    = 'Join Game';
      joinBtn.disabled       = false;
      validateJoinForm();
    } else if (formulaSection.style.display !== 'none') {
      formulaError.textContent = message;
      submitBtn.textContent    = 'Submit Formula';
      updateFormulaSum(); // re-evaluates disabled state
    }
    console.error('[player error]', message);
  });

})();

// ── Host Game Logic ───────────────────────────────────────────────────────────

(function initHostGame() {
  // Guard: only run on host.html game phase (has #board-track element)
  if (!document.getElementById('board-track')) return;

  // ── State ──────────────────────────────────────────────────────────────────

  const PLAYER_COLORS = ['#4ade80', '#f87171', '#60a5fa', '#fbbf24', '#a78bfa', '#fb923c'];
  let playerColorMap: Record<string, string> = {}; // socketId → color
  let playerPositions: Record<string, number> = {}; // socketId → tile index
  let currentPlayerId: string | null = null;
  let turnHistoryItems: string[] = [];
  const MAX_HISTORY = 10;

  // Board tile data (received on gameStarted) — used for abbreviations and tooltips
  let boardTilesData: Array<{type: string; name: string; description: string}> = [];

  // Map tile types to abbreviations (per UI-SPEC.md)
  const TILE_ABBR: Record<string, string> = {
    PAYDAY: 'PAYDAY', OPPORTUNITY_KNOCKS: 'OPP', PAY_TAXES: 'TAXES',
    STUDENT_LOAN_REDIRECT: 'LOAN', MCDONALDS: "McDONALD'S", APARTMENT: 'APT',
    SPORTS_BETTING: 'SPORTS', CIGARETTE_BREAK: 'CIGS', UNIVERSITY: 'UNI',
    PRISON: 'PRISON', FINANCE_BRO: 'FINANCE', ART_GALLERY: 'ART',
    SUPPLY_TEACHER: 'TEACHER', GYM_MEMBERSHIP: 'GYM', COP: 'COP',
    LOTTERY: 'LOTTERY', JAPAN_TRIP: 'JAPAN', DEI_OFFICER: 'DEI', PEOPLE_AND_CULTURE: 'P&C',
    REVOLUTION: 'REVOLTN', HOUSE: 'HOUSE', NEPOTISM: 'NEPT',
    COVID_STIMULUS: 'COVID', TECH_BRO: 'TECH', HOSPITAL: 'HOSP',
    RIGHT_WING_GRIFTER: 'GRIFTER', OZEMPIC: 'OZEMPIC',
    STARVING_ARTIST: 'ARTIST', YACHT_HARBOR: 'YACHT',
    INSTAGRAM_FOLLOWERS: 'INSTA', STREAMER: 'STREAMER',
  };

  // ── Board initialization ───────────────────────────────────────────────────

  // Map tile index (0-39) to grid row/col on an 11×11 perimeter board
  function getTileGridPos(index: number): { row: number; col: number } {
    if (index <= 10) return { row: 1,  col: index + 1 };          // top: left→right
    if (index <= 19) return { row: index - 9,  col: 11 };          // right: top→bottom
    if (index <= 30) return { row: 11, col: 11 - (index - 20) };   // bottom: right→left
    return { row: 11 - (index - 30), col: 1 };                     // left: bottom→top
  }

  function initBoard(players: Array<{socketId: string; name: string; position: number}>): void {
    const track = document.getElementById('board-track')!;
    track.innerHTML = '';

    for (let i = 0; i < 40; i++) {
      const div = document.createElement('div');
      div.className = 'tile';
      div.dataset.index = String(i);

      const { row, col } = getTileGridPos(i);
      div.style.gridColumn = String(col);
      div.style.gridRow = String(row);

      // Inject full tile name and tooltip data from boardTilesData
      const tileData = boardTilesData[i];
      const tileName = tileData ? tileData.name : String(i);
      const instruction = tileData?.description ?? '';
      div.setAttribute('data-instruction', instruction);

      const nameEl = document.createElement('span');
      nameEl.className = 'tile-name';
      nameEl.textContent = tileName;
      div.appendChild(nameEl);

      const label = document.createElement('span');
      label.className = 'tile-label';
      label.textContent = `${i}`;
      div.appendChild(label);

      const dots = document.createElement('div');
      dots.className = 'tile-dots';
      dots.id = `tile-dots-${i}`;
      div.appendChild(dots);

      track.appendChild(div);
    }

    // Centre panel
    const center = document.createElement('div');
    center.id = 'board-center';
    center.style.cssText = 'grid-column:2/11;grid-row:2/11;background:#0d0d1e;border-radius:4px;display:flex;align-items:center;justify-content:center;';
    center.innerHTML = '<span style="font-size:1.4rem;font-weight:bold;color:#f0c040;letter-spacing:0.1em;">Modern Careers</span>';
    track.appendChild(center);

    // Assign colors and initial positions
    players.forEach((p, idx) => {
      playerColorMap[p.socketId] = PLAYER_COLORS[idx % PLAYER_COLORS.length];
      playerPositions[p.socketId] = p.position;
    });

    renderAllDots();
  }

  // ── Dot rendering ──────────────────────────────────────────────────────────

  function renderAllDots(): void {
    // Clear all dot containers
    document.querySelectorAll('.tile-dots').forEach(d => (d.innerHTML = ''));
    // Re-render each player's dot at their position
    for (const [socketId, pos] of Object.entries(playerPositions)) {
      const dotsContainer = document.getElementById(`tile-dots-${pos}`);
      if (!dotsContainer) continue;
      const dot = document.createElement('span');
      dot.className = 'player-dot' + (socketId === currentPlayerId ? ' active' : '');
      dot.style.backgroundColor = playerColorMap[socketId] ?? '#eee';
      dot.title = socketId; // show socketId on hover for debugging
      dotsContainer.appendChild(dot);
    }
  }

  // ── Helper functions ───────────────────────────────────────────────────────

  function updateCurrentPlayerDisplay(name: string): void {
    const el = document.getElementById('current-player-display');
    if (el) el.textContent = `${name}'s Turn`;
  }

  function addTurnHistory(text: string): void {
    turnHistoryItems.unshift(text); // newest first
    if (turnHistoryItems.length > MAX_HISTORY) turnHistoryItems.pop();

    const list = document.getElementById('turn-history-list')!;
    list.innerHTML = '';
    turnHistoryItems.forEach(item => {
      const li = document.createElement('li');
      li.textContent = item;
      list.appendChild(li);
    });
  }

  // ── Socket event handlers ──────────────────────────────────────────────────

  socket.on('gameStarted', ({ turnOrder, currentPlayerSocketId, currentPlayerName, players, boardTiles }: {
    turnOrder: string[];
    currentPlayerSocketId: string;
    currentPlayerName: string;
    players: Array<{socketId: string; name: string; position: number}>;
    boardTiles?: Array<{type: string; name: string; description: string}>;
  }) => {
    // initHostLobby's gameStarted handler already handles section visibility;
    // this IIFE focuses on board initialization
    if (boardTiles) boardTilesData = boardTiles;
    currentPlayerId = currentPlayerSocketId;
    updateCurrentPlayerDisplay(currentPlayerName);
    initBoard(players);
    console.log('[host-game] Board initialized. Turn order:', turnOrder.join(' → '));
  });

  socket.on('move-token', ({ playerId, playerName, roll, toPosition, tileName }: {
    playerId: string;
    playerName: string;
    roll: number;
    toPosition: number;
    tileName?: string;
  }) => {
    playerPositions[playerId] = toPosition;
    renderAllDots();

    // Highlight landing tile briefly
    const tile = document.querySelector(`.tile[data-index="${toPosition}"]`) as HTMLElement;
    if (tile) {
      tile.style.borderColor = '#f0c040';
      setTimeout(() => { tile.style.borderColor = ''; }, 1500);
    }

    // Update history
    addTurnHistory(`${playerName} rolled ${roll} → ${tileName ?? `tile ${toPosition}`}`);
  });

  socket.on('nextTurn', ({ currentPlayer, currentPlayerName, turnNumber }: {
    currentPlayer: string;
    currentPlayerName: string;
    turnNumber: number;
  }) => {
    // nextTurn: advance current player and update turn counter
    currentPlayerId = currentPlayer;
    updateCurrentPlayerDisplay(currentPlayerName);
    const turnCounter = document.getElementById('turn-counter');
    if (turnCounter) turnCounter.textContent = `Turn ${turnNumber}`;
    renderAllDots(); // re-render to update active dot highlight
  });

  socket.on('tile-landed', ({ tileIndex, tileType }: {
    tileIndex: number;
    tileType: string;
  }) => {
    // Update tile label with type abbreviation if it was previously just an index
    const tile = document.querySelector(`.tile[data-index="${tileIndex}"]`) as HTMLElement;
    if (tile) {
      const label = tile.querySelector('.tile-label') as HTMLElement;
      if (label && label.textContent === String(tileIndex)) {
        const ABBR: Record<string, string> = {
          PAYDAY: 'PAYDAY', PRISON: 'PRISON', PARK_BENCH: 'BENCH', HOSPITAL: 'HOSP',
          APARTMENT: 'APART', HOUSE: 'HOUSE', CAREER_ENTRANCE: 'CAREER', OPPORTUNITY: 'OPP', TBD: 'TBD'
        };
        label.textContent = ABBR[tileType] ?? tileType.slice(0, 6);
      }
    }
  });

  socket.on('drains-applied', ({ playerId, deductions, newMoney }: {
    playerId: string;
    deductions: Array<{type: string; amount: number}>;
    newMoney: number;
  }) => {
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

  socket.on('gameState', (state: any) => {
    // Sync positions and current player from periodic broadcast
    if (state.players) {
      for (const [socketId, player] of Object.entries(state.players as any)) {
        playerPositions[socketId] = (player as any).position;
      }
    }
    if (state.currentTurnPlayer) currentPlayerId = state.currentTurnPlayer;
    renderAllDots();
    // Update status badges (Hospital/Prison/Japan) on player dots
    if (state.players) {
      for (const [socketId, player] of Object.entries(state.players as any)) {
        const p = player as any;
        const dot = document.querySelector(`.player-dot[title="${socketId}"]`) as HTMLElement;
        if (dot) {
          const status = p.inHospital ? '[H]' : p.inPrison ? `[P:${p.prisonTurns ?? 0}]` : p.inJapan ? '[J]' : '';
          dot.title = socketId + (status ? ` ${status}` : '');
        }
      }
    }
  });

  // ── Phase 6: Hospital event handlers (host screen) ───────────────────

  socket.on('hospital-entered', ({ playerName, newHp }: { playerName: string; reason: string; newHp: number }) => {
    addTurnHistory(`${playerName} → Hospital (HP: ${newHp})`);
  });

  socket.on('hospital-escaped', ({ playerName, escapeRoll }: { playerName: string; escapeRoll: number; hpGained: number; payment: number; recipientRole: string; newHp: number; newMoney: number }) => {
    addTurnHistory(`${playerName} escaped Hospital (rolled ${escapeRoll})`);
  });

  // ── Phase 6: Prison event handlers (host screen) ─────────────────────

  socket.on('prison-entered', ({ playerName }: { playerName: string }) => {
    addTurnHistory(`${playerName} → Prison`);
  });

  socket.on('prison-escaped', ({ playerName }: { playerName: string; roll?: number; method?: string; newPosition: number }) => {
    addTurnHistory(`${playerName} escaped Prison`);
  });

  // ── Phase 6: Japan Trip event handlers (host screen) ─────────────────

  socket.on('japan-landed', ({ playerName }: { playerName: string; happinessGained: number; newHappiness: number }) => {
    addTurnHistory(`${playerName} → Japan Trip (+1 Happiness)`);
  });

  // ── Phase 6: Goomba Stomp event handler (host screen) ────────────────

  socket.on('goomba-stomped', ({ stomperName, stompedNames, destination }: { stomperName: string; stompedNames: string[]; isCopStomp: boolean; destination: number }) => {
    const destLabel = destination === 10 ? 'Prison' : 'Japan Trip';
    addTurnHistory(`STOMP! ${stomperName} → stomped ${stompedNames.join(', ')} to ${destLabel}`);
  });

  // ── Phase 7: Property event handlers (host screen) ─────────────────

  socket.on('property-purchased', ({ tileIndex, ownerName, tileName }: { tileIndex: number; ownerName: string; tileName: string; buyerName: string; cost: number }) => {
    // Update the board tile label to show ownership
    const tile = document.querySelector(`.tile[data-index="${tileIndex}"]`) as HTMLElement;
    if (tile) {
      const nameEl = tile.querySelector('.tile-name') as HTMLElement;
      if (nameEl) nameEl.textContent = `${ownerName}'s ${tileName}`;
    }
    addTurnHistory(`${ownerName} bought ${tileName} (tile ${tileIndex})`);
  });

  socket.on('property-rent-paid', ({ visitorName, ownerName, rentAmount }: { tileIndex: number; visitorName: string; ownerName: string; rentAmount: number }) => {
    addTurnHistory(`${visitorName} paid $${rentAmount.toLocaleString()} rent to ${ownerName}`);
  });

  socket.on('property-default', ({ visitorName, ownerName }: { tileIndex: number; visitorName: string; ownerName: string; cashTransferred: number }) => {
    addTurnHistory(`${visitorName} couldn't pay rent — all cash to ${ownerName}, sent to Prison`);
  });

  // ── Phase 8: Career/University event handlers (host screen) ──────────

  const DEGREE_DISPLAY_HOST: Record<string, string> = {
    economics: 'Economics', computerScience: 'Computer Science',
    genderStudies: 'Gender Studies', politicalScience: 'Political Science',
    art: 'Art', teaching: 'Teaching', medical: 'Medical',
  };

  socket.on('careerEntered', (data: any) => {
    addTurnHistory(`${data.playerName} entered ${data.displayName}`);
  });

  socket.on('pathTileEvent', (data: any) => {
    const shortEvent = data.eventText.length > 40 ? data.eventText.substring(0, 37) + '...' : data.eventText;
    addTurnHistory(`${data.playerName} ${data.displayName} T${data.tileIndex + 1}: ${shortEvent}`);
  });

  socket.on('pathComplete', (data: any) => {
    let msg = `${data.playerName} completed ${data.displayName}!`;
    if (data.roleUnlock) msg += ` (${data.roleUnlock === 'isCop' ? 'Cop' : 'Artist'} role unlocked)`;
    addTurnHistory(msg);
  });

  socket.on('degreeChosen', (data: any) => {
    let msg = `${data.playerName} chose ${DEGREE_DISPLAY_HOST[data.degree] || data.degree} degree`;
    if (data.degree === 'medical') msg = `${data.playerName} earned Medical degree! Sent to Hospital for residency.`;
    addTurnHistory(msg);
  });

  socket.on('tile-student-loan-redirect', (data: any) => {
    addTurnHistory(`${data.playerName} redirected to University (loan payment)`);
  });

})();

// ── Player Game Logic ──────────────────────────────────────────────────────

(function initPlayerGame() {
  if (!document.getElementById('roll-btn')) return;

  const rollBtn         = document.getElementById('roll-btn') as HTMLButtonElement;
  const turnIndicator   = document.getElementById('turn-indicator') as HTMLElement;
  const drainNotif      = document.getElementById('drain-notification') as HTMLElement;
  const lastRollDisplay = document.getElementById('last-roll-display') as HTMLElement;

  // Stat grid references
  const statMoneyEl   = document.getElementById('stat-money') as HTMLElement;
  const statFameEl    = document.getElementById('stat-fame') as HTMLElement;
  const statHapEl     = document.getElementById('stat-happiness') as HTMLElement;
  const statHpEl      = document.getElementById('stat-hp') as HTMLElement;
  const statDegreeEl  = document.getElementById('stat-degree') as HTMLElement;
  const statCareerEl  = document.getElementById('stat-career') as HTMLElement;
  const tileInstrEl   = document.getElementById('active-tile-instruction') as HTMLElement;
  const tileNameEl    = document.getElementById('tile-name-display') as HTMLElement;
  const tileTextEl    = document.getElementById('tile-instruction-text') as HTMLElement;

  let mySocketId: string | null = null;
  let currentTurnPlayerId: string | null = null;
  let currentTurnPhase: string = 'WAITING_FOR_ROLL';
  // Board tile data received on gameStarted — used to look up tile info by position
  let boardTilesData: Array<{type: string; name: string; description: string}> = [];

  // Phase 8: Degree display names
  const DEGREE_DISPLAY: Record<string, string> = {
    economics: 'Economics',
    computerScience: 'Computer Science',
    genderStudies: 'Gender Studies',
    politicalScience: 'Political Science',
    art: 'Art',
    teaching: 'Teaching',
    medical: 'Medical',
  };

  // If socket already connected (possible when initPlayerLobby ran first), grab id immediately
  if (socket.id) mySocketId = socket.id;

  // ── Debug teleport panel (wired immediately, not inside gameStarted) ────
  if (new URLSearchParams(window.location.search).get('debug') === '1') {
    const debugPanel = document.getElementById('debug-panel');
    if (debugPanel) debugPanel.style.display = 'block';
    document.getElementById('debug-goto-btn')?.addEventListener('click', () => {
      const tile = parseInt((document.getElementById('debug-tile-input') as HTMLInputElement).value, 10);
      socket.emit('debug-goto-tile', { tile });
    });
  }

  // ── Formula reminder toggle ─────────────────────────────────────────────
  document.getElementById('formula-toggle-btn')?.addEventListener('click', () => {
    const reveal = document.getElementById('formula-reveal')!;
    const btn = document.getElementById('formula-toggle-btn')!;
    if (reveal.style.display === 'none') {
      reveal.style.display = 'block';
      btn.textContent = 'Hide your goal';
    } else {
      reveal.style.display = 'none';
      btn.textContent = 'Show your goal';
    }
  });

  // ── Helpers ────────────────────────────────────────────────────────────

  function updateRollButton(): void {
    const isMyTurn = (mySocketId !== null && currentTurnPlayerId === mySocketId);
    const canRoll  = isMyTurn && currentTurnPhase === 'WAITING_FOR_ROLL';
    rollBtn.disabled = !canRoll;
    rollBtn.style.opacity = canRoll ? '1' : '0.35';
    rollBtn.style.cursor  = canRoll ? 'pointer' : 'not-allowed';
  }

  function showDrainNotification(deductions: Array<{type: string; amount: number}>): void {
    const lines = deductions.map(d => {
      const label = d.type === 'marriage' ? 'Marriage'
        : d.type === 'kids' ? 'Kids'
        : d.type === 'student_loans' ? 'Student Loan' : d.type;
      return `-$${d.amount.toLocaleString()} ${label}`;
    });
    drainNotif.innerHTML = 'Drains Applied:<br>' + lines.join('<br>');
    drainNotif.style.opacity = '1';
    setTimeout(() => {
      drainNotif.style.opacity = '0';
    }, 3000);
  }

  function updateTurnIndicator(currentPlayerName: string): void {
    if (currentTurnPlayerId === mySocketId) {
      turnIndicator.textContent = 'Your Turn!';
      turnIndicator.style.color = '#f0c040';
    } else {
      turnIndicator.textContent = `Waiting for ${currentPlayerName}...`;
      turnIndicator.style.color = '#aaa';
    }
  }

  // ── Socket event handlers ─────────────────────────────────────────────

  socket.on('connected', ({ socketId }: { socketId: string }) => {
    mySocketId = socketId;
    updateRollButton();
  });

  socket.on('gameStarted', ({ currentPlayerSocketId, currentPlayerName, boardTiles }: { currentPlayerSocketId: string; currentPlayerName: string; turnOrder: string[]; players: unknown[]; boardTiles?: Array<{type: string; name: string; description: string}> }) => {
    const waitingSection = document.getElementById('waiting-section');
    const gameSection    = document.getElementById('game-section');
    if (waitingSection) waitingSection.style.display = 'none';
    if (gameSection)    gameSection.style.display    = 'block';

    if (boardTiles) boardTilesData = boardTiles;
    currentTurnPlayerId = currentPlayerSocketId;
    currentTurnPhase    = 'WAITING_FOR_ROLL';
    updateRollButton();
    updateTurnIndicator(currentPlayerName);
    // Initialize stat grid with defaults (gameState broadcast will update with real values)
    if (statMoneyEl) statMoneyEl.textContent = '$10,000';
    if (statHpEl)    statHpEl.textContent    = '10';
  });

  socket.on('nextTurn', ({ currentPlayer, currentPlayerName }: { currentTurnIndex: number; currentPlayer: string; currentPlayerName: string; turnNumber: number }) => {
    currentTurnPlayerId = currentPlayer;
    currentTurnPhase    = 'WAITING_FOR_ROLL';
    updateRollButton();
    updateTurnIndicator(currentPlayerName);
  });

  socket.on('drains-applied', ({ playerId, deductions, newMoney }: { playerId: string; deductions: Array<{type: string; amount: number}>; newMoney: number }) => {
    if (playerId === mySocketId) {
      if (statMoneyEl) statMoneyEl.textContent = `$${newMoney.toLocaleString()}`;
      if (deductions.length > 0) showDrainNotification(deductions);
    }
  });

  socket.on('move-token', ({ playerId, roll, d1, d2 }: { playerId: string; playerName: string; roll: number; d1: number; d2: number; fromPosition: number; toPosition: number }) => {
    if (playerId === mySocketId) {
      currentTurnPhase = 'MID_ROLL';
      updateRollButton(); // disable during roll animation
      if (lastRollDisplay) lastRollDisplay.textContent = `You rolled ${roll} (${d1} + ${d2})`;
    }
  });

  socket.on('turnSkipped', ({ playerId }: { playerId: string; playerName: string; reason: string }) => {
    if (playerId === mySocketId) {
      if (lastRollDisplay) lastRollDisplay.textContent = 'Your turn was skipped (Burnout)';
    }
  });

  socket.on('gameState', (state: any) => {
    // Sync turn state from periodic broadcast
    if (state.currentTurnPlayer) currentTurnPlayerId = state.currentTurnPlayer;
    if (state.turnPhase) currentTurnPhase = state.turnPhase;
    if (state.players && mySocketId && state.players[mySocketId]) {
      const me = state.players[mySocketId];
      // Update stat grid
      if (statMoneyEl)  statMoneyEl.textContent  = '$' + me.money.toLocaleString();
      if (statFameEl)   statFameEl.textContent    = String(me.fame ?? 0);
      if (statHapEl)    statHapEl.textContent     = String(me.happiness ?? 0);
      if (statHpEl)     statHpEl.textContent      = String(me.hp ?? 10);
      if (statCareerEl) statCareerEl.textContent  = me.career ?? 'None';
      // Phase 8: degree display name + path progress hide when not in path
      if (statDegreeEl) {
        if (me.degree) {
          statDegreeEl.textContent = DEGREE_DISPLAY[me.degree] || me.degree;
          statDegreeEl.style.color = '#f0c040';
        } else {
          statDegreeEl.textContent = 'None';
          statDegreeEl.style.color = '';
        }
      }
      if (!me.inPath) {
        const pathProgress = document.getElementById('path-progress');
        if (pathProgress) pathProgress.style.display = 'none';
      }
      // Formula reminder — populate once when successFormula is received
      if (me.successFormula) {
        const formulaReveal = document.getElementById('formula-reveal');
        if (formulaReveal && !formulaReveal.dataset.set) {
          formulaReveal.dataset.set = '1';
          formulaReveal.textContent =
            `Goal: $${me.successFormula.money.toLocaleString()} · ${me.successFormula.fame} Fame · ${me.successFormula.happiness} Happiness`;
        }
      }
      // Update tile instruction from current position
      if (me.position !== undefined && boardTilesData.length > 0) {
        const tile = boardTilesData[me.position];
        if (tile && tileInstrEl && tileNameEl && tileTextEl) {
          tileInstrEl.style.display = 'block';
          tileNameEl.textContent = 'Currently on: ' + tile.name;
          tileTextEl.textContent = tile.description;
        }
      }
    }
    updateRollButton();
  });

  socket.on('error', ({ message }: { message: string }) => {
    // Re-enable button on server error (e.g. double-roll rejected)
    const gameSection = document.getElementById('game-section');
    if (gameSection && gameSection.style.display !== 'none') {
      currentTurnPhase = 'WAITING_FOR_ROLL';
      updateRollButton();
      console.error('[player game error]', message);
    }
  });

  // ── Roll Dice button — emits roll-dice to server ─────────────────────

  rollBtn.addEventListener('click', () => {
    if (rollBtn.disabled) return;
    rollBtn.disabled = true;
    rollBtn.style.opacity = '0.35';
    rollBtn.style.cursor  = 'not-allowed';
    rollBtn.textContent   = 'Rolling...';
    socket.emit('roll-dice'); // server responds with move-token + nextTurn

    // Restore text after brief delay (server confirms via move-token)
    setTimeout(() => { rollBtn.textContent = 'Roll Dice'; }, 1000);
  });

  // ── Phase 6: Status banner helpers ───────────────────────────────────

  const statusBannerEl = document.getElementById('status-banner') as HTMLElement | null;
  function showStatusBanner(message: string, color: string): void {
    if (!statusBannerEl) return;
    statusBannerEl.textContent = message;
    statusBannerEl.style.display = 'block';
    statusBannerEl.style.background = color;
  }
  function clearStatusBanner(): void {
    if (!statusBannerEl) return;
    statusBannerEl.style.display = 'none';
    statusBannerEl.textContent = '';
  }

  // ── Phase 6: Hospital event handlers (player screen) ─────────────────

  socket.on('hospital-entered', ({ playerName, newHp }: { playerName: string; reason: string; newHp: number }) => {
    if (mySocketId && currentTurnPlayerId === mySocketId) {
      showStatusBanner(`You've been hospitalized! HP: ${newHp}. Roll to escape or pay 1/2 Salary.`, '#dc2626');
    }
    if (lastRollDisplay) lastRollDisplay.textContent = `${playerName} sent to Hospital (HP: ${newHp})`;
  });

  socket.on('hospital-stayed', ({ playerName, escapeRoll }: { playerName: string; escapeRoll: number }) => {
    if (mySocketId && currentTurnPlayerId === mySocketId) {
      showStatusBanner(`Escape failed (rolled ${escapeRoll}). Still in Hospital.`, '#dc2626');
    }
  });

  socket.on('hospital-escaped', ({ playerName, escapeRoll, hpGained, payment, newHp, newMoney }: { playerName: string; escapeRoll: number; hpGained: number; payment: number; recipientRole: string; newHp: number; newMoney: number }) => {
    clearStatusBanner();
    if (mySocketId && currentTurnPlayerId === mySocketId) {
      if (lastRollDisplay) lastRollDisplay.textContent = `Escaped! Rolled ${escapeRoll}. +${hpGained} HP. Paid $${payment.toLocaleString()}.`;
      if (statHpEl) statHpEl.textContent = String(newHp);
      if (statMoneyEl) statMoneyEl.textContent = '$' + newMoney.toLocaleString();
    }
  });

  // ── Phase 6: Prison event handlers (player screen) ───────────────────

  socket.on('prison-entered', ({ playerName }: { playerName: string }) => {
    if (lastRollDisplay) lastRollDisplay.textContent = `${playerName} sent to Prison!`;
    // Cards still allowed in prison — no block message shown
  });

  socket.on('prison-stayed', ({ playerName, roll }: { playerName: string; roll: number }) => {
    if (mySocketId && currentTurnPlayerId === mySocketId) {
      if (lastRollDisplay) lastRollDisplay.textContent = `Still in Prison (rolled ${roll}). Need 9, 11, or 12 to escape.`;
    }
  });

  socket.on('prison-escaped', ({ playerName, newPosition }: { playerName: string; roll?: number; method?: string; newPosition: number }) => {
    if (lastRollDisplay) lastRollDisplay.textContent = `${playerName} escaped Prison! Moving to tile ${newPosition}.`;
  });

  socket.on('prison-cop-immune', ({ playerName }: { playerName: string }) => {
    if (lastRollDisplay) lastRollDisplay.textContent = `${playerName} is a Cop — immune to Prison!`;
  });

  // ── Phase 6: Japan Trip event handlers (player screen) ───────────────

  socket.on('japan-landed', ({ playerName, happinessGained, newHappiness }: { playerName: string; happinessGained: number; newHappiness: number }) => {
    if (mySocketId && currentTurnPlayerId === mySocketId) {
      showStatusBanner(`Welcome to Japan! +${happinessGained} Happiness. Stay next turn?`, '#16a34a');
      if (statHapEl) statHapEl.textContent = String(newHappiness);
    }
  });

  socket.on('japan-forced-leave', ({ playerName, roll, happinessGained, costPaid }: { playerName: string; roll: number; newPosition: number; happinessGained: number; costPaid: number }) => {
    clearStatusBanner();
    if (mySocketId && currentTurnPlayerId === mySocketId) {
      if (lastRollDisplay) lastRollDisplay.textContent = `Forced to leave Japan (rolled ${roll})! +${happinessGained} Happiness, paid $${costPaid.toLocaleString()}.`;
    }
  });

  socket.on('japan-stay-choice', ({ roll, happinessGained, costPaid }: { playerName: string; roll: number; happinessGained: number; costPaid: number }) => {
    if (mySocketId && currentTurnPlayerId !== mySocketId) return; // only show to active player
    // Show stay/leave buttons
    const choiceDiv = document.getElementById('japan-choice') as HTMLElement | null;
    if (choiceDiv) {
      choiceDiv.style.display = 'block';
      choiceDiv.innerHTML = `
        <p>Japan Turn: +${happinessGained} Happiness, paid $${costPaid.toLocaleString()}. Rolled ${roll}.</p>
        <button id="japan-stay-btn">Stay in Japan</button>
        <button id="japan-leave-btn">Leave Japan</button>
      `;
      document.getElementById('japan-stay-btn')?.addEventListener('click', () => {
        socket.emit('japan-stay');
        choiceDiv.style.display = 'none';
      }, { once: true });
      document.getElementById('japan-leave-btn')?.addEventListener('click', () => {
        socket.emit('japan-leave');
        choiceDiv.style.display = 'none';
      }, { once: true });
    } else {
      // Fallback: confirm dialog if DOM element not present
      const stay = window.confirm(`Japan Turn: +${happinessGained} Happiness, paid $${costPaid.toLocaleString()}. Rolled ${roll}. Stay in Japan? (OK=Stay, Cancel=Leave)`);
      socket.emit(stay ? 'japan-stay' : 'japan-leave');
    }
  });

  // ── Phase 6: Goomba Stomp event handler (player screen) ──────────────

  socket.on('goomba-stomped', ({ stomperName, stompedNames, destination }: { stomperName: string; stompedNames: string[]; isCopStomp: boolean; destination: number }) => {
    const destLabel = destination === 10 ? 'Prison' : 'Japan Trip';
    const msg = `${stomperName} stomped ${stompedNames.join(', ')}! Sent to ${destLabel}!`;
    if (lastRollDisplay) lastRollDisplay.textContent = msg;
  });

  // ── Phase 7: Property event handlers (player screen) ────────────────

  const propertyChoiceDiv = document.getElementById('property-choice') as HTMLElement | null;
  const propertyChoiceMsg = document.getElementById('property-choice-msg') as HTMLElement | null;
  const btnBuyProperty    = document.getElementById('btn-buy-property') as HTMLButtonElement | null;
  const btnPassProperty   = document.getElementById('btn-pass-property') as HTMLButtonElement | null;

  function hidePropertyChoice(): void {
    if (propertyChoiceDiv) propertyChoiceDiv.style.display = 'none';
  }

  socket.on('property-buy-prompt', ({ tileName, cost, currentMoney }: { tileIndex: number; tileName: string; cost: number; currentMoney: number }) => {
    if (propertyChoiceDiv && propertyChoiceMsg) {
      propertyChoiceMsg.textContent = `${tileName} is for sale! Cost: $${cost.toLocaleString()}. You have $${currentMoney.toLocaleString()}.`;
      propertyChoiceDiv.style.display = 'block';
    }
  });

  if (btnBuyProperty) {
    btnBuyProperty.addEventListener('click', () => {
      socket.emit('buy-property', { accept: true });
      hidePropertyChoice();
    });
  }

  if (btnPassProperty) {
    btnPassProperty.addEventListener('click', () => {
      socket.emit('buy-property', { accept: false });
      hidePropertyChoice();
    });
  }

  socket.on('property-purchased', ({ buyerName, tileName, cost }: { tileIndex: number; ownerName: string; tileName: string; buyerName: string; cost: number }) => {
    if (lastRollDisplay) lastRollDisplay.textContent = `${buyerName} bought ${tileName} for $${cost.toLocaleString()}`;
  });

  socket.on('property-rent-paid', ({ visitorName, ownerName, rentAmount }: { tileIndex: number; visitorName: string; ownerName: string; rentAmount: number }) => {
    if (lastRollDisplay) lastRollDisplay.textContent = `${visitorName} paid $${rentAmount.toLocaleString()} rent to ${ownerName}`;
  });

  socket.on('property-default', ({ visitorName, ownerName, cashTransferred }: { tileIndex: number; visitorName: string; ownerName: string; cashTransferred: number }) => {
    if (lastRollDisplay) lastRollDisplay.textContent = `${visitorName} couldn't pay rent — all $${cashTransferred.toLocaleString()} to ${ownerName}, sent to Prison`;
  });

  // ── Phase 8: Career Entry Prompt ─────────────────────────────────────

  let pendingCareer: string | null = null;

  socket.on('careerEntryPrompt', (data: any) => {
    const careerChoice = document.getElementById('career-choice')!;
    const careerName = document.getElementById('career-name')!;
    const careerReq = document.getElementById('career-req')!;
    const careerFee = document.getElementById('career-fee')!;
    const careerButtons = document.getElementById('career-buttons')!;
    const enterBtn = document.getElementById('career-enter-btn')!;

    careerName.textContent = data.displayName;
    careerReq.textContent = data.requirements;
    careerFee.textContent = data.fee > 0 ? `Entry fee: $${data.fee.toLocaleString()}` : 'Free entry';

    if (data.meetsRequirements) {
      careerButtons.style.display = 'flex';
      enterBtn.textContent = `Enter ${data.displayName}`;
      pendingCareer = data.career;
    } else {
      careerButtons.style.display = 'none';
      careerReq.style.color = '#f87171';
      setTimeout(() => {
        careerChoice.style.display = 'none';
        careerReq.style.color = '#aaa';
      }, 2000);
    }
    careerChoice.style.display = 'block';
  });

  document.getElementById('career-enter-btn')?.addEventListener('click', () => {
    if (pendingCareer) {
      socket.emit('career-enter', { career: pendingCareer });
      document.getElementById('career-choice')!.style.display = 'none';
      pendingCareer = null;
    }
  });

  document.getElementById('career-pass-btn')?.addEventListener('click', () => {
    socket.emit('career-pass');
    document.getElementById('career-choice')!.style.display = 'none';
    pendingCareer = null;
  });

  // ── Phase 8: Degree Selection Prompt ────────────────────────────────

  socket.on('degreeSelectionPrompt', (data: any) => {
    if (data.hasDegree) return;
    const degreeChoice = document.getElementById('degree-choice')!;
    const degreeButtons = document.getElementById('degree-buttons')!;
    degreeButtons.innerHTML = '';

    for (const deg of data.availableDegrees) {
      const btn = document.createElement('button');
      btn.textContent = DEGREE_DISPLAY[deg] || deg;
      btn.style.cssText = 'padding:12px 16px; font-size:16px; font-weight:400; background:#1a1a2e; color:#eee; border:1px solid #333; border-radius:8px; cursor:pointer; text-align:left;';
      if (deg === 'medical') {
        const sub = document.createElement('div');
        sub.textContent = '(Doctor -- sent to Hospital)';
        sub.style.cssText = 'font-size:12px; color:#aaa; margin-top:4px;';
        btn.appendChild(sub);
      }
      btn.addEventListener('mouseenter', () => { btn.style.borderColor = '#f0c040'; });
      btn.addEventListener('mouseleave', () => { btn.style.borderColor = '#333'; });
      btn.addEventListener('click', () => {
        socket.emit('choose-degree', { degree: deg });
        degreeChoice.style.display = 'none';
      });
      degreeButtons.appendChild(btn);
    }
    degreeChoice.style.display = 'block';
  });

  // ── Phase 8: Streamer Roll Prompt ────────────────────────────────────

  socket.on('streamerEntryPrompt', (data: any) => {
    const streamerRoll = document.getElementById('streamer-roll')!;
    const attemptEl = document.getElementById('streamer-attempt')!;
    const resultEl = document.getElementById('streamer-result')!;
    const rollBtn2 = document.getElementById('streamer-roll-btn')!;
    attemptEl.textContent = `Attempt 1/${data.attemptsRemaining}`;
    resultEl.style.display = 'none';
    rollBtn2.style.opacity = '1';
    (rollBtn2 as HTMLButtonElement).disabled = false;
    streamerRoll.style.display = 'block';
  });

  document.getElementById('streamer-roll-btn')?.addEventListener('click', () => {
    socket.emit('streamer-roll-attempt');
  });

  document.getElementById('streamer-pass-btn')?.addEventListener('click', () => {
    socket.emit('career-pass');
    document.getElementById('streamer-roll')!.style.display = 'none';
  });

  socket.on('streamerRollResult', (data: any) => {
    const resultEl = document.getElementById('streamer-result')!;
    const rollBtn2 = document.getElementById('streamer-roll-btn')!;
    const attemptEl = document.getElementById('streamer-attempt')!;
    resultEl.style.display = 'block';

    if (data.success) {
      resultEl.textContent = "Rolled a 1 -- you're in!";
      resultEl.style.color = '#4ade80';
      setTimeout(() => {
        document.getElementById('streamer-roll')!.style.display = 'none';
      }, 1500);
    } else {
      resultEl.textContent = `Rolled a ${data.roll} -- entry failed.`;
      resultEl.style.color = '#f87171';
      if (data.attemptsRemaining > 0) {
        attemptEl.textContent = `Attempt ${3 - data.attemptsRemaining}/${2}`;
        resultEl.textContent += ' 1 attempt remaining.';
      } else {
        resultEl.textContent += ' No attempts remaining.';
        (rollBtn2 as HTMLButtonElement).disabled = true;
        rollBtn2.style.opacity = '0.5';
        setTimeout(() => {
          document.getElementById('streamer-roll')!.style.display = 'none';
        }, 2000);
      }
    }
  });

  // ── Phase 8: Path Tile Event ─────────────────────────────────────────

  socket.on('pathTileEvent', (data: any) => {
    if (data.playerId === mySocketId) {
      const tileNameEl2 = document.getElementById('tile-name-display');
      const tileInstrEl2 = document.getElementById('tile-instruction-text');
      if (tileNameEl2) tileNameEl2.textContent = `${data.displayName} -- Tile ${data.tileIndex + 1}`;
      if (tileInstrEl2) {
        let html = data.eventText;
        const sc = data.statChanges;
        const badges: string[] = [];
        if (sc.cash > 0) badges.push(`<span style="display:inline-block;padding:4px 8px;margin:2px;border-radius:4px;font-size:12px;font-weight:600;font-family:monospace;background:#1a1a2e;border:1px solid #4ade80;color:#4ade80;">+$${sc.cash.toLocaleString()}</span>`);
        if (sc.cash < 0) badges.push(`<span style="display:inline-block;padding:4px 8px;margin:2px;border-radius:4px;font-size:12px;font-weight:600;font-family:monospace;background:#1a1a2e;border:1px solid #f87171;color:#f87171;">-$${Math.abs(sc.cash).toLocaleString()}</span>`);
        if (sc.fame > 0) badges.push(`<span style="display:inline-block;padding:4px 8px;margin:2px;border-radius:4px;font-size:12px;font-weight:600;font-family:monospace;background:#1a1a2e;border:1px solid #f0c040;color:#f0c040;">+${sc.fame} Fame</span>`);
        if (sc.fame < 0) badges.push(`<span style="display:inline-block;padding:4px 8px;margin:2px;border-radius:4px;font-size:12px;font-weight:600;font-family:monospace;background:#1a1a2e;border:1px solid #f87171;color:#f87171;">${sc.fame} Fame</span>`);
        if (sc.happiness > 0) badges.push(`<span style="display:inline-block;padding:4px 8px;margin:2px;border-radius:4px;font-size:12px;font-weight:600;font-family:monospace;background:#1a1a2e;border:1px solid #4ade80;color:#4ade80;">+${sc.happiness} Happiness</span>`);
        if (sc.happiness < 0) badges.push(`<span style="display:inline-block;padding:4px 8px;margin:2px;border-radius:4px;font-size:12px;font-weight:600;font-family:monospace;background:#1a1a2e;border:1px solid #f87171;color:#f87171;">${sc.happiness} Happiness</span>`);
        if (sc.hp > 0) badges.push(`<span style="display:inline-block;padding:4px 8px;margin:2px;border-radius:4px;font-size:12px;font-weight:600;font-family:monospace;background:#1a1a2e;border:1px solid #4ade80;color:#4ade80;">+${sc.hp} HP</span>`);
        if (sc.hp < 0) badges.push(`<span style="display:inline-block;padding:4px 8px;margin:2px;border-radius:4px;font-size:12px;font-weight:600;font-family:monospace;background:#1a1a2e;border:1px solid #f87171;color:#f87171;">${sc.hp} HP</span>`);
        if (sc.salary > 0) badges.push(`<span style="display:inline-block;padding:4px 8px;margin:2px;border-radius:4px;font-size:12px;font-weight:600;font-family:monospace;background:#1a1a2e;border:1px solid #f0c040;color:#f0c040;">+$${sc.salary.toLocaleString()} Salary</span>`);
        if (badges.length > 0) html += '<div style="margin-top:8px;">' + badges.join('') + '</div>';
        if (data.specialEffect) html += `<div style="color:#f87171;margin-top:4px;font-weight:600;">${data.specialEffect === 'HOSPITAL' ? 'Sent to Hospital' : data.specialEffect === 'PRISON' ? 'Sent to Prison' : data.specialEffect}</div>`;
        tileInstrEl2.innerHTML = html;
      }
      const pathProgress = document.getElementById('path-progress');
      const pathNameEl = document.getElementById('path-name');
      const pathFraction = document.getElementById('path-fraction');
      const pathBar = document.getElementById('path-bar');
      if (pathProgress && pathNameEl && pathFraction && pathBar) {
        pathProgress.style.display = 'block';
        pathNameEl.textContent = data.displayName;
        pathFraction.textContent = `Tile ${data.tileIndex + 1} of ${data.totalTiles}`;
        pathBar.style.width = `${((data.tileIndex + 1) / data.totalTiles) * 100}%`;
      }
    }
  });

  // ── Phase 8: Career Entered ──────────────────────────────────────────

  socket.on('careerEntered', (data: any) => {
    if (data.playerId === mySocketId) {
      const pathProgress = document.getElementById('path-progress');
      const pathNameEl = document.getElementById('path-name');
      const pathFraction = document.getElementById('path-fraction');
      const pathBar = document.getElementById('path-bar');
      if (pathProgress && pathNameEl && pathFraction && pathBar) {
        pathProgress.style.display = 'block';
        pathNameEl.textContent = data.displayName;
        pathFraction.textContent = 'Tile 0 of ?';
        pathBar.style.width = '0%';
      }
    }
  });

  // ── Phase 8: Path Complete ───────────────────────────────────────────

  socket.on('pathComplete', (data: any) => {
    if (data.playerId === mySocketId) {
      const tileNameEl2 = document.getElementById('tile-name-display');
      const tileInstrEl2 = document.getElementById('tile-instruction-text');
      if (tileNameEl2) tileNameEl2.textContent = `${data.displayName} Complete!`;
      if (tileInstrEl2) {
        let html = `You finished the ${data.displayName} path.`;
        if (data.roleUnlock) html += `<div style="color:#f0c040;font-weight:600;margin-top:8px;">${data.roleUnlock === 'isCop' ? 'Cop role unlocked!' : 'Artist role unlocked!'}</div>`;
        html += '<div style="color:#aaa;font-size:12px;margin-top:4px;">Experience card earned. (Coming soon)</div>';
        tileInstrEl2.innerHTML = html;
      }
      const pathProgress = document.getElementById('path-progress');
      if (pathProgress) pathProgress.style.display = 'none';
    }
  });

  // ── Phase 8: Degree Chosen ───────────────────────────────────────────

  socket.on('degreeChosen', (data: any) => {
    if (data.playerId === mySocketId) {
      const degreeEl = document.getElementById('stat-degree');
      if (degreeEl) {
        degreeEl.textContent = DEGREE_DISPLAY[data.degree] || data.degree;
        degreeEl.style.color = '#f0c040';
      }
    }
  });

  // ── Phase 8: Cop Wait ────────────────────────────────────────────────

  socket.on('copWaitStarted', (_data: any) => {
    const turnInd = document.getElementById('turn-indicator');
    if (turnInd) {
      turnInd.textContent = 'Cop training: skip 1 turn before entering';
      turnInd.style.color = '#f0c040';
    }
  });

  socket.on('copWaitComplete', (_data: any) => {
    const turnInd = document.getElementById('turn-indicator');
    if (turnInd) {
      turnInd.textContent = 'Training complete. Entering Cop path.';
      turnInd.style.color = '#4ade80';
    }
  });

  socket.on('copWaiting', (data: any) => {
    const turnInd = document.getElementById('turn-indicator');
    if (turnInd) {
      turnInd.textContent = `Waiting at Police Academy... (${data.turnsRemaining} turn remaining)`;
      turnInd.style.color = '#f0c040';
    }
  });

  // ── Phase 8: Tile 3 Redirect ─────────────────────────────────────────

  socket.on('tile-student-loan-redirect', (_data: any) => {
    const tileNameEl2 = document.getElementById('tile-name-display');
    const tileInstrEl2 = document.getElementById('tile-instruction-text');
    if (tileNameEl2) tileNameEl2.textContent = 'Student Loan Payment';
    if (tileInstrEl2) tileInstrEl2.textContent = 'Redirected to University. Entry fee waived. -$15,000.';
  });

})();

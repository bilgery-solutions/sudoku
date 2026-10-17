"use strict";

(function () {
  const STORAGE_KEY = "bilgery-sudoku-v1";
  const LABELS = { easy: "Leicht", medium: "Mittel", hard: "Schwer" };
  const ALL = 0x1ff;
  const boardEl = document.getElementById("board");
  const padEl = document.getElementById("numberpad");
  const coverEl = document.getElementById("board-cover");
  const coverTitle = document.getElementById("cover-title");
  const coverSubtitle = document.getElementById("cover-subtitle");
  const coverSymbol = document.getElementById("cover-symbol");
  const resumeButton = document.getElementById("resume-button");
  const feedbackEl = document.getElementById("feedback");
  const confirmModal = document.getElementById("confirm-modal");
  const winModal = document.getElementById("win-modal");
  const cells = [];
  const digits = [];
  const ROW = Array.from({ length: 81 }, (_, i) => Math.floor(i / 9));
  const COL = Array.from({ length: 81 }, (_, i) => i % 9);
  const BOX = Array.from({ length: 81 }, (_, i) => Math.floor(ROW[i] / 3) * 3 + Math.floor(COL[i] / 3));
  const PEERS = Array.from({ length: 81 }, (_, i) => {
    const result = [];
    for (let j = 0; j < 81; j++) {
      if (j !== i && (ROW[j] === ROW[i] || COL[j] === COL[i] || BOX[j] === BOX[i])) result.push(j);
    }
    return result;
  });

  let game = null;
  let generating = false;
  let pendingAction = null;

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function popcount(mask) {
    let count = 0;
    while (mask) { mask &= mask - 1; count++; }
    return count;
  }

  function solvedGrid() {
    const values = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const bandOrder = shuffle([0, 1, 2]);
    const stackOrder = shuffle([0, 1, 2]);
    const rows = bandOrder.flatMap(band => shuffle([0, 1, 2]).map(r => b * 3 + r));
    const cols = stackOrder.flatMap(band => shuffle([0, 1, 2]).map(c => band * 3 + c));
    const transpose = Math.random() < .5;
    const result = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const rr = transpose ? cols[c] : rows[r];
        const cc = transpose ? rows[r] : cols[c];
        result.push(values[(rr * 3 + Math.floor(rr / 3) + cc) % 9]);
      }
    }
    return result;
  }

  // Backtracking mit Bitmasken: Bei zwei gefundenen Lösungen sofort abbrechen.
  function countSolutions(board, limit = 2) {
    const rows = new Uint16Array(9);
    const cols = new Uint16Array(9);
    const boxes = new Uint16Array(9);
    let open = 0;
    for (let i = 0; i < 81; i++) {
      const value = board[i];
      if (!value) { open++; continue; }
      const bit = 1 << (value - 1);
      const r = ROW[i], c = COL[i], b = BOX[i];
      if ((rows[r] | cols[c] | boxes[b]) & bit) return 0;
      rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
    }
    function search(remaining) {
      if (!remaining) return 1;
      let pick = -1, mask = 0, best = 10;
      for (let i = 0; i < 81; i++) {
        if (board[i]) continue;
        const allowed = ALL & ~(rows[ROW[i]] | cols[COL[i]] | boxes[BOX[i]]);
        const count = popcount(allowed);
        if (!count) return 0;
        if (count < best) {
          pick = i; mask = allowed; best = count;
          if (count === 1) break;
        }
      }
      let found = 0;
      const r = ROW[pick], c = COL[pick], b = BOX[pick];
      for (let remainingBits = mask; remainingBits; remainingBits &= remainingBits - 1) {
        const bit = remainingBits & -remainingBits;
        board[pick] = Math.log2(bit) + 1;
        rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
        found += search(remaining - 1);
        rows[r] ^= bit; cols[c] ^= bit; boxes[b] ^= bit;
        if (found >= limit) break;
      }
      board[pick] = 0;
      return found;
    }
    return search(open);
  }

  function createPuzzle(level) {
    const targets = {
      easy: 43 + Math.floor(Math.random() * 3),
      medium: 35 + Math.floor(Math.random() * 3),
      hard: 28 + Math.floor(Math.random() * 3)
    };
    const target = targets[level];
    let bestPuzzle = null;
    let bestSolution = null;
    let bestClues = 82;

    for (let attempt = 0; attempt < 4; attempt++) {
      const solution = solvedGrid();
      const puzzle = solution.slice();
      let clues = 81;

      // Zunächst möglichst symmetrische Vorgaben entfernen.
      const groups = shuffle(Array.from({ length: 41 }, (_, i) => i === 40 ? [40] : [i, 80 - i]));
      for (const group of groups) {
        if (clues - group.length < target) continue;
        const originals = group.map(i => puzzle[i]);
        group.forEach(i => { puzzle[i] = 0; });
        if (countSolutions(puzzle) === 1) clues -= group.length;
        else group.forEach((i, j) => { puzzle[i] = originals[j]; });
        if (clues <= target) break;
      }

      // Einzelne Zellen ermöglichen auch bei schwierigen Rätseln das gewünschte Niveau.
      if (clues > target) {
        const candidates = shuffle(Array.from({ length: 81 }, (_, i) => i).filter(i => puzzle[i] !== 0));
        for (const i of candidates) {
          if (clues <= target) break;
          const original = puzzle[i];
          puzzle[i] = 0;
          if (countSolutions(puzzle) === 1) clues--;
          else puzzle[i] = original;
        }
      }

      if (clues < bestClues) {
        bestClues = clues;
        bestPuzzle = puzzle;
        bestSolution = solution;
      }
      if (clues <= target + 1) break;
    }
    return { puzzle: bestPuzzle, solution: bestSolution };
  }

  function safeSave() {
    if (!game) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(game)); }
    catch (_) { /* Privater Browsermodus: App bleibt trotzdem spielbar. */ }
  }

  function restoreGame() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!saved || !LABELS[saved.level]) return null;
      for (const field of ["puzzle", "solution", "board", "notes", "hinted"]) {
        if (!Array.isArray(saved[field]) || saved[field].length !== 81) return null;
      }
      if (!saved.puzzle.every((v, i) => Number.isInteger(v) && v >= 0 && v <= 9 && (!v || v === saved.solution[i]))) return null;
      if (!saved.solution.every(v => Number.isInteger(v) && v >= 1 && v <= 9)) return null;
      if (!saved.board.every((v, i) => Number.isInteger(v) && v >= 0 && v <= 9 && (!saved.puzzle[i] || saved.puzzle[i] === v))) return null;
      if (!saved.notes.every(v => Number.isInteger(v) && v >= 0 && v <= ALL)) return null;
      saved.history = Array.isArray(saved.history) ? saved.history.slice(-80) : [];
      saved.seconds = Math.max(0, Number(saved.seconds) || 0);
      saved.selected = Number.isInteger(saved.selected) && saved.selected >= 0 && saved.selected < 81 ? saved.selected : -1;
      saved.mistakes = Math.max(0, Number(saved.mistakes) || 0);
      saved.hintsUsed = Math.max(0, Number(saved.hintsUsed) || 0);
      saved.pencil = !!saved.pencil;
      saved.paused = !!saved.paused;
      saved.completed = !!saved.completed;
      return saved;
    } catch (_) { return null; }
  }

  function setFeedback(message, type = "") {
    feedbackEl.textContent = message;
    feedbackEl.className = "feedback" + (type ? " " + type + "-message" : "");
  }

  function showCover(mode) {
    if (!mode) { coverEl.hidden = true; return; }
    coverEl.hidden = false;
    const paused = mode === "paused";
    coverTitle.textContent = paused ? "Kurze Pause." : "Rätsel wird erstellt";
    coverSubtitle.textContent = paused ? "Deine Zeit steht still." : "Einen kleinen Moment …";
    coverSymbol.innerHTML = paused
      ? '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
    resumeButton.hidden = !paused;
  }

  function formatTime(seconds) {
    const s = Math.floor(seconds);
    const minutes = Math.floor(s / 60), remaining = s % 60;
    return String(minutes).padStart(2, "0") + ":" + String(remaining).padStart(2, "0");
  }

  function updateClock() {
    document.getElementById("timer").textContent = formatTime(game ? game.seconds : 0);
  }

  function updateControls() {
    document.querySelectorAll(".level").forEach(button => {
      const active = game && game.level === button.dataset.level;
      button.classList.toggle("active", !!active);
      button.setAttribute("aria-pressed", String(!!active));
    });
    const locked = !game || game.paused || game.completed || generating;
    document.getElementById("undo").disabled = locked || !game.history.length;
    document.getElementById("erase").disabled = locked;
    document.getElementById("notes").disabled = locked;
    document.getElementById("hint").disabled = locked;
    document.getElementById("pause-button").disabled = !game || game.completed || generating;
    const noteButton = document.getElementById("notes");
    noteButton.classList.toggle("active", !!game && game.pencil);
    noteButton.setAttribute("aria-pressed", String(!!game && game.pencil));
    noteButton.setAttribute("aria-label", game && game.pencil ? "Notizmodus ausschalten" : "Notizmodus einschalten");

    const selectedNumber = game && game.selected >= 0 ? game.board[game.selected] : 0;
    digits.forEach((button, index) => {
      const digit = index + 1;
      const count = game ? game.board.filter(v => v === digit).length : 0;
      button.disabled = locked;
      button.classList.toggle("active", !!selectedNumber && selectedNumber === digit);
      button.querySelector("small").textContent = String(Math.max(0, 9 - count));
      button.setAttribute("aria-label", digit + " eintragen, " + Math.max(0, 9 - count) + " übrig");
    });

    if (game) {
      document.getElementById("level-label").textContent = LABELS[game.level].toUpperCase();
      document.getElementById("progress").textContent = game.board.filter(Boolean).length + " / 81";
    }
    document.getElementById("pause-button").setAttribute("aria-label", game && game.paused ? "Spiel fortsetzen" : "Spiel pausieren");
    updateClock();
  }

  function drawBoard() {
    if (!game) return;
    const selected = game.selected;
    const selectedValue = selected >= 0 ? game.board[selected] : 0;
    const peers = selected >= 0 ? new Set(PEERS[selected]) : new Set();
    for (let i = 0; i < 81; i++) {
      const cell = cells[i];
      const value = game.board[i];
      const classes = ["cell"];
      if (COL[i] === 2 || COL[i] === 5) classes.push("edge-right");
      if (ROW[i] === 2 || ROW[i] === 5) classes.push("edge-bottom");
      if (COL[i] === 8) classes.push("last-col");
      if (ROW[i] === 8) classes.push("last-row");
      if (game.puzzle[i]) classes.push("given");
      if (game.hinted[i]) classes.push("hinted");
      if (peers.has(i)) classes.push("peer");
      if (value && selectedValue && value === selectedValue) classes.push("same-number");
      if (i === selected) classes.push("selected");
      if (value && value !== game.solution[i]) classes.push("incorrect");
      cell.className = classes.join(" ");
      cell.setAttribute("aria-selected", String(i === selected));
      cell.setAttribute("aria-label", "Zeile " + (ROW[i] + 1) + ", Spalte " + (COL[i] + 1) + ", " +
        (value ? value + (game.puzzle[i] ? ", Vorgabe" : "") : "leer"));
      if (value) {
        cell.textContent = String(value);
      } else if (game.notes[i]) {
        const wrapper = document.createElement("span");
        wrapper.className = "notes-grid";
        for (let d = 1; d <= 9; d++) {
          const item = document.createElement("span");
          if (game.notes[i] & (1 << (d - 1))) item.textContent = String(d);
          wrapper.appendChild(item);
        }
        cell.replaceChildren(wrapper);
      } else {
        cell.textContent = "";
      }
    }
    boardEl.setAttribute("aria-busy", String(generating));
  }

  function render() {
    drawBoard();
    updateControls();
    if (generating) showCover("loading");
    else if (game && game.paused) showCover("paused");
    else showCover(null);
  }

  function selectCell(index) {
    if (!game || generating || game.paused || game.completed) return;
    game.selected = index;
    render();
    safeSave();
  }

  function snapshot() {
    game.history.push({
      board: game.board.slice(),
      notes: game.notes.slice(),
      hinted: game.hinted.slice(),
      mistakes: game.mistakes,
      hintsUsed: game.hintsUsed
    });
    if (game.history.length > 80) game.history.shift();
  }

  function undo() {
    if (!game || generating || game.paused || game.completed) return;
    const previous = game.history.pop();
    if (!previous) return;
    game.board = previous.board;
    game.notes = previous.notes;
    game.hinted = previous.hinted;
    game.mistakes = previous.mistakes;
    game.hintsUsed = previous.hintsUsed;
    setFeedback("Letzter Zug rückgängig gemacht.");
    render();
    safeSave();
  }

  function removeNotesInPeers(index, digit) {
    const mask = ~(1 << (digit - 1));
    for (const peer of PEERS[index]) game.notes[peer] &= mask;
  }

  function finishIfSolved() {
    if (!game.board.every((v, i) => v === game.solution[i])) return;
    game.completed = true;
    game.paused = false;
    setFeedback("Perfekt! Du hast alle Felder richtig ausgefüllt.", "success");
    document.getElementById("win-summary").textContent = LABELS[game.level] +
      " · " + formatTime(game.seconds) + " · " + game.mistakes +
      (game.mistakes === 1 ? " Fehler" : " Fehler") +
      " · " + game.hintsUsed + (game.hintsUsed === 1 ? " Hinweis" : " Hinweise");
    winModal.hidden = false;
  }

  function placeDigit(digit) {
    if (!game || generating || game.paused || game.completed) return;
    const i = game.selected;
    if (i < 0) { setFeedback("Wähle zuerst ein freies Feld."); return; }
    if (game.puzzle[i]) { setFeedback("Diese Zahl ist vorgegeben und kann nicht verändert werden."); return; }
    if (game.pencil) {
      if (game.board[i]) { setFeedback("Lösche zuerst die eingetragene Zahl."); return; }
      snapshot();
      game.notes[i] ^= 1 << (digit - 1);
      setFeedback("Notiz " + digit + (game.notes[i] & (1 << (digit - 1)) ? " hinzugefügt." : " entfernt."));
    } else {
      if (game.board[i] === digit && !game.notes[i]) return;
      snapshot();
      game.board[i] = digit;
      game.notes[i] = 0;
      game.hinted[i] = 0;
      if (digit !== game.solution[i]) {
        game.mistakes++;
        setFeedback("Diese Zahl passt hier nicht. Versuch es noch einmal.", "error");
      } else {
        removeNotesInPeers(i, digit);
        setFeedback("Sehr gut. Bleib dran.");
      }
      finishIfSolved();
    }
    render();
    safeSave();
  }

  function eraseCell() {
    if (!game || generating || game.paused || game.completed) return;
    const i = game.selected;
    if (i < 0) { setFeedback("Wähle zuerst ein Feld."); return; }
    if (game.puzzle[i]) { setFeedback("Vorgegebene Zahlen kannst du nicht löschen."); return; }
    if (!game.board[i] && !game.notes[i]) return;
    snapshot();
    game.board[i] = 0;
    game.notes[i] = 0;
    game.hinted[i] = 0;
    setFeedback("Feld geleert.");
    render();
    safeSave();
  }

  function useHint() {
    if (!game || generating || game.paused || game.completed) return;
    let index = game.selected;
    if (index < 0 || game.puzzle[index] || game.board[index] === game.solution[index]) {
      index = game.board.findIndex((value, i) => value !== game.solution[i]);
    }
    if (index < 0) return;
    snapshot();
    game.selected = index;
    const digit = game.solution[index];
    game.board[index] = digit;
    game.notes[index] = 0;
    game.hinted[index] = 1;
    game.hintsUsed++;
    removeNotesInPeers(index, digit);
    setFeedback("Hier gehört die " + digit + " hin.", "success");
    finishIfSolved();
    render();
    safeSave();
  }

  function toggleNotes() {
    if (!game || generating || game.paused || game.completed) return;
    game.pencil = !game.pencil;
    setFeedback(game.pencil ? "Notizmodus an: mehrere Zahlen vormerken." : "Notizmodus aus: Zahlen direkt eintragen.");
    updateControls();
    safeSave();
  }

  function togglePause() {
    if (!game || generating || game.completed) return;
    game.paused = !game.paused;
    render();
    safeSave();
  }

  function hasProgress() {
    return game && !game.completed && (
      game.board.some((value, i) => value !== game.puzzle[i]) ||
      game.notes.some(Boolean) || game.hintsUsed > 0
    );
  }

  async function startGame(level) {
    if (generating) return;
    confirmModal.hidden = true;
    winModal.hidden = true;
    generating = true;
    showCover("loading");
    updateControls();
    await new Promise(resolve => setTimeout(resolve, 35));
    try {
      const generated = createPuzzle(level);
      game = {
        level,
        puzzle: generated.puzzle,
        solution: generated.solution,
        board: generated.puzzle.slice(),
        notes: Array(81).fill(0),
        hinted: Array(81).fill(0),
        selected: -1,
        pencil: false,
        mistakes: 0,
        hintsUsed: 0,
        seconds: 0,
        paused: false,
        completed: false,
        history: []
      };
      setFeedback("Wähle ein Feld und tippe auf eine Zahl.");
    } catch (error) {
      console.error("Sudoku konnte nicht erzeugt werden:", error);
      setFeedback("Rätsel konnte nicht erstellt werden. Bitte erneut versuchen.", "error");
    } finally {
      generating = false;
      render();
      safeSave();
    }
  }

  function askForGame(level) {
    if (generating) return;
    if (hasProgress()) {
      pendingAction = () => startGame(level);
      document.getElementById("confirm-title").textContent = "Neues Rätsel?";
      document.getElementById("confirm-text").textContent = "Dein aktueller Spielfortschritt geht dabei verloren.";
      confirmModal.hidden = false;
    } else {
      startGame(level);
    }
  }

  function makeInterface() {
    for (let i = 0; i < 81; i++) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cell";
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("aria-label", "Zeile " + (ROW[i] + 1) + ", Spalte " + (COL[i] + 1));
      cell.addEventListener("click", () => selectCell(i));
      boardEl.appendChild(cell);
      cells.push(cell);
    }
    for (let d = 1; d <= 9; d++) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "digit";
      button.innerHTML = '<span>' + d + '</span><small>9</small>';
      button.addEventListener("click", () => placeDigit(d));
      padEl.appendChild(button);
      digits.push(button);
    }

    document.getElementById("new-game").addEventListener("click", () => askForGame(game ? game.level : "easy"));
    document.querySelectorAll(".level").forEach(button => button.addEventListener("click", () => {
      if (game && game.level === button.dataset.level) return;
      askForGame(button.dataset.level);
    }));
    document.getElementById("undo").addEventListener("click", undo);
    document.getElementById("erase").addEventListener("click", eraseCell);
    document.getElementById("notes").addEventListener("click", toggleNotes);
    document.getElementById("hint").addEventListener("click", useHint);
    document.getElementById("pause-button").addEventListener("click", togglePause);
    resumeButton.addEventListener("click", togglePause);

    document.getElementById("confirm-no").addEventListener("click", () => {
      pendingAction = null;
      confirmModal.hidden = true;
    });
    document.getElementById("confirm-yes").addEventListener("click", () => {
      const action = pendingAction;
      pendingAction = null;
      confirmModal.hidden = true;
      if (action) action();
    });
    document.getElementById("win-next").addEventListener("click", () => startGame(game.level));
    document.getElementById("win-close").addEventListener("click", () => { winModal.hidden = true; });
    confirmModal.addEventListener("click", event => {
      if (event.target === confirmModal) { pendingAction = null; confirmModal.hidden = true; }
    });
    winModal.addEventListener("click", event => {
      if (event.target === winModal) winModal.hidden = true;
    });

    document.addEventListener("keydown", event => {
      if (!confirmModal.hidden) {
        if (event.key === "Escape") { pendingAction = null; confirmModal.hidden = true; }
        return;
      }
      if (!winModal.hidden) {
        if (event.key === "Escape") winModal.hidden = true;
        return;
      }
      if (!game || generating || game.paused || game.completed ||
          event.altKey || event.metaKey || (event.ctrlKey && event.key.toLowerCase() !== "z")) return;
      if (event.ctrlKey && event.key.toLowerCase() === "z") { event.preventDefault(); undo(); return; }
      if (/^[1-9]$/.test(event.key)) { event.preventDefault(); placeDigit(Number(event.key)); return; }
      if (event.key === "Backspace" || event.key === "Delete" || event.key === "0") {
        event.preventDefault(); eraseCell(); return;
      }
      if (event.key.toLowerCase() === "n") { event.preventDefault(); toggleNotes(); return; }
      const moves = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 };
      if (moves[event.key] !== undefined) {
        event.preventDefault();
        const origin = game.selected < 0 ? 0 : game.selected;
        const row = ROW[origin], col = COL[origin];
        let next = origin;
        if (event.key === "ArrowUp") next = ((row + 8) % 9) * 9 + col;
        if (event.key === "ArrowDown") next = ((row + 1) % 9) * 9 + col;
        if (event.key === "ArrowLeft") next = row * 9 + (col + 8) % 9;
        if (event.key === "ArrowRight") next = row * 9 + (col + 1) % 9;
        selectCell(next);
      }
    });

    window.addEventListener("pagehide", safeSave);
    document.addEventListener("visibilitychange", safeSave);
    setInterval(() => {
      if (game && !game.paused && !game.completed && !generating && !document.hidden) {
        game.seconds++;
        updateClock();
        safeSave();
      }
    }, 1000);
  }

  makeInterface();
  game = restoreGame();
  if (game) {
    render();
    setFeedback(game.completed ? "Geschafft! Starte ein neues Rätsel." : "Dein letztes Rätsel ist wieder da.");
  } else {
    startGame("easy");
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }
})();

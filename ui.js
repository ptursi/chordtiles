/* ========================================================================
   ui.js — Chord Tiles — Board Rendering, Rack, Preview, Modals, Drag & Drop
   ======================================================================== */
(function () {
  "use strict";
  var CT = window.CT;

  /* ── Cached DOM references ──────────────────────────────────────────── */

  var els = {};
  var cellElements = [];   // [row][col] cached cell divs
  var rackElements = [];   // cached rack tile divs
  var selectedRackTile = null;
  var dragState = null;
  var selectedBoardVariantId = null; // set during board selection

  CT.ui = {};

  /* ── Cache elements ─────────────────────────────────────────────────── */

  CT.ui.cacheElements = function () {
    els.landingScreen = document.getElementById("landingScreen");
    els.launchGameBtn = document.getElementById("launchGameBtn");
    els.setupModal = document.getElementById("setupModal");
    els.closeSetupModal = document.getElementById("closeSetupModal");
    els.setupForm = document.getElementById("setupForm");
    els.setupWarning = document.getElementById("setupWarning");
    els.numPlayers = document.getElementById("numPlayers");
    els.playerNamesContainer = document.getElementById("playerNamesContainer");
    els.includeAccidentals = document.getElementById("includeAccidentals");
    els.enableVariantMode = document.getElementById("enableVariantMode");
    els.winCondition = document.getElementById("winCondition");
    els.roundLimitField = document.getElementById("roundLimitField");
    els.roundLimit = document.getElementById("roundLimit");
    els.targetScoreField = document.getElementById("targetScoreField");
    els.targetScore = document.getElementById("targetScore");
    els.enableTimedTurns = document.getElementById("enableTimedTurns");
    els.timedTurnSeconds = document.getElementById("timedTurnSeconds");
    els.timerField = document.getElementById("timerField");
    els.enableEarTraining = document.getElementById("enableEarTraining");
    els.playbackMode = document.getElementById("playbackMode");
    els.enableTileSwap = document.getElementById("enableTileSwap");
    els.saveSetupBtn = document.getElementById("saveSetupBtn");

    els.boardSelectModal = document.getElementById("boardSelectModal");
    els.boardCardGrid = document.getElementById("boardCardGrid");
    els.boardSelectContinueBtn = document.getElementById("boardSelectContinueBtn");
    els.setupBoardSummary = document.getElementById("setupBoardSummary");
    els.setupBoardName = document.getElementById("setupBoardName");
    els.setupBoardDesc = document.getElementById("setupBoardDesc");
    els.setupBackBtn = document.getElementById("setupBackBtn");
    els.enableBlockedSpaces = document.getElementById("enableBlockedSpaces");

    els.gameContainer = document.getElementById("gameContainer");
    els.board = document.getElementById("board");
    els.boardWrapper = document.getElementById("boardWrapper");
    els.rackContainer = document.getElementById("rackContainer");
    els.currentPlayerDisplay = document.getElementById("currentPlayerDisplay");
    els.roundDisplay = document.getElementById("roundDisplay");
    els.timerDisplay = document.getElementById("timerDisplay");
    els.bagCount = document.getElementById("bagCount");
    els.scoreboardContainer = document.getElementById("scoreboardContainer");
    els.previewPanel = document.getElementById("previewPanel");
    els.previewChords = document.getElementById("previewChords");
    els.previewScore = document.getElementById("previewScore");
    els.previewError = document.getElementById("previewError");
    els.boardScoreOverlay = document.getElementById("boardScoreOverlay");
    els.bonusPanel = document.getElementById("bonusPanel");
    els.bonusList = document.getElementById("bonusList");

    els.confirmMoveBtn = document.getElementById("confirmMoveBtn");
    els.passTurnBtn = document.getElementById("passTurnBtn");
    els.swapTilesBtn = document.getElementById("swapTilesBtn");
    els.shuffleRackBtn = document.getElementById("shuffleRackBtn");
    els.recallTilesBtn = document.getElementById("recallTilesBtn");
    els.settingsBtn = document.getElementById("settingsBtn");

    els.passDeviceOverlay = document.getElementById("passDeviceOverlay");
    els.turnSummary = document.getElementById("turnSummary");
    els.turnSummaryReplay = document.getElementById("turnSummaryReplay");
    els.nextPlayerName = document.getElementById("nextPlayerName");
    els.startTurnBtn = document.getElementById("startTurnBtn");

    els.confirmModal = document.getElementById("confirmModal");
    els.confirmEyebrow = document.getElementById("confirmEyebrow");
    els.confirmTitle = document.getElementById("confirmTitle");
    els.confirmMessage = document.getElementById("confirmMessage");
    els.confirmYes = document.getElementById("confirmYes");
    els.confirmNo = document.getElementById("confirmNo");
    els.closeConfirmModal = document.getElementById("closeConfirmModal");

    els.wildPickerModal = document.getElementById("wildPickerModal");
    els.wildPickerGrid = document.getElementById("wildPickerGrid");

    els.settingsModal = document.getElementById("settingsModal");
    els.closeSettingsModal = document.getElementById("closeSettingsModal");
    els.saveSettingsBtn = document.getElementById("saveSettingsBtn");
    els.midEarTraining = document.getElementById("midEarTraining");
    els.midPlaybackMode = document.getElementById("midPlaybackMode");
    els.midRestartBtn = document.getElementById("midRestartBtn");
    els.midNewGameBtn = document.getElementById("midNewGameBtn");

    els.swapModal = document.getElementById("swapModal");
    els.closeSwapModal = document.getElementById("closeSwapModal");
    els.swapRack = document.getElementById("swapRack");
    els.swapConfirmBtn = document.getElementById("swapConfirmBtn");
    els.swapCancelBtn = document.getElementById("swapCancelBtn");

    els.gameOverModal = document.getElementById("gameOverModal");
    els.gameOverTitle = document.getElementById("gameOverTitle");
    els.gameOverMessage = document.getElementById("gameOverMessage");
    els.gameOverScores = document.getElementById("gameOverScores");
    els.gameOverNewGame = document.getElementById("gameOverNewGame");
  };

  CT.ui.els = function () { return els; };

  /* ── Escape HTML ────────────────────────────────────────────────────── */

  function esc(str) {
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* ── Board building ─────────────────────────────────────────────────── */

  CT.ui.buildBoard = function () {
    var board = CT.state.board;
    els.board.innerHTML = "";
    cellElements = [];

    for (var r = 0; r < 15; r++) {
      cellElements[r] = [];
      for (var c = 0; c < 15; c++) {
        var cell = board[r][c];
        var div = document.createElement("div");
        div.className = "cell";
        div.dataset.row = r;
        div.dataset.col = c;

        if (cell.isBlocked) {
          div.classList.add("cell-blocked");
        } else {
          if (cell.premiumType && CT.PREMIUM_INFO[cell.premiumType]) {
            div.classList.add(CT.PREMIUM_INFO[cell.premiumType].cssClass);
          }
          if (r === CT.CENTER && c === CT.CENTER) {
            div.classList.add("cell-center");
          }
          // Label
          if (cell.premiumType && !cell.isBlocked) {
            var label = document.createElement("span");
            label.className = "cell-label";
            label.textContent = cell.premiumType;
            div.appendChild(label);
          }
        }

        div.addEventListener("click", onCellClick);
        els.board.appendChild(div);
        cellElements[r][c] = div;
      }
    }
  };

  /* ── Cell updates (incremental) ─────────────────────────────────────── */

  CT.ui.updateCell = function (row, col) {
    var div = cellElements[row] && cellElements[row][col];
    if (!div) return;
    var cell = CT.state.board[row][col];

    // Remove tile children
    var existing = div.querySelector(".board-tile");
    if (existing) existing.remove();

    // Reset tile-related classes
    div.classList.remove("cell-has-tile", "cell-has-locked-tile",
      "cell-drop-target", "cell-valid-group", "cell-invalid-group", "cell-chord-glow");

    if (cell.tile) {
      div.classList.add("cell-has-tile");
      if (cell.isLocked) div.classList.add("cell-has-locked-tile");

      var tileDiv = document.createElement("div");
      tileDiv.className = "board-tile";
      if (cell.tile.isWild) tileDiv.classList.add("is-wild");
      if (!cell.isLocked) {
        tileDiv.classList.add("placed-this-turn");
        tileDiv.classList.add("just-placed");
        // Remove animation class after it plays
        setTimeout(function () { tileDiv.classList.remove("just-placed"); }, 250);
      }

      var noteName = CT.getEffectiveNote(cell.tile);
      var noteSpan = document.createElement("span");
      noteSpan.className = "board-tile-note";
      noteSpan.textContent = noteName || (cell.tile.isWild ? "W" : "?");
      if (noteName && noteName.indexOf("/") !== -1) {
        noteSpan.classList.add("board-tile-note--small");
      }
      tileDiv.appendChild(noteSpan);

      var ptsSpan = document.createElement("span");
      ptsSpan.className = "board-tile-points";
      ptsSpan.textContent = cell.tile.isWild ? "0" : cell.tile.points;
      tileDiv.appendChild(ptsSpan);

      div.appendChild(tileDiv);

      // Hide premium label when tile is placed
      var label = div.querySelector(".cell-label");
      if (label) label.style.display = "none";
    } else {
      var lbl = div.querySelector(".cell-label");
      if (lbl) lbl.style.display = "";
    }
  };

  CT.ui.updateCells = function (positions) {
    positions.forEach(function (p) { CT.ui.updateCell(p.row, p.col); });
  };

  CT.ui.highlightGroups = function (groups, chordResults) {
    // Clear all group highlights
    for (var r = 0; r < 15; r++) {
      for (var c = 0; c < 15; c++) {
        var div = cellElements[r][c];
        div.classList.remove("cell-valid-group", "cell-invalid-group", "cell-chord-glow");
      }
    }

    if (!groups) return;

    // Map chord results by group index
    var validGroupIndices = {};
    if (chordResults) {
      chordResults.forEach(function (cr) {
        for (var gi = 0; gi < groups.length; gi++) {
          if (groups[gi] === cr.group) {
            validGroupIndices[gi] = true;
            break;
          }
        }
      });
    }

    groups.forEach(function (group, gi) {
      if (group.cells.length < 3) return; // Skip 2-note groups
      var isValid = validGroupIndices[gi];
      group.cells.forEach(function (cell) {
        var div = cellElements[cell.row][cell.col];
        if (isValid) {
          div.classList.add("cell-valid-group");
        } else {
          div.classList.add("cell-invalid-group");
        }
      });
    });
  };

  /* ── Rack rendering ─────────────────────────────────────────────────── */

  CT.ui.renderRack = function () {
    var player = CT.currentPlayer();
    if (!player) return;

    els.rackContainer.innerHTML = "";
    rackElements = [];
    selectedRackTile = null;

    for (var i = 0; i < CT.RACK_SIZE; i++) {
      var tile = player.rack[i];
      if (!tile) {
        var empty = document.createElement("div");
        empty.className = "rack-tile-empty";
        els.rackContainer.appendChild(empty);
        rackElements.push(null);
        continue;
      }

      var div = document.createElement("div");
      div.className = "rack-tile";
      if (tile.isWild) div.classList.add("is-wild");
      div.dataset.tileId = tile.id;
      div.dataset.rackIndex = i;

      var note = document.createElement("span");
      note.className = "rack-tile-note";
      note.textContent = tile.isWild ? "W" : tile.note;
      div.appendChild(note);

      var pts = document.createElement("span");
      pts.className = "rack-tile-points";
      pts.textContent = tile.points;
      div.appendChild(pts);

      // Tap to select
      div.addEventListener("click", onRackTileClick);

      // Drag start (pointer events)
      div.addEventListener("pointerdown", onRackTilePointerDown);

      div.style.touchAction = "none";

      els.rackContainer.appendChild(div);
      rackElements.push(div);
    }
  };

  /* ── Rack tile interaction ──────────────────────────────────────────── */

  function onRackTileClick(e) {
    if (dragState) return; // Ignore clicks during drag
    var tileId = parseInt(e.currentTarget.dataset.tileId);
    var player = CT.currentPlayer();
    var tile = player.rack.find(function (t) { return t.id === tileId; });
    if (!tile) return;

    // Play note if ear training is on
    if (CT.state.settings.enableEarTraining && CT.state.settings.autoPlayTileOnTap) {
      var noteName = tile.isWild ? null : tile.note;
      if (noteName) CT.playNote(noteName);
    }

    // Toggle selection
    if (selectedRackTile && selectedRackTile.id === tile.id) {
      selectedRackTile = null;
    } else {
      selectedRackTile = tile;
    }
    updateRackSelection();
  }

  function updateRackSelection() {
    rackElements.forEach(function (el) {
      if (!el) return;
      el.classList.remove("is-selected");
      if (selectedRackTile && el.dataset.tileId == selectedRackTile.id) {
        el.classList.add("is-selected");
      }
    });
  }

  /* ── Cell click (tap-to-place) ──────────────────────────────────────── */

  function onCellClick(e) {
    var row = parseInt(e.currentTarget.dataset.row);
    var col = parseInt(e.currentTarget.dataset.col);
    var cell = CT.state.board[row][col];

    // If cell has a tile placed this turn, return it to rack
    if (cell.tile && !cell.isLocked) {
      var removed = CT.removeTileFromBoard(row, col);
      if (removed) {
        CT.ui.updateCell(row, col);
        CT.ui.renderRack();
        CT.emit("placement-changed");
        return;
      }
    }

    // If we have a selected rack tile and cell is empty, place it
    if (selectedRackTile && !cell.tile && !cell.isBlocked) {
      var tile = selectedRackTile;
      selectedRackTile = null;

      // If wild tile, prompt for note assignment first
      if (tile.isWild && !tile.assignedNote) {
        showWildPicker(tile, function () {
          CT.placeTileOnBoard(row, col, tile);
          CT.ui.updateCell(row, col);
          CT.ui.renderRack();
          CT.emit("placement-changed");
        });
        return;
      }

      CT.placeTileOnBoard(row, col, tile);
      CT.ui.updateCell(row, col);
      CT.ui.renderRack();

      // Play note on placement
      if (CT.state.settings.enableEarTraining && CT.state.settings.autoPlayTileOnTap) {
        var pNote = CT.getEffectiveNote(tile);
        if (pNote) CT.playNote(pNote);
      }

      CT.emit("placement-changed");
    }
  }

  /* ── Drag and drop (pointer events) ─────────────────────────────────── */

  function onRackTilePointerDown(e) {
    if (e.button !== 0) return;
    var tileId = parseInt(e.currentTarget.dataset.tileId);
    var player = CT.currentPlayer();
    var tile = player.rack.find(function (t) { return t.id === tileId; });
    if (!tile) return;

    var startX = e.clientX;
    var startY = e.clientY;
    var moved = false;

    function onMove(me) {
      var dx = me.clientX - startX;
      var dy = me.clientY - startY;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 8) return;

      if (!moved) {
        moved = true;
        selectedRackTile = null;
        updateRackSelection();
        startDrag(tile, me.clientX, me.clientY);
      }

      if (dragState) {
        dragState.ghost.style.left = me.clientX + "px";
        dragState.ghost.style.top = me.clientY + "px";

        // Find drop target
        dragState.ghost.style.display = "none";
        var target = document.elementFromPoint(me.clientX, me.clientY);
        dragState.ghost.style.display = "";

        clearDropHighlight();
        if (target) {
          var cellDiv = target.closest(".cell");
          if (cellDiv && !cellDiv.classList.contains("cell-blocked") &&
              !cellDiv.classList.contains("cell-has-tile")) {
            cellDiv.classList.add("cell-drop-target");
            dragState.targetCell = cellDiv;
          } else {
            dragState.targetCell = null;
          }
        }
      }
    }

    function onUp(ue) {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);

      if (dragState) {
        endDrag();
      }
    }

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  }

  function startDrag(tile, x, y) {
    var ghost = document.createElement("div");
    ghost.className = "drag-ghost";
    if (tile.isWild) ghost.classList.add("is-wild");
    ghost.textContent = tile.isWild ? (tile.assignedNote || "W") : tile.note;
    ghost.style.left = x + "px";
    ghost.style.top = y + "px";
    document.body.appendChild(ghost);

    dragState = { tile: tile, ghost: ghost, targetCell: null };

    // Hide the rack tile visually
    var rackEl = rackElements.find(function (el) { return el && el.dataset.tileId == tile.id; });
    if (rackEl) rackEl.style.opacity = "0.3";
  }

  function endDrag() {
    if (!dragState) return;

    var tile = dragState.tile;
    var target = dragState.targetCell;

    // Remove ghost
    dragState.ghost.remove();
    clearDropHighlight();

    // Restore rack tile visibility
    var rackEl = rackElements.find(function (el) { return el && el.dataset.tileId == tile.id; });
    if (rackEl) rackEl.style.opacity = "";

    if (target) {
      var row = parseInt(target.dataset.row);
      var col = parseInt(target.dataset.col);

      if (tile.isWild && !tile.assignedNote) {
        var capturedRow = row, capturedCol = col;
        dragState = null;
        showWildPicker(tile, function () {
          CT.placeTileOnBoard(capturedRow, capturedCol, tile);
          CT.ui.updateCell(capturedRow, capturedCol);
          CT.ui.renderRack();
          CT.emit("placement-changed");
        });
        return;
      }

      CT.placeTileOnBoard(row, col, tile);
      CT.ui.updateCell(row, col);
      CT.ui.renderRack();

      if (CT.state.settings.enableEarTraining && CT.state.settings.autoPlayTileOnTap) {
        var pNote = CT.getEffectiveNote(tile);
        if (pNote) CT.playNote(pNote);
      }

      CT.emit("placement-changed");
    } else {
      // Return to rack (no-op, tile wasn't removed yet in drag)
    }

    dragState = null;
  }

  function clearDropHighlight() {
    var highlighted = document.querySelectorAll(".cell-drop-target");
    for (var i = 0; i < highlighted.length; i++) {
      highlighted[i].classList.remove("cell-drop-target");
    }
  }

  /* ── Wild tile picker ───────────────────────────────────────────────── */

  var wildPickerCallback = null;

  function showWildPicker(tile, callback) {
    wildPickerCallback = function (noteName) {
      CT.assignWildTile(tile, noteName);
      closeModal(els.wildPickerModal);
      if (callback) callback();
    };

    var notes = CT.state.settings.includeAccidentals
      ? CT.PITCH_NAMES_FROM_C
      : CT.NATURAL_NOTES;

    els.wildPickerGrid.innerHTML = "";
    notes.forEach(function (note) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "wild-picker-btn";
      btn.textContent = note;
      btn.addEventListener("click", function () {
        if (wildPickerCallback) wildPickerCallback(note);
      });
      els.wildPickerGrid.appendChild(btn);
    });

    openModal(els.wildPickerModal);
  }

  /* ── Scoreboard ─────────────────────────────────────────────────────── */

  CT.ui.renderScoreboard = function () {
    var st = CT.state;
    if (!st) return;
    els.scoreboardContainer.innerHTML = "";
    st.players.forEach(function (player, i) {
      var pill = document.createElement("div");
      pill.className = "score-pill";
      if (i === st.currentPlayerIndex) pill.classList.add("is-active");
      pill.innerHTML =
        '<span class="score-pill-name" style="color:' + CT.PLAYER_COLORS[i] + '">' + esc(player.name) + '</span>' +
        '<span class="score-pill-score">' + player.score + '</span>';
      els.scoreboardContainer.appendChild(pill);
    });
  };

  /* ── Turn info ──────────────────────────────────────────────────────── */

  CT.ui.renderTurnInfo = function () {
    var st = CT.state;
    if (!st) return;
    var player = st.players[st.currentPlayerIndex];
    els.currentPlayerDisplay.innerHTML = '<span style="color:' + CT.PLAYER_COLORS[st.currentPlayerIndex] + '">' + esc(player.name) + '</span>';

    var roundText = "Round " + st.roundNumber;
    if (st.settings.winCondition === "rounds") {
      roundText += " of " + st.settings.roundLimit;
    }
    if (st.finalRound) roundText += " (Final)";
    els.roundDisplay.textContent = roundText;
    els.bagCount.textContent = "Tiles in bag: " + CT.getBagCount();

    // Swap button visibility
    els.swapTilesBtn.hidden = !st.settings.enableTileSwap;
  };

  /* ── Preview panel ──────────────────────────────────────────────────── */

  CT.ui.updatePreview = function (validationResult, scoreResult) {
    var placed = CT.getPlacedTilePositions();

    if (placed.length === 0) {
      els.previewPanel.hidden = true;
      els.confirmMoveBtn.disabled = true;
      CT.ui.highlightGroups(null, null);
      if (els.boardScoreOverlay) els.boardScoreOverlay.hidden = true;
      return;
    }

    els.previewPanel.hidden = false;

    if (!validationResult) {
      els.previewChords.innerHTML = "";
      els.previewScore.textContent = "";
      els.previewError.textContent = "";
      els.confirmMoveBtn.disabled = true;
      if (els.boardScoreOverlay) els.boardScoreOverlay.hidden = true;
      return;
    }

    // Highlight groups
    CT.ui.highlightGroups(validationResult.groups, validationResult.chordResults);

    if (validationResult.valid && scoreResult) {
      els.previewChords.innerHTML = scoreResult.chords.map(function (c) {
        return '<span class="preview-chord-tag">' + esc(c.displayName) + ' (+' + c.groupScore + ')</span>';
      }).join("");
      els.previewScore.textContent = "Total: " + scoreResult.totalScore + " points";
      els.previewError.textContent = "";
      els.confirmMoveBtn.disabled = false;
      if (els.boardScoreOverlay) {
        els.boardScoreOverlay.hidden = false;
        els.boardScoreOverlay.textContent = "+" + scoreResult.totalScore + " pts";
      }
    } else {
      els.previewChords.innerHTML = "";
      els.previewScore.textContent = "";
      els.previewError.textContent = validationResult.errors.join(" ");
      els.confirmMoveBtn.disabled = true;
      if (els.boardScoreOverlay) els.boardScoreOverlay.hidden = true;
    }
  };

  /* ── Bonus panel (removed) ────────────────────────────────────────── */

  CT.ui.renderBonuses = function () {
    // Bonuses removed — no-op for backward compatibility
  };

  /* ── Modal helpers ──────────────────────────────────────────────────── */

  function openModal(modal) {
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
  }

  function closeModal(modal) {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
  }

  CT.ui.openModal = openModal;
  CT.ui.closeModal = closeModal;

  /* ── Confirmation modal ─────────────────────────────────────────────── */

  var pendingConfirm = null;
  var pendingCancel = null;

  CT.ui.showConfirm = function (opts) {
    els.confirmEyebrow.textContent = opts.eyebrow || "Confirm";
    els.confirmTitle.textContent = opts.title || "Are you sure?";
    els.confirmMessage.textContent = opts.message || "";
    els.confirmYes.textContent = opts.confirmText || "Confirm";
    els.confirmNo.textContent = opts.cancelText || "Cancel";
    pendingConfirm = opts.onConfirm || null;
    pendingCancel = opts.onCancel || null;
    openModal(els.confirmModal);
  };

  CT.ui.bindConfirmModal = function () {
    els.confirmYes.addEventListener("click", function () {
      closeModal(els.confirmModal);
      if (pendingConfirm) pendingConfirm();
      pendingConfirm = null;
      pendingCancel = null;
    });
    els.confirmNo.addEventListener("click", function () {
      closeModal(els.confirmModal);
      if (pendingCancel) pendingCancel();
      pendingConfirm = null;
      pendingCancel = null;
    });
    els.closeConfirmModal.addEventListener("click", function () {
      closeModal(els.confirmModal);
      pendingConfirm = null;
      pendingCancel = null;
    });
  };

  /* ── Pass device overlay ────────────────────────────────────────────── */

  CT.ui.showPassDevice = function (summary, nextPlayerIndex, hasChords) {
    var nextPlayer = CT.state.players[nextPlayerIndex];
    els.turnSummary.innerHTML = summary;
    els.nextPlayerName.textContent = nextPlayer.name;
    els.nextPlayerName.style.color = CT.PLAYER_COLORS[nextPlayerIndex];
    els.turnSummaryReplay.hidden = !hasChords;
    els.passDeviceOverlay.hidden = false;
  };

  CT.ui.hidePassDevice = function () {
    els.passDeviceOverlay.hidden = true;
  };

  /* ── Swap modal ─────────────────────────────────────────────────────── */

  var swapSelected = [];

  CT.ui.showSwapModal = function () {
    var player = CT.currentPlayer();
    if (!player) return;
    swapSelected = [];

    els.swapRack.innerHTML = "";
    player.rack.forEach(function (tile) {
      var div = document.createElement("div");
      div.className = "swap-tile";
      if (tile.isWild) div.classList.add("is-wild");
      div.textContent = tile.isWild ? "W" : tile.note;
      div.dataset.tileId = tile.id;
      div.addEventListener("click", function () {
        var idx = swapSelected.indexOf(tile.id);
        if (idx >= 0) {
          swapSelected.splice(idx, 1);
          div.classList.remove("is-selected");
        } else {
          swapSelected.push(tile.id);
          div.classList.add("is-selected");
        }
      });
      els.swapRack.appendChild(div);
    });

    openModal(els.swapModal);
  };

  CT.ui.getSwapSelected = function () { return swapSelected; };

  /* ── Game over modal ────────────────────────────────────────────────── */

  CT.ui.showGameOver = function (result) {
    var st = CT.state;
    var winnerNames = result.winners.map(function (i) { return st.players[i].name; });
    els.gameOverTitle.textContent = result.winners.length === 1
      ? winnerNames[0] + " wins!"
      : "It's a tie!";

    var reasons = {
      "rounds-complete": "Final round complete.",
      "target-reached": winnerNames[0] + " reached the target score.",
      "all-passed": "All players passed consecutively.",
      "bag-depleted": "Tile bag depleted. Final scores:"
    };
    els.gameOverMessage.textContent = reasons[result.reason] || "Game over.";

    els.gameOverScores.innerHTML = "";
    st.players.forEach(function (p, i) {
      var row = document.createElement("div");
      row.className = "game-over-row";
      if (result.winners.indexOf(i) >= 0) row.classList.add("is-winner");
      row.innerHTML =
        '<span style="color:' + CT.PLAYER_COLORS[i] + ';font-weight:700">' + esc(p.name) + '</span>' +
        '<span style="font-weight:800">' + p.score + '</span>';
      els.gameOverScores.appendChild(row);
    });

    openModal(els.gameOverModal);
  };

  /* ── Landing / setup visibility ─────────────────────────────────────── */

  CT.ui.hideLanding = function () {
    els.landingScreen.classList.remove("is-open");
  };

  CT.ui.showSetup = function () {
    // Update board summary at top of settings
    var variantId = selectedBoardVariantId || CT.DEFAULT_BOARD_VARIANT_ID;
    var variant = CT.getBoardVariantById(variantId);
    if (variant && els.setupBoardName) {
      els.setupBoardName.textContent = variant.name;
      els.setupBoardDesc.textContent = variant.shortDescription;
    }
    syncPlayerNames(parseInt(els.numPlayers.value) || 2);
    updateSetupVisibility();
    openModal(els.setupModal);
  };

  CT.ui.hideSetup = function () {
    closeModal(els.setupModal);
  };

  /* ── Board selection ────────────────────────────────────────────────── */

  CT.ui.showBoardSelect = function () {
    selectedBoardVariantId = selectedBoardVariantId || CT.DEFAULT_BOARD_VARIANT_ID;
    renderBoardCards();
    els.boardSelectContinueBtn.disabled = false; // always have a default
    openModal(els.boardSelectModal);
  };

  CT.ui.hideBoardSelect = function () {
    closeModal(els.boardSelectModal);
  };

  CT.ui.getSelectedBoardVariantId = function () {
    return selectedBoardVariantId || CT.DEFAULT_BOARD_VARIANT_ID;
  };

  function renderBoardCards() {
    if (!els.boardCardGrid) return;
    els.boardCardGrid.innerHTML = "";
    var currentId = selectedBoardVariantId || CT.DEFAULT_BOARD_VARIANT_ID;

    CT.BOARD_VARIANTS.forEach(function (variant) {
      var card = document.createElement("div");
      card.className = "board-card";
      if (variant.id === currentId) card.classList.add("is-selected");
      card.dataset.variantId = variant.id;

      // Mini board preview
      card.appendChild(buildMiniPreview(variant.layout));

      // Name
      var nameEl = document.createElement("div");
      nameEl.className = "board-card-name";
      nameEl.textContent = variant.name;
      card.appendChild(nameEl);

      // Description
      var descEl = document.createElement("div");
      descEl.className = "board-card-desc";
      descEl.textContent = variant.shortDescription;
      card.appendChild(descEl);

      card.addEventListener("click", function () {
        selectedBoardVariantId = variant.id;
        var cards = els.boardCardGrid.querySelectorAll(".board-card");
        cards.forEach(function (c) { c.classList.remove("is-selected"); });
        card.classList.add("is-selected");
        els.boardSelectContinueBtn.disabled = false;
      });

      els.boardCardGrid.appendChild(card);
    });
  }

  function buildMiniPreview(layout) {
    var wrap = document.createElement("div");
    wrap.className = "board-mini-preview";

    var cellClassMap = {
      "TC": "board-mini-tc",
      "DC": "board-mini-dc",
      "TN": "board-mini-tn",
      "DN": "board-mini-dn",
      "CS": "board-mini-cs"
    };

    for (var r = 0; r < 15; r++) {
      for (var c = 0; c < 15; c++) {
        var cell = document.createElement("div");
        cell.className = "board-mini-cell";
        var val = layout[r][c];
        if (cellClassMap[val]) {
          cell.classList.add(cellClassMap[val]);
        } else if (r === 7 && c === 7) {
          cell.classList.add("board-mini-center");
        } else {
          cell.classList.add("board-mini-normal");
        }
        wrap.appendChild(cell);
      }
    }

    return wrap;
  }

  CT.ui.showGame = function () {
    els.gameContainer.hidden = false;
  };

  /* ── Setup form helpers ─────────────────────────────────────────────── */

  function syncPlayerNames(count) {
    count = Math.max(1, Math.min(6, count));
    els.playerNamesContainer.innerHTML = "";
    for (var i = 0; i < count; i++) {
      var input = document.createElement("input");
      input.type = "text";
      input.placeholder = "Player " + (i + 1);
      input.value = "";
      input.dataset.playerIndex = i;
      els.playerNamesContainer.appendChild(input);
    }
  }

  function updateSetupVisibility() {
    var isRounds = els.winCondition.value === "rounds";
    els.roundLimitField.style.display = isRounds ? "" : "none";
    els.targetScoreField.style.display = isRounds ? "none" : "";
  }

  function syncEarTrainingDisabledState() {
    var on = els.enableEarTraining.checked;
    els.playbackMode.disabled = !on;
    els.playbackMode.style.opacity = on ? "" : "0.4";
  }

  CT.ui.bindSetupForm = function () {
    els.numPlayers.addEventListener("input", function () {
      syncPlayerNames(parseInt(els.numPlayers.value) || 2);
    });
    els.winCondition.addEventListener("change", updateSetupVisibility);
    els.enableEarTraining.addEventListener("change", syncEarTrainingDisabledState);
    syncEarTrainingDisabledState();
  };

  CT.ui.getSetupSettings = function () {
    var count = Math.max(1, Math.min(6, parseInt(els.numPlayers.value) || 2));
    var names = [];
    var inputs = els.playerNamesContainer.querySelectorAll("input");
    for (var i = 0; i < count; i++) {
      var val = inputs[i] ? inputs[i].value.trim() : "";
      names.push(val || ("Player " + (i + 1)));
    }

    return {
      numberOfPlayers: count,
      playerNames: names,
      includeAccidentals: els.includeAccidentals.checked,
      enableVariantMode: els.enableVariantMode.checked,
      winCondition: els.winCondition.value,
      roundLimit: Math.max(1, Math.min(30, parseInt(els.roundLimit.value) || 10)),
      targetScore: Math.max(50, Math.min(2000, parseInt(els.targetScore.value) || 300)),
      enableTimedTurns: els.enableTimedTurns.checked,
      timedTurnSeconds: Math.max(30, Math.min(300, parseInt(els.timedTurnSeconds.value) || 90)),
      enableEarTraining: els.enableEarTraining.checked,
      autoPlayTileOnTap: els.enableEarTraining.checked,
      autoPlayChordOnConfirm: els.enableEarTraining.checked,
      playbackMode: els.playbackMode.value,
      enableTileSwap: els.enableTileSwap.checked,
      selectedBoardVariantId: selectedBoardVariantId || CT.DEFAULT_BOARD_VARIANT_ID,
      enableBlockedSpaces: els.enableBlockedSpaces ? els.enableBlockedSpaces.checked : true
    };
  };

  /* ── Initialize player name inputs ──────────────────────────────────── */

  CT.ui.initSetupDefaults = function () {
    syncPlayerNames(2);
    updateSetupVisibility();
  };

})();

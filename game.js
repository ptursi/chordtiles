/* ========================================================================
   game.js — Chord Tiles — Turn Lifecycle & Orchestrator
   ======================================================================== */
(function () {
  "use strict";
  var CT = window.CT;

  var timerInterval = null;
  var timerDeadline = null;
  var timerStarted = false;
  var lastScoreResult = null;
  var lastAllChordData = null;
  var isFirstTurn = true;

  /* ── Initialization ─────────────────────────────────────────────────── */

  document.addEventListener("DOMContentLoaded", function () {
    CT.ui.cacheElements();
    CT.ui.initSetupDefaults();
    CT.ui.bindSetupForm();
    CT.ui.bindConfirmModal();
    bindGameEvents();
    bindButtonEvents();
    initBoardPinchZoom();
  });

  /* ── Event bindings ─────────────────────────────────────────────────── */

  function bindButtonEvents() {
    var els = CT.ui.els();

    // Landing -> Board select
    els.launchGameBtn.addEventListener("click", function () {
      CT.ui.hideLanding();
      CT.ui.showBoardSelect();
    });

    // Board select continue -> Setup
    els.boardSelectContinueBtn.addEventListener("click", function () {
      CT.ui.hideBoardSelect();
      CT.ui.showSetup();
    });

    // Setup back button -> Board select
    els.setupBackBtn.addEventListener("click", function () {
      CT.ui.hideSetup();
      CT.ui.showBoardSelect();
    });

    // Setup form submit
    els.setupForm.addEventListener("submit", function (e) {
      e.preventDefault();
      handleStartGame();
    });

    els.closeSetupModal.addEventListener("click", function () {
      CT.ui.hideSetup();
      if (!CT.state) {
        CT.ui.showBoardSelect();
      }
    });

    // Confirm move
    els.confirmMoveBtn.addEventListener("click", handleConfirmMove);

    // Pass turn
    els.passTurnBtn.addEventListener("click", handlePassTurn);

    // Swap tiles
    els.swapTilesBtn.addEventListener("click", handleSwapTiles);
    els.swapConfirmBtn.addEventListener("click", function () {
      var selected = CT.ui.getSwapSelected();
      if (selected.length === 0) return;
      CT.ui.closeModal(els.swapModal);
      CT.recallAllTiles();
      CT.swapTiles(selected);
      finishTurn(null, "Swapped " + selected.length + " tile" + (selected.length > 1 ? "s" : "") + ".");
    });
    els.swapCancelBtn.addEventListener("click", function () {
      CT.ui.closeModal(els.swapModal);
    });
    els.closeSwapModal.addEventListener("click", function () {
      CT.ui.closeModal(els.swapModal);
    });

    // Shuffle rack
    els.shuffleRackBtn.addEventListener("click", function () {
      CT.shuffleRack();
      CT.ui.renderRack();
    });

    // Recall tiles
    els.recallTilesBtn.addEventListener("click", function () {
      CT.recallAllTiles();
      CT.ui.renderRack();
      refreshAfterPlacementChange();
    });

    // Start turn (pass device)
    els.startTurnBtn.addEventListener("click", function () {
      CT.ui.hidePassDevice();
      beginPlayerTurn();
    });

    // Turn summary replay
    els.turnSummaryReplay.addEventListener("click", function () {
      if (lastAllChordData && lastAllChordData.length > 0) {
        playAllChords(lastAllChordData, CT.state.settings.playbackMode);
      }
    });

    // Settings (mid-game)
    els.settingsBtn.addEventListener("click", function () {
      pauseTimer();
      populateMidSettings();
      CT.ui.openModal(els.settingsModal);
    });

    els.closeSettingsModal.addEventListener("click", function () {
      CT.ui.closeModal(els.settingsModal);
      resumeTimer();
    });

    els.saveSettingsBtn.addEventListener("click", function () {
      applyMidSettings();
      CT.ui.closeModal(els.settingsModal);
      resumeTimer();
    });

    els.midEarTraining.addEventListener("change", syncMidEarTrainingState);

    els.midRestartBtn.addEventListener("click", function () {
      CT.ui.closeModal(els.settingsModal);
      CT.ui.showConfirm({
        eyebrow: "Restart",
        title: "Restart the game?",
        message: "All scores and progress will be lost.",
        confirmText: "Restart",
        onConfirm: function () {
          startGameWithSettings(CT.state.settings);
        }
      });
    });

    els.midNewGameBtn.addEventListener("click", function () {
      CT.ui.closeModal(els.settingsModal);
      CT.ui.showConfirm({
        eyebrow: "New game",
        title: "Start a new game?",
        message: "Return to the board selection screen to start fresh.",
        confirmText: "New Game",
        onConfirm: function () {
          clearTimer();
          CT.state = null;
          CT.ui.showBoardSelect();
        }
      });
    });

    // Game over — Main Menu
    els.gameOverMainMenu.addEventListener("click", function () {
      CT.ui.closeModal(els.gameOverModal);
      clearTimer();
      CT.state = null;
      CT.ui.showLanding();
    });

    // Game over — Restart Game (same settings)
    els.gameOverRestart.addEventListener("click", function () {
      CT.ui.closeModal(els.gameOverModal);
      startGameWithSettings(CT.state.settings);
    });

    // Game over — View Finished Game
    els.gameOverViewBoard.addEventListener("click", function () {
      CT.ui.closeModal(els.gameOverModal);
      CT.ui.showBoardViewMode();
    });

    // View-board bar — Main Menu
    els.viewBoardMainMenu.addEventListener("click", function () {
      clearTimer();
      CT.state = null;
      CT.ui.hideBoardViewMode();
      CT.ui.showLanding();
    });

    // View-board bar — Restart Game
    els.viewBoardRestart.addEventListener("click", function () {
      var settings = CT.state.settings;
      CT.ui.hideBoardViewMode();
      startGameWithSettings(settings);
    });
  }

  function bindGameEvents() {
    CT.on("placement-changed", refreshAfterPlacementChange);
  }

  /* ── Start game ─────────────────────────────────────────────────────── */

  function handleStartGame() {
    var settings = CT.ui.getSetupSettings();
    CT.ui.hideSetup();
    startGameWithSettings(settings);
  }

  function startGameWithSettings(settings) {
    clearTimer();
    isFirstTurn = true;
    CT.createInitialState(settings);
    CT.ui.hideLanding();
    CT.ui.showGame();
    CT.ui.buildBoard();
    beginPlayerTurn();
  }

  /* ── Begin player turn ──────────────────────────────────────────────── */

  function beginPlayerTurn() {
    CT.ui.clearChordIdentification();
    CT.ui.renderRack();
    CT.ui.renderScoreboard();
    CT.ui.renderTurnInfo();
    CT.ui.updatePreview(null, null);

    // Clear group highlights
    CT.ui.highlightGroups(null, null);

    // Refresh claim overlays for the new active player's perspective
    CT.ui.updateAllClaimOverlays();

    // Show triads-blocked cells based on the current locked board state
    CT.ui.updateTriadsBlocking();

    // Start timer if enabled
    if (CT.state.settings.enableTimedTurns) {
      startTimer(CT.state.settings.timedTurnSeconds);
    }

    var els = CT.ui.els();
    els.confirmMoveBtn.disabled = true;
  }

  /* ── Placement changed ──────────────────────────────────────────────── */

  function refreshAfterPlacementChange() {
    var placed      = CT.getPlacedTilePositions();
    var claimPlaced = CT.getPlacedClaimTile();

    if (placed.length === 0 && !claimPlaced) {
      CT.ui.updatePreview(null, null);
      // Update all cells (in case tiles were recalled)
      for (var r = 0; r < 15; r++) {
        for (var c = 0; c < 15; c++) {
          CT.ui.updateCell(r, c);
        }
      }
      CT.ui.updateTriadsBlocking();
      return;
    }

    var validation  = null;
    var scoreResult = null;

    if (placed.length > 0) {
      validation = CT.validatePlacement(CT.state.board, placed, CT.isFirstMove());
      if (validation.valid) {
        scoreResult = CT.calculateTurnScore(
          validation.chordResults,
          validation.groups,
          CT.state.board,
          placed
        );
      }
    }

    CT.ui.updatePreview(validation, scoreResult);
    CT.ui.updateTriadsBlocking();
  }

  /* ── Confirm move ───────────────────────────────────────────────────── */

  function handleConfirmMove() {
    var placed      = CT.getPlacedTilePositions();
    var claimPlaced = CT.getPlacedClaimTile(); // snapshot BEFORE confirmPlacement

    // Nothing to confirm
    if (placed.length === 0 && !claimPlaced) return;

    var validation  = null;
    var scoreResult = null;

    // Validate note tile placement (if any note tiles are placed)
    if (placed.length > 0) {
      validation = CT.validatePlacement(CT.state.board, placed, CT.isFirstMove());
      if (!validation.valid) return;

      scoreResult = CT.calculateTurnScore(
        validation.chordResults,
        validation.groups,
        CT.state.board,
        placed
      );
    }

    // Claim placement was fully validated at placement time.
    // Re-running validateClaimPlacement here would incorrectly reject it because
    // claimedByPlayerIndex is already set on the cell. No second check needed.

    clearTimer();

    // Confirm placement (locks note tiles, applies score, refills rack)
    CT.confirmPlacement(scoreResult);

    // Build chord replay data and play back
    if (scoreResult && scoreResult.chords.length > 0) {
      var allChordData = [];
      for (var ci = 0; ci < validation.chordResults.length; ci++) {
        var notes = getNotesFromGroup(validation.chordResults[ci]);
        allChordData.push({ notes: notes, chordType: scoreResult.chords[ci].chordType });
      }
      lastAllChordData = allChordData;

      if (CT.state.settings.enableEarTraining && CT.state.settings.autoPlayChordOnConfirm) {
        playAllChords(allChordData, CT.state.settings.playbackMode);
      } else {
        CT.playSoundEffect("confirm");
      }
    } else {
      CT.playSoundEffect("confirm");
      lastAllChordData = null;
    }

    lastScoreResult = scoreResult;

    // Build turn summary (claimPlaced still accessible — turnState cleared in advanceTurn later)
    var summary = buildTurnSummary(scoreResult, claimPlaced);

    finishTurn(scoreResult, summary);
  }

  function getNotesFromGroup(chordResult) {
    if (!chordResult || !chordResult.group) return [];
    return chordResult.group.cells
      .filter(function (c) { return c.tile; })
      .map(function (c) { return CT.getEffectiveNote(c.tile); })
      .filter(function (n) { return n; });
  }

  /* ── Pass turn ──────────────────────────────────────────────────────── */

  function handlePassTurn() {
    CT.ui.showConfirm({
      eyebrow: "Pass",
      title: "Pass your turn?",
      message: "You will not place any tiles this turn.",
      confirmText: "Pass",
      cancelText: "Cancel",
      onConfirm: function () {
        clearTimer();
        CT.recallAllTiles();
        CT.ui.renderRack();
        refreshAfterPlacementChange();
        CT.passTurn();
        finishTurn(null, CT.currentPlayer().name + " passed.");
      }
    });
  }

  /* ── Swap tiles ─────────────────────────────────────────────────────── */

  function handleSwapTiles() {
    if (CT.getBagCount() === 0) {
      CT.ui.showConfirm({
        eyebrow: "Cannot swap",
        title: "Bag is empty",
        message: "There are no tiles left in the bag to swap with.",
        confirmText: "OK"
      });
      return;
    }
    CT.recallAllTiles();
    refreshAfterPlacementChange();
    CT.ui.showSwapModal();
  }

  /* ── Finish turn / advance ──────────────────────────────────────────── */

  function finishTurn(scoreResult, summaryText) {
    // Check win condition
    var winResult = CT.checkWinCondition();

    // turnSummaryHtml is passed to the game-over modal only when the game ended
    // on a confirmed scored turn (scoreResult !== null). Passes, swaps, and
    // timer expirations all call finishTurn with scoreResult === null, so they
    // show no final-turn summary in the game-over modal.
    var finalSummaryHtml = scoreResult ? summaryText : null;

    if (winResult) {
      CT.state.phase = "GAME_OVER";
      CT.playSoundEffect("win");
      CT.ui.renderScoreboard();
      CT.ui.showGameOver(winResult, finalSummaryHtml);
      return;
    }

    // Advance to next player
    var prevPlayerIndex = CT.state.currentPlayerIndex;
    CT.advanceTurn();
    var nextPlayerIndex = CT.state.currentPlayerIndex;

    // Check win after round advance (for round-limit mode)
    var postAdvanceWin = CT.checkWinCondition();
    if (postAdvanceWin) {
      CT.state.phase = "GAME_OVER";
      CT.playSoundEffect("win");
      CT.ui.renderScoreboard();
      CT.ui.showGameOver(postAdvanceWin, finalSummaryHtml);
      return;
    }

    // Show pass device screen
    isFirstTurn = false;
    var hasChords = scoreResult && scoreResult.chords && scoreResult.chords.length > 0;
    CT.ui.showPassDevice(summaryText, nextPlayerIndex, hasChords);
    CT.ui.renderScoreboard();
  }

  function buildTurnSummary(scoreResult, claimPlaced) {
    var player = CT.state.players[CT.state.currentPlayerIndex];
    var html = "";

    if (scoreResult) {
      html += '<p class="summary-header"><strong>' + esc(player.name) + '</strong> scored <strong>' + scoreResult.totalScore + ' points</strong>.</p>';
      scoreResult.chords.forEach(function (c) {
        var invEnabled = CT.state && CT.state.settings.enableInversionBonus;
        html += '<div class="summary-chord-block">';
        html += '<span class="summary-chord-name">' + esc(c.displayName) + (c.isMainLine ? '' : ' <em class="summary-cross-label">(cross)</em>') + '</span>';
        html += '<span class="summary-line">Chord Points: <strong>+' + c.chordBonus + '</strong></span>';
        html += '<span class="summary-line">Tile Points: <strong>+' + c.tilePoints + '</strong></span>';
        if (c.premiumBonus > 0) {
          html += '<span class="summary-line">Premium Bonus: <strong>+' + c.premiumBonus + '</strong></span>';
        }
        if (invEnabled && c.isMainLine && c.inversionLabel !== null) {
          if (c.inversionBonus > 0) {
            html += '<span class="summary-line">Inversion: <strong>' + esc(c.inversionLabel) + '</strong></span>';
            html += '<span class="summary-line">Inversion Bonus: <strong>+' + c.inversionBonus + '</strong></span>';
          } else {
            html += '<span class="summary-line">Inversion Bonus: <em>none</em></span>';
          }
        }
        if (c.perfectSequenceLabel !== null) {
          if (c.perfectSequenceBonus > 0) {
            html += '<span class="summary-line">Perfect Sequence: <strong>+' + c.perfectSequenceBonus + '</strong></span>';
          } else {
            html += '<span class="summary-line">Perfect Sequence: <em>none</em></span>';
          }
        }
        html += '<span class="summary-line summary-total">= <strong>' + c.groupScore + ' points</strong></span>';
        html += '</div>';
      });
    } else if (claimPlaced) {
      // Claim-only turn
      html += '<p class="summary-header"><strong>' + esc(player.name) + '</strong> claimed a space (0 points).</p>';
    }

    // Show claim tile action if it was placed this turn
    if (claimPlaced) {
      var playerColor = CT.PLAYER_COLORS[CT.state.currentPlayerIndex] || "#888";
      html += '<div class="summary-chord-block summary-claim-block">';
      html += '<span class="summary-chord-name" style="color:' + playerColor + '">★ Space Claimed</span>';
      html += '<span class="summary-line">Row ' + (claimPlaced.row + 1) + ', Column ' + (claimPlaced.col + 1) + ' reserved for 3 rounds.</span>';
      html += '</div>';
    }

    return html;
  }

  /**
   * Play all chords sequentially with delay between them.
   * Highlights the active chord name in the turn summary.
   */
  function playAllChords(allChordData, mode) {
    if (!allChordData || allChordData.length === 0) return;
    var chordDuration = (mode === "melodic") ? 1.8 : 1.2;

    allChordData.forEach(function (cd, idx) {
      var startDelay = idx * chordDuration * 1000;
      function playAndHighlight() {
        CT.playChord(cd.notes, cd.chordType, mode);
        var chordNames = document.querySelectorAll("#turnSummary .summary-chord-name");
        if (chordNames[idx]) {
          chordNames[idx].classList.add("is-playing");
          setTimeout(function () {
            chordNames[idx].classList.remove("is-playing");
          }, chordDuration * 1000);
        }
      }
      if (idx === 0) {
        playAndHighlight();
      } else {
        setTimeout(playAndHighlight, startDelay);
      }
    });
  }

  function esc(str) {
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* ── Turn timer ─────────────────────────────────────────────────────── */

  function startTimer(seconds) {
    clearTimer();
    timerStarted = true;
    timerDeadline = Date.now() + seconds * 1000;
    var els = CT.ui.els();
    els.timerDisplay.hidden = false;
    updateTimerDisplay();
    timerInterval = setInterval(function () {
      updateTimerDisplay();
      if (Date.now() >= timerDeadline) {
        handleTimerExpired();
      }
    }, 200);
  }

  function updateTimerDisplay() {
    var els = CT.ui.els();
    if (!timerStarted) {
      els.timerDisplay.textContent = "";
      els.timerDisplay.hidden = true;
      return;
    }
    var remaining = Math.max(0, timerDeadline - Date.now());
    var secs = Math.ceil(remaining / 1000);
    var mins = Math.floor(secs / 60);
    var s = secs % 60;
    els.timerDisplay.textContent = mins + ":" + (s < 10 ? "0" : "") + s;
    els.timerDisplay.classList.toggle("is-urgent", remaining <= 10000);
  }

  function clearTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    timerDeadline = null;
    timerStarted = false;
    var els = CT.ui.els();
    els.timerDisplay.hidden = true;
    els.timerDisplay.classList.remove("is-urgent");
  }

  function pauseTimer() {
    if (!timerStarted || !timerInterval) return;
    clearInterval(timerInterval);
    timerInterval = null;
    // Store remaining time
    timerDeadline = Date.now() + Math.max(0, timerDeadline - Date.now());
  }

  function resumeTimer() {
    if (!timerStarted || timerInterval) return;
    var remaining = Math.max(0, timerDeadline - Date.now());
    timerDeadline = Date.now() + remaining;
    timerInterval = setInterval(function () {
      updateTimerDisplay();
      if (Date.now() >= timerDeadline) {
        handleTimerExpired();
      }
    }, 200);
  }

  function handleTimerExpired() {
    clearTimer();
    // Force-close swap and pass-confirmation modals if either is open.
    // This prevents the player from acting on a stale modal after the turn ends.
    var els = CT.ui.els();
    CT.ui.cancelConfirm();
    CT.ui.closeModal(els.swapModal);
    // Recall any placed tiles and re-render so the board clears visually.
    // Placed tiles must never remain on the board for the next player.
    CT.recallAllTiles();
    CT.ui.renderRack();
    refreshAfterPlacementChange();
    CT.passTurn();
    finishTurn(null, CT.currentPlayer().name + "'s time expired. Turn passed.");
  }

  /* ── Mid-game settings ──────────────────────────────────────────────── */

  function populateMidSettings() {
    var s = CT.state.settings;
    var els = CT.ui.els();
    els.midEarTraining.checked = s.enableEarTraining;
    els.midPlaybackMode.value = s.playbackMode;
    if (els.midChordIdentify) els.midChordIdentify.checked = s.enableChordIdentify !== false;
    syncMidEarTrainingState();
  }

  function applyMidSettings() {
    var s = CT.state.settings;
    var els = CT.ui.els();
    var earOn = els.midEarTraining.checked;
    s.enableEarTraining = earOn;
    s.autoPlayTileOnTap = earOn;
    s.autoPlayChordOnConfirm = earOn;
    s.playbackMode = els.midPlaybackMode.value;
    if (els.midChordIdentify) s.enableChordIdentify = els.midChordIdentify.checked;
    if (!s.enableChordIdentify) CT.ui.clearChordIdentification();
  }

  function syncMidEarTrainingState() {
    var els = CT.ui.els();
    var on = els.midEarTraining.checked;
    els.midPlaybackMode.disabled = !on;
    els.midPlaybackMode.style.opacity = on ? "" : "0.4";
  }

  /* ── Board pinch-to-zoom ─────────────────────────────────────────────── */

  function initBoardPinchZoom() {
    var wrapper = document.getElementById("boardWrapper");
    if (!wrapper) return;

    var currentScale = 1;
    var lastScale = 1;
    var startDist = 0;
    var isPinching = false;

    function getTouchDist(touches) {
      var dx = touches[0].clientX - touches[1].clientX;
      var dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }

    wrapper.addEventListener("touchstart", function (e) {
      if (e.touches.length === 2) {
        isPinching = true;
        startDist = getTouchDist(e.touches);
        lastScale = currentScale;
        e.preventDefault();
      }
    }, { passive: false });

    wrapper.addEventListener("touchmove", function (e) {
      if (e.touches.length === 2 && isPinching) {
        var newDist = getTouchDist(e.touches);
        var scale = lastScale * (newDist / startDist);
        scale = Math.max(0.5, Math.min(3.0, scale));
        currentScale = scale;
        wrapper.style.transformOrigin = "center center";
        wrapper.style.transform = "scale(" + currentScale + ")";
        e.preventDefault();
      }
    }, { passive: false });

    wrapper.addEventListener("touchend", function (e) {
      if (e.touches.length < 2) {
        isPinching = false;
        lastScale = currentScale;
      }
    });
  }

})();

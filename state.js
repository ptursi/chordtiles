/* ========================================================================
   state.js — Chord Tiles — Game State Management & Event Bus
   ======================================================================== */
(function () {
  "use strict";
  var CT = window.CT;

  /* ── Simple event bus ───────────────────────────────────────────────── */

  var listeners = {};

  CT.on = function (event, handler) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(handler);
  };

  CT.off = function (event, handler) {
    if (!listeners[event]) return;
    listeners[event] = listeners[event].filter(function (h) { return h !== handler; });
  };

  CT.emit = function (event, data) {
    if (!listeners[event]) return;
    listeners[event].forEach(function (h) { h(data); });
  };

  /* ── Tile ID counter ────────────────────────────────────────────────── */

  var nextTileId = 1;

  function makeTile(note) {
    var isWild  = note === "WILD";
    var isClaim = note === "CLAIM";
    return {
      id:           nextTileId++,
      note:         note,
      points:       (isWild || isClaim) ? 0 : (CT.TILE_POINTS[note] || 0),
      isWild:       isWild,
      isClaim:      isClaim,
      assignedNote: null
    };
  }

  /* ── Bag ─────────────────────────────────────────────────────────────── */

  function buildBag(includeAccidentals, enableClaimTiles) {
    var dist = includeAccidentals
      ? CT.TILE_DISTRIBUTION_CHROMATIC
      : CT.TILE_DISTRIBUTION_NATURAL;
    var bag = [];
    for (var note in dist) {
      for (var i = 0; i < dist[note]; i++) {
        bag.push(makeTile(note));
      }
    }
    // Add claim tiles when enabled
    if (enableClaimTiles) {
      var claimCount = includeAccidentals
        ? CT.CLAIM_TILE_COUNT_CHROMATIC
        : CT.CLAIM_TILE_COUNT_NATURAL;
      for (var ci = 0; ci < claimCount; ci++) {
        bag.push(makeTile("CLAIM"));
      }
    }
    return shuffle(bag);
  }

  /**
   * Draw tiles for a specific player's rack, skipping claim tiles if the
   * player already holds 2 or more (rack limit = 2 claim tiles at a time).
   * Skipped claim tiles are shuffled back into the bag so they stay in play.
   */
  function drawTilesForPlayer(bag, count, currentRack) {
    var claimCount = currentRack.filter(function (t) { return t.isClaim; }).length;
    var drawn = [];
    var skippedClaims = [];

    while (drawn.length < count && bag.length > 0) {
      var tile = bag.pop();
      if (tile.isClaim && claimCount >= 2) {
        skippedClaims.push(tile);   // hold aside, put back after
      } else {
        if (tile.isClaim) claimCount++; // track how many the player now holds
        drawn.push(tile);
      }
    }

    // Return skipped claim tiles to bag and re-shuffle to avoid order bias
    if (skippedClaims.length > 0) {
      for (var i = 0; i < skippedClaims.length; i++) {
        bag.push(skippedClaims[i]);
      }
      shuffle(bag);
    }

    return drawn;
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function drawTiles(bag, count) {
    var drawn = [];
    var n = Math.min(count, bag.length);
    for (var i = 0; i < n; i++) {
      drawn.push(bag.pop());
    }
    return drawn;
  }

  /* ── Board generation ───────────────────────────────────────────────── */

  function generateBoard(settings, blockedLayoutIndex) {
    var variantId = (settings && settings.selectedBoardVariantId) || CT.DEFAULT_BOARD_VARIANT_ID;
    var variant = CT.getBoardVariantById(variantId);
    var layout = variant ? variant.layout : null;
    var size = CT.BOARD_SIZE;
    var board = [];
    for (var r = 0; r < size; r++) {
      board[r] = [];
      for (var c = 0; c < size; c++) {
        var raw = layout ? layout[r][c] : "--";
        var premiumType = (raw === "--") ? null : raw;
        board[r][c] = {
          row: r,
          col: c,
          premiumType: premiumType,
          tile: null,
          isBlocked: false,
          isLocked: false,
          // Claim tile fields (populated by CT.placeClaimTileOnBoard)
          claimedByPlayerIndex: -1,   // -1 = unclaimed
          claimExpiresAtTurn:   0,    // absolute turn count when claim expires
          claimTileRef:         null  // tile object, returned to bag on expire/use
        };
      }
    }

    // Apply blocked overlay only if enabled and index is valid
    if (blockedLayoutIndex >= 0) {
      var blockedLayout = CT.BLOCKED_LAYOUTS[blockedLayoutIndex];
      if (blockedLayout) {
        blockedLayout.forEach(function (pos) {
          var cell = board[pos[0]][pos[1]];
          if (!cell.premiumType) {
            cell.isBlocked = true;
          }
        });
      }
    }

    return board;
  }

  /* ── Player creation ────────────────────────────────────────────────── */

  function createPlayer(name, bag) {
    var rack = drawTiles(bag, CT.RACK_SIZE);
    return {
      name: name,
      score: 0,
      rack: rack
    };
  }

  /* ── Game state ─────────────────────────────────────────────────────── */

  CT.state = null;

  CT.createInitialState = function (settings) {
    nextTileId = 1;
    var s = JSON.parse(JSON.stringify(settings));
    var enableBlocked = s.enableBlockedSpaces !== false;
    var blockedLayoutIndex = enableBlocked
      ? Math.floor(Math.random() * CT.BLOCKED_LAYOUTS.length)
      : -1;
    var bag = buildBag(s.includeAccidentals, s.enableClaimTiles);
    var board = generateBoard(s, blockedLayoutIndex);

    var players = [];
    for (var i = 0; i < s.numberOfPlayers; i++) {
      players.push(createPlayer(s.playerNames[i] || ("Player " + (i + 1)), bag));
    }

    CT.state = {
      phase: "PLAYING",
      settings: s,
      players: players,
      currentPlayerIndex: 0,
      roundNumber: 1,
      bag: bag,
      board: board,
      blockedLayoutIndex: blockedLayoutIndex,
      turnState: createFreshTurnState(),
      consecutivePassCount: 0,
      moveCount: 0,
      totalTurns: 0,        // increments every time any player ends their turn
      finalRound: false,
      finalRoundStartPlayer: -1
    };

    CT.emit("state-created", CT.state);
    return CT.state;
  };

  function createFreshTurnState() {
    return {
      placedTiles: [],        // { row, col, tile } — normal note tiles
      placedClaimTile: null,  // { row, col, tile } — max one claim tile per turn
      stolenClaimData: null,  // saved opponent claim during a steal; finalized on confirm
      previewGroups: [],
      previewScore: 0,
      previewErrors: [],
      previewChords: []
    };
  }

  /* ── Turn state helpers ─────────────────────────────────────────────── */

  CT.isFirstMove = function () {
    return CT.state && CT.state.moveCount === 0;
  };

  CT.currentPlayer = function () {
    return CT.state ? CT.state.players[CT.state.currentPlayerIndex] : null;
  };

  CT.placeTileOnBoard = function (row, col, tile) {
    var st = CT.state;
    if (!st) return false;
    var cell = st.board[row][col];
    if (cell.isBlocked || cell.tile) return false;

    // Opponent-claimed cells are unavailable
    if (cell.claimedByPlayerIndex >= 0 &&
        cell.claimedByPlayerIndex !== st.currentPlayerIndex) {
      return false;
    }

    cell.tile = tile;
    // Remove tile from player rack
    var player = st.players[st.currentPlayerIndex];
    var idx = player.rack.indexOf(tile);
    if (idx >= 0) player.rack.splice(idx, 1);

    st.turnState.placedTiles.push({ row: row, col: col, tile: tile });
    CT.emit("tile-placed", { row: row, col: col, tile: tile });
    return true;
  };

  CT.removeTileFromBoard = function (row, col) {
    var st = CT.state;
    if (!st) return null;
    var cell = st.board[row][col];
    if (!cell.tile || cell.isLocked) return null;

    // Check that this tile was placed this turn
    var placedIdx = -1;
    for (var i = 0; i < st.turnState.placedTiles.length; i++) {
      var p = st.turnState.placedTiles[i];
      if (p.row === row && p.col === col) { placedIdx = i; break; }
    }
    if (placedIdx < 0) return null;

    var tile = cell.tile;
    cell.tile = null;

    // If it was a wild, reset assignment
    if (tile.isWild) tile.assignedNote = null;

    st.turnState.placedTiles.splice(placedIdx, 1);

    // Return tile to player rack
    var player = st.players[st.currentPlayerIndex];
    player.rack.push(tile);

    CT.emit("tile-removed", { row: row, col: col, tile: tile });
    return tile;
  };

  CT.recallAllTiles = function () {
    var st = CT.state;
    if (!st) return;
    // Remove note tiles in reverse order
    var placed = st.turnState.placedTiles.slice();
    for (var i = placed.length - 1; i >= 0; i--) {
      CT.removeTileFromBoard(placed[i].row, placed[i].col);
    }
    // Also recall claim tile placed this turn (if any)
    if (st.turnState.placedClaimTile) {
      CT.removeClaimTileFromBoard(
        st.turnState.placedClaimTile.row,
        st.turnState.placedClaimTile.col
      );
    }
  };

  CT.getPlacedTilePositions = function () {
    return CT.state ? CT.state.turnState.placedTiles.map(function (p) {
      return { row: p.row, col: p.col };
    }) : [];
  };

  /* ── Claim tile placement ───────────────────────────────────────────── */

  /**
   * Place a claim tile on the board for the current player.
   * Supports steal: if the target cell has an opponent's active claim, that
   * claim tile is immediately returned to the bag and the new claim takes over
   * with a fresh expiry timer.
   * Claim is recorded immediately; expiry timer is set based on
   * state.totalTurns so it survives numberOfPlayers × 3 full turns.
   * Returns true on success, false if placement is illegal.
   */
  CT.placeClaimTileOnBoard = function (row, col, claimTile) {
    var st = CT.state;
    if (!st || !st.settings.enableClaimTiles) return false;
    // Only one claim tile per turn
    if (st.turnState.placedClaimTile) return false;

    var cell = st.board[row][col];
    // Cannot place on a blocked cell or one that already has a note tile
    if (cell.isBlocked || cell.tile) return false;
    // Cannot self-steal (refreshing own timer)
    if (cell.claimedByPlayerIndex === st.currentPlayerIndex) return false;

    // ── Steal: save opponent's claim — do NOT return to bag yet ──────────
    // The stolen data is kept in turnState.stolenClaimData so that if the
    // current player recalls before confirming, the original claim is restored.
    // The tile goes to the bag only when the move is confirmed.
    if (cell.claimedByPlayerIndex >= 0) {
      st.turnState.stolenClaimData = {
        row: row,
        col: col,
        playerIndex:   cell.claimedByPlayerIndex,
        expiresAtTurn: cell.claimExpiresAtTurn,
        tileRef:       cell.claimTileRef
      };
      // Clear for overwrite — Player 2's claim data is written below
      cell.claimedByPlayerIndex = -1;
      cell.claimExpiresAtTurn   = 0;
      cell.claimTileRef         = null;
    }

    // Mark the cell as claimed by the current player
    cell.claimedByPlayerIndex = st.currentPlayerIndex;
    // Fresh expiry: numberOfPlayers × 3 full turns from now
    cell.claimExpiresAtTurn   = st.totalTurns + st.settings.numberOfPlayers * 3;
    cell.claimTileRef         = claimTile;

    // Remove from player rack
    var player = st.players[st.currentPlayerIndex];
    var idx = player.rack.indexOf(claimTile);
    if (idx >= 0) player.rack.splice(idx, 1);

    // Track in turn state
    st.turnState.placedClaimTile = { row: row, col: col, tile: claimTile };

    CT.emit("tile-placed", { row: row, col: col, tile: claimTile, isClaim: true });
    return true;
  };

  /**
   * Recall a claim tile placed THIS turn (before confirming).
   * Clears claim data from the cell and returns the tile to the rack.
   */
  CT.removeClaimTileFromBoard = function (row, col) {
    var st = CT.state;
    if (!st) return false;

    var ptc = st.turnState.placedClaimTile;
    if (!ptc || ptc.row !== row || ptc.col !== col) return false;

    var cell = st.board[row][col];
    var claimTile = cell.claimTileRef;

    // Clear claim from cell
    cell.claimedByPlayerIndex = -1;
    cell.claimExpiresAtTurn   = 0;
    cell.claimTileRef         = null;

    // Return tile to rack
    var player = st.players[st.currentPlayerIndex];
    player.rack.push(claimTile);

    // Clear from turn state
    st.turnState.placedClaimTile = null;

    // If this was a steal, restore the original opponent claim so the board
    // returns to its pre-turn state (the steal is only permanent on confirm).
    if (st.turnState.stolenClaimData) {
      var scd = st.turnState.stolenClaimData;
      cell.claimedByPlayerIndex = scd.playerIndex;
      cell.claimExpiresAtTurn   = scd.expiresAtTurn;
      cell.claimTileRef         = scd.tileRef;
      st.turnState.stolenClaimData = null;
    }

    CT.emit("tile-removed", { row: row, col: col, tile: claimTile, isClaim: true });
    return true;
  };

  /** Returns the claim tile placed this turn, or null. */
  CT.getPlacedClaimTile = function () {
    return CT.state ? CT.state.turnState.placedClaimTile : null;
  };

  /* ── Confirm placement ──────────────────────────────────────────────── */

  CT.confirmPlacement = function (scoreResult) {
    var st = CT.state;
    if (!st) return;

    var player = st.players[st.currentPlayerIndex];

    // Lock all placed note tiles; consume own claims on covered cells
    st.turnState.placedTiles.forEach(function (p) {
      var lockCell = st.board[p.row][p.col];
      lockCell.isLocked = true;
      // If the owner placed a note on their own claimed cell, consume the claim now
      if (lockCell.claimedByPlayerIndex === st.currentPlayerIndex) {
        if (lockCell.claimTileRef) {
          st.bag.push(lockCell.claimTileRef); // return claim tile to bag
        }
        lockCell.claimedByPlayerIndex = -1;
        lockCell.claimExpiresAtTurn   = 0;
        lockCell.claimTileRef         = null;
      }
    });

    // Finalize any steal: the stolen tile now permanently goes to the bag
    if (st.turnState.stolenClaimData && st.turnState.stolenClaimData.tileRef) {
      st.bag.push(st.turnState.stolenClaimData.tileRef);
      shuffle(st.bag);
      st.turnState.stolenClaimData = null;
    }

    // Apply score (0 for claim-only turns)
    player.score += scoreResult ? scoreResult.totalScore : 0;

    // Refill rack, respecting the 1-claim-tile-per-rack rule
    var needed = CT.RACK_SIZE - player.rack.length;
    if (needed > 0 && st.bag.length > 0) {
      var drawn = drawTilesForPlayer(st.bag, needed, player.rack);
      player.rack = player.rack.concat(drawn);
    }

    st.moveCount++;
    st.consecutivePassCount = 0;

    // Check bag depletion → trigger final round
    if (st.bag.length === 0 && !st.finalRound) {
      st.finalRound = true;
      st.finalRoundStartPlayer = st.currentPlayerIndex;
    }

    CT.emit("move-confirmed", scoreResult);
  };

  /* ── Pass turn ──────────────────────────────────────────────────────── */

  CT.passTurn = function () {
    var st = CT.state;
    if (!st) return;
    st.consecutivePassCount++;
    CT.emit("turn-passed");
  };

  /* ── Swap tiles ─────────────────────────────────────────────────────── */

  CT.swapTiles = function (tileIds) {
    var st = CT.state;
    if (!st) return;
    var player = st.players[st.currentPlayerIndex];

    var toSwap = [];
    var remaining = [];
    player.rack.forEach(function (t) {
      if (tileIds.indexOf(t.id) >= 0) toSwap.push(t);
      else remaining.push(t);
    });

    // Put swapped tiles back into bag
    toSwap.forEach(function (t) {
      if (t.isWild) t.assignedNote = null;
      st.bag.push(t);
    });
    shuffle(st.bag);

    // Draw same number, respecting 1-claim-tile-per-rack rule
    var drawn = drawTilesForPlayer(st.bag, toSwap.length, remaining);
    player.rack = remaining.concat(drawn);
    player.consecutiveScoringTurns = 0;
    player.passedLastTurn = false;
    st.consecutivePassCount = 0;

    CT.emit("tiles-swapped");
  };

  /* ── Advance turn ───────────────────────────────────────────────────── */

  CT.advanceTurn = function () {
    var st = CT.state;
    if (!st) return;

    var prevPlayer = st.currentPlayerIndex;
    st.currentPlayerIndex = (st.currentPlayerIndex + 1) % st.settings.numberOfPlayers;

    // Check if we completed a round
    if (st.currentPlayerIndex === 0) {
      st.roundNumber++;
    }

    // Advance absolute turn counter (counts every player turn regardless of type)
    st.totalTurns++;

    // Expire claim tiles whose 3-round timer has elapsed
    if (st.settings.enableClaimTiles) {
      for (var er = 0; er < 15; er++) {
        for (var ec = 0; ec < 15; ec++) {
          var ecell = st.board[er][ec];
          if (ecell.claimedByPlayerIndex >= 0 &&
              st.totalTurns >= ecell.claimExpiresAtTurn) {
            if (ecell.claimTileRef) st.bag.push(ecell.claimTileRef);
            ecell.claimedByPlayerIndex = -1;
            ecell.claimExpiresAtTurn   = 0;
            ecell.claimTileRef         = null;
          }
        }
      }
    }

    st.turnState = createFreshTurnState();
    CT.emit("turn-advanced", { prevPlayer: prevPlayer });
  };

  /* ── Win condition checks ───────────────────────────────────────────── */

  CT.checkWinCondition = function () {
    var st = CT.state;
    if (!st) return null;

    // All players passed twice consecutively
    if (st.consecutivePassCount >= st.settings.numberOfPlayers * 2) {
      return { reason: "all-passed", winners: findHighestScorers() };
    }

    // Target score mode
    if (st.settings.winCondition === "target") {
      for (var i = 0; i < st.players.length; i++) {
        if (st.players[i].score >= st.settings.targetScore) {
          return { reason: "target-reached", winners: [i] };
        }
      }
    }

    // Round limit (check at end of full round)
    if (st.settings.winCondition === "rounds") {
      // roundNumber increments when we wrap to player 0
      // so if roundNumber > roundLimit, the last round is complete
      if (st.roundNumber > st.settings.roundLimit) {
        return { reason: "rounds-complete", winners: findHighestScorers() };
      }
    }

    // Final round after bag depletion
    if (st.finalRound) {
      // Check if we've come back around to the player who triggered final round
      // after everyone has had one more turn
      var nextPlayer = (st.currentPlayerIndex) % st.settings.numberOfPlayers;
      if (st.moveCount > 0 && nextPlayer === st.finalRoundStartPlayer) {
        // Check if current player just finished (after advanceTurn)
        return { reason: "bag-depleted", winners: findHighestScorers() };
      }
    }

    return null;
  };

  function findHighestScorers() {
    var st = CT.state;
    var maxScore = -1;
    st.players.forEach(function (p) {
      if (p.score > maxScore) maxScore = p.score;
    });
    var winners = [];
    st.players.forEach(function (p, i) {
      if (p.score === maxScore) winners.push(i);
    });
    return winners;
  }

  /* ── Assign wild tile ───────────────────────────────────────────────── */

  CT.assignWildTile = function (tile, noteName) {
    if (!tile || !tile.isWild) return;
    tile.assignedNote = noteName;
    CT.emit("wild-assigned", { tile: tile, note: noteName });
  };

  /* ── Get effective note for a tile ──────────────────────────────────── */

  CT.getEffectiveNote = function (tile) {
    if (!tile) return null;
    if (tile.isWild) return tile.assignedNote;
    return tile.note;
  };

  /* ── Claim rounds-left helper ───────────────────────────────────────── */

  /**
   * Returns the number of full rounds remaining before a claim expires.
   * Uses the current state.totalTurns and the number of players to convert
   * the internal absolute-turn counter into a human-readable round count.
   * Never returns a negative value.
   *
   * @param {Object} cell - board cell with claimExpiresAtTurn set
   * @returns {number} rounds left (0 = expires this round or already gone)
   */
  CT.getClaimRoundsLeft = function (cell) {
    var st = CT.state;
    if (!st || cell.claimedByPlayerIndex < 0) return 0;
    var turnsLeft = cell.claimExpiresAtTurn - st.totalTurns;
    if (turnsLeft <= 0) return 0;
    return Math.ceil(turnsLeft / st.settings.numberOfPlayers);
  };

  /* ── Utility exports ────────────────────────────────────────────────── */

  CT.shuffleRack = function () {
    var player = CT.currentPlayer();
    if (player) shuffle(player.rack);
    CT.emit("rack-changed");
  };

  CT.getBagCount = function () {
    return CT.state ? CT.state.bag.length : 0;
  };

  CT.drawTiles = drawTiles;
  CT.shuffle = shuffle;

})();

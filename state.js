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
    var isWild = note === "WILD";
    return {
      id: nextTileId++,
      note: note,
      points: isWild ? 0 : (CT.TILE_POINTS[note] || 0),
      isWild: isWild,
      assignedNote: null
    };
  }

  /* ── Bag ─────────────────────────────────────────────────────────────── */

  function buildBag(includeAccidentals) {
    var dist = includeAccidentals
      ? CT.TILE_DISTRIBUTION_CHROMATIC
      : CT.TILE_DISTRIBUTION_NATURAL;
    var bag = [];
    for (var note in dist) {
      for (var i = 0; i < dist[note]; i++) {
        bag.push(makeTile(note));
      }
    }
    return shuffle(bag);
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

  function generateBoard(blockedLayoutIndex) {
    var size = CT.BOARD_SIZE;
    var board = [];
    for (var r = 0; r < size; r++) {
      board[r] = [];
      for (var c = 0; c < size; c++) {
        var raw = CT.PREMIUM_BOARD[r][c];
        var premiumType = raw === "--" ? null : raw;
        board[r][c] = {
          row: r,
          col: c,
          premiumType: premiumType,
          tile: null,
          isBlocked: false,
          isLocked: false
        };
      }
    }

    // Apply blocked overlay
    var layout = CT.BLOCKED_LAYOUTS[blockedLayoutIndex];
    if (layout) {
      layout.forEach(function (pos) {
        var cell = board[pos[0]][pos[1]];
        // Only block normal squares, never premium
        if (!cell.premiumType) {
          cell.isBlocked = true;
        }
      });
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
    var blockedLayoutIndex = Math.floor(Math.random() * CT.BLOCKED_LAYOUTS.length);
    var bag = buildBag(s.includeAccidentals);
    var board = generateBoard(blockedLayoutIndex);

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
      finalRound: false,
      finalRoundStartPlayer: -1
    };

    CT.emit("state-created", CT.state);
    return CT.state;
  };

  function createFreshTurnState() {
    return {
      placedTiles: [],   // { row, col, tile }
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
    // Remove in reverse order
    var placed = st.turnState.placedTiles.slice();
    for (var i = placed.length - 1; i >= 0; i--) {
      CT.removeTileFromBoard(placed[i].row, placed[i].col);
    }
  };

  CT.getPlacedTilePositions = function () {
    return CT.state ? CT.state.turnState.placedTiles.map(function (p) {
      return { row: p.row, col: p.col };
    }) : [];
  };

  /* ── Confirm placement ──────────────────────────────────────────────── */

  CT.confirmPlacement = function (scoreResult) {
    var st = CT.state;
    if (!st) return;

    var player = st.players[st.currentPlayerIndex];

    // Lock all placed tiles
    st.turnState.placedTiles.forEach(function (p) {
      st.board[p.row][p.col].isLocked = true;
    });

    // Apply score
    player.score += scoreResult.totalScore;

    // Refill rack
    var needed = CT.RACK_SIZE - player.rack.length;
    if (needed > 0 && st.bag.length > 0) {
      var drawn = drawTiles(st.bag, needed);
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

    // Draw same number
    var drawn = drawTiles(st.bag, toSwap.length);
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

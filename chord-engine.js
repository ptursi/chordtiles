/* ========================================================================
   chord-engine.js — Chord Tiles — Group Extraction, Chord Detection, Validation
   ======================================================================== */
(function () {
  "use strict";
  var CT = window.CT;

  /* ── Pitch class helpers ────────────────────────────────────────────── */

  function noteToPitchClass(noteName) {
    var pc = CT.NOTE_TO_PITCH_CLASS[noteName];
    return pc !== undefined ? pc : -1;
  }

  function effectivePitchClass(tile) {
    var note = CT.getEffectiveNote(tile);
    return note ? noteToPitchClass(note) : -1;
  }

  /* ── Get enabled chord tables ───────────────────────────────────────── */

  function getEnabledChordIntervals() {
    var intervals = {};
    for (var k in CT.CHORD_INTERVALS) intervals[k] = CT.CHORD_INTERVALS[k];
    if (CT.state && CT.state.settings.enableVariantMode) {
      for (var vk in CT.VARIANT_CHORD_INTERVALS) intervals[vk] = CT.VARIANT_CHORD_INTERVALS[vk];
    }
    return intervals;
  }

  function getEnabledBonusPoints() {
    var pts = {};
    for (var k in CT.CHORD_BONUS_POINTS) pts[k] = CT.CHORD_BONUS_POINTS[k];
    if (CT.state && CT.state.settings.enableVariantMode) {
      for (var vk in CT.VARIANT_CHORD_BONUS_POINTS) pts[vk] = CT.VARIANT_CHORD_BONUS_POINTS[vk];
    }
    return pts;
  }

  /* ── Chord detection (unordered pitch-class set matching) ───────────── */

  /**
   * Given an array of pitch classes (integers 0-11), detect the best chord.
   * Returns { chordType, root, rootName, displayName } or null.
   */
  CT.detectChord = function (pitchClasses) {
    var unique = [];
    var seen = {};
    for (var i = 0; i < pitchClasses.length; i++) {
      var pc = pitchClasses[i];
      if (pc < 0) continue;
      if (!seen[pc]) {
        seen[pc] = true;
        unique.push(pc);
      }
    }

    if (unique.length < 3) return null;

    // If 5 or fewer unique, try directly
    if (unique.length <= 5) {
      return detectFromSet(unique);
    }

    // >5 unique: try subsets of size 5, then 4, then 3
    var best = null;
    var bestScore = -1;
    var bonusPts = getEnabledBonusPoints();

    for (var size = Math.min(5, unique.length); size >= 3; size--) {
      var subsets = getSubsets(unique, size);
      for (var s = 0; s < subsets.length; s++) {
        var result = detectFromSet(subsets[s]);
        if (result) {
          var score = bonusPts[result.chordType] || 0;
          if (score > bestScore) {
            bestScore = score;
            best = result;
          }
        }
      }
      if (best) return best; // Take best from largest subset first
    }

    return best;
  };

  function detectFromSet(pitchClassSet) {
    var intervals = getEnabledChordIntervals();
    var rootIntervals = CT.ROOT_POSITION_INTERVALS;
    var bonusPts = getEnabledBonusPoints();
    var best = null;
    var bestScore = -1;

    // Try each pitch class as potential root
    for (var ri = 0; ri < pitchClassSet.length; ri++) {
      var root = pitchClassSet[ri];
      var ivs = [];
      for (var j = 0; j < pitchClassSet.length; j++) {
        ivs.push((pitchClassSet[j] - root + 12) % 12);
      }
      ivs.sort(function (a, b) { return a - b; });
      var ivStr = ivs.join(",");

      // Compare against root position intervals
      for (var chordType in rootIntervals) {
        if (!intervals[chordType]) continue; // not enabled
        var target = rootIntervals[chordType];
        if (target.length !== ivs.length) continue;
        if (target.join(",") === ivStr) {
          var score = bonusPts[chordType] || 0;
          if (score > bestScore) {
            bestScore = score;
            best = {
              chordType: chordType,
              root: root,
              rootName: CT.PITCH_NAMES_FROM_C[root],
              displayName: CT.PITCH_NAMES_FROM_C[root] + " " + chordType
            };
          }
        }
      }
    }

    return best;
  }

  function getSubsets(arr, size) {
    var result = [];
    function recurse(start, current) {
      if (current.length === size) {
        result.push(current.slice());
        return;
      }
      for (var i = start; i < arr.length; i++) {
        current.push(arr[i]);
        recurse(i + 1, current);
        current.pop();
      }
    }
    recurse(0, []);
    return result;
  }

  /* ── Group extraction from board ────────────────────────────────────── */

  /**
   * Given the board and placed tile positions, extract all scoring groups.
   * Returns array of { cells: Cell[], isMainLine: boolean, axis: 'h'|'v' }
   */
  CT.extractScoringGroups = function (board, placedPositions) {
    if (!placedPositions || placedPositions.length === 0) return [];

    var groups = [];

    // Determine axis of placement
    var axis = determineAxis(placedPositions);

    // === Main line ===
    var mainLine = extractLine(board, placedPositions, axis);
    if (mainLine.length >= 2) {
      groups.push({ cells: mainLine, isMainLine: true, axis: axis });
    } else if (placedPositions.length === 1) {
      // Single tile: main line might be in either direction
      // Try both and use the longer one as main
      var hLine = extractLine(board, placedPositions, "h");
      var vLine = extractLine(board, placedPositions, "v");
      if (hLine.length >= 2) {
        groups.push({ cells: hLine, isMainLine: true, axis: "h" });
      }
      if (vLine.length >= 2) {
        groups.push({ cells: vLine, isMainLine: vLine.length >= 2 && hLine.length < 2, axis: "v" });
      }
    }

    // === Cross groups (perpendicular to main axis) ===
    var crossAxis = axis === "h" ? "v" : "h";
    for (var i = 0; i < placedPositions.length; i++) {
      var pos = placedPositions[i];
      var crossLine = extractLineFromPoint(board, pos.row, pos.col, crossAxis);
      if (crossLine.length >= 2) {
        // Don't add duplicates (for single-tile placements)
        var isDupe = false;
        for (var g = 0; g < groups.length; g++) {
          if (linesMatch(groups[g].cells, crossLine)) { isDupe = true; break; }
        }
        if (!isDupe) {
          groups.push({ cells: crossLine, isMainLine: false, axis: crossAxis });
        }
      }
    }

    return groups;
  };

  function determineAxis(positions) {
    if (positions.length <= 1) return "h"; // default for single tile
    var allSameRow = true;
    var allSameCol = true;
    for (var i = 1; i < positions.length; i++) {
      if (positions[i].row !== positions[0].row) allSameRow = false;
      if (positions[i].col !== positions[0].col) allSameCol = false;
    }
    if (allSameRow) return "h";
    if (allSameCol) return "v";
    return "invalid"; // tiles not in a line
  }

  function extractLine(board, positions, axis) {
    if (axis === "h") {
      var row = positions[0].row;
      var minCol = 14, maxCol = 0;
      for (var i = 0; i < positions.length; i++) {
        if (positions[i].col < minCol) minCol = positions[i].col;
        if (positions[i].col > maxCol) maxCol = positions[i].col;
      }
      // Extend left
      while (minCol > 0 && board[row][minCol - 1].tile) minCol--;
      // Extend right
      while (maxCol < 14 && board[row][maxCol + 1].tile) maxCol++;
      var cells = [];
      for (var c = minCol; c <= maxCol; c++) {
        cells.push(board[row][c]);
      }
      return cells;
    } else {
      var col = positions[0].col;
      var minRow = 14, maxRow = 0;
      for (var j = 0; j < positions.length; j++) {
        if (positions[j].row < minRow) minRow = positions[j].row;
        if (positions[j].row > maxRow) maxRow = positions[j].row;
      }
      while (minRow > 0 && board[minRow - 1][col].tile) minRow--;
      while (maxRow < 14 && board[maxRow + 1][col].tile) maxRow++;
      var vcells = [];
      for (var r = minRow; r <= maxRow; r++) {
        vcells.push(board[r][col]);
      }
      return vcells;
    }
  }

  function extractLineFromPoint(board, row, col, axis) {
    if (axis === "h") {
      var minC = col, maxC = col;
      while (minC > 0 && board[row][minC - 1].tile) minC--;
      while (maxC < 14 && board[row][maxC + 1].tile) maxC++;
      var cells = [];
      for (var c = minC; c <= maxC; c++) cells.push(board[row][c]);
      return cells;
    } else {
      var minR = row, maxR = row;
      while (minR > 0 && board[minR - 1][col].tile) minR--;
      while (maxR < 14 && board[maxR + 1][col].tile) maxR++;
      var vcells = [];
      for (var r = minR; r <= maxR; r++) vcells.push(board[r][col]);
      return vcells;
    }
  }

  function linesMatch(cells1, cells2) {
    if (cells1.length !== cells2.length) return false;
    for (var i = 0; i < cells1.length; i++) {
      if (cells1[i].row !== cells2[i].row || cells1[i].col !== cells2[i].col) return false;
    }
    return true;
  }

  /* ── Placement validation ───────────────────────────────────────────── */

  /**
   * Validate a placement.
   * Returns { valid, groups[], chordResults[], errors[] }
   */
  CT.validatePlacement = function (board, placedPositions, isFirstMove) {
    var errors = [];

    if (placedPositions.length === 0) {
      return { valid: false, groups: [], chordResults: [], errors: ["No tiles placed."] };
    }

    // 1. Check all tiles are in a straight line
    var axis = determineAxis(placedPositions);
    if (axis === "invalid") {
      return { valid: false, groups: [], chordResults: [], errors: ["Tiles must be placed in a straight line."] };
    }

    // 2. Check for gaps in the line
    if (!checkContinuity(board, placedPositions, axis)) {
      errors.push("Tiles must form a continuous line (no empty gaps).");
    }

    // 3. First move must cross center
    if (isFirstMove) {
      var crossesCenter = false;
      // Check placed tiles
      for (var i = 0; i < placedPositions.length; i++) {
        if (placedPositions[i].row === CT.CENTER && placedPositions[i].col === CT.CENTER) {
          crossesCenter = true;
          break;
        }
      }
      if (!crossesCenter) {
        errors.push("First move must cross the center square.");
      }
    }

    // 4. After first move, must connect to existing tiles
    if (!isFirstMove) {
      var connects = false;
      for (var p = 0; p < placedPositions.length; p++) {
        if (hasAdjacentLockedTile(board, placedPositions[p].row, placedPositions[p].col)) {
          connects = true;
          break;
        }
      }
      // Also check if the line includes existing tiles (gap-filling)
      if (!connects) {
        var groups = CT.extractScoringGroups(board, placedPositions);
        for (var g = 0; g < groups.length; g++) {
          for (var gc = 0; gc < groups[g].cells.length; gc++) {
            if (groups[g].cells[gc].isLocked) { connects = true; break; }
          }
          if (connects) break;
        }
      }
      if (!connects) {
        errors.push("Tiles must connect to existing tiles on the board.");
      }
    }

    if (errors.length > 0) {
      return { valid: false, groups: [], chordResults: [], errors: errors };
    }

    // 5. Check all wild tiles have been assigned
    for (var w = 0; w < placedPositions.length; w++) {
      var wTile = board[placedPositions[w].row][placedPositions[w].col].tile;
      if (wTile && wTile.isWild && !wTile.assignedNote) {
        errors.push("All wild tiles must be assigned a note before confirming.");
        return { valid: false, groups: [], chordResults: [], errors: errors };
      }
    }

    // 6. Extract groups and validate chords
    var allGroups = CT.extractScoringGroups(board, placedPositions);
    var chordResults = [];
    var hasMainLine = false;
    var mainLineValid = false;

    // Build a set of placed positions for quick lookup
    var placedPosSet = {};
    placedPositions.forEach(function (p) { placedPosSet[p.row + "," + p.col] = true; });

    for (var gi = 0; gi < allGroups.length; gi++) {
      var group = allGroups[gi];
      var pitchClasses = groupToPitchClasses(group.cells);

      if (group.cells.length < 3) {
        // 2-note groups are ignored (neither score nor invalidate)
        continue;
      }

      var detection = CT.detectChord(pitchClasses);

      // Check if the pre-existing (locked) tiles already formed this same chord.
      // If so, the new tiles didn't create a NEW chord — skip scoring this group.
      var isUnchangedChord = false;
      if (detection && !isFirstMove) {
        var existingCells = group.cells.filter(function (c) {
          return !placedPosSet[c.row + "," + c.col];
        });
        if (existingCells.length >= 3) {
          var existingPCs = groupToPitchClasses(existingCells);
          var existingDetection = CT.detectChord(existingPCs);
          if (existingDetection &&
              existingDetection.chordType === detection.chordType &&
              existingDetection.rootName === detection.rootName) {
            isUnchangedChord = true;
          }
        }
      }

      if (group.isMainLine) {
        hasMainLine = true;
        if (!detection) {
          errors.push("Main line does not form a valid chord.");
        } else if (isUnchangedChord) {
          // Valid chord but unchanged — doesn't score, doesn't invalidate
          // Do not push to chordResults (no score), but don't push error either
        } else {
          mainLineValid = true;
          chordResults.push({
            group: group,
            chordType: detection.chordType,
            root: detection.rootName,
            displayName: detection.displayName,
            pitchClasses: pitchClasses
          });
        }
      } else {
        // Cross group of 3+: must be valid chord (even if unchanged)
        if (!detection) {
          errors.push("A cross-group does not form a valid chord: " +
            group.cells.map(function (c) { return CT.getEffectiveNote(c.tile); }).join("-"));
        } else if (!isUnchangedChord) {
          chordResults.push({
            group: group,
            chordType: detection.chordType,
            root: detection.rootName,
            displayName: detection.displayName,
            pitchClasses: pitchClasses
          });
        }
        // If isUnchangedChord: valid but unchanged — skip scoring silently
      }
    }

    // If we have groups of 3+ but main line didn't qualify, check
    // For single tile placement, there might not be a "main line" group of 3+
    // That's ok if cross groups are valid
    if (allGroups.length === 0 && isFirstMove) {
      errors.push("Must form at least one valid chord.");
    }

    // Need at least one NEW valid chord
    if (chordResults.length === 0 && errors.length === 0) {
      errors.push("Placement must create at least one new chord (cannot duplicate an existing chord).");
    }

    return {
      valid: errors.length === 0,
      groups: allGroups,
      chordResults: chordResults,
      errors: errors
    };
  };

  function checkContinuity(board, positions, axis) {
    if (positions.length <= 1) return true;
    if (axis === "h") {
      var row = positions[0].row;
      var cols = positions.map(function (p) { return p.col; }).sort(function (a, b) { return a - b; });
      for (var c = cols[0]; c <= cols[cols.length - 1]; c++) {
        if (!board[row][c].tile) {
          // Check if this position is in our placed tiles
          var isPlaced = false;
          for (var i = 0; i < positions.length; i++) {
            if (positions[i].col === c) { isPlaced = true; break; }
          }
          if (!isPlaced) return false;
        }
      }
    } else {
      var col = positions[0].col;
      var rows = positions.map(function (p) { return p.row; }).sort(function (a, b) { return a - b; });
      for (var r = rows[0]; r <= rows[rows.length - 1]; r++) {
        if (!board[r][col].tile) {
          var isPlacedR = false;
          for (var j = 0; j < positions.length; j++) {
            if (positions[j].row === r) { isPlacedR = true; break; }
          }
          if (!isPlacedR) return false;
        }
      }
    }
    return true;
  }

  function hasAdjacentLockedTile(board, row, col) {
    var dirs = [[-1,0],[1,0],[0,-1],[0,1]];
    for (var d = 0; d < dirs.length; d++) {
      var nr = row + dirs[d][0];
      var nc = col + dirs[d][1];
      if (nr >= 0 && nr < 15 && nc >= 0 && nc < 15) {
        if (board[nr][nc].tile && board[nr][nc].isLocked) return true;
      }
    }
    return false;
  }

  function groupToPitchClasses(cells) {
    var pcs = [];
    for (var i = 0; i < cells.length; i++) {
      if (cells[i].tile) {
        var pc = effectivePitchClass(cells[i].tile);
        if (pc >= 0) pcs.push(pc);
      }
    }
    return pcs;
  }

  /* ── Exports ────────────────────────────────────────────────────────── */

  CT.noteToPitchClass = noteToPitchClass;
  CT.groupToPitchClasses = groupToPitchClasses;

})();

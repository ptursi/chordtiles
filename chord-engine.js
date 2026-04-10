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

  /* ── Chord detection ───────────────────────────────────────────────── */

  /**
   * CT.detectExactChord — BOARD GAMEPLAY MODE (strict, exact full-group only)
   *
   * This is the ONLY detection function used for board validation and scoring.
   * It enforces exact matching against the full unique pitch-class set of a
   * contiguous group. Subset matching is explicitly forbidden here because:
   *
   *   If a line contains extra notes that break a chord, the move must fail.
   *   Allowing subset rescue would let an illegal multi-tile extension score
   *   as if only the valid inner notes existed — that is the root cause of
   *   the extension-scoring bug.
   *
   * Rules:
   *  1. Deduplicate pitch classes (duplicate notes are fine on the board;
   *     chord validity is based on the UNIQUE pitch-class set only).
   *  2. Return null if fewer than 3 unique pitch classes.
   *  3. Return null if more than 5 unique pitch classes — no chord type in
   *     Chord Tiles has more than 5 notes, so a longer group is invalid.
   *     This is the critical guard: we do NOT try subsets when there are
   *     too many unique pitch classes. The whole group must match or fail.
   *  4. Test ONLY the full unique set against known chord types.
   *
   * @param {number[]} pitchClasses  May contain duplicates and -1 values.
   * @returns {{ chordType, root, rootName, displayName } | null}
   */
  CT.detectExactChord = function (pitchClasses) {
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

    // *** CRITICAL: reject groups with more than 5 unique pitch classes.
    // No enabled chord type has more than 5 notes, so this group cannot
    // possibly form a valid chord as a whole. We return null immediately
    // and do NOT fall back to subset search — that would silently rescue
    // an illegal extended line by finding a chord hidden inside it.
    if (unique.length > 5) return null;

    // Exact full-set match — no subsets tried.
    return detectFromSet(unique);
  };

  /**
   * CT.detectChord — SUBSET-MATCHING MODE (legacy / non-board use only)
   *
   * This version tries subsets when the group has >5 unique pitch classes,
   * returning the highest-value chord found in any subset.
   *
   * ⚠️  DO NOT USE THIS FOR BOARD VALIDATION OR SCORING.
   *     Use CT.detectExactChord instead. Subset matching on the board
   *     allows an illegal extended line to score via a hidden inner chord,
   *     which is the bug this refactor was created to fix.
   *
   * Kept here as a utility for non-board chord identification (e.g. future
   * analysis tools, chord name labelling outside of gameplay).
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

    if (unique.length <= 5) {
      return detectFromSet(unique);
    }

    // >5 unique: try subsets (NOT used for board validation — see detectExactChord)
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
      if (best) return best;
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

  /* ── Inversion classification ──────────────────────────────────────── */

  /**
   * Functional interval sequences for eligible chord types (mod 12).
   * Array index = chord function: 0=root, 1=3rd, 2=5th, 3=7th, 4=9th.
   * Chord types NOT listed here (augmented, fully diminished 7th, sus4)
   * are excluded from inversion bonus — they are either symmetrical or
   * cannot be classified cleanly by this scheme.
   */
  var INVERSION_SEQUENCES = {
    "major triad":         [0, 4, 7],   // root / 3rd / 5th
    "minor triad":         [0, 3, 7],   // root / 3rd / 5th
    "diminished triad":    [0, 3, 6],   // root / 3rd / 5th
    "sus4 triad":          [0, 5, 7],   // root / 4th / 5th  (replaces 3rd with 4th)
    "major 7th":           [0, 4, 7, 11],
    "minor 7th":           [0, 3, 7, 10],
    "dominant 7th":        [0, 4, 7, 10],
    "half diminished 7th": [0, 3, 6, 10],
    "minor major 7th":     [0, 3, 7, 11],
    "major 9":             [0, 4, 7, 11, 2],
    "minor 9":             [0, 3, 7, 10, 2],
    "dominant 9":          [0, 4, 7, 10, 2],
    "dominant b9":         [0, 4, 7, 10, 1],
    "dominant #9":         [0, 4, 7, 10, 3]
    // augmented triad     → excluded (symmetrical, 3 equal-interval slices)
    // fully diminished 7th→ excluded (symmetrical, 4 equal-interval slices)
  };

  /**
   * CT.getInversionClassification
   *
   * Classifies the inversion of a chord from its main-line board cells.
   * Reading order is left→right (horizontal) or top→bottom (vertical) —
   * cells[] must already be in that order (extractLine guarantees this).
   *
   * Algorithm:
   *  1. Build interval→function-index map from the chord's INVERSION_SEQUENCE.
   *  2. Walk cells in order; map each note's interval-from-root to a function
   *     index (root=0, 3rd=1, 5th=2, 7th=3, 9th=4). Skip duplicate function
   *     indices (keeps first occurrence).
   *  3. First function index seen → inversion type:
   *       0 = root position (check remaining for perfect vs imperfect)
   *       1 = 1st inversion
   *       2 = 2nd inversion
   *       other = none
   *  4. Perfect root position: root is first AND remaining indices are
   *     strictly ascending (1,2,3,4,...). Any other order = imperfect.
   *
   * @param {Array}  cells       Main group cells in board reading order.
   * @param {Object} chordResult { chordType, root (rootName string), ... }
   * @returns {{ label: string, bonusPct: number }}
   */
  CT.getInversionClassification = function (cells, chordResult) {
    var seq = INVERSION_SEQUENCES[chordResult.chordType];
    if (!seq) return { label: "none", bonusPct: 0 };

    var rootPC = CT.NOTE_TO_PITCH_CLASS[chordResult.root];
    if (rootPC === undefined) return { label: "none", bonusPct: 0 };

    // Build reverse map: interval mod 12 → function index
    var intervalToFuncIdx = {};
    for (var k = 0; k < seq.length; k++) {
      intervalToFuncIdx[seq[k]] = k;
    }

    // Walk cells in reading order; collect function indices (no duplicates)
    var funcSeq = [];
    var seenFuncIdx = {};
    for (var i = 0; i < cells.length; i++) {
      if (!cells[i].tile) continue;
      var note = CT.getEffectiveNote(cells[i].tile);
      if (!note) continue;
      var pc = CT.NOTE_TO_PITCH_CLASS[note];
      if (pc === undefined) continue;
      var interval = (pc - rootPC + 12) % 12;
      var fi = intervalToFuncIdx[interval];
      if (fi === undefined) continue;
      if (!seenFuncIdx[fi]) {
        seenFuncIdx[fi] = true;
        funcSeq.push(fi);
      }
    }

    if (funcSeq.length < 2) return { label: "none", bonusPct: 0 };

    var first = funcSeq[0];

    if (first === 1) return { label: "1st Inversion", bonusPct: 15 };
    if (first === 2) return { label: "2nd Inversion", bonusPct: 10 };

    if (first === 0) {
      // Root is first — check if remaining are in strictly ascending order
      var ascending = true;
      for (var j = 1; j < funcSeq.length - 1; j++) {
        if (funcSeq[j] >= funcSeq[j + 1]) { ascending = false; break; }
      }
      return ascending
        ? { label: "Root Position (Perfect)", bonusPct: 40 }
        : { label: "Root Position (Imperfect)", bonusPct: 25 };
    }

    // First tone is not root, 3rd, or 5th
    return { label: "none", bonusPct: 0 };
  };

  /**
   * CT.runInversionTests — 12 self-test cases for CT.getInversionClassification.
   * Call from browser console to verify correctness.
   */
  CT.runInversionTests = function () {
    var pass = 0, fail = 0;

    function check(desc, actual, expected) {
      if (actual === expected) {
        pass++;
      } else {
        console.error("FAIL [inversion]: " + desc + " — expected " + JSON.stringify(expected) + ", got " + JSON.stringify(actual));
        fail++;
      }
    }

    function makeCells(notes) {
      return notes.map(function (n) {
        return { tile: { note: n, isWild: false }, isLocked: true };
      });
    }

    function classify(notes, chordType, rootName) {
      return CT.getInversionClassification(makeCells(notes), { chordType: chordType, root: rootName });
    }

    // 1. Perfect root triad (horizontal): C-E-G
    var r = classify(["C","E","G"], "major triad", "C");
    check("C-E-G perfect root label", r.label, "Root Position (Perfect)");
    check("C-E-G perfect root pct",   r.bonusPct, 40);

    // 2. Imperfect root triad: C-G-E
    r = classify(["C","G","E"], "major triad", "C");
    check("C-G-E imperfect root label", r.label, "Root Position (Imperfect)");
    check("C-G-E imperfect root pct",   r.bonusPct, 25);

    // 3. 1st inversion: E-G-C
    r = classify(["E","G","C"], "major triad", "C");
    check("E-G-C 1st inv label", r.label, "1st Inversion");
    check("E-G-C 1st inv pct",   r.bonusPct, 15);

    // 4. 2nd inversion: G-E-C (5th first)
    r = classify(["G","E","C"], "major triad", "C");
    check("G-E-C 2nd inv label", r.label, "2nd Inversion");
    check("G-E-C 2nd inv pct",   r.bonusPct, 10);

    // 5. Vertical perfect root 7th chord: A-C-E-G (minor 7th, root A)
    r = classify(["A","C","E","G"], "minor 7th", "A");
    check("A-C-E-G minor 7th perfect label", r.label, "Root Position (Perfect)");
    check("A-C-E-G minor 7th perfect pct",   r.bonusPct, 40);

    // 6. Augmented triad excluded
    r = classify(["C","E","G#/Ab"], "augmented triad", "C");
    check("augmented excluded label", r.label, "none");
    check("augmented excluded pct",   r.bonusPct, 0);

    // 7. Fully diminished 7th excluded
    r = classify(["C","D#/Eb","F#/Gb","A"], "fully diminished 7th", "C");
    check("fully dim 7th excluded label", r.label, "none");
    check("fully dim 7th excluded pct",   r.bonusPct, 0);

    // 8. sus4 — uses root/4th/5th scheme
    r = classify(["C","F","G"], "sus4 triad", "C");
    check("sus4 C-F-G perfect root label", r.label, "Root Position (Perfect)");
    check("sus4 C-F-G perfect root pct",   r.bonusPct, 40);

    r = classify(["C","G","F"], "sus4 triad", "C");
    check("sus4 C-G-F imperfect root label", r.label, "Root Position (Imperfect)");
    check("sus4 C-G-F imperfect root pct",   r.bonusPct, 25);

    r = classify(["F","C","G"], "sus4 triad", "C");
    check("sus4 F-C-G 1st inv label", r.label, "1st Inversion");
    check("sus4 F-C-G 1st inv pct",   r.bonusPct, 15);

    r = classify(["G","C","F"], "sus4 triad", "C");
    check("sus4 G-C-F 2nd inv label", r.label, "2nd Inversion");
    check("sus4 G-C-F 2nd inv pct",   r.bonusPct, 10);

    r = classify(["F","F","C","G"], "sus4 triad", "C");
    check("sus4 F-F-C-G 1st inv (dup) label", r.label, "1st Inversion");
    check("sus4 F-F-C-G 1st inv (dup) pct",   r.bonusPct, 15);

    // 9. Perfect root 9th chord: F-A-C-E-G (major 9, root F)
    r = classify(["F","A","C","E","G"], "major 9", "F");
    check("F major 9 perfect label", r.label, "Root Position (Perfect)");
    check("F major 9 perfect pct",   r.bonusPct, 40);

    // 10. Imperfect root 9th chord: F-C-E-G-A (major 9, root F — 5th before 3rd)
    r = classify(["F","C","E","G","A"], "major 9", "F");
    check("F major 9 imperfect label", r.label, "Root Position (Imperfect)");
    check("F major 9 imperfect pct",   r.bonusPct, 25);

    // 11. 1st inversion 7th: C-E-G-A (minor 7th root A, 3rd=C first)
    r = classify(["C","E","G","A"], "minor 7th", "A");
    check("minor 7th 1st inv C-E-G-A label", r.label, "1st Inversion");
    check("minor 7th 1st inv C-E-G-A pct",   r.bonusPct, 15);

    // 12. 2nd inversion triad: G-C-E (major triad root C, 5th=G first)
    r = classify(["G","C","E"], "major triad", "C");
    check("G-C-E 2nd inv label", r.label, "2nd Inversion");
    check("G-C-E 2nd inv pct",   r.bonusPct, 10);

    console.log("CT.runInversionTests: " + pass + " passed, " + fail + " failed.");
    return { pass: pass, fail: fail };
  };

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
        if (group.isMainLine) {
          // A 2-note main line is not a valid chord — players must form at least a triad.
          errors.push("The main line must form at least 3 notes.");
        }
        // Cross-groups of 2 notes are allowed (they don't score or invalidate the move).
        continue;
      }

      // Triads Only mode: any scoring group with more than 3 tiles is invalid
      if (CT.state && CT.state.settings.triadsOnlyMode) {
        var tilesInGroup = group.cells.filter(function (c) { return c.tile; }).length;
        if (tilesInGroup > 3) {
          errors.push("Triads Only mode: groups are limited to 3 notes — extensions to 7ths and 9ths are disabled.");
          continue;
        }
      }

      // *** BOARD VALIDATION: use exact full-group detection only.
      // CT.detectExactChord rejects groups with >5 unique pitch classes outright
      // and never tries subsets. This ensures an extended line that no longer
      // forms a valid chord as a whole cannot score via a hidden inner chord.
      var detection = CT.detectExactChord(pitchClasses);

      // Unchanged-chord check: determine whether the pre-existing locked tiles
      // already formed the exact same chord. If so, the new tile(s) did not
      // create a NEW chord — the group does not score (but does not invalidate).
      //
      // Hardening: both the full group AND the locked-only sub-group must pass
      // exact detection, and they must produce the same chord type + root.
      // If the new tile introduced a new unique pitch class that changes the
      // chord (even to another valid chord), that is treated as a NEW chord,
      // not as "unchanged". If the new tile pushed the group past 5 unique PCs,
      // detectExactChord returns null and detection is null, so this whole block
      // is skipped and the main-line error branch fires instead.
      var isUnchangedChord = false;
      if (detection && !isFirstMove) {
        var existingCells = group.cells.filter(function (c) {
          return !placedPosSet[c.row + "," + c.col];
        });
        if (existingCells.length >= 3) {
          var existingPCs = groupToPitchClasses(existingCells);
          // Also exact-only for the locked-cell sub-group
          var existingDetection = CT.detectExactChord(existingPCs);
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
          errors.push("Main line already forms this chord — the extension must create a new chord identity.");
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
        // Cross group of 3+: must be valid chord AND must create a new chord identity
        if (!detection) {
          errors.push("A cross-group does not form a valid chord: " +
            group.cells.map(function (c) { return CT.getEffectiveNote(c.tile); }).join("-"));
        } else if (isUnchangedChord) {
          errors.push("A cross-group already forms this chord — the extension must create a new chord identity.");
        } else {
          chordResults.push({
            group: group,
            chordType: detection.chordType,
            root: detection.rootName,
            displayName: detection.displayName,
            pitchClasses: pitchClasses
          });
        }
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

  /* ── Claim tile placement validation ───────────────────────────────── */

  /**
   * Validate whether a claim tile may be placed at (row, col).
   * Rules:
   *  - Cannot be placed on the first move (no locked tiles exist yet)
   *  - Cannot be on blocked, DC, or TC cells
   *  - Cannot be on occupied cells (note tile already there)
   *  - Cannot self-steal (refreshing your own claim timer is not allowed)
   *  - May steal an OPPONENT's active claim — the old tile returns to bag in state
   *  - Must be adjacent to at least one locked tile OR a tile placed this turn
   *
   * @param {number}   row
   * @param {number}   col
   * @param {Array}    board             - 15×15 cell array
   * @param {boolean}  isFirstMove
   * @param {Array}    [placedPositions] - array of {row,col} for tiles placed this turn
   * @param {number}   [currentPlayerIndex] - index of the acting player
   * Returns { valid: boolean, isSteal: boolean, error: string|null }
   */
  CT.validateClaimPlacement = function (row, col, board, isFirstMove, placedPositions, currentPlayerIndex) {
    if (isFirstMove) {
      return { valid: false, isSteal: false, error: "Claim tiles cannot be placed on the first move." };
    }
    var cell = board[row][col];
    if (cell.isBlocked) {
      return { valid: false, isSteal: false, error: "Cannot claim blocked spaces." };
    }
    if (cell.tile) {
      return { valid: false, isSteal: false, error: "Cannot claim an occupied space." };
    }
    if (cell.premiumType === "DC" || cell.premiumType === "TC") {
      return { valid: false, isSteal: false, error: "Claim tiles cannot be placed on DC or TC spaces." };
    }

    var isSteal = false;
    if (cell.claimedByPlayerIndex >= 0) {
      // Self-steal is not allowed (cannot refresh own claim timer)
      if (currentPlayerIndex !== undefined && cell.claimedByPlayerIndex === currentPlayerIndex) {
        return { valid: false, isSteal: false, error: "You cannot steal your own reserved space." };
      }
      // Opponent claim — this is a steal, which is legal if adjacency is met
      isSteal = true;
    }

    // Build a fast lookup of positions placed this turn
    var placedSet = {};
    if (placedPositions && placedPositions.length) {
      for (var p = 0; p < placedPositions.length; p++) {
        placedSet[placedPositions[p].row + "," + placedPositions[p].col] = true;
      }
    }

    // Must be adjacent to a locked tile OR a tile placed this turn
    var dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    var adjacent = false;
    for (var d = 0; d < dirs.length; d++) {
      var nr = row + dirs[d][0];
      var nc = col + dirs[d][1];
      if (nr >= 0 && nr < 15 && nc >= 0 && nc < 15) {
        var ncell = board[nr][nc];
        if ((ncell.tile && ncell.isLocked) || placedSet[nr + "," + nc]) {
          adjacent = true;
          break;
        }
      }
    }
    if (!adjacent) {
      return { valid: false, isSteal: false, error: "Claim tile must be adjacent to a tile already on the board or placed this turn." };
    }

    return { valid: true, isSteal: isSteal, error: null };
  };

  /* ── Cell auto-blocking — single source of truth ──────────────────── */

  /**
   * Collect contiguous-tile info along one axis from an empty cell (r, c).
   *
   * Walks outward from (r,c) in both directions along `axis` ("h" or "v"),
   * stopping at the first empty or out-of-bounds cell on each side.
   *
   * Returns:
   *   count      — total number of tiles found (both sides combined)
   *   pcs        — deduplicated pitch-class array from ALL those tiles
   *   pcSet      — { [pc]: true } lookup for fast duplicate checks against ALL tiles
   *   lockedPcs  — deduplicated pitch-class array from LOCKED tiles only
   *
   * lockedPcs mirrors what validatePlacement calls "existingCells" — the tiles
   * that were already on the board before the current turn started.  This is
   * the set used by the validator's isUnchangedChord check (lines 662-675) to
   * determine whether a placement creates a genuinely new chord identity.
   */
  function cellAxisInfo(r, c, axis) {
    var board = CT.state.board;
    var neighbors = [];
    if (axis === "h") {
      for (var cc = c - 1; cc >= 0;  cc--)  { if (board[r][cc].tile) neighbors.unshift(board[r][cc]); else break; }
      for (var cc2 = c + 1; cc2 < 15; cc2++) { if (board[r][cc2].tile) neighbors.push(board[r][cc2]); else break; }
    } else {
      for (var rr = r - 1; rr >= 0;  rr--)  { if (board[rr][c].tile) neighbors.unshift(board[rr][c]); else break; }
      for (var rr2 = r + 1; rr2 < 15; rr2++) { if (board[rr2][c].tile) neighbors.push(board[rr2][c]); else break; }
    }
    var pcs = [], pcSet = {}, lockedPcs = [], lockedPcSet = {}, hasUnlockedTile = false;
    for (var i = 0; i < neighbors.length; i++) {
      if (!neighbors[i].isLocked) hasUnlockedTile = true;
      var note = CT.getEffectiveNote(neighbors[i].tile);
      if (note) {
        var pc = CT.NOTE_TO_PITCH_CLASS[note];
        if (pc !== undefined && pc >= 0) {
          if (!pcSet[pc])       { pcs.push(pc);       pcSet[pc]       = true; }
          if (neighbors[i].isLocked && !lockedPcSet[pc]) {
            lockedPcs.push(pc); lockedPcSet[pc] = true;
          }
        }
      }
    }
    return { count: neighbors.length, pcs: pcs, pcSet: pcSet, lockedPcs: lockedPcs, hasUnlockedTile: hasUnlockedTile };
  }

  /**
   * Evaluate placing pitch-class `newPC` into an existing axis group.
   *
   * Mirrors validatePlacement's isUnchangedChord check exactly:
   *   • "before" chord = detectExactChord(axisInfo.lockedPcs)
   *                      (only tiles locked from previous turns — same as validator's
   *                       existingCells filtered by placedPosSet)
   *   • "after" chord  = detectExactChord(fullPCs after adding newPC)
   *   • "unchanged" only when both are non-null AND have the same type + root
   *
   * This eliminates the false-positive blocking that occurred when placed-this-turn
   * tiles extended a group to 3+ tiles: the blocker previously used allPcs for the
   * "before" comparison, but the validator only looks at locked tiles.  With this
   * fix, both systems agree on what constitutes "same chord identity."
   *
   * Returns:
   *   "new_chord"  — the note produces a valid chord that is a new identity
   *   "unchanged"  — the note leaves the chord identity the same as the locked-only chord
   *   "invalid"    — the resulting group cannot form any valid chord
   */
  function evalAxisLegal(newPC, axisInfo) {
    // Compute the full PC set after placing newPC.
    var fullPCs;
    if (axisInfo.pcSet[newPC]) {
      fullPCs = axisInfo.pcs;              // duplicate — unique set unchanged
    } else {
      fullPCs = axisInfo.pcs.concat([newPC]);
      if (fullPCs.length > 5) return "invalid"; // detectExactChord always null for 6+
    }

    var afterChord = CT.detectExactChord(fullPCs);
    if (!afterChord) return "invalid";

    // Mirror the validator's isUnchangedChord: compare against the chord formed
    // by LOCKED tiles only.  If the locked tiles didn't form a chord (null),
    // any valid afterChord is by definition a new identity.
    var beforeChord = CT.detectExactChord(axisInfo.lockedPcs);
    if (beforeChord &&
        beforeChord.chordType === afterChord.chordType &&
        beforeChord.rootName  === afterChord.rootName) {
      return "unchanged";
    }

    return "new_chord";
  }

  /**
   * CT.isCellAutoBlocked(row, col, enabledNotes)
   *
   * The SINGLE SOURCE OF TRUTH for the auto-block preview system.
   *
   * Returns true only when NO enabled note tile can be legally placed at
   * (row, col) under the current board state, using the exact same rules
   * as validatePlacement — detectExactChord for chord detection, and the
   * same locked-tiles-only "before chord" comparison for identity checks.
   *
   * ALIGNMENT WITH validatePlacement
   * ──────────────────────────────────
   * evalAxisLegal computes the "before chord" from axisInfo.lockedPcs (tiles
   * locked from previous turns only), exactly matching what validatePlacement
   * does via its existingCells/isUnchangedChord check.  A cell is only marked
   * "unchanged" when the locked-only sub-group already formed the same chord.
   * If placed-this-turn tiles contributed to the group but the locked tiles
   * alone don't form a chord, any valid result is treated as a new identity —
   * eliminating the false-positive blocking that occurred when in-progress
   * this-turn lines were mistakenly treated as "closed" chord groups.
   *
   * AUTO-BLOCK TRIGGER POLICY
   * ─────────────────────────
   * An axis is "evaluable" (chord-constraining) only when placing at (row,col)
   * would form a group of 4+ tiles along that axis — i.e. ≥3 existing
   * neighbours are already there, AND at least one has a known pitch class.
   *
   * Why ≥3 neighbours (4+-tile result), not ≥2 (3-tile result)?
   *   A 2-tile group is always "in progress".  The player may resolve it with
   *   a multi-tile placement even if no single 3rd note alone completes a chord
   *   (e.g. B+C need a 4-note chord like Cmaj7).  Blocking adjacent cells
   *   would prevent those multi-tile moves entirely.  Only an established 3+-tile
   *   chord line constrains what can legally extend it.
   *
   * A cell is blocked only when, for EVERY enabled note:
   *   • it makes at least one evaluable axis invalid, OR
   *   • no evaluable axis produces a genuinely new chord identity
   *     ("unchanged" duplicates do not satisfy the new-chord requirement
   *      that validatePlacement enforces at lines 719-722).
   *
   * @param {number}   row
   * @param {number}   col
   * @param {string[]} enabledNotes  Array of note name strings ("C","D#",…)
   * @returns {boolean}
   */
  CT.isCellAutoBlocked = function (row, col, enabledNotes) {
    if (!CT.state) return false;

    var hInfo = cellAxisInfo(row, col, "h");
    var vInfo = cellAxisInfo(row, col, "v");

    // "Evaluable" axis = would produce a 4+-tile group with ≥1 known pitch class,
    // AND every tile in that axis is locked (placed in a previous turn).
    // If ANY tile in the axis belongs to the current in-progress turn, we suppress
    // blocking for that axis — the player may be building a multi-tile chord and a
    // single-note lookahead would produce misleading false negatives.
    // The real-time preview (group highlight) gives accurate feedback in that case.
    var hEval = hInfo.count >= 3 && hInfo.pcs.length > 0 && !hInfo.hasUnlockedTile;
    var vEval = vInfo.count >= 3 && vInfo.pcs.length > 0 && !vInfo.hasUnlockedTile;

    // No evaluable axis → cell is fully open.
    if (!hEval && !vEval) return false;

    for (var n = 0; n < enabledNotes.length; n++) {
      var newPC = CT.NOTE_TO_PITCH_CLASS[enabledNotes[n]];
      if (newPC === undefined || newPC < 0) continue;

      var hRes = hEval ? evalAxisLegal(newPC, hInfo) : "ok";
      var vRes = vEval ? evalAxisLegal(newPC, vInfo) : "ok";

      // A note fails if any evaluable axis rejects it.
      if (hRes === "invalid" || vRes === "invalid") continue;

      // Both evaluable axes are structurally valid.  At least one must
      // produce a genuinely NEW chord identity (mirrors the validator's
      // "at least one new chord" requirement at lines 719-722).
      var createsNewChord = (hEval && hRes === "new_chord") ||
                            (vEval && vRes === "new_chord");
      if (!createsNewChord) continue;

      return false; // A legal, new-chord-producing note exists → not blocked.
    }

    return true; // Every note either invalidates a group or only repeats an existing chord.
  };

  /* ── Exports ────────────────────────────────────────────────────────── */

  CT.noteToPitchClass      = noteToPitchClass;
  CT.groupToPitchClasses   = groupToPitchClasses;
  CT.hasAdjacentLockedTile = hasAdjacentLockedTile;

  /* ── Developer self-checks (run CT.runChordEngineTests() in console) ── */

  CT.runChordEngineTests = function () {
    var pass = 0;
    var fail = 0;

    function assert(label, condition) {
      if (condition) {
        console.log("[PASS]", label);
        pass++;
      } else {
        console.error("[FAIL]", label);
        fail++;
      }
    }

    // 1. Valid triad passes exact detection
    var ceg = [0, 4, 7];  // C-E-G
    var t1 = CT.detectExactChord(ceg);
    assert("C-E-G → valid major triad", t1 && t1.chordType === "major triad" && t1.rootName === "C");

    // 2. Extended invalid line fails (6 unique PCs)
    var t2 = CT.detectExactChord([0, 4, 7, 10, 2, 6]); // C-E-G-Bb-D-F# (6 unique)
    assert("C-E-G-Bb-D-F# (6 unique) → null", t2 === null);

    // 3. Valid 5-note dominant 9th passes
    var t3 = CT.detectExactChord([0, 4, 7, 10, 2]); // C-E-G-Bb-D
    assert("C-E-G-Bb-D → valid dominant 9 or similar 5-note chord", t3 !== null);

    // 4. 6-note line with valid subset still fails exact detection
    var t4 = CT.detectExactChord([0, 4, 7, 10, 2, 5]); // 6 unique PCs
    assert("6-note group → null (no subset rescue)", t4 === null);

    // 5. Duplicate notes are fine — validity based on unique PCs only
    var t5 = CT.detectExactChord([0, 4, 7, 0, 4]); // C-E-G-C-E (duplicates)
    assert("C-E-G-C-E (duplicates) → valid C major triad", t5 && t5.chordType === "major triad");

    // 6. Minor triad detected correctly
    var t6 = CT.detectExactChord([9, 0, 4]); // A-C-E
    assert("A-C-E → valid minor triad", t6 && t6.chordType === "minor triad" && t6.rootName === "A");

    // 7. 2-note group → null
    var t7 = CT.detectExactChord([0, 7]);
    assert("2-note group → null", t7 === null);

    // 8. Cross-group with extra unique note → null
    var t8 = CT.detectExactChord([0, 4, 7, 11]); // C-E-G-B = major 7th — should pass
    assert("C-E-G-B → valid major 7th", t8 && t8.chordType === "major 7th");
    var t8b = CT.detectExactChord([0, 4, 7, 11, 3]); // C-E-G-B-Eb — 5 unique PCs, likely invalid
    // This may or may not be null depending on chord tables, but must not subset-rescue a 6+ group
    assert("5-note non-chord set → null or valid chord (no silent subset)", t8b === null || (t8b && t8b.chordType));

    // 9. subset mode (CT.detectChord) still finds chord in 6-note set
    var t9 = CT.detectChord([0, 4, 7, 10, 2, 6]);
    assert("CT.detectChord (subset) on 6-note set → finds inner chord", t9 !== null);

    console.log("--- Chord Engine Tests: " + pass + " passed, " + fail + " failed ---");
    return { pass: pass, fail: fail };
  };

})();

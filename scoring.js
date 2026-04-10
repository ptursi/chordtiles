/* ========================================================================
   scoring.js — Chord Tiles — 7-Step Scoring Pipeline
   ======================================================================== */
(function () {
  "use strict";
  var CT = window.CT;

  /**
   * Calculate the total turn score.
   * @param {Array} chordResults - from validatePlacement
   * @param {Array} allGroups - all groups from extractScoringGroups
   * @param {Object} board - the game board
   * @param {Array} placedPositions - { row, col } of tiles placed this turn
   * @returns {Object} score breakdown
   */
  CT.calculateTurnScore = function (chordResults, allGroups, board, placedPositions) {
    var placedSet = {};
    placedPositions.forEach(function (p) {
      placedSet[p.row + "," + p.col] = true;
    });

    var groupScores = [];
    var totalScore = 0;
    var chords = [];

    for (var i = 0; i < chordResults.length; i++) {
      var cr = chordResults[i];
      var group = cr.group;
      var gs = scoreGroup(group.cells, cr, board, placedSet, group.isMainLine);
      groupScores.push(gs);
      totalScore += gs.groupTotal;
      chords.push({
        chordType: cr.chordType,
        root: cr.root,
        displayName: cr.displayName,
        groupScore: gs.groupTotal,
        tilePoints: gs.tilePoints,
        chordBonus: gs.chordBonus,
        premiumBonus: gs.premiumBonus,
        isMainLine: group.isMainLine,
        inversionBonus: gs.inversionBonus,
        inversionLabel: gs.inversionLabel
      });
    }

    return {
      totalScore: totalScore,
      groupScores: groupScores,
      chords: chords
    };
  };

  /**
   * Score a single group using the 7-step pipeline.
   * @param {boolean} isMainGroup  True only for the main placement line.
   */
  function scoreGroup(cells, chordResult, board, placedSet, isMainGroup) {
    var bonusPts = CT.CHORD_BONUS_POINTS;
    if (CT.state && CT.state.settings.enableVariantMode) {
      bonusPts = Object.assign({}, bonusPts, CT.VARIANT_CHORD_BONUS_POINTS);
    }

    // Step 1 & 2: Calculate tile points with multipliers
    var baseTilePointsTotal = 0;      // raw tile points without multipliers
    var tilePointsTotal = 0;          // tile points after DN/TN multipliers
    var hasWildInGroup = false;
    var tileDetails = [];

    for (var i = 0; i < cells.length; i++) {
      var cell = cells[i];
      if (!cell.tile) continue;

      var tile = cell.tile;
      if (tile.isWild) hasWildInGroup = true;

      var basePoints = tile.isWild ? 0 : tile.points;
      var isNewlyPlaced = placedSet[cell.row + "," + cell.col];
      var tileMultiplier = 1;

      // Step 2: Apply tile multipliers (DN, TN) only to tiles placed this turn
      // and only if the cell hasn't been locked before (first time on premium)
      if (isNewlyPlaced && !cell.isLocked && cell.premiumType) {
        if (cell.premiumType === "DN") tileMultiplier = 2;
        else if (cell.premiumType === "TN") tileMultiplier = 3;
      }

      var tileScore = basePoints * tileMultiplier;
      baseTilePointsTotal += basePoints;
      tilePointsTotal += tileScore;
      tileDetails.push({
        note: CT.getEffectiveNote(tile),
        base: basePoints,
        multiplier: tileMultiplier,
        score: tileScore
      });
    }

    // Step 3: tile points are summed (done above)

    // Step 4: Chord bonus
    var chordBonus = bonusPts[chordResult.chordType] || 0;

    // Step 5: Chord multipliers (DC, TC) - only from tiles placed THIS turn
    // If ANY wild tile exists in the group, chord multipliers are suppressed entirely
    var chordMultiplier = 1;
    if (!hasWildInGroup) {
      var highestChordMult = 1;
      for (var j = 0; j < cells.length; j++) {
        var cCell = cells[j];
        if (!placedSet[cCell.row + "," + cCell.col]) continue;
        if (cCell.isLocked) continue; // premium already used
        if (cCell.tile && cCell.tile.isWild) continue;

        if (cCell.premiumType === "DC" && 2 > highestChordMult) highestChordMult = 2;
        else if (cCell.premiumType === "TC" && 3 > highestChordMult) highestChordMult = 3;
      }
      chordMultiplier = highestChordMult;
    }

    var chordBonusTotal = chordBonus * chordMultiplier;

    // Step 5b: Inversion bonus — main line only, applied to base chord value only.
    // DC/TC chord multipliers and inversion bonus are independent and stack freely.
    // Cross-groups never receive this bonus (isMainGroup === false).
    // Augmented, fully diminished 7th, and sus4 return bonusPct=0 from
    // CT.getInversionClassification so they are excluded automatically.
    var inversionBonus = 0;
    var inversionLabel = null; // null = feature off / not the main group

    if (isMainGroup && CT.state && CT.state.settings.enableInversionBonus) {
      var invResult = CT.getInversionClassification(cells, chordResult);
      inversionLabel = invResult.label;
      if (invResult.bonusPct > 0) {
        inversionBonus = Math.round(chordBonus * invResult.bonusPct / 100);
      }
    }

    // Step 6: Cadence bonus (+10 if CS square and chord is 7th or 9th)
    var cadenceBonus = 0;
    if (CT.SEVENTH_OR_NINTH_TYPES.has(chordResult.chordType)) {
      for (var k = 0; k < cells.length; k++) {
        var csCell = cells[k];
        if (placedSet[csCell.row + "," + csCell.col] && !csCell.isLocked && csCell.premiumType === "CS") {
          cadenceBonus = 10;
          break;
        }
      }
    }

    // Step 7: Sum
    var groupTotal = tilePointsTotal + chordBonusTotal + cadenceBonus + inversionBonus;

    // Premium bonus = everything beyond base tile points + base chord bonus
    // i.e. tile multiplier additions + chord multiplier additions + cadence bonus
    // NOTE: inversionBonus is tracked separately and not folded into premiumBonus.
    var premiumBonus = (tilePointsTotal - baseTilePointsTotal) + (chordBonusTotal - chordBonus) + cadenceBonus;

    return {
      tilePoints: tilePointsTotal,
      baseTilePoints: baseTilePointsTotal,
      tileDetails: tileDetails,
      chordBonus: chordBonus,
      chordMultiplier: chordMultiplier,
      chordBonusTotal: chordBonusTotal,
      cadenceBonus: cadenceBonus,
      inversionBonus: inversionBonus,
      inversionLabel: inversionLabel,
      premiumBonus: premiumBonus,
      groupTotal: groupTotal,
      chordType: chordResult.chordType,
      displayName: chordResult.displayName,
      hasWild: hasWildInGroup
    };
  }

})();

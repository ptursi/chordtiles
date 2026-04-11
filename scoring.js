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
        tilePoints: gs.baseTilePoints,  // base (pre-multiplier); premiumBonus carries the extra
        chordBonus: gs.chordBonus,
        premiumBonus: gs.premiumBonus,
        isMainLine: group.isMainLine,
        inversionBonus: gs.inversionBonus,
        inversionLabel: gs.inversionLabel,
        perfectSequenceBonus: gs.perfectSequenceBonus,
        perfectSequenceLabel: gs.perfectSequenceLabel
      });
    }

    return {
      totalScore: totalScore,
      groupScores: groupScores,
      chords: chords
    };
  };

  /**
   * Score a single group.
   * @param {boolean} isMainGroup  True only for the main placement line.
   */
  function scoreGroup(cells, chordResult, board, placedSet, isMainGroup) {
    var bonusPts = CT.CHORD_BONUS_POINTS;
    if (CT.state && CT.state.settings.enableVariantMode) {
      bonusPts = Object.assign({}, bonusPts, CT.VARIANT_CHORD_BONUS_POINTS);
    }

    // Step 1: Base tile points — no multipliers applied yet.
    var baseTilePointsTotal = 0;
    var hasWildInGroup = false;
    var tileDetails = [];

    for (var i = 0; i < cells.length; i++) {
      var cell = cells[i];
      if (!cell.tile) continue;
      var tile = cell.tile;
      if (tile.isWild) hasWildInGroup = true;
      var basePoints = tile.isWild ? 0 : tile.points;
      baseTilePointsTotal += basePoints;
      tileDetails.push({
        note: CT.getEffectiveNote(tile),
        base: basePoints,
        multiplier: 1,      // finalised after premium evaluation
        score: basePoints
      });
    }

    // Step 2: Base chord bonus.
    var chordBonus = bonusPts[chordResult.chordType] || 0;

    // Step 3: Premium square evaluation — single best premium wins per group.
    //
    // Candidates and their extra-point values:
    //   DN  →  baseTilePointsTotal × 1   (all group tiles × 2, extra = tiles × 1)
    //   TN  →  baseTilePointsTotal × 2   (all group tiles × 3, extra = tiles × 2)
    //   DC  →  chordBonus × 1            (chord bonus × 2, extra = chord × 1)
    //   TC  →  chordBonus × 2            (chord bonus × 3, extra = chord × 2)
    //
    // Constraints:
    //   • Only newly placed, non-locked tiles may trigger a premium.
    //   • Wild tiles in the group suppress DC/TC (chord multipliers) entirely —
    //     including when the wild tile itself sits on the DC/TC square.
    //     hasWildInGroup handles both cases via a single early-exit continue,
    //     so DC/TC are never selected as best-premium when wilds are present.
    //   • Wild tiles do NOT suppress DN/TN. A wild sitting on a DN/TN square
    //     still triggers the tile multiplier (the wild contributes 0 pts itself
    //     but all other tiles in the group are still multiplied).
    //   • DN/TN apply to ALL tiles in the group (incl. locked) but only on the
    //     main line — cross-groups never receive tile multipliers.
    //   • After confirmation the cell is locked and cannot trigger again.
    //   • In a tie, the first premium encountered (board reading order) wins.

    var bestPremiumType  = null;
    var bestPremiumExtra = 0;

    for (var j = 0; j < cells.length; j++) {
      var pCell = cells[j];
      if (!placedSet[pCell.row + "," + pCell.col]) continue; // newly placed only
      if (pCell.isLocked) continue;                          // already used
      if (!pCell.premiumType) continue;

      var pt = pCell.premiumType;
      var isChordMult = (pt === "DC" || pt === "TC");
      var isTileMult  = (pt === "DN" || pt === "TN");

      if (isChordMult && hasWildInGroup) continue; // wild suppresses chord mults
      if (isTileMult  && !isMainGroup)   continue; // tile mults: main line only

      var extra = 0;
      if      (pt === "DN") extra = baseTilePointsTotal;
      else if (pt === "TN") extra = baseTilePointsTotal * 2;
      else if (pt === "DC") extra = chordBonus;
      else if (pt === "TC") extra = chordBonus * 2;

      if (extra > bestPremiumExtra) {
        bestPremiumExtra = extra;
        bestPremiumType  = pt;
      }
    }

    // Step 4: Apply the winning premium.
    var tileGroupMultiplier = 1;
    var chordMultiplier     = 1;

    if      (bestPremiumType === "DN") tileGroupMultiplier = 2;
    else if (bestPremiumType === "TN") tileGroupMultiplier = 3;
    else if (bestPremiumType === "DC") chordMultiplier     = 2;
    else if (bestPremiumType === "TC") chordMultiplier     = 3;

    var tilePointsTotal = baseTilePointsTotal * tileGroupMultiplier;
    var chordBonusTotal = chordBonus          * chordMultiplier;

    // Propagate the group multiplier into tile details.
    for (var td = 0; td < tileDetails.length; td++) {
      tileDetails[td].multiplier = tileGroupMultiplier;
      tileDetails[td].score      = tileDetails[td].base * tileGroupMultiplier;
    }

    // Step 5b: Inversion bonus — main line only, applied to BASE chord value.
    var inversionBonus = 0;
    var inversionLabel = null;

    if (isMainGroup && CT.state && CT.state.settings.enableInversionBonus) {
      var invResult = CT.getInversionClassification(cells, chordResult);
      inversionLabel = invResult.label;
      if (invResult.bonusPct > 0) {
        inversionBonus = Math.round(chordBonus * invResult.bonusPct / 100);
      }
    }

    // Step 5c: Perfect Sequence bonus — scale families only, variant mode on.
    var perfectSequenceBonus = 0;
    var perfectSequenceLabel = null;

    if (CT.state && CT.state.settings.enableVariantMode) {
      var psResult = CT.getPerfectSequenceClassification(cells, chordResult);
      perfectSequenceLabel = psResult.label;
      if (psResult.bonusPct > 0) {
        perfectSequenceBonus = Math.round(chordBonus * psResult.bonusPct / 100);
      }
    }

    // Step 6: Sum.
    var groupTotal   = tilePointsTotal + chordBonusTotal + inversionBonus + perfectSequenceBonus;
    var premiumBonus = (tilePointsTotal - baseTilePointsTotal) + (chordBonusTotal - chordBonus);

    return {
      tilePoints:           tilePointsTotal,
      baseTilePoints:       baseTilePointsTotal,
      tileDetails:          tileDetails,
      chordBonus:           chordBonus,
      chordMultiplier:      chordMultiplier,
      tileGroupMultiplier:  tileGroupMultiplier,
      chordBonusTotal:      chordBonusTotal,
      inversionBonus:       inversionBonus,
      inversionLabel:       inversionLabel,
      perfectSequenceBonus: perfectSequenceBonus,
      perfectSequenceLabel: perfectSequenceLabel,
      premiumBonus:         premiumBonus,
      groupTotal:           groupTotal,
      chordType:            chordResult.chordType,
      displayName:          chordResult.displayName,
      hasWild:              hasWildInGroup
    };
  }

})();

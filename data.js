/* ========================================================================
   data.js — Chord Tiles — Constants & Definitions
   No game logic. Pure data.
   ======================================================================== */
(function () {
  "use strict";
  const CT = (window.CT = window.CT || {});

  /* ── Note names ─────────────────────────────────────────────────────── */

  CT.PITCH_NAMES_FROM_C = [
    "C", "C#/Db", "D", "D#/Eb", "E", "F",
    "F#/Gb", "G", "G#/Ab", "A", "A#/Bb", "B"
  ];

  CT.NATURAL_NOTES = ["C", "D", "E", "F", "G", "A", "B"];

  CT.ACCIDENTAL_NOTES = ["C#/Db", "D#/Eb", "F#/Gb", "G#/Ab", "A#/Bb"];

  CT.NOTE_TO_PITCH_CLASS = {};
  CT.PITCH_NAMES_FROM_C.forEach(function (name, i) {
    CT.NOTE_TO_PITCH_CLASS[name] = i;
  });

  /* ── Tile point values ──────────────────────────────────────────────── */

  CT.TILE_POINTS = {};
  CT.NATURAL_NOTES.forEach(function (n) { CT.TILE_POINTS[n] = 2; });
  CT.ACCIDENTAL_NOTES.forEach(function (n) { CT.TILE_POINTS[n] = 3; });
  CT.TILE_POINTS["WILD"]  = 0;
  CT.TILE_POINTS["CLAIM"] = 0;

  /* ── Claim tile ─────────────────────────────────────────────────────── */

  CT.CLAIM_TILE_NOTE = "CLAIM";
  // Chromatic mode: 6 claim tiles in bag  |  Diatonic mode: 3
  CT.CLAIM_TILE_COUNT_CHROMATIC = 6;
  CT.CLAIM_TILE_COUNT_NATURAL   = 3;

  /* ── Tile distributions ─────────────────────────────────────────────── */

  CT.TILE_DISTRIBUTION_CHROMATIC = {
    C: 6, D: 6, E: 6, F: 6, G: 6, A: 6, B: 6,
    "C#/Db": 5, "D#/Eb": 5, "F#/Gb": 5, "G#/Ab": 5, "A#/Bb": 5,
    WILD: 7
  };                                                          // total 74

  CT.TILE_DISTRIBUTION_NATURAL = {
    C: 7, D: 7, E: 7, F: 7, G: 7, A: 7, B: 7,
    WILD: 2
  };                                                          // total 51

  /* ── Chord interval data (ported from Chord Dice) ───────────────────── */

  CT.CHORD_INTERVALS = {
    "major triad":             [[0,4,7],[0,3,8],[0,5,9]],
    "minor triad":             [[0,3,7],[0,4,9],[0,5,8]],
    "diminished triad":        [[0,3,6],[0,3,9],[0,6,9]],
    "augmented triad":         [[0,4,8]],
    "sus4 triad":              [[0,5,7],[0,2,7],[0,5,10]],
    "major 7th":               [[0,4,7,11],[0,3,7,8],[0,4,5,9],[0,1,5,8]],
    "minor 7th":               [[0,3,7,10],[0,4,7,9],[0,3,5,8],[0,2,5,9]],
    "dominant 7th":            [[0,4,7,10],[0,3,6,8],[0,3,5,9],[0,2,6,9]],
    "half diminished 7th":     [[0,3,6,10],[0,3,7,9],[0,4,6,9],[0,2,5,8]],
    "fully diminished 7th":    [[0,3,6,9]],
    "minor major 7th":         [[0,3,7,11],[0,4,8,9],[0,4,5,8],[0,1,4,8]],
    "major 9":                 [[0,2,4,7,11],[0,2,5,9,10],[0,3,7,8,10],[0,4,5,7,9],[0,1,3,5,8]],
    "minor 9":                 [[0,2,3,7,10],[0,1,5,8,10],[0,4,7,9,11],[0,3,5,7,8],[0,2,4,5,9]],
    "dominant 9":              [[0,2,4,7,10],[0,2,5,8,10],[0,3,6,8,10],[0,3,5,7,9],[0,2,4,6,9]],
    "dominant b9":             [[0,1,4,7,10],[0,3,6,9,11],[0,3,6,8,9],[0,3,5,6,9],[0,2,3,6,9]],
    "dominant #9":             [[0,3,4,7,10],[0,1,4,7,9],[0,3,6,8,11],[0,3,5,8,9],[0,2,5,6,9]]
  };

  CT.VARIANT_CHORD_INTERVALS = {
    "pentatonic scale":        [[0,3,5,7,10],[0,2,4,7,9],[0,2,5,7,10],[0,3,5,8,10],[0,2,5,7,9]],
    "whole step series":       [[0,2,4,6,8],[0,2,4,6,10],[0,2,4,8,10],[0,2,6,8,10],[0,4,6,8,10]],
    "chromatic scale":         [[0,1,2,3,4],[0,1,2,3,11],[0,1,2,10,11],[0,1,9,10,11],[0,8,9,10,11]]
  };

  CT.ROOT_POSITION_INTERVALS = {
    "major triad":             [0,4,7],
    "minor triad":             [0,3,7],
    "diminished triad":        [0,3,6],
    "augmented triad":         [0,4,8],
    "sus4 triad":              [0,5,7],
    "major 7th":               [0,4,7,11],
    "minor 7th":               [0,3,7,10],
    "dominant 7th":            [0,4,7,10],
    "half diminished 7th":     [0,3,6,10],
    "fully diminished 7th":    [0,3,6,9],
    "minor major 7th":         [0,3,7,11],
    "major 9":                 [0,2,4,7,11],
    "minor 9":                 [0,2,3,7,10],
    "dominant 9":              [0,2,4,7,10],
    "dominant b9":             [0,1,4,7,10],
    "dominant #9":             [0,3,4,7,10],
    "pentatonic scale":        [0,2,4,7,9],
    "whole step series":       [0,2,4,6,8],
    "chromatic scale":         [0,1,2,3,4]
  };

  CT.PLAYBACK_VOICING_INTERVALS = {
    "major triad":             [0,4,7],
    "minor triad":             [0,3,7],
    "diminished triad":        [0,3,6],
    "augmented triad":         [0,4,8],
    "sus4 triad":              [0,5,7],
    "major 7th":               [0,4,7,11],
    "minor 7th":               [0,3,7,10],
    "dominant 7th":            [0,4,7,10],
    "half diminished 7th":     [0,3,6,10],
    "fully diminished 7th":    [0,3,6,9],
    "minor major 7th":         [0,3,7,11],
    "major 9":                 [0,4,7,11,14],
    "minor 9":                 [0,3,7,10,14],
    "dominant 9":              [0,4,7,10,14],
    "dominant b9":             [0,4,7,10,13],
    "dominant #9":             [0,4,7,10,15],
    "pentatonic scale":        [0,2,4,7,9],
    "whole step series":       [0,2,4,6,8],
    "chromatic scale":         [0,1,2,3,4]
  };

  /* ── Chord bonus points ─────────────────────────────────────────────── */

  CT.CHORD_BONUS_POINTS = {
    "major triad":          18,
    "minor triad":          18,
    "diminished triad":     24,
    "augmented triad":      28,
    "sus4 triad":           20,
    "minor 7th":            34,
    "dominant 7th":         38,
    "major 7th":            42,
    "half diminished 7th":  46,
    "minor major 7th":      52,
    "fully diminished 7th": 58,
    "major 9":              68,
    "minor 9":              68,
    "dominant 9":           72,
    "dominant b9":          80,
    "dominant #9":          84
  };

  CT.VARIANT_CHORD_BONUS_POINTS = {
    "pentatonic scale":     36,
    "whole step series":    90,
    "chromatic scale":     140
  };

  CT.TRIAD_TYPES = [
    "major triad", "minor triad", "diminished triad",
    "augmented triad", "sus4 triad"
  ];

  CT.SEVENTH_TYPES = [
    "major 7th", "minor 7th", "dominant 7th",
    "half diminished 7th", "fully diminished 7th", "minor major 7th"
  ];

  CT.NINTH_TYPES = [
    "major 9", "minor 9", "dominant 9", "dominant b9", "dominant #9"
  ];

  CT.SEVENTH_OR_NINTH_TYPES = new Set([...CT.SEVENTH_TYPES, ...CT.NINTH_TYPES]);

  /* ── Board — Premium matrix ─────────────────────────────────────────── */

  CT.BOARD_SIZE = 15;
  CT.CENTER = 7;

  CT.PREMIUM_BOARD = [
    ["TC","--","--","DN","--","--","--","TC","--","--","--","DN","--","--","TC"],
    ["--","DC","--","--","TN","--","--","DN","--","--","TN","--","--","DC","--"],
    ["--","--","DC","--","--","CS","--","--","--","CS","--","--","DC","--","--"],
    ["DN","--","--","DC","--","--","DN","--","DN","--","--","DC","--","--","DN"],
    ["--","TN","--","--","DC","--","--","CS","--","--","DC","--","--","TN","--"],
    ["--","--","CS","--","--","DN","--","--","--","DN","--","--","CS","--","--"],
    ["--","--","--","DN","--","--","DC","--","DC","--","--","DN","--","--","--"],
    ["TC","DN","--","--","CS","--","--","DC","--","--","CS","--","--","DN","TC"],
    ["--","--","--","DN","--","--","DC","--","DC","--","--","DN","--","--","--"],
    ["--","--","CS","--","--","DN","--","--","--","DN","--","--","CS","--","--"],
    ["--","TN","--","--","DC","--","--","CS","--","--","DC","--","--","TN","--"],
    ["DN","--","--","DC","--","--","DN","--","DN","--","--","DC","--","--","DN"],
    ["--","--","DC","--","--","CS","--","--","--","CS","--","--","DC","--","--"],
    ["--","DC","--","--","TN","--","--","DN","--","--","TN","--","--","DC","--"],
    ["TC","--","--","DN","--","--","--","TC","--","--","--","DN","--","--","TC"]
  ];

  /* ── Board — Blocked overlays (zero-based [row, col]) ───────────────── */

  CT.BLOCKED_LAYOUTS = [
    [[2,4],[2,10],[12,4],[12,10]],     // A
    [[4,2],[4,12],[10,2],[10,12]],     // B
    [[1,6],[1,8],[13,6],[13,8]]        // C
  ];

  /* ── Premium type display info ──────────────────────────────────────── */

  CT.PREMIUM_INFO = {
    TC: { label: "TC", fullName: "Triple Chord",  cssClass: "premium-tc" },
    DC: { label: "DC", fullName: "Double Chord",  cssClass: "premium-dc" },
    DN: { label: "DN", fullName: "Double Note",   cssClass: "premium-dn" },
    TN: { label: "TN", fullName: "Triple Note",   cssClass: "premium-tn" },
    CS: { label: "CS", fullName: "Cadence Square", cssClass: "premium-cs" }
  };

  /* ── MIDI range ─────────────────────────────────────────────────────── */

  CT.CHORD_MIDI_RANGE = { min: 48, max: 74 };

  /* ── Rack size ──────────────────────────────────────────────────────── */

  CT.RACK_SIZE = 6;

  /* ── Player colours ─────────────────────────────────────────────────── */

  CT.PLAYER_COLORS = ["#c56b2e", "#2053b8", "#17735f", "#7e36a1"];

  /* ── Default settings ───────────────────────────────────────────────── */

  CT.DEFAULT_SETTINGS = {
    numberOfPlayers: 2,
    playerNames: ["Player 1", "Player 2"],
    includeAccidentals: true,
    enableVariantMode: false,
    winCondition: "rounds",
    roundLimit: 10,
    targetScore: 300,
    enableTimedTurns: false,
    timedTurnSeconds: 90,
    enableEarTraining: true,
    autoPlayTileOnTap: true,
    autoPlayChordOnConfirm: true,
    playbackMode: "harmonic",
    enableTileSwap: true,
    selectedBoardVariantId: "pure-balance",
    enableBlockedSpaces: true,
    triadsOnlyMode: false,
    enableInversionBonus: true,
    enableClaimTiles: false
  };

  /* ── Board Variants ─────────────────────────────────────────────────── */

  CT.BOARD_VARIANTS = [
    {
      id: "harmonic-crown",
      name: "Harmonic Crown",
      shortDescription: "A balanced board with strong outer-corner power, diagonal tension, and a regal ring of high-impact spaces.",
      longDescription: "Harmonic Crown spreads its strongest rewards toward the outer structure while still keeping meaningful central development. Triple Chord spaces in the corners and upper/lower crown points create long-term goals, while Double Chord and Triple Note spaces support strategic upgrades and lane contests without overcrowding the middle.",
      layout: [
        ["TC","--","--","DN","--","--","--","TC","--","--","--","DN","--","--","TC"],
        ["--","DC","--","--","TN","--","--","DN","--","--","TN","--","--","DC","--"],
        ["--","--","TC","--","DN","--","--","--","--","--","DN","--","TC","--","--"],
        ["DN","--","--","DC","--","--","DN","--","DN","--","--","DC","--","--","DN"],
        ["--","TN","--","--","DC","--","--","--","--","--","DC","--","--","TN","--"],
        ["--","--","--","DN","--","TN","--","--","--","TN","--","DN","--","--","--"],
        ["--","DN","--","--","--","--","DN","--","DN","--","--","--","DN","--","--"],
        ["TC","--","--","--","DN","--","--","--","--","--","DN","--","--","--","TC"],
        ["--","DN","--","--","--","--","DN","--","DN","--","--","--","DN","--","--"],
        ["--","--","--","DN","--","TN","--","--","--","TN","--","DN","--","--","--"],
        ["--","TN","--","--","DC","--","--","--","--","--","DC","--","--","TN","--"],
        ["DN","--","--","DC","--","--","DN","--","DN","--","--","DC","--","--","DN"],
        ["--","--","TC","--","DN","--","--","--","--","--","DN","--","TC","--","--"],
        ["--","DC","--","--","TN","--","--","DN","--","--","TN","--","--","DC","--"],
        ["TC","--","--","DN","--","--","--","TC","--","--","--","DN","--","--","TC"]
      ]
    },
    {
      id: "pure-balance",
      name: "Pure Balance",
      shortDescription: "An ultra-sparse board with rare power spikes and clean, readable strategy from opening to endgame.",
      longDescription: "Pure Balance is a disciplined board with very sparse premium placement. It rewards patience, efficient chord-building, and careful board control. Most of the pressure comes from note placement and timing rather than multiplier chaining, making this board great for players who want clarity and strong fundamentals.",
      layout: [
        ["TC","--","--","DN","--","--","--","TC","--","--","--","DN","--","--","TC"],
        ["--","--","--","--","TN","--","--","--","--","--","TN","--","--","--","--"],
        ["--","--","DC","--","--","--","DN","--","DN","--","--","--","DC","--","--"],
        ["DN","--","--","--","--","--","--","--","--","--","--","--","--","--","DN"],
        ["--","TN","--","--","DC","--","--","DN","--","--","DC","--","--","TN","--"],
        ["--","--","--","--","--","DN","--","--","--","DN","--","--","--","--","--"],
        ["--","--","DN","--","--","--","--","--","--","--","--","--","DN","--","--"],
        ["TC","--","--","--","DN","--","--","--","--","--","DN","--","--","--","TC"],
        ["--","--","DN","--","--","--","--","--","--","--","--","--","DN","--","--"],
        ["--","--","--","--","--","DN","--","--","--","DN","--","--","--","--","--"],
        ["--","TN","--","--","DC","--","--","DN","--","--","DC","--","--","TN","--"],
        ["DN","--","--","--","--","--","--","--","--","--","--","--","--","--","DN"],
        ["--","--","DC","--","--","--","DN","--","DN","--","--","--","DC","--","--"],
        ["--","--","--","--","TN","--","--","--","--","--","TN","--","--","--","--"],
        ["TC","--","--","DN","--","--","--","TC","--","--","--","DN","--","--","TC"]
      ]
    },
    {
      id: "split-lanes",
      name: "Split Lanes",
      shortDescription: "A sparse board with two strong chord corridors that encourage lane control, timing, and contested expansion.",
      longDescription: "Split Lanes creates the feeling of two major battle routes across the board. Premium spaces are separated enough to avoid clutter, but the structure still nudges players into choosing a side, contesting development paths, and planning upgrades across mirrored chord corridors.",
      layout: [
        ["TC","--","--","DN","--","--","--","TC","--","--","--","DN","--","--","TC"],
        ["--","DC","--","--","TN","--","--","--","--","--","TN","--","--","DC","--"],
        ["--","--","DC","--","--","DN","--","--","--","DN","--","--","DC","--","--"],
        ["DN","--","--","--","--","--","DN","--","DN","--","--","--","--","--","DN"],
        ["--","TN","--","--","DC","--","--","--","--","--","DC","--","--","TN","--"],
        ["--","--","DN","--","--","DN","--","--","--","DN","--","--","DN","--","--"],
        ["--","--","--","DN","--","--","--","--","--","--","--","DN","--","--","--"],
        ["TC","--","--","--","DN","--","--","--","--","--","DN","--","--","--","TC"],
        ["--","--","--","DN","--","--","--","--","--","--","--","DN","--","--","--"],
        ["--","--","DN","--","--","DN","--","--","--","DN","--","--","DN","--","--"],
        ["--","TN","--","--","DC","--","--","--","--","--","DC","--","--","TN","--"],
        ["DN","--","--","--","--","--","DN","--","DN","--","--","--","--","--","DN"],
        ["--","--","DC","--","--","DN","--","--","--","DN","--","--","DC","--","--"],
        ["--","DC","--","--","TN","--","--","--","--","--","TN","--","--","DC","--"],
        ["TC","--","--","DN","--","--","--","TC","--","--","--","DN","--","--","TC"]
      ]
    },
    {
      id: "elite-mode",
      name: "Elite Mode",
      shortDescription: "An extremely sparse, high-discipline board where every premium square matters and patience is everything.",
      longDescription: "Elite Mode strips the board down to its essentials. Premium spaces are rare, powerful, and far apart. This variant rewards sharp tactical judgment, efficient use of natural board flow, and careful timing of your strongest chords. It is the cleanest and most unforgiving option of the group.",
      layout: [
        ["TC","--","--","DN","--","--","--","TC","--","--","--","DN","--","--","TC"],
        ["--","--","--","--","TN","--","--","--","--","--","TN","--","--","--","--"],
        ["--","--","DC","--","--","--","--","--","--","--","--","--","DC","--","--"],
        ["DN","--","--","--","--","--","--","--","--","--","--","--","--","--","DN"],
        ["--","TN","--","--","--","--","--","--","--","--","--","--","--","TN","--"],
        ["--","--","--","--","--","DN","--","--","--","DN","--","--","--","--","--"],
        ["--","--","DN","--","--","--","--","--","--","--","--","--","DN","--","--"],
        ["TC","--","--","--","--","--","--","DC","--","--","--","--","--","--","TC"],
        ["--","--","DN","--","--","--","--","--","--","--","--","--","DN","--","--"],
        ["--","--","--","--","--","DN","--","--","--","DN","--","--","--","--","--"],
        ["--","TN","--","--","--","--","--","--","--","--","--","--","--","TN","--"],
        ["DN","--","--","--","--","--","--","--","--","--","--","--","--","--","DN"],
        ["--","--","DC","--","--","--","--","--","--","--","--","--","DC","--","--"],
        ["--","--","--","--","TN","--","--","--","--","--","TN","--","--","--","--"],
        ["TC","--","--","DN","--","--","--","TC","--","--","--","DN","--","--","TC"]
      ]
    }
  ];

  CT.DEFAULT_BOARD_VARIANT_ID = "pure-balance";

  CT.getBoardVariantById = function (variantId) {
    for (var i = 0; i < CT.BOARD_VARIANTS.length; i++) {
      if (CT.BOARD_VARIANTS[i].id === variantId) return CT.BOARD_VARIANTS[i];
    }
    return CT.BOARD_VARIANTS[0];
  };
})();

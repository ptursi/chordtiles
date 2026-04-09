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
  CT.TILE_POINTS["WILD"] = 0;

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
    enableTileSwap: true
  };
})();

/* ========================================================================
   audio.js — Chord Tiles — Piano Synthesis & Playback
   Ported from Chord Dice Game
   ======================================================================== */
(function () {
  "use strict";
  var CT = window.CT;

  var audioContext = null;

  function ensureAudioContext() {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === "suspended") {
      audioContext.resume();
    }
    return audioContext;
  }

  function midiToFrequency(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function getNoteIndexFromC(note) {
    var pc = CT.NOTE_TO_PITCH_CLASS[note];
    return pc !== undefined ? pc : 0;
  }

  /* ── Piano synthesis ────────────────────────────────────────────────── */

  function playPianoFrequency(frequency, startOffset, duration, gainScale) {
    startOffset = startOffset || 0;
    duration = duration || 1.2;
    gainScale = gainScale || 1;

    var context = ensureAudioContext();
    var startTime = context.currentTime + startOffset;
    var velocityJitter = 0.94 + Math.random() * 0.14;
    var detuneHumanize = function () { return (Math.random() - 0.5) * 6; };

    var masterGain = context.createGain();
    var toneFilter = context.createBiquadFilter();
    var bodyFilter = context.createBiquadFilter();
    var compressor = context.createDynamicsCompressor();

    toneFilter.type = "lowpass";
    toneFilter.frequency.setValueAtTime(3200 + Math.random() * 500, startTime);
    toneFilter.Q.value = 0.9;

    bodyFilter.type = "peaking";
    bodyFilter.frequency.setValueAtTime(900, startTime);
    bodyFilter.Q.value = 0.8;
    bodyFilter.gain.setValueAtTime(2.5, startTime);

    compressor.threshold.value = -24;
    compressor.knee.value = 18;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.22;

    var peakGain = 0.2 * gainScale * velocityJitter;
    var sustainGain = 0.075 * gainScale * velocityJitter;
    masterGain.gain.setValueAtTime(0.0001, startTime);
    masterGain.gain.linearRampToValueAtTime(peakGain, startTime + 0.005);
    masterGain.gain.exponentialRampToValueAtTime(sustainGain, startTime + 0.08);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    masterGain.connect(toneFilter);
    toneFilter.connect(bodyFilter);
    bodyFilter.connect(compressor);
    compressor.connect(context.destination);

    var partials = [
      { ratio: 1, gain: 0.86, type: "triangle", release: Math.max(0.18, duration - 0.02) },
      { ratio: 2, gain: 0.26, type: "sine", release: Math.max(0.16, duration - 0.24) },
      { ratio: 3, gain: 0.09, type: "sine", release: Math.max(0.14, duration - 0.42) }
    ];

    partials.forEach(function (partial, index) {
      var oscillator = context.createOscillator();
      var partialGain = context.createGain();
      oscillator.type = partial.type;
      oscillator.frequency.setValueAtTime(frequency * partial.ratio, startTime);
      oscillator.detune.setValueAtTime(detuneHumanize() + index * 0.6, startTime);
      var partialPeak = partial.gain * gainScale * velocityJitter;
      partialGain.gain.setValueAtTime(0.0001, startTime);
      partialGain.gain.linearRampToValueAtTime(partialPeak, startTime + 0.004 + index * 0.002);
      partialGain.gain.exponentialRampToValueAtTime(0.0001, startTime + partial.release);
      oscillator.connect(partialGain);
      partialGain.connect(masterGain);
      oscillator.start(startTime);
      oscillator.stop(startTime + duration + 0.05);
    });

    // Hammer attack transient
    var hammerOsc = context.createOscillator();
    var hammerGain = context.createGain();
    var hammerFilter = context.createBiquadFilter();
    hammerOsc.type = "square";
    hammerOsc.frequency.setValueAtTime(frequency * 5.1, startTime);
    hammerOsc.detune.setValueAtTime(detuneHumanize() * 2, startTime);
    hammerFilter.type = "bandpass";
    hammerFilter.frequency.setValueAtTime(Math.min(6000, frequency * 8), startTime);
    hammerFilter.Q.value = 1.4;
    hammerGain.gain.setValueAtTime(0.03 * gainScale * velocityJitter, startTime);
    hammerGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.025);
    hammerOsc.connect(hammerFilter);
    hammerFilter.connect(hammerGain);
    hammerGain.connect(masterGain);
    hammerOsc.start(startTime);
    hammerOsc.stop(startTime + 0.03);
  }

  /* ── Sound effects ──────────────────────────────────────────────────── */

  CT.playSoundEffect = function (type) {
    var sequences = {
      place: [440, 520],
      confirm: [523, 659, 784],
      bonus: [523, 659, 784, 880],
      error: [300, 220],
      win: [392, 523, 659, 784]
    };
    var seq = sequences[type];
    if (!seq) return;
    try {
      var context = ensureAudioContext();
      var startTime = context.currentTime;
      seq.forEach(function (freq, index) {
        var osc = context.createOscillator();
        var gain = context.createGain();
        var filter = context.createBiquadFilter();
        osc.type = type === "error" ? "sawtooth" : "sine";
        osc.frequency.setValueAtTime(freq, startTime + index * 0.08);
        osc.detune.setValueAtTime((Math.random() - 0.5) * 8, startTime + index * 0.08);
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(3000, startTime + index * 0.08);
        gain.gain.setValueAtTime(0.0001, startTime + index * 0.08);
        gain.gain.linearRampToValueAtTime(0.04, startTime + index * 0.08 + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + index * 0.08 + 0.14);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(context.destination);
        osc.start(startTime + index * 0.08);
        osc.stop(startTime + index * 0.08 + 0.15);
      });
    } catch (e) {
      // Audio unavailable
    }
  };

  /* ── Note playback ──────────────────────────────────────────────────── */

  CT.playNote = function (noteName) {
    if (!noteName) return;
    var pc = getNoteIndexFromC(noteName);
    var midi = 60 + pc;   // C4 octave
    try {
      playPianoFrequency(midiToFrequency(midi), 0, 1.0, 1);
    } catch (e) { /* unavailable */ }
  };

  /* ── Chord playback ─────────────────────────────────────────────────── */

  function getPreferredRootOctave(rootPitchClass, chord) {
    var rootIntervals = CT.ROOT_POSITION_INTERVALS[chord];
    var noteCount = rootIntervals ? rootIntervals.length : 0;
    if (noteCount >= 5) return 3;
    if (noteCount === 4) return rootPitchClass <= 4 ? 4 : 3;
    return rootPitchClass <= 5 ? 4 : 3;
  }

  function getChordMidiNotes(notes, chordType) {
    if (!chordType) {
      return notes.map(function (n) { return 60 + getNoteIndexFromC(n); }).sort(function (a, b) { return a - b; });
    }

    var rootIntervals = CT.ROOT_POSITION_INTERVALS[chordType];
    var playbackIntervals = CT.PLAYBACK_VOICING_INTERVALS[chordType] || rootIntervals;
    if (!rootIntervals || !playbackIntervals) {
      return notes.map(function (n) { return 60 + getNoteIndexFromC(n); }).sort(function (a, b) { return a - b; });
    }

    // Find root via detection
    var pcs = [];
    var seen = {};
    notes.forEach(function (n) {
      var pc = getNoteIndexFromC(n);
      if (!seen[pc]) { seen[pc] = true; pcs.push(pc); }
    });

    var rootPC = null;
    for (var ri = 0; ri < pcs.length; ri++) {
      var candidate = pcs[ri];
      var ivs = pcs.map(function (pc) { return (pc - candidate + 12) % 12; }).sort(function (a, b) { return a - b; });
      if (ivs.join(",") === rootIntervals.join(",")) {
        rootPC = candidate;
        break;
      }
    }

    if (rootPC === null) {
      return notes.map(function (n) { return 60 + getNoteIndexFromC(n); }).sort(function (a, b) { return a - b; });
    }

    var octave = getPreferredRootOctave(rootPC, chordType);
    var rootMidi = 12 * (octave + 1) + rootPC;
    var midiNotes = playbackIntervals.map(function (iv) { return rootMidi + iv; });

    // Ensure within range
    while (midiNotes[0] < CT.CHORD_MIDI_RANGE.min) {
      rootMidi += 12;
      midiNotes = playbackIntervals.map(function (iv) { return rootMidi + iv; });
    }
    while (midiNotes[midiNotes.length - 1] > CT.CHORD_MIDI_RANGE.max) {
      rootMidi -= 12;
      midiNotes = playbackIntervals.map(function (iv) { return rootMidi + iv; });
    }

    return midiNotes;
  }

  CT.playChord = function (notes, chordType, mode) {
    mode = mode || "harmonic";
    if (!notes || notes.length === 0) return;

    var midiNotes = getChordMidiNotes(notes, chordType);

    try {
      if (mode === "harmonic") {
        midiNotes.forEach(function (midi) {
          playPianoFrequency(midiToFrequency(midi), 0, 1.55, 0.65);
        });
      } else {
        midiNotes.forEach(function (midi, index) {
          playPianoFrequency(midiToFrequency(midi), index * 0.28, 0.95, 0.85);
        });
      }
    } catch (e) { /* unavailable */ }
  };

  CT.ensureAudioContext = ensureAudioContext;

})();

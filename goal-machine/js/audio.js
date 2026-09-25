/* Goal Machine – sound effects and music, all synthesised with Web Audio (no audio files). */
'use strict';

(function () {
  const store = GM.store;
  // X is the "studio": the audio context plus its buses. It can be swapped for an OfflineAudioContext to render
  // sounds to a file (see GM.sound.renderDemo), so every sound is written against X rather than a global context.
  let X = null, live = null;
  const now = () => X.ctx.currentTime;

  function makeStudio(ctx) {
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    const master = ctx.createGain(), sfx = ctx.createGain(), bg = ctx.createGain();
    sfx.connect(master); bg.connect(master); master.connect(comp); comp.connect(ctx.destination);
    // two seconds of white noise, reused by every noisy sound
    const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return { ctx, master, sfx, bg, noise };
  }

  /* ---------------------------------------------------------------- building blocks */
  function env(g, t, vol, attack, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  function tone(freq, o = {}) {
    const t = o.t != null ? o.t : now(), dur = o.dur || 0.2, c = X.ctx;
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.glide || dur));
    if (o.detune) osc.detune.value = o.detune;
    let out = osc;
    if (o.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; osc.connect(f); out = f; }
    out.connect(g); g.connect(o.dest || X.sfx);
    env(g, t, o.vol || 0.2, o.attack || 0.005, dur);
    osc.start(t); osc.stop(t + dur + 0.05);
    return osc;
  }
  function noise(o = {}) {
    const t = o.t != null ? o.t : now(), dur = o.dur || 0.2, c = X.ctx;
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = X.noise; src.loop = true;
    f.type = o.type || 'bandpass'; f.frequency.setValueAtTime(o.freq || 1000, t); f.Q.value = o.q || 1;
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    src.connect(f); f.connect(g); g.connect(o.dest || X.sfx);
    env(g, t, o.vol || 0.2, o.attack || 0.005, dur);
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  }
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);

  // A referee's pea whistle: a high tone warbled fast by the pea, with a little breath
  function blast(t, dur, vol = 0.17) {
    const c = X.ctx, osc = c.createOscillator(), lfo = c.createOscillator(), depth = c.createGain(), g = c.createGain();
    osc.type = 'sine'; osc.frequency.value = 2900;
    lfo.frequency.value = 38; depth.gain.value = 170;
    lfo.connect(depth); depth.connect(osc.frequency);
    osc.connect(g); g.connect(X.sfx);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.setValueAtTime(vol, t + dur - 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.start(t); lfo.start(t); osc.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
    noise({ t, dur, freq: 2900, q: 4, vol: vol * 0.35, attack: 0.02 });
  }

  // A crowd roar: noise through a bank of voice-range filters, each wobbling on its own
  function roar(t, hold = 1.2, vol = 0.35, dest) {
    [300, 520, 800, 1150, 1700, 2600].forEach((f, i) => {
      const c = X.ctx, src = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
      src.buffer = X.noise; src.loop = true;
      bp.type = 'bandpass'; bp.Q.value = 1.4;
      bp.frequency.setValueAtTime(f * 0.85, t);
      bp.frequency.linearRampToValueAtTime(f * (1.05 + 0.1 * Math.random()), t + 0.6);  // the "whoa" rising
      const v = vol * (i < 3 ? 1 : 0.6);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(v, t + 0.25 + Math.random() * 0.15);
      g.gain.setValueAtTime(v, t + 0.4 + hold);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4 + hold + 2.2);
      src.connect(bp); bp.connect(g); g.connect(dest || X.sfx);
      src.start(t, Math.random() * 1.5); src.stop(t + hold + 3);
    });
  }

  // Brassy chord: detuned saws with a filter that opens as the note starts
  function brass(notes, t, dur, vol = 0.07) {
    notes.forEach(n => [-7, 7].forEach(dt => {
      const c = X.ctx, osc = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
      osc.type = 'sawtooth'; osc.frequency.value = midi(n); osc.detune.value = dt;
      f.type = 'lowpass'; f.frequency.setValueAtTime(500, t); f.frequency.linearRampToValueAtTime(3200, t + 0.06);
      f.frequency.exponentialRampToValueAtTime(1200, t + dur);
      osc.connect(f); f.connect(g); g.connect(X.sfx);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.03);
      g.gain.setValueAtTime(vol * 0.8, t + dur - 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.15);
      osc.start(t); osc.stop(t + dur + 0.2);
    }));
  }

  /* ---------------------------------------------------------------- the sound board */
  const SOUNDS = {
    tap: t => tone(1100, { t, to: 800, dur: 0.05, vol: 0.06 }),
    tick: t => { tone(2100, { t, type: 'triangle', dur: 0.025, vol: 0.04 }); noise({ t, dur: 0.02, type: 'highpass', freq: 5000, vol: 0.015 }); },
    land: t => { tone(170, { t, to: 55, dur: 0.2, vol: 0.4 }); noise({ t, dur: 0.07, type: 'lowpass', freq: 900, vol: 0.18 }); },
    place: t => { noise({ t, dur: 0.14, freq: 700, to: 3800, q: 2, vol: 0.22 }); tone(520, { t: t + 0.07, to: 880, dur: 0.14, type: 'triangle', vol: 0.14 }); },
    swoosh: t => noise({ t, dur: 0.28, freq: 3500, to: 400, q: 1.5, vol: 0.2 }),
    wild: t => [84, 88, 91, 96, 100].forEach((n, i) => tone(midi(n), { t: t + i * 0.055, dur: 0.35, type: 'triangle', vol: 0.09 })),
    good: t => { tone(880, { t, dur: 0.5, vol: 0.16 }); tone(1320, { t: t + 0.07, dur: 0.6, vol: 0.13 }); tone(2640, { t: t + 0.07, dur: 0.2, vol: 0.03 }); },
    bad: t => { tone(140, { t, dur: 0.32, type: 'sawtooth', lp: 700, vol: 0.13 }); tone(148, { t, dur: 0.32, type: 'sawtooth', lp: 700, vol: 0.13 }); },
    clock: t => { tone(1750, { t, type: 'triangle', dur: 0.05, vol: 0.12 }); tone(1180, { t, dur: 0.03, vol: 0.06 }); },
    whistle: t => blast(t, 0.4),
    fulltime: t => { blast(t, 0.28); blast(t + 0.4, 0.28); blast(t + 0.8, 0.95); },
    sting: t => { brass([67, 71, 74], t, 0.12, 0.05); brass([72, 76, 79], t + 0.14, 0.35, 0.06); },
    horn: t => {
      [57, 61, 64, 69].forEach(n => tone(midi(n), { t, dur: 1.4, type: 'sawtooth', lp: 1500, attack: 0.05, vol: 0.06 }));
      roar(t + 0.1, 1.4, 0.3);
    },
    cheer: t => roar(t, 1.1, 0.28),
    fanfare: t => {
      brass([60, 64, 67], t, 0.16); brass([60, 64, 67], t + 0.2, 0.16); brass([60, 65, 69], t + 0.4, 0.16);
      brass([64, 67, 72], t + 0.6, 1.2, 0.08); roar(t + 0.5, 1.6, 0.3);
    },
  };
  // a blip that climbs as you close in on a target (frac 0..1)
  const rise = (t, frac) => tone(380 + 900 * Math.min(1, Math.max(0, frac)), { t, dur: 0.12, type: 'triangle', vol: 0.1 });

  /* ---------------------------------------------------------------- background music */
  let bgNodes = [], bgTimer = null, bgMode = 'off';

  // The music: a 56-bar song at 122 bpm (about 1 min 50 s) in sections, so it takes a while to come round again:
  // intro → groove → lift → breakdown (with a drum roll) → chorus → groove with a new bassline → chorus → turnaround.
  // The chorus tune is written out; the arpeggio and hi-hats pick slightly different patterns on each pass.
  const CH = { Am: [57, 60, 64], F: [53, 57, 60], C: [52, 55, 60], G: [55, 59, 62], Em: [52, 55, 59], Dm: [50, 53, 57] };
  const ROOT = { Am: 45, F: 41, C: 48, G: 43, Em: 40, Dm: 38 };
  const _ = null;
  const TUNES = {  // eighth notes per bar, MIDI numbers
    lift: [[69, _, 72, _, 69, _, 65, _], [71, _, 74, _, 71, _, 67, _], [71, _, 76, _, 79, _, 76, _], [69, _, _, _, 72, 71, 69, _]],
    chorus: [[76, _, 79, _, 76, 74, 72, _], [74, _, 71, _, 74, _, 79, _], [72, _, 76, _, 81, _, 79, 76], [77, _, 76, _, 72, _, _, _],
      [76, _, 79, _, 76, 74, 72, _], [74, _, 71, _, 74, _, 79, 81], [84, _, 83, _, 81, _, 79, 76], [77, _, 79, _, 76, _, _, _]],
  };
  const SONG = [
    { bars: 4, chords: ['Am', 'F', 'C', 'G'], pad: 1, hats: 8, bass: 'pulse', intro: 1 },
    { bars: 8, chords: ['Am', 'F', 'C', 'G'], pad: 1, kick: 1, clap: 1, hats: 8, bass: 'pulse', stab: 1 },
    { bars: 8, chords: ['F', 'G', 'Em', 'Am'], pad: 1, kick: 1, clap: 1, hats: 16, bass: 'pulse', arp: 1, tune: 'lift', fill: 1 },
    { bars: 8, chords: ['Dm', 'F', 'Am', 'G'], pad: 1, hats: 0, bass: 'long', arp: 1, roll: 1 },
    { bars: 8, chords: ['C', 'G', 'Am', 'F'], pad: 1, kick: 1, clap: 1, hats: 16, open: 1, bass: 'pulse', stab: 1, tune: 'chorus' },
    { bars: 8, chords: ['Am', 'F', 'C', 'G'], pad: 1, kick: 1, clap: 1, hats: 8, bass: 'bounce', stab: 1, arp: 1 },
    { bars: 8, chords: ['C', 'G', 'Am', 'F'], pad: 1, kick: 1, clap: 1, hats: 16, open: 1, bass: 'bounce', stab: 1, arp: 1, tune: 'chorus', fill: 1 },
    { bars: 4, chords: ['Am', 'F', 'G', 'G'], pad: 1, kick: 1, hats: 8, bass: 'pulse', roll: 1 },
  ];
  const BARS = SONG.reduce((a, x) => a + x.bars, 0);
  function startMusic(from, until) {
    const bpm = 122, step = 60 / bpm / 4, c = X.ctx;
    const out = c.createGain(); out.gain.value = 1.5; out.connect(X.bg);
    // the tune gets a little echo
    const lead = c.createGain(), echo = c.createDelay(1), fb = c.createGain(), wet = c.createGain();
    echo.delayTime.value = step * 3; fb.gain.value = 0.3; wet.gain.value = 0.35;
    lead.connect(out); lead.connect(echo); echo.connect(fb); fb.connect(echo); echo.connect(wet); wet.connect(out);
    let s = 0, t0 = (from || now()) + 0.1, pass = 0;
    const inst = {
      kick: t => tone(150, { t, to: 45, glide: 0.12, dur: 0.22, vol: 0.5, dest: out }),
      clap: (t, v = 0.11) => [0, 0.01, 0.022].forEach(j => noise({ t: t + j, dur: 0.12, freq: 1600, q: 0.9, vol: v, dest: out })),
      hat: (t, open) => noise({ t, dur: open ? 0.18 : 0.04, type: 'highpass', freq: 7500, vol: open ? 0.05 : 0.035, dest: out }),
      bass: (t, n, len) => tone(midi(n), { t, dur: step * len, type: 'sawtooth', lp: 380, vol: 0.14, dest: out }),
      stab: (t, ch) => ch.forEach(n => [-9, 9].forEach(d => tone(midi(n + 12), { t, dur: step * 1.4, type: 'sawtooth', lp: 1700, detune: d, vol: 0.022, dest: out }))),
      pad: (t, ch, bars) => ch.forEach(n => tone(midi(n), { t, dur: step * 16 * bars, type: 'triangle', attack: 0.4, vol: 0.03, dest: out })),
      arp: (t, n) => tone(midi(n + 24), { t, dur: step * 0.9, type: 'square', lp: 2600, vol: 0.016, dest: out }),
      tune: (t, n) => { tone(midi(n), { t, dur: step * 1.7, type: 'square', lp: 2400, vol: 0.028, dest: lead }); tone(midi(n), { t, dur: step * 1.7, type: 'sawtooth', lp: 3000, detune: 8, vol: 0.018, dest: lead }); },
    };
    const ARPS = [[0, 1, 2, 1], [0, 2, 1, 2], [2, 1, 0, 1], [0, 1, 2, 3]];
    function schedule(horizon) {
      while (t0 < horizon) {
        const barAll = Math.floor(s / 16) % BARS, b = s % 16;
        if (barAll === 0 && b === 0 && s > 0) pass++;
        let sec = SONG[0], start = 0;
        for (const x of SONG) { if (barAll < start + x.bars) { sec = x; break; } start += x.bars; }
        const bar = barAll - start, name = sec.chords[bar % 4], ch = CH[name], root = ROOT[name], last = bar === sec.bars - 1;
        const r = GM.rng(pass + ':' + barAll + ':' + b);
        if (b === 0 && sec.pad) inst.pad(t0, ch, 1);
        if (sec.kick && b % 4 === 0 && !(last && sec.fill && b >= 8)) inst.kick(t0);
        if (sec.clap && (b === 4 || b === 12)) inst.clap(t0);
        // drum roll into the next section: the last bar (or two, for a roll) fills with rising claps
        if ((sec.fill && last && b >= 8) || (sec.roll && bar >= sec.bars - 2 && (bar === sec.bars - 1 || b % 2 === 0))) {
          inst.clap(t0, 0.03 + 0.08 * ((bar === sec.bars - 1 ? 16 : 0) + b) / 32);
        }
        if (sec.hats === 8 && b % 4 === 2) inst.hat(t0, sec.open && b === 14);
        if (sec.hats === 16 && (b % 2 === 0 || r() < 0.2)) inst.hat(t0, sec.open && b === 14 && bar % 2 === 1);
        if (sec.bass === 'pulse' && b % 2 === 0) inst.bass(t0, b === 6 || b === 14 ? root + 12 : root, 1.8);
        if (sec.bass === 'bounce' && [0, 3, 6, 8, 10, 11, 14].includes(b)) inst.bass(t0, [6, 11].includes(b) ? root + 12 : b === 14 ? root + 7 : root, 1.4);
        if (sec.bass === 'long' && b === 0) inst.bass(t0, root, 15);
        if (sec.stab && (b === 2 || b === 6 || b === 10 || b === 13)) inst.stab(t0, ch);
        if (sec.arp && !(sec.intro)) {
          const pat = ARPS[(pass + Math.floor(barAll / 4)) % ARPS.length], notes = ch.concat(ch[0] + 12);
          inst.arp(t0, notes[pat[b % 4]] + (b >= 8 ? 12 : 0));
        }
        if (sec.tune && b % 2 === 0) {
          const tune = TUNES[sec.tune], n = tune[bar % tune.length][b / 2];
          if (n) inst.tune(t0, n);
        }
        s++; t0 += step;
      }
    }
    if (until) { schedule(until - 1); return; }
    schedule(now() + 0.25);
    bgTimer = setInterval(() => schedule(now() + 0.25), 60);
    bgNodes.push({ stop: () => { out.disconnect(); echo.disconnect(); } });
  }

  function stopBg() {
    clearInterval(bgTimer); bgTimer = null;
    bgNodes.forEach(n => { try { n.stop(); } catch (e) { } });
    bgNodes = []; bgMode = 'off';
  }
  function syncBg() {
    if (!live) return;
    const want = document.hidden ? 'off' : GM.sound.settings().bg;
    if (want === bgMode) return;
    stopBg();
    X = live;
    if (want === 'music') startMusic();
    bgMode = want;
  }

  /* ---------------------------------------------------------------- public */
  function unlock() {
    if (!live) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      live = makeStudio(new AC());
      applyVolumes();
    }
    if (live.ctx.state === 'suspended') live.ctx.resume();
    syncBg();
  }
  function applyVolumes() {
    if (!live) return;
    const s = GM.sound.settings();
    live.sfx.gain.value = s.sfx ? s.sfxVol : 0;
    live.bg.gain.setTargetAtTime(s.bgVol * 0.8, live.ctx.currentTime, 0.1);
  }

  GM.sound = {
    settings: () => ({ sfx: store.get('sfx', true), sfxVol: store.get('sfxVol', 0.7), bg: store.get('bg', 'off') === 'music' ? 'music' : 'off', bgVol: store.get('bgVol', 0.5) }),
    set(k, v) { store.set(k, v); applyVolumes(); syncBg(); },
    play(name, arg) {
      if (!live || !store.get('sfx', true) || document.hidden) return;
      if (live.ctx.state !== 'running') return;
      X = live;
      try { name === 'rise' ? rise(now(), arg) : SOUNDS[name] && SOUNDS[name](now()); } catch (e) { }
    },
    // Renders every sound (and a few seconds of each background) to a WAV, for checking them without a speaker
    async renderDemo(names = Object.keys(SOUNDS), gap = 1.6, bgSeconds = 0) {
      const sfxEnd = names.length * gap + 2, rate = 44100;
      const ctx = new OfflineAudioContext(1, Math.ceil((sfxEnd + bgSeconds + 1) * rate), rate);
      const prev = X; X = makeStudio(ctx);
      X.bg.gain.value = 0.4;
      names.forEach((n, i) => SOUNDS[n](i * gap + 0.1));
      const liveNodes = bgNodes;
      if (bgSeconds) startMusic(sfxEnd, sfxEnd + bgSeconds);
      bgNodes = liveNodes;
      const buf = await ctx.startRendering();
      X = prev;
      return buf.getChannelData(0);
    },
  };

  // sound only starts after the first tap (browser rule); pause everything when the app goes to the background
  ['pointerdown', 'keydown'].forEach(e => document.addEventListener(e, unlock, { capture: true, passive: true }));
  document.addEventListener('visibilitychange', () => {
    if (!live) return;
    if (document.hidden) { live.ctx.suspend(); stopBg(); }
    else { live.ctx.resume(); syncBg(); }
  });
  // a soft click on buttons and tiles (sounds tied to specific actions play on top)
  document.addEventListener('click', e => {
    if (e.target.closest('.btn, .tile, .stat-btn, .tabbar a, .icon-btn, .seg button, .hard-toggle > *, .tab, .h2h-banner')) GM.sound.play('tap');
  }, true);
})();

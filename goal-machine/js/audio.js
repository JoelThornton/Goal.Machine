/* Goal Machine – sound effects, stadium atmosphere and music, all synthesised with Web Audio (no audio files). */
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

  /* ---------------------------------------------------------------- background: crowd + music */
  let bgNodes = [], bgTimer = null, bgMode = 'off';

  // live: runs until stopBg(). Offline (from/until given): everything is scheduled up front for that stretch.
  function startCrowd(from, until) {
    const c = X.ctx, out = c.createGain();
    out.gain.value = 0.9; out.connect(X.bg);
    const bands = [260, 520, 900, 1500, 2600].map((f, i) => {
      const src = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
      src.buffer = X.noise; src.loop = true;
      bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 0.9;
      g.gain.value = [0.4, 0.36, 0.24, 0.14, 0.07][i];
      src.connect(bp); bp.connect(g); g.connect(out);
      src.start(from || 0, Math.random() * 1.5);
      if (until) src.stop(until);
      bgNodes.push(src);
      return { g, base: g.gain.value };
    });
    // the murmur drifts; now and then an "ooh" swells or the fans start clapping along
    let next = (from || now()) + 3;
    const drift = t => {
      bands.forEach(b => b.g.gain.setTargetAtTime(b.base * (0.6 + Math.random() * 0.8), t, 0.6));
      if (t > next) {
        if (Math.random() < 0.6) noise({ t, dur: 2.4, freq: 450, to: 800, q: 3, vol: 0.12, attack: 0.9, dest: out });
        else [0, 0.5, 1, 1.25, 1.5].forEach(d => [0, 0.012, 0.025].forEach(j => noise({ t: t + d + j, dur: 0.06, freq: 1400, q: 0.8, vol: 0.06, dest: out })));
        next = t + 6 + Math.random() * 10;
      }
    };
    if (until) for (let t = from; t < until - 2.5; t += 0.5) drift(t);
    else bgTimer = setInterval(() => drift(now()), 500);
  }

  // A 16-bar loop at 122 bpm: Am – F – C – G. The first four bars are a quieter intro, and the arpeggio comes and goes.
  function startMusic(from, until) {
    const bpm = 122, step = 60 / bpm / 4;
    const chords = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
    const out = X.ctx.createGain(); out.gain.value = 1.5; out.connect(X.bg);
    let s = 0, t0 = (from || now()) + 0.1;
    const inst = {
      kick: t => { tone(150, { t, to: 45, glide: 0.12, dur: 0.22, vol: 0.5, dest: out }); },
      clap: t => { [0, 0.01, 0.022].forEach(j => noise({ t: t + j, dur: 0.12, freq: 1600, q: 0.9, vol: 0.11, dest: out })); },
      hat: (t, open) => noise({ t, dur: open ? 0.18 : 0.04, type: 'highpass', freq: 7500, vol: open ? 0.05 : 0.04, dest: out }),
      bass: (t, n) => tone(midi(n - 12), { t, dur: step * 1.8, type: 'sawtooth', lp: 380, vol: 0.14, dest: out }),
      stab: (t, ch) => ch.forEach(n => [-9, 9].forEach(d => tone(midi(n + 12), { t, dur: step * 1.4, type: 'sawtooth', lp: 1700, detune: d, vol: 0.022, dest: out }))),
      pad: (t, ch) => ch.forEach(n => tone(midi(n), { t, dur: step * 16, type: 'triangle', attack: 0.4, vol: 0.03, dest: out })),
      arp: (t, n) => tone(midi(n + 24), { t, dur: step * 0.9, type: 'square', lp: 2600, vol: 0.018, dest: out }),
    };
    function schedule(horizon) {
      while (t0 < horizon) {
        const bar = Math.floor(s / 16) % 16, b = s % 16, ch = chords[bar % 4], intro = bar < 4;
        if (b === 0) inst.pad(t0, ch);
        if (!intro && b % 4 === 0) inst.kick(t0);
        if (!intro && (b === 4 || b === 12)) inst.clap(t0);
        if (b % 4 === 2) inst.hat(t0, b === 14 && bar % 2 === 1);
        if (b % 2 === 0) inst.bass(t0, b === 6 || b === 14 ? ch[0] + 12 : ch[0]);
        if (!intro && (b === 2 || b === 6 || b === 10 || b === 13)) inst.stab(t0, ch);
        if (bar >= 8 && bar % 8 >= 2) inst.arp(t0, ch[[0, 1, 2, 1][b % 4]] + (b >= 8 ? 12 : 0));
        s++; t0 += step;
      }
    }
    if (until) { schedule(until - 1); return; }
    schedule(now() + 0.25);
    bgTimer = setInterval(() => schedule(now() + 0.25), 60);
    bgNodes.push({ stop: () => out.disconnect() });
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
    if (want === 'crowd') startCrowd(); else if (want === 'music') startMusic();
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
    settings: () => ({ sfx: store.get('sfx', true), sfxVol: store.get('sfxVol', 0.7), bg: store.get('bg', 'off'), bgVol: store.get('bgVol', 0.5) }),
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
      const ctx = new OfflineAudioContext(1, Math.ceil((sfxEnd + bgSeconds * 2) * rate), rate);
      const prev = X; X = makeStudio(ctx);
      X.bg.gain.value = 0.4;
      names.forEach((n, i) => SOUNDS[n](i * gap + 0.1));
      const liveNodes = bgNodes;
      if (bgSeconds) { startCrowd(sfxEnd, sfxEnd + bgSeconds); startMusic(sfxEnd + bgSeconds, sfxEnd + 2 * bgSeconds); }
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

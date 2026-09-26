/* Goal Machine – the XI draft: Ultimate Wildcard (most goals/assists/apps), Target (hit a number) and the Daily */
'use strict';

(function () {
  const FORMATION = ['GK', 'LB', 'CB', 'CB', 'RB', 'LM', 'CM', 'CM', 'RM', 'ST', 'ST'];
  // CHAOS kicks off in a random shape (seeded, so a Daily CHAOS or a CHAOS Race gives everyone the same one)
  const CHAOS_FORMATIONS = [
    FORMATION,                                                        // 4-4-2
    ['GK', 'LB', 'CB', 'CB', 'RB', 'LM', 'CM', 'CM', 'CM', 'RM', 'ST'], // 4-5-1
    ['GK', 'CB', 'CB', 'CB', 'LM', 'CM', 'CM', 'CM', 'RM', 'ST', 'ST'], // 3-5-2
    ['GK', 'LB', 'CB', 'CB', 'CB', 'RB', 'LM', 'CM', 'CM', 'RM', 'ST'], // 5-4-1
    ['GK', 'LB', 'CB', 'CB', 'RB', 'CM', 'CM', 'CM', 'ST', 'ST', 'ST'], // 4-3-3
    ['GK', 'CB', 'CB', 'CB', 'LM', 'CM', 'CM', 'RM', 'ST', 'ST', 'ST'], // 3-4-3
    ['GK', 'LB', 'CB', 'CB', 'CB', 'RB', 'CM', 'CM', 'CM', 'ST', 'ST'], // 5-3-2
  ];
  const baseForm = () => (S && S.form) || FORMATION;
  const SIDE = { LB: 0, LM: 0, RB: 2, RM: 2 }; // for left-to-right ordering on the pitch
  // Target mode numbers - simulated so each is reachable in ~70% of games by someone picking the biggest numbers
  const TARGETS = { goals: 500, assists: 325, apps: 3400 };
  // The Treble: hit all three at once (above what a random team gets, below what a greedy one gets)
  const TREBLE = { goals: 400, assists: 300, apps: 3300 };
  // Mystery Target: stat and number are drawn at random; the number stays hidden until full time
  const MYSTERY = { goals: [300, 650], assists: [220, 420], apps: [2600, 4200] };
  // Target Race (online): a new target every game, anywhere in this range - some are much harder than others,
  // but you both chase the same one on the same spins, so it's all about who gets closer
  const RACE_TARGET = { goals: [220, 800], assists: [150, 520], apps: [2200, 5000] };
  const STAT_KEYS = ['goals', 'assists', 'apps'];
  // "big number" filter for the Centurion Throw, per stat
  const BIG = { goals: 100, assists: 50, apps: 400 };

  // kind: 'reveal' | 'respin' | 'special' (themed spin) | 'formation' | 'modifier' | 'sub'
  const WILDCARDS = {
    scout: { icon: '🔍', name: "Scout's IQ", w: 3, kind: 'reveal', desc: st => `See the PL ${st.label} of the players on the reels this turn.` },
    respin: { icon: '🎰', name: 'Roll Again', w: 3, kind: 'respin', desc: () => 'Throw these back and spin again – free.' },
    sub: { icon: '🔄', name: 'Make a Sub', w: 2, kind: 'sub', desc: st => `Release a player from your XI. His ${st.label} come off.` },
    centurion: { icon: '💯', name: 'Centurion Throw', w: 1.5, kind: 'special', desc: st => `A free spin of players with ${BIG[st.id]}+ PL ${st.bigLabel || st.label}.`, filter: (p, st) => p[st.key] >= BIG[st.id] },
    gegenpress: { icon: '⚡', name: 'Gegenpress', w: 1.5, kind: 'formation', desc: () => 'Your empty LM and RM slots push up and become strikers.' },
    bus: { icon: '🚌', name: 'Park the Bus', w: 1.5, kind: 'formation', desc: () => 'Two empty attacking slots drop back to centre-back.' },
    captain: { icon: '©️', name: "Captain's Armband", w: 1.5, kind: 'modifier', desc: st => `Your next signing’s ${st.label} count double.` },
    rotation: { icon: '🩹', name: 'Rotation Risk', w: 1.5, kind: 'modifier', desc: st => `Your next signing’s ${st.label} count half (rounded down).` },
    coin: { icon: '🎲', name: 'Double or Nothing', w: 1, kind: 'modifier', desc: st => `Coin toss on your next signing: his ${st.label} count ×2… or ×0.` },
    deadline: { icon: '⏰', name: 'Deadline Day', w: 1.5, kind: 'special', desc: () => 'A free spin with FIVE players to choose from.', reels: 5 },
    oneclub: { icon: '❤️', name: 'One-Club Man', w: 1, kind: 'special', desc: () => 'A free spin of players who only played for one PL club.', filter: p => p.clubs.length === 1 },
    journeyman: { icon: '🧳', name: 'Journeyman', w: 1, kind: 'special', desc: () => 'A free spin of players who turned out for 4+ PL clubs.', filter: p => p.clubs.length >= 4 },
    throwback: { icon: '📼', name: '90s Throwback', w: 1, kind: 'special', desc: () => 'A free spin of players whose PL career began in the 1990s.', filter: p => p.first <= 1999 },
    // CHAOS only
    allin: { icon: '🎰', name: 'All In', w: 1.2, chaos: true, kind: 'allin', desc: () => 'Coin toss on your whole XI so far: every signing ×2… or ×½.' },
    hot: { icon: '🔥', name: 'Hot Streak', w: 1.2, chaos: true, kind: 'hot', desc: st => `Your next three signings’ ${st.label} count ×1.5.` },
    magnet: { icon: '🧲', name: 'Old Teammates', w: 1.2, chaos: true, kind: 'special', desc: () => 'A free spin of players who played alongside your last signing (chemistry bonus!).',
      filter: p => { const lp = S.last != null ? byId(S.last) : null; return !!lp && p.first <= lp.last && p.last >= lp.first && p.clubs.some(c => lp.clubs.includes(c)); } },
    trophy: { icon: '🏆', name: 'Trophy Cabinet', w: 1.2, chaos: true, kind: 'special', desc: () => 'A free spin of PL title winners (title bonus!).', filter: p => (p.hon.P || 0) > 0 },
    storm: { icon: '🌪️', name: 'Wildcard Storm', w: 1, chaos: true, kind: 'special', desc: () => 'A free spin of nothing but wildcards.', storm: true },
  };
  // CHAOS events: now and then, something happens to you before a spin (seeded, so a challenge gets the same chaos)
  const EVENTS = {
    redcard: { icon: '🟥', name: 'Red card', w: 1, desc: st => `Your next signing’s ${st.label} count half.` },
    injury: { icon: '🚑', name: 'Injury crisis', w: 1, desc: st => `One of your players picks up a knock: his ${st.label} are halved.` },
    taxman: { icon: '🧾', name: 'The taxman', w: 0.8, desc: () => 'Takes a wildcard from your bag.' },
    windfall: { icon: '💰', name: 'TV money', w: 1, desc: () => 'A windfall: bonus points!' },
    derby: { icon: '🔥', name: 'Derby day', w: 1, desc: st => `Your next signing’s ${st.label} count double.` },
    golden: { icon: '⚽', name: 'Golden goal', w: 0.7, desc: st => `Your next signing’s ${st.label} count TRIPLE.` },
    var: { icon: '📺', name: 'VAR check', w: 0.9, desc: () => 'VAR reviews your last signing…' },
    box: { icon: '🎁', name: 'Mystery box', w: 0.9, desc: () => 'A free CHAOS wildcard for your bag.' },
    masked: { icon: '🎭', name: 'Masked men', w: 0.8, desc: () => 'This spin’s players wear masks: no names until you sign one.' },
  };
  // the CHAOS meter: taking or playing a wildcard (and every storm) charges it; full, the next spin opens with a big
  // CHAOS moment. Now and then a smaller match-day event (above) strikes too. Only ever one thing at a time.
  const METER = 4;
  const HURT = ['rotation', 'zero', 'injured', 'halved'];
  // the big moments the meter sets off (need: filled slots, empty slots)
  const MOMENTS = {
    unleash: { icon: '💥', name: 'CHAOS UNLEASHED', w: 1.1, tone: 'unleash' },
    tornado: { icon: '🌪️', name: 'Tornado!', w: 1, tone: 'bad', need: n => n >= 3 },
    lightning: { icon: '⚡', name: 'Lightning strike', w: 0.9, tone: 'weird', need: n => n >= 2 },
    parade: { icon: '🚌', name: 'Open-top bus parade', w: 0.8, tone: 'good', need: n => n >= 1 },
    deadline: { icon: '⏰', name: 'Deadline day', w: 0.9, tone: 'good', need: (n, left) => left >= 1 },
    sacked: { icon: '📰', name: 'Manager sacked!', w: 0.8, tone: 'weird', need: () => !!(S && S.manager) },
  };
  // CHAOS managers: you appoint one at kick-off. Each brings a perk and a catch, worked out on your XI as bonus points
  // (per-player amounts are in goals and scale to the stat; percentages are of your XI's own numbers)
  const grpSum = (x, gs) => x.slots.filter(s => gs.includes(GM.GROUP[s.pos])).reduce((a, s) => a + s.g, 0);
  const count = (x, f) => x.ps.filter(f).length;
  const vet = p => Math.min(p.last, GM.currentSeason) - p.first + 1 >= 10;
  const MANAGERS = {
    fergie: { icon: '⌚', name: 'Sir Alex Ferguson', perk: '+20 for every Man Utd player', catch: 'The hairdryer: your lowest scorer counts for nothing',
      likes: p => p.clubs.includes('Manchester United'),
      lines: x => { const n = count(x, p => p.clubs.includes('Manchester United')); return [[`⌚ Fergie’s Man Utd players (${n})`, 20 * x.u * n], ['💨 The hairdryer: lowest scorer dropped', x.slots.length > 1 ? -Math.min(...x.slots.map(s => s.g)) : 0]]; } },
    wenger: { icon: '🧥', name: 'Arsène Wenger', perk: '+20 for every Arsenal player', catch: '“I didn’t see it”: −30 if any of your players got halved or zeroed',
      likes: p => p.clubs.includes('Arsenal'),
      lines: x => { const n = count(x, p => p.clubs.includes('Arsenal')); return [[`🧥 Wenger’s Arsenal players (${n})`, 20 * x.u * n], ['🙈 “I didn’t see it”', x.slots.some(s => HURT.includes(s.mod)) ? -30 * x.u : 0]]; } },
    mourinho: { icon: '🚌', name: 'José Mourinho', perk: 'Defenders and keeper +50%', catch: 'Third-season syndrome: strikers −25%',
      likes: p => ['D', 'G'].includes(p.pos), hates: p => p.pos === 'F',
      lines: x => [['🚌 Mourinho’s back line +50%', 0.5 * grpSum(x, ['D', 'G'])], ['📉 Third-season syndrome: strikers −25%', -0.25 * grpSum(x, ['F'])]] },
    pep: { icon: '🧠', name: 'Pep Guardiola', perk: 'Midfielders +50%', catch: 'Overthinking it: strikers −20%',
      likes: p => p.pos === 'M', hates: p => p.pos === 'F',
      lines: x => [['🧠 Pep’s midfield +50%', 0.5 * grpSum(x, ['M'])], ['🤔 Overthinking it: strikers −20%', -0.2 * grpSum(x, ['F'])]] },
    klopp: { icon: '🤘', name: 'Jürgen Klopp', perk: 'Heavy metal: teammate pairs count double', catch: 'Full throttle: −10 for every ten-season veteran',
      hates: vet,
      lines: x => [[`🤘 Heavy metal chemistry (${x.pairs} pair${x.pairs === 1 ? '' : 's'})`, 12 * x.u * x.pairs], ['🏃 Full throttle: veterans', -10 * x.u * count(x, vet)]] },
    ranieri: { icon: '🦊', name: 'Claudio Ranieri', perk: 'The fairytale: +40 for every Leicester player', catch: 'Dilly ding: title medals are worth nothing',
      likes: p => p.clubs.includes('Leicester City'), hates: p => (p.hon.P || 0) > 0,
      lines: x => { const n = count(x, p => p.clubs.includes('Leicester City')), m = x.ps.reduce((a, p) => a + (p.hon.P || 0), 0); return [[`🦊 The fairytale: Leicester players (${n})`, 40 * x.u * n], ['🔔 Dilly ding: no title medal bonus', -4 * x.u * m]]; } },
    keegan: { icon: '📺', name: 'Kevin Keegan', perk: '“I would love it”: strikers +40%', catch: 'All-out attack: defenders −30%',
      likes: p => p.pos === 'F', hates: p => p.pos === 'D',
      lines: x => [['📺 “I would love it”: strikers +40%', 0.4 * grpSum(x, ['F'])], ['🕳️ All-out attack: defenders −30%', -0.3 * grpSum(x, ['D'])]] },
    allardyce: { icon: '🍷', name: 'Sam Allardyce', perk: '+15 for every player with 4+ PL clubs', catch: 'No big egos: −10 for every Hall of Famer',
      likes: p => p.clubs.length >= 4, hates: p => !!p.hon.H,
      lines: x => [[`🍷 Big Sam’s journeymen (${count(x, p => p.clubs.length >= 4)})`, 15 * x.u * count(x, p => p.clubs.length >= 4)], ['🙅 No big egos: Hall of Famers', -10 * x.u * count(x, p => p.hon.H)]] },
    redknapp: { icon: '🚗', name: 'Harry Redknapp', perk: 'Wheeler-dealer: starts you with ⏰ Deadline Day and 🎰 Roll Again', catch: '“He’d have sold them”: −10 for every one-club man',
      hates: p => p.clubs.length === 1,
      lines: x => [['🚗 “He’d have sold them”: one-club men', -10 * x.u * count(x, p => p.clubs.length === 1)]] },
    moyes: { icon: '🧱', name: 'David Moyes', perk: 'Steady: +12 for every ten-season veteran', catch: 'No superstars: your top scorer −20%',
      likes: vet,
      lines: x => [[`🧱 Steady veterans (${count(x, vet)})`, 12 * x.u * count(x, vet)], ['⭐ No superstars: top scorer −20%', x.slots.length ? -0.2 * Math.max(...x.slots.map(s => s.g)) : 0]] },
    ancelotti: { icon: '🤨', name: 'Carlo Ancelotti', perk: 'The raised eyebrow: +8 for every PL title medal', catch: 'No journeymen: −10 for every player with 5+ clubs',
      likes: p => (p.hon.P || 0) > 0, hates: p => p.clubs.length >= 5,
      lines: x => { const m = x.ps.reduce((a, p) => a + (p.hon.P || 0), 0); return [[`🤨 Title medals (${m})`, 8 * x.u * m], ['🧳 No journeymen', -10 * x.u * count(x, p => p.clubs.length >= 5)]]; } },
    hodgson: { icon: '🦁', name: 'Roy Hodgson', perk: 'Three Lions: +12 for every England player', catch: '−4 for every player from anywhere else',
      likes: p => p.nat === 'England', hates: p => p.nat !== 'England',
      lines: x => [[`🦁 Three Lions (${count(x, p => p.nat === 'England')})`, 12 * x.u * count(x, p => p.nat === 'England')], ['🌍 Players from abroad', -4 * x.u * count(x, p => p.nat !== 'England')]] },
  };
  const mgrShort = m => m.name.split(' ').slice(-1)[0];
  // CHAOS bonus points, in "goals": assists and apps games scale them to their stat
  const CHAOS_UNIT = { goals: 1, assists: 0.7, apps: 8 };

  const RULES = {
    // purist mode: no target, rack up the biggest total you can; every player equally likely
    ultimate: { max: true, weight: () => 1, noWild: ['rotation', 'bus'] },
    // hit the number: reels lean towards well-known players so big numbers are in reach
    target: { max: false, weight: p => p.fame, noWild: [] },
    // three targets at once
    treble: { max: false, treble: true, weight: p => p.fame, noWild: [] },
    // random stat + hidden number, with a thermometer
    mystery: { max: false, mystery: true, weight: p => p.fame, noWild: [] },
  };
  RULES.daily = RULES.ultimate;
  // Classic: Ultimate without the wildcards - the biggest total from the 50+ app players, all equally likely
  // The biggest-total modes come in three player pools, each with and without wildcards:
  //   Classic (50+ apps, well-known players more likely)  classicwild / classic
  //   Ultimate (50+ apps, all equally likely)             ultimate / ultimatepure
  //   Extreme (every PL player, all equally likely)       extreme / purist
  RULES.classicwild = { max: true, weight: p => p.fame, fame: true, noWild: ['rotation', 'bus'] };
  RULES.classic = { max: true, weight: p => p.fame, fame: true, noWild: [], wild: false };
  RULES.ultimatepure = { max: true, weight: () => 1, noWild: [], wild: false };
  // Every player to have played in the PL (1+ apps), all equally likely: Extreme has wildcards, Purist has none
  RULES.extreme = { max: true, weight: () => 1, noWild: ['rotation', 'bus'], all: true };
  RULES.purist = { max: true, weight: () => 1, noWild: [], wild: false, all: true };
  // Club XI: Ultimate Wildcard with everyone who played for one club in the PL (not just 50+ appearances)
  RULES.club = { max: true, weight: () => 1, noWild: ['rotation', 'bus'], club: true, all: true };
  // Ultimate Wildcard CHAOS: Ultimate plus bonus points (chemistry, rating, titles, loyalty…), extra risky wildcards,
  // wildcard storms and random events
  RULES.chaos = { max: true, weight: () => 1, noWild: ['rotation', 'bus'], chaos: true };

  let S = null; // game state
  let root = null;

  GM.draft = { start, RULES, WILDCARDS, TARGETS, state: () => S, total: st => scoreFor(st).t, score: st => scoreFor(st), render: () => render(), modeKey: (m, s, h, c) => keyFor(m, s, h, c) };

  const statSuffix = s => ({ goals: '', assists: 'ast', apps: 'apps' }[s] || '');
  function keyFor(mode, stat, hard, club) {
    if (mode === 'daily') return 'daily:' + GM.today();
    if (mode === 'club') return 'club' + GM.slug(club || '') + statSuffix(stat);
    return (mode === 'treble' || mode === 'mystery' ? mode : mode + statSuffix(stat)) + (hard ? 'h' : '');
  }

  function start(el, mode, opts = {}) {
    fitKey = '';  // a new page: size the pitch again
    root = el;
    if (!RULES[mode]) mode = 'ultimate';
    if (RULES[mode].all && !GM.allPlayers) {  // fetch every PL player first
      root.innerHTML = `<div class="topbar"><a href="#/" class="back">‹</a><h2>${(GM.MODES[mode] || { icon: '🏟️' }).icon} ${(GM.MODES[mode] || { name: 'Club XI' }).name}</h2><span></span></div>
        <div class="loading-all"><div class="splash-bar"><i></i></div><p class="muted">Loading every Premier League player…</p></div>`;
      GM.loadAll().then(() => { if (root === el && location.hash.includes('m=' + mode)) start(el, mode, opts); })
        .catch(() => { root.innerHTML += '<p class="center">Couldn’t load the player list. Check your connection and try again.</p>'; });
      return;
    }
    // Daily CHAOS: the same chaos for everyone today, goals, one go
    const dailyChaos = mode === 'chaos' && !!opts.daily && !opts.seed;
    const seed = mode === 'daily' ? 'daily:' + GM.today() : dailyChaos ? 'dchaos:' + GM.today() : (opts.seed || GM.newSeed());
    let stat = mode === 'daily' || dailyChaos ? 'goals' : (GM.STATS[opts.stat] ? opts.stat : 'goals');
    let target = RULES[mode] && !RULES[mode].max ? TARGETS[stat] : null;
    if (mode === 'treble') { stat = 'goals'; target = null; }
    if (mode === 'target' && opts.online) { const [lo, hi] = RACE_TARGET[stat], r = GM.rng(seed + '|racetarget'); target = lo + r.int(Math.round((hi - lo) / 5) + 1) * 5; }
    if (mode === 'mystery') {
      // seeded, so a challenge link gets the same mystery
      const r = GM.rng(seed + '|mystery');
      stat = STAT_KEYS[r.int(3)];
      const [lo, hi] = MYSTERY[stat];
      target = lo + r.int(hi - lo + 1);
    }
    if (mode === 'daily') {
      const done = GM.store.get('daily2:' + GM.today());
      if (done && done.xi) { S = done; S.rules = RULES.daily; S.phase = 'done'; S.readonly = true; render(); return; }
      // carry on a Daily Ultimate left half-way (saved on every move, so there's nothing to gain by leaving)
      const saved = GM.store.get(progressKey());
      if (saved && saved.xi) {
        S = saved; S.rules = RULES.daily; S.pending = null; S.subbing = false;
        if (S.phase === 'spinning') S.phase = 'pick';
        GM.toast('Welcome back – carrying on where you left off');
        if (S.phase === 'reveal') { completePick(); return; }
        render(); return;
      }
    }
    if (dailyChaos) {
      const done = GM.store.get('dchaos2:' + GM.today());
      if (done && done.xi) { S = done; S.rules = RULES.chaos; S.phase = 'done'; S.readonly = true; render(); return; }
    }
    // any other draft left half-way: the Daily CHAOS carries straight on, the rest ask
    if (!opts.online && mode !== 'daily') {
      const key = 'draftp:' + (dailyChaos ? 'dchaos:' + GM.today() : keyFor(mode, stat, !!opts.hard, mode === 'club' ? (opts.club || GM.favClub()) : null));
      const saved = GM.store.get(key);
      if (saved && saved.xi && saved.phase !== 'done' && (!opts.seed || saved.seed === opts.seed) && saved.xi.some(x => x.p != null)) {
        const resume = () => {
          S = saved; S.rules = RULES[S.mode]; S.pending = null; S.subbing = false;
          if (S.phase === 'spinning') S.phase = 'pick';
          if (S.phase === 'reveal') { completePick(); return; }
          render();
        };
        if (dailyChaos || opts.seed) { resume(); GM.toast('Welcome back – carrying on where you left off'); return; }
        setTimeout(() => {
          const n = saved.xi.filter(x => x.p != null).length;
          GM.confirm(`You left a game of ${GM.esc((GM.MODES[key.slice(7)] || GM.MODES[key.slice(7).replace(/h$/, '')] || { name: 'this' }).name)} half-way (${n}/11 signed). Carry on?`, '▶ Carry on', '🆕 New game')
            .then(ok => { if (ok && location.hash.includes('m=' + mode)) resume(); else GM.store.set(key, null); });
        }, 150);
      }
    }
    if (opts.online) {
      // an online race carries on where you left it (saved after every signing), so leaving never costs you the game
      const saved = GM.store.get('racep:' + opts.online.code);
      if (saved && saved.xi && saved.seed === seed) {
        S = saved; S.rules = RULES[S.mode]; S.pending = null; S.subbing = false;
        S.online = { ...opts.online, ms: (saved.online || {}).ms || 0, lastT: Date.now() };
        if (S.phase === 'spinning') S.phase = 'pick';
        if (S.phase === 'reveal') { completePick(); return; }
        render(); return;
      }
    }
    const club = mode === 'club' ? (opts.club && GM.clubs.includes(opts.club) ? opts.club : GM.favClub()) : null;
    if (mode === 'club' && !club) { location.hash = '#/settings?s=look'; GM.toast('Pick your favourite club first'); return; }
    const form = RULES[mode] && RULES[mode].chaos ? CHAOS_FORMATIONS[GM.rng(seed + '|formation').int(CHAOS_FORMATIONS.length)] : FORMATION;
    S = {
      mode, stat, seed, rules: RULES[mode], st: { ...GM.STATS[stat], id: stat },
      target, spin: 0, respins: 0, revealStage: mode === 'mystery' ? 'intro' : null,
      form, xi: form.map(pos => ({ pos, p: null, g: 0, mod: null, as: null })),
      reels: [], selected: -1, revealed: false, revealNext: false, special: null,
      inv: [], modifier: null, subbing: false, used: [], last: null,
      phase: 'spin', vs: opts.vs, vss: opts.vss, log: [], pending: null, wildUsed: 0, coinWin: false, bonus: [], hot: 0, event: null, meter: 0, unleash: 0, golden: false, masked: false, chaosCount: 0, manager: null, moments: [], chaosDue: false, momentSpin: -1, forceSpecial: null,
      hard: mode !== 'daily' && !dailyChaos && !!opts.hard, club, dailyChaos, day: GM.today(),
      online: opts.online ? { ...opts.online, ms: 0, lastT: Date.now() } : null,  // Live Race: { code, seat, opp } + time taken
    };
    if (S.online) root.className = 'page-draft page-online';
    render();
    const me = S;
    if (RULES[mode] && RULES[mode].chaos) setTimeout(() => { if (S === me && onThisGame() && !S.manager && S.spin === 0) pickManager(); }, 350);
  }

  const modeKey = () => (S.dailyChaos ? 'dchaos:' + S.day : keyFor(S.mode, S.stat, S.hard, S.club));
  // where a half-finished draft is kept (the Daily Ultimate has its own; online races save with the race)
  const saveKey = () => (S.mode === 'daily' ? progressKey() : S.online ? null : 'draftp:' + modeKey());
  const progressKey = () => 'dailyp:' + GM.today();
  const distKey = () => S.mode === 'daily' ? 'daily' : modeKey();
  // Hard mode flattens the star bias in the target modes (Shearer ~4x an average player instead of ~16x) but keeps the
  // same targets - big numbers are rarer, so one wrong pick can put the target out of reach.
  const reelWeight = () => (S.hard && (!S.rules.max || S.rules.fame) ? p => Math.sqrt(S.rules.weight(p)) : S.rules.weight);
  // what wildcard descriptions talk about: in the Treble a wildcard affects all three numbers
  const wst = () => S.rules.treble ? { ...S.st, label: 'numbers', bigLabel: 'goals' } : S.st;
  const modeName = () => S.dailyChaos ? 'Daily CHAOS' : S.online && S.mode === 'target' ? `Target Race · ${fmt(S.target)}` : S.mode === 'club' ? GM.MODES[modeKey()].name : GM.MODES[S.mode === 'daily' ? 'daily' : (S.rules.treble || S.rules.mystery) ? S.mode : S.mode + statSuffix(S.stat)].name;
  const val = p => p[S.st.key];
  const pv = p => ({ goals: p.goals, assists: p.ast, apps: p.apps });
  const tot = k => S.xi.reduce((t, s) => t + (s.v ? s.v[k] : 0), 0);
  const total = () => tot(S.stat);
  const openPos = () => [...new Set(S.xi.filter(s => s.p == null).map(s => s.pos))];
  // Extreme and Purist draw from every PL player; everything else from the 50+ app list
  const PL = () => (S && S.rules && S.rules.all ? GM.allPlayers : GM.players);
  const byId = id => PL()[id];
  const fits = (p, open) => p.poss.some(x => open.includes(x));
  const emptySlots = () => S.xi.filter(s => s.p == null).length;
  const fmt = n => n.toLocaleString();
  const signed = n => (n < 0 ? '−' : '+') + Math.abs(n).toLocaleString();

  /* ---------------------------------------------------------------- reel generation */
  // Fair deals. Every spin has its own fixed running order of players, drawn from the whole field and seeded by the
  // game seed + spin number (+ which re-roll or special spin it is). The reels are the first players in that order who
  // fit your open positions. So two people on the same seed see the same players on the same spin wherever their
  // positions allow - if Shearer is 1st in spin 3's order, everyone with a striker slot open on spin 3 gets him -
  // and identical decisions always give identical games. Wildcards depend on the spin alone.
  const samplers = new Map();
  function sampler(key, list, w) {
    if (!samplers.has(key)) {
      const cum = []; let t = 0;
      for (const p of list) { t += w(p); cum.push(t); }
      samplers.set(key, { list, cum, t });
    }
    const sm = samplers.get(key);
    return u => {  // binary search the cumulative weights
      let lo = 0, hi = sm.cum.length - 1; const x = u * sm.t;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (sm.cum[mid] < x) lo = mid + 1; else hi = mid; }
      return sm.list[lo];
    };
  }
  function makeReels(special) {
    const tag = `${S.seed}|${S.stat}|${S.spin}|${S.spinRespins || 0}|${special || ''}`;
    const r = GM.rng(tag), rw = GM.rng(tag + '|wild');
    const open = openPos();
    const used = new Set(S.used.concat(S.xi.filter(s => s.p != null).map(s => s.p)));
    const ok = p => fits(p, open) && !used.has(p.id);
    const wc = special && WILDCARDS[special];
    const n = (wc && wc.reels) || 3;
    const wildTypes = () => Object.keys(WILDCARDS).filter(t => !S.rules.noWild.includes(t) && (!WILDCARDS[t].chaos || S.rules.chaos) && t !== 'storm');
    // a wildcard storm: every reel is a wildcard (the Storm card, or 1 spin in 10 in CHAOS)
    if ((wc && wc.storm) || (S.rules.chaos && !special && S.spin >= 2 && S.momentSpin !== S.spin && GM.rng(tag + '|storm')() < 0.1)) {
      const rs = GM.rng(tag + '|stormcards'), types = wildTypes(), out = [];
      while (out.length < 3) { const t = rs.weighted(types, k => WILDCARDS[k].w); if (!out.some(x => x.wild === t)) out.push({ wild: t }); }
      S.storm = true;
      if (S.rules.chaos) setTimeout(() => { fx('storm', '🌪️', 8); }, 200);
      charge();
      return out;
    }
    S.storm = false;
    // the field: everyone (or the club's players in Club XI, or a wildcard's theme), as long as it still has someone who fits
    let field = PL(), fkey = S.rules.all ? 'every' : 'all';
    if (S.club) {
      const mine = PL().filter(p => p.clubs.includes(S.club));
      if (mine.some(ok)) { field = mine; fkey = 'club:' + S.club; }
    }
    if (wc && wc.filter) {
      const themed = field.filter(p => wc.filter(p, wst()));
      if (themed.some(ok)) { field = themed; fkey += '|' + special + (special === 'magnet' ? ':' + S.last : ''); }
    }
    const draw = sampler(`${fkey}|${S.mode}|${S.hard ? 'h' : ''}`, field, reelWeight());
    // wildcard: reel 1 or 2 on 28% of spins each, decided by the spin number only
    let wildAt = -1, wild = null;
    if (!special && S.spin >= 1 && S.rules.wild !== false) {
      if (rw() < 0.28) wildAt = 0; else if (rw() < 0.28) wildAt = 1;
      wild = rw.weighted(wildTypes(), t => WILDCARDS[t].w);
    }
    const reels = [], taken = new Set();
    for (let i = 0; i < n; i++) {
      if (i === wildAt) { reels.push({ wild }); continue; }
      let p = null;
      for (let tries = 0; tries < 800 && !p; tries++) { const c = draw(r()); if (ok(c) && !taken.has(c.id)) p = c; }
      if (!p) {  // very few players left who fit: pick from them directly
        const rest = field.filter(c => ok(c) && !taken.has(c.id));
        if (!rest.length) break;
        p = r.weighted(rest, reelWeight());
      }
      taken.add(p.id);
      const x = { id: p.id };
      // chemistry hint (a label only, so it doesn't change who you're offered): played with your last signing
      const lp = S.last != null ? byId(S.last) : null;
      if (lp && p.first <= lp.last && p.last >= lp.first && p.clubs.some(c => lp.clubs.includes(c))) x.mate = { name: lp.name, club: p.clubs.find(c => lp.clubs.includes(c)) };
      reels.push(x);
    }
    return reels;
  }

  /* ---------------------------------------------------------------- actions */
  async function doSpin(special) {
    if (busy || (S.phase !== 'spin' && S.phase !== 'pick')) return;
    if (S.rules.chaos && !S.manager && S.spin === 0 && !special) { await pickManager(); if (!onThisGame()) return; }
    S.pending = null;
    S.event = null;
    if (S.rules.chaos && !special && !(S.spinRespins > 0) && S.spin >= 2 && S.momentSpin !== S.spin) { await chaosTurn(); if (!onThisGame()) return; }
    if (!special && S.forceSpecial) { special = S.forceSpecial; S.forceSpecial = null; }
    S.special = special || null;
    S.reels = makeReels(special);
    S.selected = -1;
    S.revealed = S.revealNext; S.revealNext = false;
    S.phase = 'spinning';
    if (S.spin === 0 && S.respins === 0) GM.sound.play('whistle');
    render();
    await animateReels();
    S.phase = 'pick';
    render();
  }

  // before a spin: a big moment if the meter's full, otherwise (now and then) a match-day event; never both, and
  // never on the spin straight after a big one
  async function chaosTurn() {
    if (S.chaosDue) { S.chaosDue = false; S.momentSpin = S.spin; return bigMoment(); }
    if (S.lastBig === S.spin - 1) return;
    const r = GM.rng(`${S.seed}|chaos|${S.spin}`);
    if (r() >= 0.22) return;
    S.momentSpin = S.spin;
    return chaosEvent(r);
  }
  const filledIdx = () => S.xi.map((x, i) => i).filter(i => S.xi[i].p != null);
  const scale = (x, f, mod) => { STAT_KEYS.forEach(k => { x.v[k] = Math.floor(x.v[k] * f); }); x.g = x.v[S.stat]; if (mod) x.mod = mod; };
  const nm = i => GM.esc(byId(S.xi[i].p).name);

  function chaosEvent(r) {
    let e = r.weighted(Object.keys(EVENTS), k => EVENTS[k].w); const ev = EVENTS[e];
    const before = snap();
    let note = ev.desc(wst()), run = null, reveal = null, tone = null;
    if (e === 'redcard' || e === 'derby') {
      if (S.modifier) note = 'But you already had a modifier lined up, so it slips by.';
      else S.modifier = e === 'redcard' ? 'rotation' : 'captain';
    } else if (e === 'injury') {
      const filled = filledIdx().filter(i => S.xi[i].mod !== 'injured');
      if (!filled.length) note = 'Nobody to injure yet. Phew.';
      else {
        const i = filled[Math.floor(r() * filled.length)];
        scale(S.xi[i], 0.5, 'injured');
        note = `${nm(i)} is crocked: his ${S.st.label} are halved.`;
        run = c => c.visit(i, '🚑', 'drive');
      }
    } else if (e === 'taxman') {
      if (!S.inv.length) note = 'Your wildcard bag is empty, so he leaves with nothing.';
      else { const k = Math.floor(r() * S.inv.length), w = S.inv.splice(k, 1)[0]; note = `He takes your ${WILDCARDS[w].icon} ${WILDCARDS[w].name} from your bag.`; run = c => c.bag('🧾'); }
    } else if (e === 'golden') {
      S.golden = true;
    } else if (e === 'var') {
      const i = S.xi.findIndex(y => y.p === S.last && y.p != null);
      if (i < 0) note = 'Nothing to review yet.';
      else {
        const given = r() < 0.5;
        scale(S.xi[i], given ? 2 : 0.5, given ? 'boosted' : 'halved');
        note = `Checking ${nm(i)}…`;
        reveal = { text: given ? `${nm(i)}: <b>GOAL GIVEN!</b> His ${S.st.label} double.` : `${nm(i)}: <b>DISALLOWED.</b> His ${S.st.label} are halved.`, tone: given ? 'good' : 'bad' };
        run = c => c.visit(i, '📺', 'frame');
        e = given ? 'var+' : 'var-';
      }
    } else if (e === 'box') {
      const cards = Object.keys(WILDCARDS).filter(k => WILDCARDS[k].chaos), w = cards[Math.floor(r() * cards.length)];
      if (S.inv.length >= 3) note = 'But your bag is full, so it’s empty. Typical.';
      else { S.inv.push(w); note = `Inside: ${WILDCARDS[w].icon} ${WILDCARDS[w].name}! It goes in your bag.`; run = c => c.bag('🎁'); }
    } else if (e === 'masked') {
      S.masked = true;
    } else if (e === 'windfall') {
      const pts = Math.round(20 * CHAOS_UNIT[S.stat]);
      S.bonus.push([`💰 TV money (spin ${S.spin + 1})`, pts]);
      note = `+${pts} bonus points.`;
      run = c => c.rain('💰');
    }
    S.event = { icon: ev.icon, name: ev.name, note: (reveal ? reveal.text : note).replace(/<[^>]+>/g, '') };
    S.log.push(ev.icon);
    S.chaosCount = (S.chaosCount || 0) + 1;
    const good = ['windfall', 'derby', 'golden', 'var+', 'box'].includes(e);
    tone = good ? 'good' : e === 'masked' || e === 'var-' || e === 'var+' ? 'weird' : 'bad';
    return moment({ icon: ev.icon, name: ev.name, text: note, tone, before, run, reveal, small: true });
  }

  async function bigMoment() {
    const r = GM.rng(`${S.seed}|moment|${S.spin}`), filled = filledIdx(), left = emptySlots();
    const keys = Object.keys(MOMENTS).filter(k => !MOMENTS[k].need || MOMENTS[k].need(filled.length, left));
    const k = r.weighted(keys, x => MOMENTS[x].w), m = MOMENTS[k], before = snap();
    const o = { icon: m.icon, name: m.name, tone: m.tone, before, big: true };
    S.lastBig = S.spin;
    S.chaosCount = (S.chaosCount || 0) + 1; S.log.push(m.icon);
    if (k === 'unleash') {
      S.unleash = (S.unleash || 0) + 2;
      o.text = 'The meter blows! Your next two signings count <b>DOUBLE</b>.';
      o.run = c => c.rain('💥');
    } else if (k === 'tornado') {
      const hits = filled.map(i => ({ i, up: r() < 0.5 }));
      hits.forEach(({ i, up }) => scale(S.xi[i], up ? 2 : 0.5, up ? 'boosted' : 'halved'));
      const ups = hits.filter(h => h.up).length;
      o.text = `It rips through your XI: <b>${ups}</b> player${ups === 1 ? '' : 's'} doubled, <b>${hits.length - ups}</b> halved.`;
      o.run = c => c.sweep('🌪️');
    } else if (k === 'lightning') {
      const by = filled.slice().sort((a, b) => S.xi[b].g - S.xi[a].g), top = by[0], low = by[by.length - 1];
      scale(S.xi[top], 0.5, 'halved'); scale(S.xi[low], 3, 'boosted');
      o.text = `${nm(top)} is struck: <b>halved</b>. ${nm(low)} is charged up: <b>×3</b>!`;
      o.run = c => { c.visit(top, '⚡', 'strike'); c.visit(low, '✨', 'strike', 900); };
    } else if (k === 'parade') {
      const medals = S.xi.reduce((a, x) => a + (x.p != null ? (byId(x.p).hon.P || 0) : 0), 0), pts = Math.round(Math.max(15, 8 * medals) * CHAOS_UNIT[S.stat]);
      S.bonus.push([`🚌 Bus parade (spin ${S.spin + 1})`, pts]);
      o.text = `The fans are out: <b>+${pts}</b> bonus points${medals ? ` for your ${medals} title medal${medals === 1 ? '' : 's'}` : ''}.`;
      o.run = c => c.sweep('🚌');
    } else if (k === 'deadline') {
      S.forceSpecial = 'deadline';
      o.text = 'The window’s about to slam shut: this spin has <b>FIVE</b> players to choose from.';
    } else if (k === 'sacked') {
      const old = MANAGERS[S.manager];
      o.text = `${old.name} has been sacked. Pick his replacement:`;
      o.pick = mgrChoices(S.manager);
      o.onPick = appoint;
    }
    if (!o.pick) S.event = { icon: m.icon, name: m.name, note: o.text.replace(/<[^>]+>/g, '') };
    return moment(o);
  }

  // three managers to choose from (the same three for everyone on this seed and spin)
  function mgrChoices(not) {
    const r = GM.rng(`${S.seed}|mgr|${S.spin}`), out = [];
    const keys = Object.keys(MANAGERS).filter(k => k !== not);
    while (out.length < 3) { const k = keys[Math.floor(r() * keys.length)]; if (!out.includes(k)) out.push(k); }
    return out;
  }
  function appoint(k) {
    S.manager = k; S.log.push('👔');
    if (k === 'redknapp') ['deadline', 'respin'].forEach(w => { if (S.inv.length < 3) S.inv.push(w); });
  }
  function pickManager() {
    const shape = ['D', 'M', 'F'].map(g => S.form.filter(p => GM.GROUP[p] === g).length).join('-');
    return moment({ icon: '👔', name: 'Kick-off', tone: 'good', before: snap(), text: `Formation <b>${shape}</b>. Appoint your manager: each has a perk and a catch.`, pick: mgrChoices(null), onPick: appoint, quiet: true });
  }

  /* ---------------------------------------------------------------- CHAOS moments: one at a time, on the pitch
     A moment is applied to the state first, then shown: a card over the reels, a bit of action on the pitch, and every
     number that changed counting from its old value to its new one. Tap to skip; nothing else can happen meanwhile. */
  let busy = false;
  const snap = () => ({ g: S.xi.map(x => x.g), t: total(), b: S.rules.chaos ? scoreFor(S).bonus : 0 });
  function countTo(el, from, to, ms, fmtFn = fmt) {
    if (!el) return;
    const t0 = performance.now();
    const step = now => { const f = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - f, 3); el.textContent = fmtFn(Math.round(from + (to - from) * e)); if (f < 1 && el.isConnected) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  const coinHtml = heads => `<div class="coin" style="--end:${heads ? 1800 : 1980}deg"><div class="coin-f h">⚽<b>HEADS</b></div><div class="coin-f t">🧤<b>TAILS</b></div></div>`;
  const mgrCard = k => { const m = MANAGERS[k]; return `<button class="mgr" data-mgr="${k}"><span class="mgr-ico">${m.icon}</span><b>${m.name}</b><small class="up">✅ ${m.perk}</small><small class="down">⚠️ ${m.catch}</small></button>`; };
  function moment(o) {
    return new Promise(done => {
      busy = true;
      render();
      const pitch = GM.$('.pitch', root), timers = [], later = (ms, f) => timers.push(setTimeout(f, ms));
      const slotEl = i => GM.$(`.slot[data-slot="${i}"]`, root);
      const b = o.before || snap(), changed = S.xi.map((x, i) => i).filter(i => b.g[i] !== S.xi[i].g);
      // wind the changed numbers (and the counter) back to where they were; they count to their new values on cue
      changed.forEach(i => { const n = GM.$('.sg', slotEl(i)); if (n) n.textContent = fmt(b.g[i]); });
      const cn = GM.$('.counter-num b', root), cb = GM.$('.chaos-pts b', root), now = snap();
      if (cn) cn.textContent = fmt(b.t);
      if (cb) cb.textContent = signed(b.b);
      const hitDone = new Set();
      const hit = i => {
        if (hitDone.has(i) || !changed.includes(i)) return; hitDone.add(i);
        const el = slotEl(i); if (!el) return;
        el.classList.add(S.xi[i].g > b.g[i] ? 'hit-up' : 'hit-down');
        countTo(GM.$('.sg', el), b.g[i], S.xi[i].g, 700);
        GM.sound.play(S.xi[i].g > b.g[i] ? 'good' : 'bad');
      };
      const totals = () => { countTo(cn, b.t, now.t, 900); countTo(cb, b.b, now.b, 900, signed); };
      const fxEl = (cls, txt, x, y) => { if (!pitch) return null; const e = document.createElement('span'); e.className = 'cm-fx ' + cls; e.textContent = txt; if (x != null) { e.style.left = x + 'px'; e.style.top = y + 'px'; } pitch.appendChild(e); return e; };
      const at = i => { const el = slotEl(i), pr = pitch.getBoundingClientRect(), r = el.getBoundingClientRect(); return [r.left - pr.left + r.width / 2, r.top - pr.top + r.height / 2, (r.left + r.width / 2 - pr.left) / pr.width]; };
      const c = {
        // something crosses the whole pitch, hitting each changed player as it passes
        sweep(icon, ms = 1500) {
          const e = fxEl('sweep', icon); if (!e) return;
          e.style.animationDuration = ms + 'ms';
          changed.forEach(i => { const [, , f] = at(i); later(ms * (0.08 + 0.84 * f), () => hit(i)); });
        },
        // something arrives at one player
        visit(i, icon, kind = 'pop', delay = 0) {
          later(delay, () => { if (!slotEl(i)) return; const [x, y] = at(i); fxEl('visit ' + kind, icon, x, y); });
          later(delay + (kind === 'frame' ? 1250 : 650), () => hit(i));
        },
        bag(icon) { const inv = GM.$('.inv', root); if (inv) { inv.classList.remove('robbed'); void inv.offsetWidth; inv.classList.add('robbed'); } fxEl('visit pop', icon, pitch ? pitch.clientWidth / 2 : 0, pitch ? pitch.clientHeight - 30 : 0); },
        rain(icon) { if (!pitch) return; for (let k = 0; k < 7; k++) { const e = fxEl('rain', icon, Math.random() * pitch.clientWidth, -30); if (e) e.style.animationDelay = (k * 0.08) + 's'; } },
      };
      const el = document.createElement('div');
      el.className = `cm cm-${o.tone || 'weird'} ${o.big ? 'cm-big' : ''} ${o.pick ? 'cm-pick' : ''}`;
      el.innerHTML = `<div class="cm-card"><div class="cm-icon">${o.icon}</div><div class="cm-name">${o.name}</div><div class="cm-text">${o.text || ''}</div>
        ${o.coin != null ? coinHtml(o.coin) : ''}${o.pick ? `<div class="mgr-list">${o.pick.map(mgrCard).join('')}</div>` : '<small class="cm-skip">Tap to carry on</small>'}</div>`;
      document.body.appendChild(el);
      if (!o.quiet) fx(o.tone === 'unleash' ? 'unleash' : o.tone || 'weird', o.icon);
      let over = false;
      const finish = () => {
        if (over) return; over = true;
        timers.forEach(clearTimeout); window.removeEventListener('hashchange', finish);
        el.classList.add('out'); setTimeout(() => el.remove(), 250);
        busy = false;
        if (S.rules.chaos && (o.text || o.reveal)) S.moments = (S.moments || []).concat([{ icon: o.icon, name: o.name, text: (o.after || (o.reveal && o.reveal.text) || o.text).replace(/<[^>]+>/g, '') }]);
        render(); done();
      };
      window.addEventListener('hashchange', finish);
      if (o.pick) {
        GM.$$('[data-mgr]', el).forEach(bt => bt.onclick = () => { o.onPick(bt.dataset.mgr); GM.sound.play('whistle'); finish(); });
        return;
      }
      // the action starts once the card is up (after a coin has landed)
      const start = o.coin != null ? 1650 : 350;
      if (o.coin != null) {
        for (let k = 0; k < 8; k++) later(k * 170, () => GM.sound.play('tick'));
        later(start - 100, () => {
          const t = GM.$('.cm-text', el); if (t) t.innerHTML = o.after;
          el.className = el.className.replace(/cm-(good|bad|weird|unleash)/, 'cm-' + (o.coin ? 'good' : 'bad'));
          fx(o.coin ? 'good' : 'bad', o.coin ? '⚽' : '🧤');
        });
      }
      if (o.reveal) later(1150, () => { const t = GM.$('.cm-text', el); if (t) t.innerHTML = o.reveal.text; el.className = el.className.replace(/cm-(good|bad|weird|unleash)/, 'cm-' + o.reveal.tone); fx(o.reveal.tone, o.icon); });
      later(start, () => { if (o.run) o.run(c); changed.forEach(i => later(o.run ? 1700 : 300, () => hit(i))); totals(); });
      later(start + (o.small ? 1900 : 2300), finish);
      el.onclick = finish;
    });
  }
  // CHAOS meter
  function charge(n = 1) {
    if (!S.rules.chaos) return;
    S.meter = (S.meter || 0) + n;
    if (S.meter >= METER && !S.chaosDue) { S.meter = 0; S.chaosDue = true; GM.sound.play('siren'); }
  }
  function fx(kind, icon, rain = 0) {
    if (!S.rules.chaos) return;
    const app = document.getElementById('app');
    if (kind === 'bad' || kind === 'unleash') { app.classList.remove('shake'); void app.offsetWidth; app.classList.add('shake'); }
    if (!icon) return;
    const flash = document.createElement('div');
    flash.className = 'chaos-flash ' + kind;
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 700);
    const emojis = kind === 'good' ? [icon, '💰', '🔥', '⭐'] : kind === 'unleash' ? ['💥', '⚡', '🌪️', '🔥'] : kind === 'storm' ? ['🌪️', '🃏', '💨'] : kind === 'weird' ? [icon, '❓', '🤡'] : [icon, '💀', '😱'];
    for (let i = 0; i < rain; i++) {
      const e = document.createElement('span');
      e.className = 'chaos-emoji';
      e.textContent = emojis[i % emojis.length];
      e.style.left = Math.random() * 100 + 'vw';
      e.style.animationDelay = Math.random() * 0.35 + 's';
      e.style.fontSize = 18 + Math.random() * 26 + 'px';
      document.body.appendChild(e);
      setTimeout(() => e.remove(), 2200);
    }
    GM.sound.play(kind === 'good' ? 'jackpot' : kind === 'storm' ? 'siren' : kind === 'unleash' ? 'horn' : kind === 'weird' ? 'wild' : 'boom');
    GM.buzz(kind === 'bad' || kind === 'unleash' ? 120 : 40);
  }

  async function animateReels() {
    const cards = GM.$$('.reel', root);
    const names = PL();
    const stops = cards.map((c, i) => 500 + i * 250);
    const t0 = performance.now();
    let frame = 0;
    await new Promise(res => {
      const tick = () => {
        const t = performance.now() - t0;
        let running = false;
        if (frame++ % 2 === 0) GM.sound.play('tick');
        cards.forEach((c, i) => {
          if (t < stops[i]) {
            running = true;
            const n = c.querySelector('.reel-spin');
            if (n) n.textContent = names[Math.floor(Math.random() * names.length)].name;
          } else if (c.classList.contains('spinning')) {
            c.classList.remove('spinning');
            c.innerHTML = reelInner(S.reels[i]);
            c.classList.add('landed');
            GM.sound.play('land');
          }
        });
        if (running) setTimeout(tick, 55); else res();
      };
      tick();
    });
  }

  // Tapping a player selects him; his possible open slots light up on the pitch and you tap one to sign him.
  function sign(i) {
    const reel = S.reels[i];
    if (busy || !reel || S.phase !== 'pick' || S.subbing !== false) return;
    if (reel.wild) {
      if (S.inv.length >= 3 && !S.storm) { GM.toast('Your wildcard bag is full (3) – use one first'); return; }
      if (S.inv.length >= 3) { const gone = S.inv.shift(); GM.toast(`Bag full: your ${WILDCARDS[gone].icon} ${WILDCARDS[gone].name} blows away in the storm`); }
      S.pending = null;
      S.inv.push(reel.wild);
      S.log.push('🃏');
      charge();
      if (GM.trackPick) GM.trackPick(null, S.reels.filter(x => !x.wild).map(x => byId(x.id)));
      GM.sound.play('wild');
      GM.toast(`${WILDCARDS[reel.wild].icon} ${WILDCARDS[reel.wild].name} added to your bag`);
      return afterPick(i);
    }
    const p = byId(reel.id);
    if (!targetSlots(p).length) { GM.toast(`No open position for ${GM.esc(p.name)} any more`); return; }
    S.pending = S.pending === i ? null : i;
    render();
    if (S.pending != null) {
      const pitch = GM.$('.pitch', root);
      if (pitch && pitch.getBoundingClientRect().bottom < 60) pitch.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  const targetSlots = p => S.xi.map((s, i) => i).filter(i => S.xi[i].p == null && p.poss.includes(S.xi[i].pos));

  async function place(slotIdx) {
    if (busy || S.pending == null || S.phase !== 'pick') return;
    const i = S.pending;
    const p = byId(S.reels[i].id);
    const slot = S.xi[slotIdx];
    if (!targetSlots(p).includes(slotIdx)) { GM.toast(`${GM.esc(p.name)} can play ${p.poss.join(' / ')} – pick a highlighted slot`); return; }
    const pos = slot.pos;
    // every signing stores goals/assists/apps; modifiers apply to all three
    let mult = 1, heads = true;
    if (S.modifier === 'captain') mult = 2;
    if (S.modifier === 'rotation') mult = 0.5;
    if (S.hot > 0) { mult *= 1.5; S.hot--; }
    if (S.golden) { mult *= 3; S.golden = false; }
    if (S.unleash > 0) { mult *= 2; S.unleash--; }
    if (S.modifier === 'coin') {
      heads = GM.rng(`${S.seed}|coin|${S.spin}|${S.respins}`)() < 0.5;
      mult = heads ? 2 : 0;
      if (heads) S.coinWin = true;
    }
    const before = S.modifier === 'coin' ? snap() : null;
    const v = pv(p);
    STAT_KEYS.forEach(k => { v[k] = Math.floor(v[k] * mult); });
    slot.v = v;
    const g = v[S.stat];
    slot.p = p.id; slot.g = g; slot.mod = S.modifier === 'coin' ? (heads ? 'captain' : 'zero') : S.modifier;
    slot.as = pos !== p.poss[0] ? pos : null;
    slot.fresh = true;
    S.modifier = null;
    S.last = p.id;
    S.used.push(p.id);
    if (!S.readonly && GM.trackPick) GM.trackPick(p, S.reels.filter(x => !x.wild).map(x => byId(x.id)));
    S.log.push(pos);
    S.pending = null;
    GM.sound.play('place'); GM.buzz();
    // in target modes a blip climbs as the total closes in on the number
    if (S.target && !S.rules.treble) setTimeout(() => GM.sound.play('rise', S.xi.reduce((a, x) => a + x.g, 0) / S.target), 180);
    if (before) {  // Double or Nothing: a real coin toss before he takes his place
      await moment({ icon: '🎲', name: 'Double or nothing', tone: 'weird', before, coin: heads, text: `${GM.esc(p.name)}: heads he counts double, tails he counts for nothing…`,
        after: heads ? `<b>Heads!</b> ${GM.esc(p.name)} counts double.` : `<b>Tails…</b> ${GM.esc(p.name)} counts for nothing.` });
      if (!onThisGame()) return;
    }
    afterPick(i);
  }

  async function afterPick(i) {
    // show what everyone on the reels had before moving on
    S.revealed = true;
    S.phase = 'reveal';
    S.selected = i;
    render();
    await GM.sleep(S.reels.some(r => !r.wild) ? 1500 : 700);
    completePick();
  }

  function completePick() {
    if (S.online && GM.online) GM.online.pushRace(S);
    S.masked = false;
    S.xi.forEach(s => { s.fresh = false; });
    S.spinRespins = 0;
    S.spin++;
    S.reels = [];
    S.selected = -1;
    S.revealed = false;
    S.special = null;
    if (emptySlots() === 0) return finish();
    S.phase = 'spin';
    render();
  }

  function useWild(k) {
    const w = S.inv[k];
    const wc = WILDCARDS[w];
    if (busy || S.phase === 'spinning' || S.phase === 'reveal' || S.phase === 'done') return;
    const consume = () => { S.inv.splice(k, 1); S.log.push(wc.icon); S.wildUsed++; GM.sound.play('wild'); charge(); };
    switch (wc.kind) {
      case 'reveal':
        if (S.phase === 'pick') S.revealed = true; else S.revealNext = true;
        GM.toast(S.phase === 'pick' ? '🔍 Scout report in' : '🔍 Your next spin will be scouted');
        break;
      case 'respin':
        if (S.phase !== 'pick') { GM.toast('Spin first, then Roll Again if you don’t like them'); return; }
        S.respins++; S.spinRespins = (S.spinRespins || 0) + 1; consume(); doSpin(); return;
      case 'special':
        S.respins++; S.spinRespins = (S.spinRespins || 0) + 1; consume(); doSpin(w); return;
      case 'sub':
        if (!S.xi.some(s => s.p != null)) { GM.toast('No one to release yet'); return; }
        S.subbing = k; S.pending = null; render(); GM.toast('Tap a player on the pitch to release him'); return;
      case 'allin': {
        const filled = S.xi.filter(x => x.p != null);
        if (!filled.length) { GM.toast('Sign someone first – there’s nothing to gamble yet'); return; }
        const heads = GM.rng(`${S.seed}|allin|${S.spin}|${S.wildUsed}`)() < 0.5, before = snap();
        filled.forEach(x => scale(x, heads ? 2 : 0.5, heads ? 'boosted' : 'halved'));
        if (heads) S.coinWin = true;
        consume();
        moment({ icon: '🎰', name: 'ALL IN', tone: 'weird', before, coin: heads, text: 'Heads, your whole XI doubles. Tails, it’s halved…',
          after: heads ? '<b>Heads!</b> It pays off: your whole XI doubles.' : '<b>Tails…</b> It’s gone wrong: your whole XI is halved.', run: c => c.sweep(heads ? '💰' : '💸'), big: true });
        return;
      }
      case 'hot':
        S.hot = (S.hot || 0) + 3;
        GM.toast('🔥 Hot streak: your next three signings count ×1.5');
        break;
      case 'modifier':
        if (S.modifier) { GM.toast('A modifier is already active'); return; }
        S.modifier = w;
        GM.toast(`${wc.icon} ${wc.name} active on your next signing`);
        break;
      case 'formation': {
        const idx = w === 'gegenpress'
          ? S.xi.map((x, i) => i).filter(i => ['LM', 'RM'].includes(S.xi[i].pos) && S.xi[i].p == null)
          : S.xi.map((x, i) => i).filter(i => ['ST', 'CM', 'LM', 'RM'].includes(S.xi[i].pos) && S.xi[i].p == null)
            .sort((a, b) => ['ST', 'CM', 'LM', 'RM'].indexOf(S.xi[a].pos) - ['ST', 'CM', 'LM', 'RM'].indexOf(S.xi[b].pos) || b - a).slice(0, 2);
        if (!idx.length) { GM.toast(w === 'gegenpress' ? 'Your LM and RM slots are already filled' : 'No free attacking slots to drop back'); return; }
        idx.forEach(i => { S.xi[i].pos = w === 'gegenpress' ? 'ST' : 'CB'; });
        GM.toast(w === 'gegenpress' ? `⚡ Gegenpress! ${idx.length} midfield slot${idx.length > 1 ? 's' : ''} → strikers` : `🚌 Bus parked: ${idx.length} slot${idx.length > 1 ? 's' : ''} → defence`);
        if (S.phase === 'pick' && !S.reels.some(x => x.wild || fits(byId(x.id), openPos()))) { S.respins++; S.spinRespins = (S.spinRespins || 0) + 1; consume(); doSpin(); return; }
        break;
      }
    }
    consume();
    render();
  }

  function release(slotIdx) {
    const s = S.xi[slotIdx];
    if (busy || S.subbing === false || s.p == null) return;
    GM.toast(`👋 ${byId(s.p).name} released`);
    GM.sound.play('swoosh');
    s.p = null; s.g = 0; s.v = null; s.mod = null; s.as = null;
    S.inv.splice(S.subbing, 1);
    S.log.push('🔄');
    S.wildUsed++;
    S.subbing = false;
    charge();
    render();
  }

  /* ---------------------------------------------------------------- scoring / finish */
  function scoreFor(st) {
    const sum = k => st.xi.reduce((a, s) => a + (s.v ? s.v[k] : (k === st.stat ? s.g : 0)), 0);
    const t = sum(st.stat);
    if (st.rules.chaos) return chaosScore(st, t);
    if (st.rules.max) return { total: t, parts: [], diff: null, t };
    if (st.rules.treble) {
      // up to 333 per stat: full marks when exact, nothing once you're 25% out
      const parts = [], hits = [];
      STAT_KEYS.forEach(k => {
        const got = sum(k), tg = TREBLE[k], e = Math.abs(got - tg) / tg;
        parts.push([`${GM.STATS[k].icon} ${fmt(got)} / ${fmt(tg)} ${GM.STATS[k].label}`, Math.round(333 * Math.max(0, 1 - 4 * e))]);
        if (e <= 0.03) hits.push(k);
      });
      if (hits.length === 3) parts.push(['🏆 THE TREBLE – all three within 3%!', 500]);
      else if (hits.length === 2) parts.push(['🥈 The Double – two within 3%', 150]);
      const worst = Math.max(...STAT_KEYS.map(k => Math.abs(sum(k) - TREBLE[k]) / TREBLE[k]));
      return { total: parts.reduce((a, p) => a + p[1], 0), parts, diff: hits.length === 3 ? 0 : null, t, hits, closeness: Math.round(worst * 500) };
    }
    const diff = Math.abs(st.target - t);
    // closeness is measured in "500-goal units" so every stat/target scores on the same scale
    const d = Math.round(diff * 500 / st.target);
    const parts = [[`Closeness (${fmt(diff)} off)`, Math.max(0, 1000 - 5 * d)]];
    if (diff === 0) parts.push(['🎯 Bullseye!', 500]);
    return { total: parts.reduce((a, p) => a + p[1], 0), parts, diff, t, closeness: d };
  }

  function chaosLevel() {
    const n = (S.chaosCount || 0) + S.log.filter(x => x === '🃏').length;
    const [icon, name] = n >= 12 ? ['💥', 'Total anarchy'] : n >= 8 ? ['🌪️', 'Utter carnage'] : n >= 4 ? ['🔥', 'Proper chaos'] : ['😇', 'Mild disorder'];
    return `${icon} Chaos level: <b>${name}</b><small>${S.log.filter(x => !/^[A-Z]{2}$/.test(x)).join(' ')}</small>`;
  }
  // CHAOS: your total plus bonus points for the kind of XI you built (scaled to the stat)
  function chaosScore(st, t) {
    const u = CHAOS_UNIT[st.stat] || 1, slots = st.xi.filter(x => x.p != null).map(x => ({ ...x, player: byId(x.p) })), ps = slots.map(x => x.player);
    const parts = [];
    const add = (label, pts) => { if (pts) parts.push([label, Math.round(pts * u)]); };
    if (slots.length) {
      const { score, pairs } = GM.teamRating(slots);
      add(`🤝 Chemistry (${pairs.length} pair${pairs.length === 1 ? '' : 's'} of teammates)`, 12 * pairs.length);
      add(`⭐ Squad rating ${score}`, 3 * Math.max(0, score - 55));
      const titles = ps.reduce((a, p) => a + (p.hon.P || 0), 0);
      add(`🏆 PL title medals (${titles})`, 4 * titles);
      const hof = ps.filter(p => p.hon.H).length; add(`🏛️ Hall of Famers (${hof})`, 15 * hof);
      const loyal = ps.filter(p => p.clubs.length === 1 && p.apps >= 150).length; add(`❤️ One-club men (${loyal})`, 15 * loyal);
      const jm = ps.filter(p => p.clubs.length >= 5).length; add(`🧳 Journeymen, 5+ clubs (${jm})`, 10 * jm);
      const vets = ps.filter(p => Math.min(p.last, GM.currentSeason) - p.first + 1 >= 10).length; add(`🗓️ Ten-season veterans (${vets})`, 8 * vets);
    }
    (st.bonus || []).forEach(([label, pts]) => parts.push([label, pts]));
    const m = MANAGERS[st.manager];
    if (m && slots.length) {
      const pairs = GM.teamRating(slots).pairs.length;
      m.lines({ slots, ps, u, pairs }).forEach(([label, pts]) => { pts = Math.round(pts); if (pts) parts.push([label, pts]); });
    }
    const bonus = parts.reduce((a, x) => a + x[1], 0);
    return { total: t + bonus, parts: [[`${GM.STATS[st.stat].icon} PL ${GM.STATS[st.stat].label}`, t], ...parts], diff: null, t, bonus };
  }

  async function finish() {
    S.phase = 'done';
    const sc = scoreFor(S);
    S.final = sc;
    if (S.rules.max && !S.readonly) GM.addDist(distKey(), S.stat, S.rules.chaos ? sc.total : sc.t);  // CHAOS counts its points  // before the score is saved (see GM.dist)
    const xiSlots = S.xi.filter(s => s.p != null).map(s => ({ ...s, player: byId(s.p) }));
    if (GM.collectDraft && !S.readonly) {
      const rating = GM.teamRating(xiSlots);
      S.collected = GM.collectDraft({
        mode: S.mode, stat: S.stat, total: sc.t, points: sc.total, hard: S.hard, xi: xiSlots.map(s => s.player),
        rating: rating.score, pairs: rating.pairs.length, wildUsed: S.wildUsed, coinWin: S.coinWin,
        bull: sc.diff === 0, closeness: sc.closeness != null ? sc.closeness : null, treble: !!(sc.hits && sc.hits.length === 3),
      });
      S.collected = { n: S.collected.newPlayers.length, total: S.collected.total, badges: S.collected.fresh.map(x => x.icon + ' ' + x.name), book: S.collected.book };
    }
    if (saveKey() && !S.readonly) GM.store.set(saveKey(), null);
    if (S.dailyChaos && !S.readonly) {
      GM.store.set('dchaos2:' + S.day, { ...S, rules: undefined });
      GM.markDaily('chaos', sc.total, S.day);
    }
    if (S.mode === 'daily') {
      GM.store.set('daily2:' + GM.today(), { ...S, rules: undefined });
      GM.store.set(progressKey(), null);
      GM.markDaily('daily', sc.t);
    }
    render();
    if (S.online && GM.online) GM.online.pushRace(S);
    GM.sound.play('fulltime');
    const bull = sc.diff === 0;
    if (bull) setTimeout(() => GM.sound.play('horn'), 1700);
    if (!S.readonly && !(S.online && S.mode === 'target')) {  // a Target Race's target is its own, so it stays off the Target board
      if (S.mode === 'daily' && sc.total > GM.best('daily')) GM.store.set('best:daily', sc.total);
      const { isBest } = await GM.recordScore(modeKey(), sc.total, S.target && !S.rules.max && !S.rules.treble ? { t: sc.t, g: S.target } : { t: sc.t });
      if (isBest && sc.total > 0 && S.mode !== 'daily') GM.toast('🏆 New personal best!');
      if (isBest && sc.total > 0 && !bull) setTimeout(() => GM.sound.play('cheer'), 1700);
    }
  }

  /* ---------------------------------------------------------------- rendering */
  const posBadges = GM.posBadges;
  // a small secondary number on the reel card that isn't the stat being played for
  const hintStat = p => S.stat === 'apps' || S.rules.mystery ? '' : `<small>${fmt(p.apps)} apps</small>`;

  function reelInner(x) {
    if (!x) return '';
    if (S.masked && !x.wild && !S.revealed && S.phase !== 'reveal') {
      const p = byId(x.id);
      return `<div class="avatar lg mystery"><b>🎭</b></div><div class="reel-name">Masked man</div><div class="reel-meta">${posBadges(p)} ${GM.era(p)}</div><div class="reel-goals"><b>?</b> ${S.st.label}</div>`;
    }
    if (x.wild) {
      const w = WILDCARDS[x.wild];
      return `<div class="wild-card"><div class="wild-icon">${w.icon}</div><div class="wild-name">${w.name}</div><div class="wild-desc">${w.desc(wst())}</div><div class="tag">WILDCARD</div></div>`;
    }
    const p = byId(x.id);
    const reveal = S.revealed;
    const num = S.rules.treble
      ? `<div class="reel-goals treble-num ${reveal ? 'show' : ''}">${STAT_KEYS.map(k => `<span><b>${reveal ? fmt(pv(p)[k]) : '?'}</b> ${GM.STATS[k].icon}</span>`).join('')}</div>`
      : `<div class="reel-goals ${reveal ? 'show' : ''}">${reveal ? `<b>${fmt(val(p))}</b> ${S.st.label}` : `<b>?</b> ${S.st.label}`}${S.hard ? '' : hintStat(p)}</div>`;
    if (S.hard) {
      return `${GM.avatar(p, 'lg', true)}
      <div class="reel-name">${GM.esc(p.name)}</div>
      <div class="reel-meta">${posBadges(p)}</div>${num}`;
    }
    const mg = S.manager && MANAGERS[S.manager], gl = mg && mg.likes && mg.likes(p), gh = mg && mg.hates && mg.hates(p);
    const gaffer = gl || gh ? `<i class="gaffer ${gl ? 'up' : 'down'}" title="${GM.esc(mg.name)} ${gl ? 'likes him' : 'won’t like this'}">${gl ? '👍' : '👎'}</i>` : '';
    return `${gaffer}${x.mate ? `<div class="mate" title="Also played for ${GM.esc(x.mate.club)}, like ${GM.esc(x.mate.name)}">🤝 ${GM.clubShort(x.mate.club)} link · ${GM.esc(x.mate.name.split(' ').slice(-1)[0])}</div>` : ''}
      ${GM.avatar(p, 'lg')}
      <div class="reel-name">${GM.esc(p.name)}</div>
      <div class="reel-meta">${posBadges(p)} ${GM.flag(p.nat)} <span>${GM.era(p)}</span></div>
      <div class="chips">${p.clubs.map(c => GM.clubChip(c)).join('')}</div>${num}`;
  }

  const MOD_TAG = { captain: '<i title="Captain – doubled">©</i>', rotation: '<i title="Rotation Risk – halved">🩹</i>', zero: '<i title="Double or Nothing – lost">🎲</i>',
    injured: '<i title="Injured – halved">🚑</i>', halved: '<i title="Halved">⬇</i>', boosted: '<i title="Boosted">⬆</i>' };
  function slotHtml(s, i) {
    if (s.p == null) {
      const tgt = S.pending != null && S.reels[S.pending] && targetSlots(byId(S.reels[S.pending].id)).includes(i);
      return `<div class="slot empty ${s.pos !== baseForm()[i] ? 'moved' : ''} ${tgt ? 'target' : ''}" data-slot="${i}" title="${GM.POS_NAME[s.pos]}"><span class="pos pos-${GM.GROUP[s.pos]}">${s.pos}</span></div>`;
    }
    const p = byId(s.p);
    const surname = p.name.includes(' ') ? p.name.split(' ').slice(1).join(' ') : p.name;
    return `<div class="slot filled ${s.fresh ? 'fresh' : ''}" data-slot="${i}" title="${GM.esc(p.name)}">
      ${GM.avatar(p)}<span class="slot-name">${GM.esc(surname)}</span>
      <span class="slot-goals"><span class="sg">${S.rules.treble && s.v ? `${s.v.goals}·${s.v.assists}·${s.v.apps}` : fmt(s.g)}</span>${MOD_TAG[s.mod] || ''}</span><span class="slot-pos" title="${GM.POS_NAME[s.pos]}">${s.pos}</span></div>`;
  }

  function pitchHtml() {
    const lat = i => SIDE[baseForm()[i]] ?? 1;
    const rows = ['F', 'M', 'D', 'G'].map(g => S.xi.map((s, i) => [s, i]).filter(([s]) => GM.GROUP[s.pos] === g)
      .sort((a, b) => lat(a[1]) - lat(b[1]) || a[1] - b[1])).filter(r => r.length);
    const shape = rows.slice(0, -1).reverse().map(r => r.length).join('-');
    return `<div class="pitch ${S.subbing !== false ? 'subbing' : ''} ${S.pending != null ? 'placing' : ''}">
      <div class="pitch-lines"></div><div class="shape">${shape}</div>
      ${rows.map(r => `<div class="pitch-row ${r.length > 4 ? 'crowded' : ''}">${r.map(([s, i]) => slotHtml(s, i)).join('')}</div>`).join('')}
    </div>`;
  }

  function counterHtml() {
    const t = total();
    const left = emptySlots();
    const mod = S.modifier ? ` · <b>${WILDCARDS[S.modifier].icon} ${WILDCARDS[S.modifier].name}</b>` : '';
    if (S.rules.max) {
      const pb = GM.best(S.mode === 'daily' ? 'daily' : modeKey());
      return `<div class="counter max">
      <div class="counter-num"><b>${fmt(t)}</b><span>${S.st.label}</span>${S.rules.chaos ? `<span class="chaos-pts"><b>${signed(scoreFor(S).bonus)}</b> bonus</span>` : ''}</div>
      <div class="bar"><i style="width:${pb ? Math.min(100, t / pb * 100) : 0}%"></i></div>
      <div class="counter-sub">${pb ? (t > pb && !S.rules.chaos ? '🔥 Beating your best (' + fmt(pb) + ')' : `Your best: ${fmt(pb)}${S.rules.chaos ? ' pts' : ''}`) : 'Set your first score'} · ${left} slot${left === 1 ? '' : 's'} left${mod}${S.hot ? ` · <b>🔥 ×1.5 ×${S.hot}</b>` : ''}${S.golden ? ' · <b>⚽ ×3 next</b>' : ''}${S.unleash ? ` · <b>💥 ×2 ×${S.unleash}</b>` : ''}</div>
      ${S.rules.chaos ? `<div class="chaos-row">${S.manager ? `<button class="dugout" id="dugout">${MANAGERS[S.manager].icon} <b>${mgrShort(MANAGERS[S.manager])}</b></button>` : ''}<div class="chaos-meter ${S.chaosDue ? 'due' : ''}" title="The CHAOS meter: taking or playing wildcards fills it. Full = a CHAOS moment next spin"><span>${S.chaosDue ? 'NEXT SPIN!' : 'CHAOS'}</span>${Array.from({ length: METER }, (_, i) => `<i class="${S.chaosDue || i < (S.meter || 0) ? 'on' : ''}"></i>`).join('')}</div></div>` : ''}
    </div>`;
    }
    if (S.rules.treble) {
      return `<div class="counter treble">${STAT_KEYS.map(k => {
        const got = tot(k), tg = TREBLE[k];
        return `<div class="trow"><span><b>${GM.STATS[k].icon} ${fmt(got)}</b>/ ${fmt(tg)} ${GM.STATS[k].label}</span>
          <div class="bar"><i style="width:${Math.min(100, got / tg * 100)}%" class="${got > tg ? 'over' : ''}"></i></div></div>`;
      }).join('')}<div class="counter-sub">${left} slot${left === 1 ? '' : 's'} left${mod}</div></div>`;
    }
    if (S.rules.mystery) {
      const th = thermo(t / S.target);
      return `<div class="counter mystery">
        <div class="counter-num"><b>${fmt(t)}</b><span>${S.st.label} · target ❓</span></div>
        <div class="thermo"><i style="width:${Math.min(100, t / S.target * 80)}%;background:${th.color}"></i></div>
        <div class="counter-sub"><b>${th.icon} ${th.label}</b> · ${left} slot${left === 1 ? '' : 's'} left${mod}</div>
      </div>`;
    }
    const over = t > S.target;
    return `<div class="counter ${over ? 'over' : ''}">
      <div class="counter-num"><b>${fmt(t)}</b><span>/ ${fmt(S.target)} ${S.st.label}</span></div>
      <div class="bar"><i style="width:${Math.min(100, t / S.target * 100)}%"></i></div>
      <div class="counter-sub">${over ? `${fmt(t - S.target)} over` : `${fmt(S.target - t)} to go`} · ${left} slot${left === 1 ? '' : 's'} left${mod}</div>
    </div>`;
  }

  // Mystery Target temperature, from the fraction of the hidden target you've reached
  function thermo(f) {
    if (f > 1.08) return { icon: '💥', label: 'Overcooked!', color: 'var(--bad)' };
    if (f >= 0.97) return { icon: '🎯', label: 'Scorching!', color: '#ff7a00' };
    if (f >= 0.85) return { icon: '🔥', label: 'Hot', color: '#ffa53b' };
    if (f >= 0.65) return { icon: '♨️', label: 'Warm', color: '#ffd23f' };
    if (f >= 0.4) return { icon: '🌤️', label: 'Getting warmer', color: '#9fd8ff' };
    return { icon: '🥶', label: 'Ice cold', color: '#6cc3ff' };
  }

  function mysteryIntro() {
    // a little slot-machine reveal of which stat counts – the number stays secret
    root.innerHTML = `<div class="topbar"><a href="#/" class="back">‹</a><h2>🎲 Mystery Target</h2><span></span></div>
      <div class="mystery-intro"><p>Tonight we’re counting…</p><div class="mystery-roll" id="mroll">⚽ Goals</div>
      <p class="muted" id="mnote">The target number is secret until full time. A thermometer tells you how warm you are.</p>
      <button class="btn big" id="mgo" hidden>Kick off</button></div>`;
    const el = GM.$('#mroll', root), labels = STAT_KEYS.map(k => `${GM.STATS[k].icon} ${GM.STATS[k].name}`);
    let i = 0;
    const iv = setInterval(() => { el.textContent = labels[i++ % 3]; GM.sound.play('tick'); }, 90);
    setTimeout(() => {
      clearInterval(iv);
      GM.sound.play('land');
      el.textContent = `${S.st.icon} ${S.st.name}`;
      el.classList.add('landed');
      const range = MYSTERY[S.stat];
      GM.$('#mnote', root).innerHTML = `Somewhere between <b>${fmt(range[0])}</b> and <b>${fmt(range[1])}</b> ${S.st.label}. The exact number is secret until full time – watch the thermometer.`;
      const go = GM.$('#mgo', root); go.hidden = false;
      go.onclick = () => { S.revealStage = null; render(); };
    }, 1400);
  }

  // Size the pitch to the screen: after each update, give its four rows whatever height is left over (46-86px a row),
  // so it fills tall phones without making short ones scroll
  // sized once per screen (and game layout); the dock under the pitch is a fixed height, so it never needs to change mid-game
  let fitKey = '';
  function fitPitch() {
    const pitch = GM.$('.pitch', root);
    if (!pitch || !root.isConnected || S.phase === 'done') return;
    const rows = GM.$$('.pitch-row', pitch).length || 4;
    const key = [innerWidth, innerHeight, S.mode, S.hard, S.rules.wild !== false, !!S.vs, !!S.online, rows].join('|');
    if (key === fitKey) return;
    fitKey = key;
    const cur = parseFloat(getComputedStyle(root).getPropertyValue('--slot-h')) || 52;
    // the game's own content (the page itself always stretches to the screen, so measure #app, padding included)
    const spare = window.innerHeight - (root.getBoundingClientRect().bottom + window.scrollY);
    const next = Math.max(46, Math.min(86, Math.floor(cur + spare / rows)));
    if (Math.abs(next - cur) >= 1) root.style.setProperty('--slot-h', next + 'px');
    root.classList.toggle('slots-compact', next < 62);
  }
  window.addEventListener('resize', () => { if (S && root) { fitPitch(); fitReels(); } });
  if (document.fonts) document.fonts.ready.then(() => { fitKey = ''; if (S && root) { fitPitch(); fitReels(); } });
  // Each card measures itself: if its contents don't fit (bigger fonts on some phones, a two-line name), the less
  // important bits give way one step at a time (fit1: club badges, fit2: a smaller photo and no link line,
  // fit3: no photo), so the stat box and a wildcard's full text always show
  function fitReels() {
    GM.$$('.stage .reel', root).forEach(r => {
      const over = () => { const d = GM.$('.wild-desc', r); return r.scrollHeight > r.clientHeight + 1 || (d && d.scrollHeight > d.clientHeight + 1); };
      r.classList.remove('fit1', 'fit2', 'fit3');
      for (const c of ['fit1', 'fit2', 'fit3']) { if (!over()) break; r.classList.add(c); }
    });
  }

  // one line for what's happening (a CHAOS event, a storm, an active wildcard) and one for what to do next
  function msgHtml(sp) {
    const top = S.storm ? '<span class="m-ev">🌪️ <b>Wildcard storm!</b> No players this spin – grab a card</span>'
      : S.event ? `<span class="m-ev">${S.event.icon} <b>${GM.esc(S.event.name)}</b> – ${GM.esc(S.event.note)}</span>`
      : sp && S.phase !== 'spin' ? `<span class="m-sp">${sp.icon} ${sp.name}</span>` : '';
    const pend = S.pending != null && S.reels[S.pending] && !S.reels[S.pending].wild && byId(S.reels[S.pending].id);
    const next = S.subbing !== false ? '🔁 Tap a player on the pitch to release him <button class="btn small ghost" id="cancel-sub">Cancel</button>'
      : S.phase === 'spin' ? 'Spin for three new players'
      : S.phase !== 'pick' ? ''
      : pend ? `📍 Tap a glowing slot for <b>${GM.esc(pend.name)}</b>`
      : `Tap a player, then the slot he’ll play in${S.reels.some(r => r.wild) ? ' – or grab the wildcard' : ''}`;
    return `<div class="m-top">${top}</div><div class="m-next">${next}</div>`;
  }

  // only draw while you're still on this game: a delayed animation or sound cue must never paint a draft over the page you went to
  const onThisGame = () => { const h = location.hash; return S.online ? h.includes(S.online.code) : /^#\/(draft|daily)\b/.test(h); };
  function render() {
    if (!S || !onThisGame()) return;
    if (S.phase === 'done') return renderDone();
    requestAnimationFrame(() => { fitPitch(); fitReels(); });
    if (!S.readonly && saveKey()) GM.store.set(saveKey(), { ...S, rules: undefined });  // saved on every move
    if (S.revealStage === 'intro') return mysteryIntro();
    const icon = S.mode === 'club' ? '🏟️' : GM.MODES[S.mode === 'daily' ? 'daily' : S.mode].icon;
    const nReels = Math.max(3, S.reels.length);
    const sp = S.special && WILDCARDS[S.special];
    root.innerHTML = `
      <div class="topbar"><a href="#/" class="back">‹</a><h2><span class="t-name">${icon} ${modeName().replace(/^Ultimate Wildcard CHAOS/, 'CHAOS')}</span>${S.hard ? '<small class="hard-pill">Hard</small>' : ''}</h2><span class="top-btns">${S.online ? '' : GM.lbButton(modeKey())}<button class="icon-btn" id="help">?</button></span></div>
      ${S.vs ? `<div class="banner">⚔️ Beat <b>${GM.esc(S.vs)}</b>’s score of <b>${GM.esc(S.vss)}</b></div>` : ''}
      ${S.online ? `<div class="opp-bar" id="oppbar">${(GM.online && GM.online.oppBar && GM.online.oppBar(S.online.code)) || `🌐 Racing <b>${GM.esc(S.online.opp)}</b>…`}</div>` : ''}
      ${counterHtml()}
      ${pitchHtml()}
      <div class="dock">
      ${S.rules.wild === false ? '' : `<div class="inv ${S.inv.length ? 'has' : ''}"><span class="inv-label">${S.inv.length ? `🃏 ${S.inv.length}/3` : 'Wildcards 0/3'}</span>${S.inv.length ? S.inv.map((w, k) =>
      `<button class="wild-btn ${S.subbing === k ? 'active' : ''}" data-w="${k}" title="${GM.esc(WILDCARDS[w].desc(wst()))}">${WILDCARDS[w].icon}<small>${WILDCARDS[w].name}</small></button>`).join('')
        : '<span class="muted">none yet · they turn up on the reels</span>'}</div>`}
      <div class="stage ${S.hard ? 'hard' : ''}">${S.phase === 'spin' ? `<div class="spin-zone"><button class="btn big spin" id="spin" ${busy ? 'disabled' : ''}>🎰 SPIN</button></div>` : `<div class="reels ${nReels > 3 ? 'n5' : ''}">${Array.from({ length: nReels }, (_, i) => {
          const x = S.reels[i];
          if (S.phase === 'spinning') return `<div class="reel spinning"><div class="reel-spin">…</div></div>`;
          if (!x) return `<div class="reel idle"><div class="reel-q">?</div></div>`;
          return `<button class="reel ${x.wild ? 'is-wild' : ''} ${S.selected === i || S.pending === i ? 'selected' : ''} ${S.phase === 'reveal' && S.selected !== i ? 'dim' : ''} ${S.hard ? 'hard' : ''}" data-reel="${i}">${reelInner(x)}</button>`;
        }).join('')}</div>`}</div>
      <div class="msg">${msgHtml(sp)}</div>
      </div>`;
    GM.$('#help', root).onclick = help;
    const spb = GM.$('#spin', root); if (spb) spb.onclick = () => doSpin();
    GM.$$('[data-reel]', root).forEach(b => b.onclick = () => sign(+b.dataset.reel));
    GM.$$('[data-w]', root).forEach(b => b.onclick = () => useWild(+b.dataset.w));
    GM.$$('[data-slot]', root).forEach(b => b.onclick = () => {
      if (S.subbing !== false) release(+b.dataset.slot);
      else if (S.pending != null) place(+b.dataset.slot);
    });
    const cs = GM.$('#cancel-sub', root); if (cs) cs.onclick = () => { S.subbing = false; render(); };
    const dg = GM.$('#dugout', root); if (dg) dg.onclick = () => { const m = MANAGERS[S.manager]; GM.modal(`<div class="center"><div class="mgr-big">${m.icon}</div><h3>${m.name}</h3></div><p>✅ ${m.perk}</p><p>⚠️ ${m.catch}</p><p class="muted small">👍 and 👎 on the reels show who he’d like or not. It all adds up in your bonus.</p><div class="actions"><button class="btn" data-close>Got it</button></div>`); };
  }

  function help() {
    const r = S.rules, L = S.st.label;
    GM.modal(`<h3>How to play</h3>
      ${r.treble ? `<p>🏆 <b>The Treble:</b> one XI, three targets – <b>${fmt(TREBLE.goals)} goals</b>, <b>${fmt(TREBLE.assists)} assists</b> and <b>${fmt(TREBLE.apps)} appearances</b>. Strikers bring goals, creators bring assists, old warhorses bring apps: balance them.</p>`
      : r.mystery ? `<p>🎲 <b>Mystery Target:</b> you’re counting <b>${S.st.label}</b>, but the target is secret – somewhere between ${fmt(MYSTERY[S.stat][0])} and ${fmt(MYSTERY[S.stat][1])}. The thermometer tells you how close you are. It’s revealed at full time.</p>`
      : r.chaos ? `<p>🌪️ <b>Ultimate Wildcard CHAOS:</b> build the XI with the most PL ${L}, and then some. Your score is your ${L} <b>plus bonus points</b> for the kind of team you build: teammates who played together (chemistry), your squad rating, PL title medals, Hall of Famers, one-club men, journeymen (5+ clubs) and ten-season veterans.</p>
        <p>👔 <b>Your manager</b> brings a perk and a catch (👍 and 👎 on the reels show who he’d like). He can get the sack.</p>
        <p>⚡ <b>The CHAOS meter</b> fills every time you take or play a wildcard. When it’s full, the next spin opens with a big moment: a 🌪️ tornado through your XI, a ⚡ lightning strike, a 🚌 bus parade, ⏰ deadline day, 💥 CHAOS unleashed or a sacking.</p>
        <p>Now and then a <b>match-day event</b> strikes too (🟥 red cards, 🚑 injuries, 📺 VAR, 🧾 the taxman, 💰 TV money), one spin in ten is a <b>🌪️ wildcard storm</b>, and there are riskier wildcards like 🎰 All In (a coin toss: your whole XI ×2 or ×½).</p>`
      : r.max ? `<p>👑 <b>${modeName()}:</b> no target – build the XI with the <b>most Premier League ${L}</b> you can. Every player with 50+ apps is equally likely to turn up, so you’ll mostly see journeymen: spot the big numbers and use your wildcards well.</p>`
      : `<p>🎯 <b>${modeName()}:</b> build an XI whose players have <b>${fmt(S.target)}</b> Premier League ${L} between them – as close as you can, exactly for a bullseye.</p>`}
      <p>Each spin shows three players who fit an open position. Their ${L} are hidden until you sign one. You keep spinning until the XI is full.</p>
      <p>Every player has real positions – <b>GK, LB, CB, RB, LM, CM, RM, ST</b>. Tap a player, then tap one of the highlighted slots he can play.</p>
      <p><b>Wildcards</b> appear on the reels from the 2nd spin – grab one instead of a player and use it when you like (hold up to 3):</p>
      <ul class="wc-list">${Object.entries(WILDCARDS).filter(([k, w]) => !r.noWild.includes(k) && (!w.chaos || r.chaos)).map(([, w]) => `<li>${w.icon} <b>${w.name}</b> – ${w.desc(wst())}</li>`).join('')}</ul>
      <p><b>Scoring:</b> ${r.treble ? 'up to 333 points per stat (full marks when exact, nothing once you’re 25% out). All three within 3% wins the Treble: +500. Two = the Double: +150.'
        : r.mystery ? '1000 minus 5 points per 1% you miss by (roughly). Hit it exactly for a +500 bullseye.'
        : r.chaos ? `your XI’s PL ${L} plus every bonus, shown at full time.` : r.max ? `your score is your XI’s total PL ${L} (after any wildcard modifiers).` : `1000 minus 5 for every ${S.stat === 'goals' ? 'goal' : `${fmt(Math.round(S.target / 442 * 10) / 10)} ${L}`} off target. Exactly ${fmt(S.target)} = +500 bullseye bonus.`}</p>
      <p>🤝 A player who shares a club with your last signing may turn up to tempt you.</p>
      ${S.hard ? `<p>🥵 <b>Hard mode:</b> just names and positions – no clubs, years, apps or nationality${r.max ? '' : ', and far fewer star players on the reels (same targets)'}. Separate leaderboard.</p>` : ''}
      <div class="row"><button class="btn" data-close>Got it</button></div>`);
  }

  function renderDone() {
    const sc = S.final || scoreFor(S);
    const best = GM.best(S.mode === 'daily' ? 'daily' : modeKey());
    const icon = S.mode === 'club' ? '🏟️' : GM.MODES[S.mode === 'daily' ? 'daily' : S.mode].icon;
    const xi = S.xi.filter(s => s.p != null).map(s => ({ ...s, player: byId(s.p) }));
    root.innerHTML = `
      <div class="topbar"><a href="#/" class="back">‹</a><h2>${icon} Full time</h2><span></span></div>
      <div class="result">
        ${S.rules.mystery ? `<div class="mystery-reveal">🎲 The mystery target was <b>${fmt(S.target)}</b> ${S.st.label}</div>` : ''}
        ${S.rules.treble ? `<div class="result-total ${sc.diff === 0 ? 'bull' : ''}">${sc.hits.length === 3 ? '🏆' : sc.hits.length === 2 ? '🥈' : ''}${fmt(sc.t)}<small>goals · ${fmt(tot('assists'))} assists · ${fmt(tot('apps'))} apps</small></div>`
        : S.rules.chaos ? `<div class="result-total">${fmt(sc.total)}<small>CHAOS points · ${fmt(sc.t)} ${S.st.label} + ${fmt(sc.bonus)} bonus</small></div>`
        : `<div class="result-total ${sc.diff === 0 ? 'bull' : ''}">${fmt(sc.t)}<small>PL ${S.st.label}${S.rules.max ? '' : ` · target ${fmt(S.target)} · <b>${Math.round(sc.t / S.target * 1000) / 10}%</b>`}</small></div>`}
        ${S.rules.chaos ? `<div class="chaos-level">${chaosLevel()}</div>${S.manager ? `<div class="muted small">👔 Manager: ${MANAGERS[S.manager].icon} ${MANAGERS[S.manager].name}</div>` : ''}
          ${(S.moments || []).length ? `<details class="chaos-story"><summary>📜 What happened</summary><ol>${S.moments.map(m => `<li>${m.icon} <b>${GM.esc(m.name)}</b> ${GM.esc(m.text)}</li>`).join('')}</ol></details>` : ''}` : ''}
        ${S.rules.max && !S.rules.chaos ? '' : `${S.rules.chaos ? '' : `<div class="result-score">${fmt(sc.total)}<small>points</small></div>`}
        <table class="breakdown">${sc.parts.map(([k, v]) => `<tr><td>${k}</td><td class="${v < 0 ? 'neg' : ''}">${v < 0 ? '−' + fmt(-v) : '+' + fmt(v)}</td></tr>`).join('')}</table>`}
        ${S.vs ? `<div class="banner">${sc.total > S.vss ? '🎉 You beat' : sc.total == S.vss ? '🤝 You drew with' : '😬 You lost to'} <b>${GM.esc(S.vs)}</b> (${GM.esc(S.vss)})</div>` : ''}
        <div class="muted">Personal best: ${fmt(Math.max(best, sc.total))}</div>
      </div>
      ${S.rules.max ? (S.rules.chaos ? GM.distHtml(distKey(), S.stat, sc.total, 'CHAOS points') : GM.distHtml(distKey(), S.stat, sc.t)) : ''}
      ${S.collected ? `<a class="collected" href="#/album${S.collected.book === 'purist' ? '?b=purist' : ''}">📒 ${S.collected.n ? `<b>+${S.collected.n}</b> new player${S.collected.n === 1 ? '' : 's'} for your album` : 'No new players this time'} · ${S.collected.total.toLocaleString()} collected${S.collected.badges.length ? `<br>🏅 ${S.collected.badges.join(' · ')}` : ''} ›</a>` : ''}
      ${GM.report ? GM.report(xi, S.st, S.rules.treble) : ''}
      ${pitchHtml()}
      <div class="actions col">
        ${S.online ? `<div id="race-result"></div><a class="btn big" href="#/online?room=${S.online.code}&v=1">🆚 Compare teams & match points</a>` : S.mode !== 'daily' && !S.dailyChaos ? `<button class="btn big" id="again">🔁 Play again</button>` : `<div class="muted">New Daily ${S.dailyChaos ? 'CHAOS' : 'Ultimate'} tomorrow</div>`}
        <button class="btn" id="challenge">⚔️ Challenge a friend (same spins)</button>
        <button class="btn ghost" id="share">📤 Share result</button>
        <button class="btn ghost" id="sharepic">🖼️ Share a picture of your XI</button>
        <a class="btn ghost" href="#/leaderboard?m=${encodeURIComponent(modeKey())}">🏆 Leaderboard</a>
      </div>`;
    const again = GM.$('#again', root); if (again) again.onclick = () => start(root, S.mode, { hard: S.hard, stat: S.rules.mystery ? undefined : S.stat, club: S.club });
    GM.$('#share', root).onclick = () => GM.share(resultText(sc));
    GM.$('#sharepic', root).onclick = () => {
      const png = GM.teamPicture(S.xi.map(s => ({ pos: s.pos, p: s.p != null ? PL()[s.p] : null, v: s.p != null ? s.g : null })), {
        title: `${modeName()}${S.hard ? ' · Hard' : ''}`, sub: S.rules.max ? `My XI's Premier League ${S.st.label}` : `${sc.total} points · ${fmt(sc.t)} / ${fmt(S.target || 0)} ${S.st.label}`,
        total: sc.t, totalLabel: S.st.label });
      GM.shareImage(png, resultText(sc));
    };
    GM.$('#challenge', root).onclick = async () => {
      const name = await GM.askName() || 'A friend';
      const m = S.mode === 'daily' ? 'ultimate' : S.mode;
      const url = `${GM.baseUrl()}#/draft?m=${m}&s=${S.stat}${S.club ? '&c=' + encodeURIComponent(S.club) : ''}&seed=${encodeURIComponent(S.seed)}${S.hard ? '&h=1' : ''}&vs=${encodeURIComponent(name)}&vss=${sc.total}`;
      GM.share(S.rules.max
        ? `⚽ Goal Machine – my ${modeName()}${S.hard ? ' (Hard)' : ''} XI has ${fmt(sc.t)} PL ${S.st.label}. Same spins, can you beat it?`
        : S.rules.treble || S.rules.mystery ? `⚽ Goal Machine – I scored ${sc.total} in ${modeName()}${S.hard ? ' (Hard)' : ''}. Same spins, can you beat me?`
        : `⚽ Goal Machine – I scored ${sc.total} in ${modeName()}${S.hard ? ' (Hard)' : ''} (${fmt(sc.t)}/${fmt(S.target)}). Same spins, can you beat me?`, url);
    };
  }

  function resultText(sc) {
    const icons = S.log.map(l => ({ G: '🧤', D: '🛡️', M: '⚙️', F: '⚽' }[GM.GROUP[l]] || l)).join('');
    const head = S.mode === 'daily' ? `Daily Ultimate · ${GM.today()}` : modeName() + (S.hard ? ' (Hard)' : '');
    const rating = GM.teamRating ? GM.teamRating(S.xi.filter(s => s.p != null).map(s => ({ ...s, player: byId(s.p) }))) : null;
    const tier = rating ? `\n${rating.tier.icon} ${rating.tier.name}` : '';
    if (S.rules.chaos) return `⚽ Goal Machine – ${head}\n🌪️ ${fmt(sc.total)} CHAOS points (${fmt(sc.t)} ${S.st.label} + ${fmt(sc.bonus)} bonus)${tier}\n${icons}`;
    if (S.rules.max) return `⚽ Goal Machine – ${head}\n👑 ${fmt(sc.t)} PL ${S.st.label}${tier}\n${icons}`;
    if (S.rules.treble) return `⚽ Goal Machine – ${head}\n${STAT_KEYS.map(k => `${GM.STATS[k].icon} ${fmt(tot(k))}/${fmt(TREBLE[k])}`).join(' ')}${sc.hits.length === 3 ? ' 🏆 TREBLE!' : ''}\n${sc.total} pts${tier}\n${icons}`;
    if (S.rules.mystery) return `⚽ Goal Machine – ${head}\n🎲 ${fmt(sc.t)} ${S.st.label} vs a secret ${fmt(S.target)}${sc.diff === 0 ? ' 🎯 BULLSEYE' : ''} · ${sc.total} pts${tier}\n${icons}`;
    return `⚽ Goal Machine – ${head}\n${fmt(sc.t)}/${fmt(S.target)} ${S.st.label}${sc.diff === 0 ? ' 🎯 BULLSEYE' : ''} · ${sc.total} pts${tier}\n${icons}`;
  }
})();

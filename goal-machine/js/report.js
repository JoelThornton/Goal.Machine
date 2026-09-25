/* Goal Machine – full-time report: player badges, chemistry, team rating and a good/bad verdict */
'use strict';

(function () {
  const sum = (a, f) => a.reduce((t, x) => t + f(x), 0);
  const fmt = n => n.toLocaleString();
  const surname = p => (p.name.includes(' ') ? p.name.split(' ').slice(1).join(' ') : p.name);

  const BADGES = [
    { id: 'H', icon: '🏛️', label: 'Hall of Famer', test: p => p.hon.H },
    { id: 'B', icon: '👟', label: 'Golden Boot', test: p => p.hon.B, count: p => p.hon.B },
    { id: 'W', icon: '🌍', label: 'World Cup winner', test: p => p.hon.W },
    { id: 'C', icon: '⭐', label: 'Champions League winner', test: p => p.hon.C, count: p => p.hon.C },
    { id: 'P', icon: '🏆', label: 'In a PL title-winning squad', test: p => p.hon.P, count: p => p.hon.P },
    { id: '100', icon: '💯', label: '100 Club (100+ PL goals)', test: p => p.goals >= 100 },
    { id: 'AST', icon: '🅰️', label: 'Playmaker (75+ PL assists)', test: p => p.ast >= 75 },
    { id: 'APP', icon: '🎖️', label: 'Veteran (400+ PL apps)', test: p => p.apps >= 400 },
    { id: 'ONE', icon: '❤️', label: 'One-club man', test: p => p.clubs.length === 1 && p.apps >= 150 },
    { id: 'JM', icon: '🧳', label: 'Journeyman (5+ PL clubs)', test: p => p.clubs.length >= 5 },
  ];

  // thresholds calibrated on simulated teams: random journeymen ≈ mid-table, a legends XI ≈ Invincibles
  const TIERS = [
    { min: 0, icon: '☠️', name: 'Relegation certainties' },
    { min: 55, icon: '😰', name: 'Relegation battlers' },
    { min: 61, icon: '😐', name: 'Mid-table' },
    { min: 67, icon: '🙂', name: 'Europa League chasers' },
    { min: 73, icon: '⭐', name: 'Champions League potential' },
    { min: 80, icon: '🏆', name: 'Title contenders' },
    { min: 88, icon: '👑', name: 'Invincibles' },
  ];

  /** Player quality 0-100 for the slot he's playing in. */
  function quality(s) {
    const p = s.player, g = GM.GROUP[s.pos];
    const a = Math.min(1, p.apps / 400);
    const o = g === 'F' ? Math.min(1, p.goals / 120)
      : g === 'M' ? Math.min(1, (p.goals + p.ast) / 130)
        : g === 'D' ? Math.min(1, p.apps / 450) : Math.min(1, p.apps / 400);
    const h = p.hon;
    const hb = Math.min(12, 4 * (h.H || 0) + 2 * Math.min(3, h.B || 0) + 3 * (h.W || 0) + 2 * Math.min(3, h.C || 0) + Math.min(5, h.P || 0));
    return Math.min(100, 40 + 25 * a + 25 * o + hb);
  }

  function chemistry(xi) {
    const pairs = [];
    for (let i = 0; i < xi.length; i++) {
      for (let j = i + 1; j < xi.length; j++) {
        const c = GM.teammates(xi[i].player, xi[j].player);
        if (c) pairs.push([xi[i].player, xi[j].player, c === true ? '' : c]);
      }
    }
    return pairs;
  }

  GM.teamRating = function (xi) {
    const pairs = chemistry(xi);
    const q = xi.length ? sum(xi, quality) / xi.length : 0;
    const score = Math.min(99, Math.round(q + Math.min(6, pairs.length * 1.5)));
    const tier = TIERS.filter(t => score >= t.min).pop();
    return { score, tier, pairs };
  };

  function verdict(xi, pairs) {
    const by = g => xi.filter(s => GM.GROUP[s.pos] === g).map(s => s.player);
    const st = by('F'), mid = by('M'), def = by('D').concat(by('G')), gk = by('G')[0];
    const stGoals = sum(st, p => p.goals), midCreate = sum(mid, p => p.goals + p.ast), defApps = sum(def, p => p.apps);
    const players = xi.map(s => s.player);
    const totalApps = sum(players, p => p.apps);
    const honours = sum(players, p => (p.hon.H || 0) + (p.hon.W || 0) + (p.hon.C || 0) + (p.hon.P || 0) + (p.hon.B || 0));
    const first = Math.min(...players.map(p => p.first)), last = Math.max(...players.map(p => p.last));
    const nats = new Set(players.map(p => p.nat).filter(Boolean));
    const english = players.filter(p => p.nat === 'England').length;
    const good = [], bad = [];
    const G = (ok, score, text) => { if (ok) good.push([score, text]); };
    const B = (ok, score, text) => { if (ok) bad.push([score, text]); };
    G(stGoals >= 150, stGoals / 150, `Lethal up front – your strikers have ${fmt(stGoals)} PL goals between them.`);
    G(midCreate >= 180, midCreate / 180, `Creative engine room – ${fmt(midCreate)} goals and assists from midfield.`);
    G(defApps >= 1800, defApps / 1800, `Rock-solid at the back – ${fmt(defApps)} PL appearances in your back line.`);
    G(gk && gk.apps >= 300, gk ? gk.apps / 300 : 0, `Safe hands – ${gk ? gk.name : ''} has ${gk ? fmt(gk.apps) : 0} PL apps in goal.`);
    G(pairs.length >= 3, pairs.length / 2.5, `Great chemistry – ${pairs.length} pairs of former teammates.`);
    G(honours >= 5, honours / 4, `Serial winners – ${honours} major honours in the dressing room.`);
    G(totalApps >= 3500, totalApps / 3500, `Vastly experienced – ${fmt(totalApps)} PL appearances between them.`);
    G(english === 11, 1.3, 'Three Lions – an all-English XI.');
    G(nats.size >= 8, nats.size / 7, `United Nations – ${nats.size} nationalities in one dressing room.`);
    // the one bad thing: real weaknesses, scored so the most damning one wins
    const goals = sum(players, p => p.goals), top = players.slice().sort((a, b) => b.goals - a.goals)[0];
    const bit = players.filter(p => p.apps < 80).length, oop = xi.filter(s => s.as).length;
    const avgApps = Math.round(totalApps / Math.max(1, players.length));
    B(stGoals < 40, 1 + (40 - stGoals) / 40, `Blunt attack – your strikers have only ${stGoals} PL goals between them.`);
    B(midCreate < 45, 1 + (45 - midCreate) / 45, `No creativity – just ${midCreate} goals and assists from midfield.`);
    B(defApps < 700, 1 + (700 - defApps) / 700, `Leaky – your back line has only ${fmt(defApps)} PL apps between them.`);
    B(gk && gk.apps < 100, 1.05, `Dodgy keeper – ${gk ? gk.name : ''} only made ${gk ? gk.apps : 0} PL appearances.`);
    B(goals >= 60 && top && top.goals / goals >= 0.5, 0.6 + top.goals / goals, `One-man team – ${top ? top.name : ''} has ${top ? fmt(top.goals) : 0} of your ${fmt(goals)} goals. Nobody else chips in.`);
    B(bit >= 4, 0.7 + bit / 8, `Squad players – ${bit} of your XI made fewer than 80 PL appearances.`);
    B(oop >= 2, 0.6 + oop / 5, `Square pegs – ${oop} players are out of their best position.`);
    B(honours === 0 && xi.length === 11, 0.9, 'Empty trophy cabinet – not one major honour in the squad.');
    B(pairs.length === 0 && xi.length === 11, 1.1, 'Total strangers – none of your XI ever played together.');
    B(avgApps < 110, 1 + (110 - avgApps) / 110, `Green – they average just ${avgApps} PL appearances each.`);
    B(last - first >= 30, 0.3, `Time travellers – careers stretch from ${first} to ${last >= GM.currentSeason ? 'today' : last + 1}. Good luck with the fitness tests.`);
    // otherwise, call out the weakest unit of the team
    const units = [
      [stGoals / 150, `Weak spot up front – your strikers have only ${fmt(stGoals)} PL goals between them.`],
      [midCreate / 180, `Weak spot in midfield – just ${fmt(midCreate)} goals and assists from the middle.`],
      [defApps / 1800, `Weak spot at the back – only ${fmt(defApps)} PL apps across the back line.`],
      [gk ? gk.apps / 300 : 1, `Weak spot in goal – ${gk ? gk.name : ''} made only ${gk ? fmt(gk.apps) : 0} PL appearances.`],
    ].sort((a, b) => a[0] - b[0]);
    B(units[0][0] < 0.75, 0.5 + (0.75 - units[0][0]), units[0][1]);
    good.sort((a, b) => b[0] - a[0]);
    bad.sort((a, b) => b[0] - a[0]);
    const qs = xi.map(s => [quality(s), s.player]).sort((a, b) => a[0] - b[0]);
    const best = qs[qs.length - 1], worst = qs[0];
    return {
      good: good.length ? good[0][1] : `Star man – ${best[1].name} (${fmt(best[1].goals)} goals, ${fmt(best[1].apps)} apps).`,
      bad: bad.length ? bad[0][1] : `Weakest link – ${worst[1].name} gives you the least: ${fmt(worst[1].goals)} goals in ${fmt(worst[1].apps)} PL games.`,
    };
  }

  GM.report = function (xi, st, treble) {
    if (!xi.length) return '';
    const { score, tier, pairs } = GM.teamRating(xi);
    const v = verdict(xi, pairs);
    const players = xi.map(s => s.player);
    // team-level badge counts
    const chips = [];
    const count = (f) => players.filter(f).length;
    const n = (k, one, many) => (k === 1 ? one : many);
    const hof = count(p => p.hon.H), wc = count(p => p.hon.W), cl = count(p => p.hon.C), gb = sum(players, p => p.hon.B || 0), pl = sum(players, p => p.hon.P || 0);
    if (hof) chips.push(`🏛️ ${hof} Hall of ${n(hof, 'Famer', 'Famers')}`);
    if (wc) chips.push(`🌍 ${wc} World Cup ${n(wc, 'winner', 'winners')}`);
    if (cl) chips.push(`⭐ ${cl} Champions League ${n(cl, 'winner', 'winners')}`);
    if (pl) chips.push(`🏆 ${pl} PL ${n(pl, 'title', 'titles')}*`);
    if (gb) chips.push(`👟 ${gb} Golden ${n(gb, 'Boot', 'Boots')}`);
    const c100 = count(p => p.goals >= 100); if (c100) chips.push(`💯 ${c100} in the 100 Club`);
    if (pairs.length) chips.push(`🤝 ${pairs.length} teammate ${n(pairs.length, 'pair', 'pairs')}`);

    const rows = xi.map(s => {
      const p = s.player;
      const badges = BADGES.filter(b => b.test(p)).map(b => {
        const c = b.count ? b.count(p) : 0;
        return `<span class="badge" title="${b.label}${c > 1 ? ' ×' + c : ''}">${b.icon}${c > 1 ? `<sub>${c}</sub>` : ''}</span>`;
      }).join('');
      const tag = { captain: ' ×2', rotation: ' ÷2', zero: ' ×0' }[s.mod] || '';
      return `<div class="xi-row"><span class="pos pos-${GM.GROUP[s.pos]}">${s.pos}</span>
        <span class="xi-name">${GM.esc(p.name)}<span class="badges">${badges}</span></span>
        <b>${treble && s.v ? `${s.v.goals}·${s.v.assists}·${fmt(s.v.apps)}` : fmt(s.g)}${tag ? `<small>${tag}</small>` : ''}</b></div>`;
    }).join('');

    return `<div class="report">
      <div class="tier"><span class="tier-icon">${tier.icon}</span><div><small>Squad rating ${score}</small><b>${tier.name}</b></div></div>
      <div class="verdict good">👍 ${GM.esc(v.good)}</div>
      <div class="verdict bad">👎 ${GM.esc(v.bad)}</div>
      ${chips.length ? `<div class="team-badges">${chips.map(c => `<span>${c}</span>`).join('')}</div>` : ''}
      <div class="xi-list">${rows}</div>
      ${pairs.length ? `<details class="chem"><summary>🤝 Who played together (${pairs.length})</summary>
        ${pairs.map(([a, b, c]) => `<div>${GM.esc(surname(a))} + ${GM.esc(surname(b))}${c ? ` <small>· ${GM.esc(c)}</small>` : ''}</div>`).join('')}</details>` : ''}
      <details class="legend"><summary>Badge key</summary>${BADGES.map(b => `<div>${b.icon} ${b.label}</div>`).join('')}
        <div class="muted">*Titles count seasons a player was in a title-winning squad. Titles and teammates come from transfer records, so the odd loan spell may be missed.</div></details>
    </div>`;
  };
})();

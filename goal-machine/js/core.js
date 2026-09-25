/* Goal Machine – shared data, helpers, storage, leaderboard */
'use strict';

const GM = window.GM = {};

/* ------------------------------------------------------------------ data */
GM.GROUP = { GK: 'G', LB: 'D', CB: 'D', RB: 'D', LM: 'M', CM: 'M', RM: 'M', ST: 'F' };
GM.fold = function (s) {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/ø/g, 'o').replace(/æ/g, 'ae').replace(/ß/g, 'ss').replace(/ı/g, 'i').replace(/ł/g, 'l').replace(/đ/g, 'd')
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
};

(function () {
  const D = window.PL_DATA;
  GM.dataDate = D.generated;
  GM.players = D.players.map((r, i) => ({
    id: i, name: r[0], poss: r[1].split('/'), nat: r[2] >= 0 ? D.nats[r[2]] : null,
    clubs: r[3].map(c => D.clubs[c]), apps: r[4], goals: r[5], first: r[6], last: r[7], code: r[8], ast: r[9] || 0,
    stints: parseStints(r[10] || ''), hon: parseHon(r[11] || ''),
  }));
  // teammate pairs from Transfermarkt (index pairs, flattened)
  GM.links = new Set();
  for (let k = 0; k < (D.links || []).length; k += 2) GM.links.add(D.links[k] + ',' + D.links[k + 1]);
  function parseStints(s) {
    const out = {};
    if (!s) return out;
    for (const part of s.split('|')) {
      const [ci, runs] = part.split(':');
      const ys = new Set();
      for (const run of runs.split('.')) {
        const [a, b] = run.split('-').map(Number);
        for (let y = a; y <= (isNaN(b) ? a : b); y++) ys.add(1992 + y);
      }
      out[D.clubs[+ci]] = ys;
    }
    return out;
  }
  function parseHon(s) {
    const h = {};
    for (const m of s.matchAll(/([A-Z])(\d+)/g)) h[m[1]] = +m[2];
    return h;
  }
  GM.clubs = D.clubs;
  GM.nats = D.nats;
  // "fame" weight – used so the reels lean towards players people have heard of
  GM.players.forEach(p => { p.pos = GM.GROUP[p.poss[0]]; p.fame = p.apps * (1 + p.goals / 30); p.key = GM.fold(p.name); });
})();

GM.POS_NAME = {
  GK: 'Goalkeeper', LB: 'Left-back', CB: 'Centre-back', RB: 'Right-back', LM: 'Left midfield', CM: 'Centre midfield',
  RM: 'Right midfield', ST: 'Striker', G: 'Goalkeeper', D: 'Defender', M: 'Midfielder', F: 'Forward',
};
GM.POS_SHORT = { GK: 'GK', LB: 'LB', CB: 'CB', RB: 'RB', LM: 'LM', CM: 'CM', RM: 'RM', ST: 'ST', G: 'GK', D: 'DEF', M: 'MID', F: 'FWD' };
GM.posBadges = p => p.poss.map(x => `<span class="pos pos-${GM.GROUP[x]}" title="${GM.POS_NAME[x]}">${x}</span>`).join('');

// Stats a draft can be played on
GM.STATS = {
  goals: { key: 'goals', label: 'goals', one: 'goal', icon: '⚽', name: 'Goals' },
  assists: { key: 'ast', label: 'assists', one: 'assist', icon: '🅰️', name: 'Assists' },
  apps: { key: 'apps', label: 'apps', one: 'app', icon: '🏃', name: 'Appearances' },
};

/** Were a and b teammates? Known club-season overlap, or a Transfermarkt "played with" link. */
GM.teammates = function (a, b) {
  const key = a.id < b.id ? a.id + ',' + b.id : b.id + ',' + a.id;
  if (GM.links.has(key)) return a.clubs.find(c => b.clubs.includes(c)) || true;
  for (const c in a.stints) {
    const bs = b.stints[c];
    if (!bs) continue;
    for (const y of a.stints[c]) if (bs.has(y)) return c;
  }
  return false;
};

GM.season = y => `${y}/${String((y + 1) % 100).padStart(2, '0')}`;
GM.currentSeason = Math.max(...window.PL_DATA.players.map(r => r[7]));
GM.era = p => p.last >= GM.currentSeason ? `${p.first}–now` : p.first === p.last ? GM.season(p.first) : `${p.first}–${p.last + 1}`;

/* ------------------------------------------------------------------ clubs */
GM.CLUB = {
  'AFC Bournemouth': ['BOU', '#d71920', '#000000'], 'Arsenal': ['ARS', '#ef0107', '#ffffff'],
  'Aston Villa': ['AVL', '#670e36', '#95bfe5'], 'Barnsley': ['BAR', '#d71920', '#ffffff'],
  'Birmingham City': ['BIR', '#0000ff', '#ffffff'], 'Blackburn Rovers': ['BLB', '#009ee0', '#ffffff'],
  'Blackpool': ['BLP', '#f68712', '#ffffff'], 'Bolton Wanderers': ['BOL', '#ffffff', '#263c7e'],
  'Bradford City': ['BRA', '#8c1d40', '#fdb913'], 'Brentford': ['BRE', '#e30613', '#ffffff'],
  'Brighton and Hove Albion': ['BHA', '#0057b8', '#ffffff'], 'Burnley': ['BUR', '#6c1d45', '#99d6ea'],
  'Cardiff City': ['CAR', '#0070b5', '#ffffff'], 'Charlton Athletic': ['CHA', '#d4021d', '#ffffff'],
  'Chelsea': ['CHE', '#034694', '#ffffff'], 'Coventry City': ['COV', '#59cbe8', '#0b1f3a'],
  'Crystal Palace': ['CRY', '#1b458f', '#ffffff'], 'Derby County': ['DER', '#ffffff', '#000000'],
  'Everton': ['EVE', '#003399', '#ffffff'], 'Fulham': ['FUL', '#ffffff', '#000000'],
  'Huddersfield Town': ['HUD', '#0e63ad', '#ffffff'], 'Hull City': ['HUL', '#f5a12d', '#000000'],
  'Ipswich Town': ['IPS', '#0044a9', '#ffffff'], 'Leeds United': ['LEE', '#ffffff', '#1d428a'],
  'Leicester City': ['LEI', '#003090', '#fdbe11'], 'Liverpool': ['LIV', '#c8102e', '#ffffff'],
  'Luton Town': ['LUT', '#f78f1e', '#002d62'], 'Manchester City': ['MCI', '#6cabdd', '#1c2c5b'],
  'Manchester United': ['MUN', '#da291c', '#fbe122'], 'Middlesbrough': ['MID', '#e11b22', '#ffffff'],
  'Newcastle United': ['NEW', '#241f20', '#ffffff'], 'Norwich City': ['NOR', '#fff200', '#00a650'],
  'Nottingham Forest': ['NFO', '#dd0000', '#ffffff'], 'Oldham Athletic': ['OLD', '#004a99', '#ffffff'],
  'Portsmouth': ['POR', '#001489', '#ffffff'], 'Queens Park Rangers': ['QPR', '#1d5ba4', '#ffffff'],
  'Reading': ['REA', '#004494', '#ffffff'], 'Sheffield United': ['SHU', '#ee2737', '#ffffff'],
  'Sheffield Wednesday': ['SHW', '#0e00f7', '#ffffff'], 'Southampton': ['SOU', '#d71920', '#ffffff'],
  'Stoke City': ['STK', '#e03a3e', '#ffffff'], 'Sunderland': ['SUN', '#eb172b', '#ffffff'],
  'Swansea City': ['SWA', '#ffffff', '#121212'], 'Swindon Town': ['SWI', '#d71920', '#ffffff'],
  'Tottenham Hotspur': ['TOT', '#ffffff', '#132257'], 'Watford': ['WAT', '#fbee23', '#ed2127'],
  'West Bromwich Albion': ['WBA', '#122f67', '#ffffff'], 'West Ham United': ['WHU', '#7a263a', '#1bb1e7'],
  'Wigan Athletic': ['WIG', '#1d59af', '#ffffff'], 'Wimbledon': ['WIM', '#1a2e5a', '#f5d130'],
  'Wolverhampton Wanderers': ['WOL', '#fdb913', '#231f20'],
};
GM.clubShort = c => (GM.CLUB[c] || [c.slice(0, 3).toUpperCase()])[0];
GM.clubChip = function (c, long) {
  const [s, bg, fg] = GM.CLUB[c] || [c.slice(0, 3).toUpperCase(), '#444', '#fff'];
  return `<span class="chip" style="--cb:${bg};--cf:${fg}" title="${c}">${long ? GM.esc(c) : s}</span>`;
};

/* ------------------------------------------------------------------ flags */
GM.ISO = {
  Albania: 'AL', Algeria: 'DZ', 'Antigua and Barbuda': 'AG', Argentina: 'AR', Armenia: 'AM', Australia: 'AU', Austria: 'AT',
  Bangladesh: 'BD', Barbados: 'BB', Belarus: 'BY', Belgium: 'BE', Benin: 'BJ', Bermuda: 'BM', 'Bosnia and Herzegovina': 'BA',
  Brazil: 'BR', Bulgaria: 'BG', 'Burkina Faso': 'BF', Burundi: 'BI', Cameroon: 'CM', Canada: 'CA', Chile: 'CL', China: 'CN',
  Colombia: 'CO', Congo: 'CG', 'Costa Rica': 'CR', Croatia: 'HR', Curacao: 'CW', 'Czech Republic': 'CZ', 'DR Congo': 'CD',
  Denmark: 'DK', Ecuador: 'EC', Egypt: 'EG', 'Equatorial Guinea': 'GQ', Estonia: 'EE', Finland: 'FI', France: 'FR', Gabon: 'GA',
  Gambia: 'GM', Georgia: 'GE', Germany: 'DE', Ghana: 'GH', Gibraltar: 'GI', Greece: 'GR', Grenada: 'GD', Guinea: 'GN',
  'Guinea-Bissau': 'GW', Guyana: 'GY', Haiti: 'HT', Honduras: 'HN', Hungary: 'HU', Iceland: 'IS', Iran: 'IR', Ireland: 'IE',
  Israel: 'IL', Italy: 'IT', 'Ivory Coast': 'CI', Jamaica: 'JM', Japan: 'JP', Kenya: 'KE', Latvia: 'LV', Mali: 'ML', Mexico: 'MX',
  Montserrat: 'MS', Morocco: 'MA', Netherlands: 'NL', 'New Zealand': 'NZ', Nigeria: 'NG', Norway: 'NO', Oman: 'OM',
  Paraguay: 'PY', Peru: 'PE', Poland: 'PL', Portugal: 'PT', Romania: 'RO', Russia: 'RU', Senegal: 'SN', Serbia: 'RS',
  Slovakia: 'SK', Slovenia: 'SI', 'South Africa': 'ZA', 'South Korea': 'KR', Spain: 'ES', Sweden: 'SE', Switzerland: 'CH',
  Togo: 'TG', 'Trinidad and Tobago': 'TT', Tunisia: 'TN', Turkey: 'TR', Ukraine: 'UA', 'United States': 'US', Uruguay: 'UY',
  Venezuela: 'VE', Zambia: 'ZM', Zimbabwe: 'ZW', 'Northern Ireland': 'GB',
};
GM.flag = function (nat) {
  if (!nat) return '🏳️';
  const sub = { England: 'gbeng', Scotland: 'gbsct', Wales: 'gbwls' }[nat];
  if (sub) return '🏴' + [...sub].map(c => String.fromCodePoint(0xE0000 + c.charCodeAt(0))).join('') + '\u{E007F}';
  const iso = GM.ISO[nat];
  return iso ? [...iso].map(c => String.fromCodePoint(0x1F1A5 + c.charCodeAt(0))).join('') : '🏳️';
};

/* ------------------------------------------------------------------ misc utils */
GM.esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
GM.$ = (sel, root = document) => root.querySelector(sel);
GM.$$ = (sel, root = document) => [...root.querySelectorAll(sel)];
GM.initials = name => name.split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 3).toUpperCase();
GM.today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
GM.sleep = ms => new Promise(r => setTimeout(r, ms));

GM.avatar = function (p, cls = '', plain = false) {
  // plain = hard mode: no photo, no club colours
  const [, bg, fg] = plain ? [0, '#23483b', '#e8f5ee'] : GM.CLUB[p.clubs[p.clubs.length - 1]] || [0, '#334', '#fff'];
  const img = p.code && !plain ? `<img loading="lazy" alt="" src="https://resources.premierleague.com/premierleague/photos/players/110x140/p${p.code}.png" onerror="this.remove()">` : '';
  return `<span class="avatar ${cls}" style="--cb:${bg};--cf:${fg}"><b>${GM.initials(p.name)}</b>${img}</span>`;
};

/* ------------------------------------------------------------------ seeded RNG */
GM.hash = function (str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0) * 4294967296 + (h1 >>> 0);
};
GM.rng = function (seed) {
  let a = GM.hash(String(seed)) >>> 0;
  const f = function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.int = n => Math.floor(f() * n);
  f.pick = arr => arr[Math.floor(f() * arr.length)];
  f.weighted = (arr, w) => {
    let tot = 0; for (const x of arr) tot += w(x);
    let r = f() * tot;
    for (const x of arr) { r -= w(x); if (r <= 0) return x; }
    return arr[arr.length - 1];
  };
  f.shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; };
  return f;
};
GM.newSeed = () => Math.random().toString(36).slice(2, 10);

/* ------------------------------------------------------------------ storage */
GM.store = {
  get(k, d) { try { const v = localStorage.getItem('gm:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('gm:' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
};

// Moving house: the old address (joelthornton.github.io/goal-machine/) forwards players here with their saved scores,
// album and settings packed into the link (#import=…). Merge them in, keeping the better of anything both sides have.
(function importFromOldAddress() {
  const m = location.hash.match(/^#import=([^&]*)(?:&r=(.*))?$/);
  if (!m) return;
  try {
    const data = JSON.parse(decodeURIComponent(escape(atob(m[1]))));
    const get = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
    for (const [k, raw] of Object.entries(data)) {
      if (!k.startsWith('gm:')) continue;
      const cur = get(k);
      let v; try { v = JSON.parse(raw); } catch (e) { continue; }
      if (cur == null) v = v;
      else if (k.startsWith('gm:best:')) v = Math.max(+cur || 0, +v || 0);
      else if (k.startsWith('gm:hist:') && Array.isArray(cur) && Array.isArray(v)) v = cur.concat(v).sort((a, b) => b.s - a.s).slice(0, 20);
      else if (k === 'gm:album' && cur && v) {
        v = { players: { ...v.players, ...cur.players }, ach: { ...v.ach, ...cur.ach }, days: [...new Set([...(v.days || []), ...(cur.days || [])])].slice(-60) };
      } else if (k === 'gm:played') v = (+cur || 0) + (+v || 0);
      else continue; // keep what's already here for settings, names etc.
      localStorage.setItem(k, JSON.stringify(v));
    }
  } catch (e) { /* bad or truncated link - just carry on */ }
  history.replaceState(null, '', location.pathname + location.search + (m[2] ? decodeURIComponent(m[2]) : '#/'));
})();

GM.getName = () => GM.store.get('name', '');
GM.askName = async function () {
  let n = GM.getName();
  if (n) return n;
  n = await GM.prompt('Pick a name for the leaderboard', '', 'e.g. Joel');
  n = (n || '').trim().slice(0, 20);
  if (n) GM.store.set('name', n);
  return n;
};

/* ------------------------------------------------------------------ modal / toast */
GM.toast = function (msg, ms = 2200) {
  const t = document.createElement('div');
  t.className = 'toast'; t.innerHTML = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, ms);
};
GM.modal = function (html, { onClose } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `<div class="modal" role="dialog">${html}</div>`;
  const close = () => { wrap.remove(); onClose && onClose(); };
  wrap.addEventListener('click', e => { if (e.target === wrap || e.target.closest('[data-close]')) close(); });
  document.body.appendChild(wrap);
  return { el: wrap.firstChild, close };
};
GM.prompt = function (title, value = '', placeholder = '') {
  return new Promise(res => {
    const m = GM.modal(`<h3>${GM.esc(title)}</h3><form><input class="input" maxlength="20" value="${GM.esc(value)}" placeholder="${GM.esc(placeholder)}" autofocus>
      <div class="row"><button type="button" class="btn ghost" data-close>Skip</button><button class="btn">Save</button></div></form>`, { onClose: () => res(null) });
    const f = m.el.querySelector('form');
    f.onsubmit = e => { e.preventDefault(); const v = f.querySelector('input').value; m.el.parentNode.remove(); res(v); };
    setTimeout(() => f.querySelector('input').focus(), 50);
  });
};

/* ------------------------------------------------------------------ share */
GM.share = async function (text, url) {
  const full = url ? `${text}\n${url}` : text;
  if (window.AndroidApp && window.AndroidApp.share) { window.AndroidApp.share(full); return; }  // Android app: native share sheet
  if (navigator.share) {
    try { await navigator.share({ text, url }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(full); GM.toast('Copied to clipboard 📋'); }
  catch (e) { GM.modal(`<h3>Copy this</h3><textarea class="input" rows="5">${GM.esc(full)}</textarea><div class="row"><button class="btn" data-close>Done</button></div>`); }
};
GM.APK_URL = 'https://github.com/OpportunisticGames/opportunisticgames.github.io/releases/latest/download/goal-machine.apk';
GM.baseUrl = () => location.href.split('#')[0].split('?')[0];

/* ------------------------------------------------------------------ player search (autocomplete) */
GM.search = function (q, limit = 8, pool = GM.players) {
  q = GM.fold(q);
  if (q.length < 2) return [];
  const words = q.split(' ');
  const res = [];
  for (const p of pool) {
    const k = p.key;
    let score = -1;
    if (k === q) score = 100;
    else if (k.startsWith(q)) score = 80;
    else if (words.every(w => k.split(' ').some(t => t.startsWith(w)))) score = 60;
    else if (k.includes(q)) score = 40;
    if (score >= 0) res.push([score + Math.min(19, p.fame / 100), p]);
  }
  res.sort((a, b) => b[0] - a[0]);
  return res.slice(0, limit).map(r => r[1]);
};

// plain: names only (no flag, positions or years) so the suggestions don't give clues away
GM.autocomplete = function (input, box, onPick, { exclude, plain } = {}) {
  let items = [], active = 0;
  const render = () => {
    box.innerHTML = items.map((p, i) => `<button type="button" class="ac-item ${i === active ? 'active' : ''}" data-i="${i}">
      ${plain ? `<span>${GM.esc(p.name)}</span>` : `<span>${GM.flag(p.nat)} ${GM.esc(p.name)}</span><small>${p.poss.join('/')} · ${GM.era(p)}</small>`}</button>`).join('');
    box.hidden = !items.length;
  };
  input.addEventListener('input', () => {
    items = GM.search(input.value, 8).filter(p => !(exclude && exclude(p)));
    active = 0; render();
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { active = Math.min(items.length - 1, active + 1); render(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { active = Math.max(0, active - 1); render(); e.preventDefault(); }
    else if (e.key === 'Enter') { e.preventDefault(); if (items[active]) choose(items[active]); }
  });
  box.addEventListener('click', e => { const b = e.target.closest('.ac-item'); if (b) choose(items[+b.dataset.i]); });
  function choose(p) { items = []; render(); input.value = ''; onPick(p); }
};

/* ------------------------------------------------------------------ scores + leaderboard */
GM.MODES = {
  ultimate: { name: 'Ultimate Wildcard', icon: '👑' },
  ultimateast: { name: 'Ultimate Wildcard – Assists', icon: '👑' },
  ultimateapps: { name: 'Ultimate Wildcard – Apps', icon: '👑' },
  target: { name: 'Target 500 – Goals', icon: '🎯' },
  targetast: { name: 'Target 350 – Assists', icon: '🎯' },
  targetapps: { name: 'Target 3,750 – Apps', icon: '🎯' },
  treble: { name: 'The Treble', icon: '🏆' },
  mystery: { name: 'Mystery Target', icon: '🎲' },
  daily: { name: 'Daily Ultimate', icon: '📅' },
  hopper: { name: 'Club Hopper', icon: '🦘' },
  hilo: { name: 'Higher or Lower', icon: '↕️' },
  whoami: { name: 'Who Am I?', icon: '🕵️' },
  grid: { name: 'Club Grid', icon: '#️⃣' },
  tally: { name: 'Guess the Tally', icon: '🔢' },
};

// Hard mode: games show names + positions only (no clubs, years, apps, nationality); Who Am I? saves the
// clubs for the last clue. Scores go to "<mode>h".
GM.HARD_MODES = ['ultimate', 'ultimateast', 'ultimateapps', 'target', 'targetast', 'targetapps', 'treble', 'mystery', 'hopper', 'grid', 'hilo', 'whoami', 'tally'];
GM.isHard = () => GM.store.get('hard', false);
GM.setHard = v => GM.store.set('hard', !!v);
Object.keys(GM.MODES).filter(k => GM.HARD_MODES.includes(k)).forEach(k => {
  GM.MODES[k + 'h'] = { name: GM.MODES[k].name + ' (Hard)', icon: GM.MODES[k].icon };
});

GM.best = mode => GM.store.get('best:' + mode, 0);

/** Records a finished game locally and (if configured) on the global board. Returns {isBest}. */
GM.recordScore = async function (mode, score, meta = {}) {
  const hist = GM.store.get('hist:' + mode, []);
  hist.push({ s: score, t: Date.now(), m: meta });
  hist.sort((a, b) => b.s - a.s);
  GM.store.set('hist:' + mode, hist.slice(0, 20));
  const isBest = score > GM.best(mode);
  if (isBest) GM.store.set('best:' + mode, score);
  GM.store.set('played', GM.store.get('played', 0) + 1);
  if (GM.lb.enabled && score > 0) {
    const name = await GM.askName();
    if (name) GM.lb.submit(mode, score, name, meta).catch(() => GM.toast('Could not reach the global leaderboard'));
  }
  return { isBest };
};

GM.lb = {
  get cfg() { return window.GM_CONFIG || {}; },
  get enabled() { return !!(this.cfg.supabaseUrl && this.cfg.supabaseAnonKey); },
  headers() {
    const k = this.cfg.supabaseAnonKey;
    const h = { apikey: k, 'Content-Type': 'application/json' };
    if (k.startsWith('eyJ')) h.Authorization = 'Bearer ' + k; // legacy JWT anon keys
    return h;
  },
  async submit(mode, score, name, meta) {
    const r = await fetch(`${this.cfg.supabaseUrl}/rest/v1/scores`, {
      method: 'POST', headers: { ...this.headers(), Prefer: 'return=minimal' },
      body: JSON.stringify({ mode, score, name, meta }),
    });
    if (!r.ok) throw new Error(await r.text());
  },
  async top(mode, limit = 25) {
    const r = await fetch(`${this.cfg.supabaseUrl}/rest/v1/best_scores?select=name,score,created_at&mode=eq.${encodeURIComponent(mode)}&order=score.desc,created_at.asc&limit=${limit}`,
      { headers: this.headers() });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
};

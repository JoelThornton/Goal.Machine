// A stand-in for the Supabase online_* functions (same rules as the SQL), shared by every test phone
module.exports = function makeServer() {
  const players = { alice: { username: 'Alice', key: 'a'.repeat(28) }, bob: { username: 'Bob', key: 'b'.repeat(28) }, cara: { username: 'Cara', key: 'c'.repeat(28) } };
  const rooms = {}, friends = new Set(), backups = {}, pics = {}, reports = []; let n = 0;
  const now = () => Date.now() / 1000;
  const auth = (u, k) => { const p = players[(u || '').toLowerCase()]; return p && p.key === k ? p.username : null; };
  const befriend = (a, b) => { friends.add(a + '|' + b); friends.add(b + '|' + a); };
  const finalise = r => {
    const h = r.race.host, g = r.race.guest;
    if (r.status === 'done' || !(h && h.done) || !(g && g.done)) return;
    const [wt, wr, ws] = r.kind === 'race' ? [50, 30, 20] : [60, 40, 0]; let hp = 0, gp = 0;
    const cmp = (a, b, w, low) => { if (low ? a < b : a > b) hp += w; else if (low ? b < a : b > a) gp += w; else { hp += w / 2; gp += w / 2; } };
    if (r.kind === 'race' && r.variant === 'target') cmp(h.d ?? 1e9, g.d ?? 1e9, 100, true);
    else if (r.kind === 'race' && r.variant === 'chaos') cmp(h.c || 0, g.c || 0, 100);
    else { cmp(h.t || 0, g.t || 0, wt); cmp(h.r || 0, g.r || 0, wr); if (ws) cmp(h.ms ?? 1e12, g.ms ?? 1e12, ws, true); }
    r.status = 'done'; r.turn = null; r.result = { host: hp, guest: gp, winner: hp > gp ? 'host' : gp > hp ? 'guest' : 'draw' };
  };
  const view = r => ({ bids_in: Object.keys(r.secret || {}).filter(k => k === 'host' || k === 'guest'), code: r.code, kind: r.kind, variant: r.variant, stat: r.stat, seed: r.seed, host: r.host, guest: r.guest, moves: r.moves, race: r.race, turn: r.turn, status: r.status, result: r.result, seen: r.seen, now: now(), updated: r.updated });
  const fns = {
    claim_name: a => { const k = a.p_username.toLowerCase(); if (players[k] && players[k].key !== a.p_key) return 'taken'; players[k] = { username: a.p_username, key: a.p_key }; return 'ok'; }, name_available: a => true, submit_score: a => 'ok',
    online_create(a) {
      const u = auth(a.p_user, a.p_key); if (!u) return { error: 'auth' };
      let o = null; if (a.p_opp) { o = (players[a.p_opp.toLowerCase()] || {}).username; if (!o) return { error: 'no_user' }; if (o === u) return { error: 'self' }; }
      const code = 'R' + String(++n).padStart(4, '0');
      rooms[code] = { code, kind: a.p_kind, secret: {}, variant: a.p_variant || null, stat: a.p_stat, seed: 'online:' + code + ':t', host: u, guest: o, moves: [], race: {}, turn: a.p_kind === 'duel' ? 'guest' : a.p_kind === 'auction' ? 'both' : 'host', status: o ? 'playing' : 'open', result: null, seen: {}, updated: new Date().toISOString() };
      if (o) befriend(u, o); return { code, seat: 'host' };
    },
    online_join(a) {
      const u = auth(a.p_user, a.p_key); if (!u) return { error: 'auth' }; const r = rooms[a.p_code]; if (!r) return { error: 'no_room' };
      if (r.host === u) return { code: r.code, seat: 'host' }; if (r.guest === u) return { code: r.code, seat: 'guest' };
      if (r.guest) return { error: 'full' }; r.guest = u; r.status = 'playing'; befriend(u, r.host); return { code: r.code, seat: 'guest' };
    },
    online_get(a) { const r = rooms[a.p_code]; if (!r) return null; const s = r.host === a.p_user ? 'host' : r.guest === a.p_user ? 'guest' : null; if (s) r.seen[s] = now(); return view(r); },
    online_move(a) {
      const u = auth(a.p_user, a.p_key); if (!u) return 'auth'; const r = rooms[a.p_code]; if (!r) return 'no_room';
      const s = r.host === u ? 'host' : r.guest === u ? 'guest' : null; if (!s) return 'not_yours'; if (['done', 'declined'].includes(r.status)) return 'over';
      if (a.p_move) { if (r.moves.length !== a.p_seq) return 'conflict'; r.moves.push({ ...a.p_move, s }); }
      if (a.p_all && ['duel', 'auction'].includes(r.kind)) Object.assign(r.race, a.p_all); else if (a.p_sum) r.race[s] = a.p_sum;
      if (a.p_turn === 'none') r.turn = null; else if (['host', 'guest', 'both'].includes(a.p_turn)) r.turn = a.p_turn;
      r.updated = new Date().toISOString(); finalise(r); return 'ok';
    },
    online_bid(a) {
      const u = auth(a.p_user, a.p_key); const r = rooms[a.p_code]; const s = r.host === u ? 'host' : r.guest === u ? 'guest' : null;
      if (!s) return 'not_yours'; if (r.kind !== 'auction' || ['done', 'declined'].includes(r.status)) return 'over';
      if (a.p_lot !== r.moves.length) return 'stale';
      let sec = r.secret.lot === a.p_lot ? r.secret : { lot: a.p_lot };
      const need = sec.need || a.p_need || 'both'; if (need !== 'both' && need !== s) return 'not_needed';
      sec = { ...sec, need, [s]: a.p_bid };
      if ((need === 'both' && 'host' in sec && 'guest' in sec) || (need !== 'both' && need in sec)) {
        const bids = {}; if ('host' in sec) bids.host = sec.host; if ('guest' in sec) bids.guest = sec.guest;
        r.moves.push({ lot: a.p_lot, bids }); r.secret = {}; return 'sold';
      }
      r.secret = sec; return 'waiting';
    },
    friends_week(a) {
      const u = auth(a.p_user, a.p_key); if (!u) return null;
      const names = [u, ...[...friends].filter(f => f.startsWith(u + '|')).map(f => f.split('|')[1])];
      return names.map(n => ({ name: n, score: n === 'Bob' ? 420 : n === u ? 380 : 0, games: n === u ? 2 : 1, me: n === u })).sort((x, y) => y.score - x.score);
    },
    save_backup(a) { const u = auth(a.p_user, a.p_key); if (!u) return 'auth'; backups[u] = { data: a.p_data, updated: new Date().toISOString() }; return 'ok'; },
    load_backup(a) { const u = auth(a.p_user, a.p_key); if (!u) return null; return backups[u] || { none: true }; },
    delete_account(a) { const u = auth(a.p_user, a.p_key); if (!u) return 'auth'; delete players[u.toLowerCase()]; return 'deleted'; },
    set_avatar(a) { const u = auth(a.p_user, a.p_key); if (!u) return 'auth'; if (a.p_image && !/^data:image\/(jpeg|webp|png);base64,/.test(a.p_image)) return 'bad_image'; pics[u] = a.p_image; return 'ok'; },
    get_avatars(a) { const out = {}; (a.p_names || []).forEach(n => { const k = Object.keys(pics).find(x => x.toLowerCase() === n.toLowerCase()); if (k && pics[k]) out[k] = pics[k]; }); return out; },
    report_avatar(a) { reports.push([a.p_user, a.p_target]); return reports.filter(r => r[1] === a.p_target).length >= 3 ? 'removed' : 'ok'; },
    online_remove_friend(a) { const u = auth(a.p_user, a.p_key); friends.delete(u + '|' + a.p_friend); return 'ok'; },
    online_resign(a) {
      const u = auth(a.p_user, a.p_key); const r = rooms[a.p_code]; const s = r.host === u ? 'host' : 'guest';
      if (!r.guest) { delete rooms[a.p_code]; return 'cancelled'; }
      const played = r.race[s] || r.moves.some(m => m.s === s);
      if (!played) { r.status = 'declined'; return 'declined'; }
      r.status = 'done'; r.result = { host: s === 'host' ? 0 : 100, guest: s === 'guest' ? 0 : 100, winner: s === 'host' ? 'guest' : 'host', resigned: s }; return 'resigned';
    },
    online_games(a) {
      const u = auth(a.p_user, a.p_key); if (!u) return null;
      return Object.values(rooms).filter(r => (r.host === u || r.guest === u) && r.status !== 'declined').reverse()
        .map(r => ({ bids_in: Object.keys(r.secret || {}).filter(k => k === 'host' || k === 'guest'), code: r.code, kind: r.kind, variant: r.variant, stat: r.stat, host: r.host, guest: r.guest, turn: r.turn, status: r.status, result: r.result, updated: r.updated, nmoves: r.moves.length,
          sums: Object.fromEntries(Object.entries(r.race).map(([k, v]) => { const { x, ...rest } = v; return [k, rest]; })) }));
    },
    online_friends(a) {
      const u = auth(a.p_user, a.p_key); if (!u) return null;
      return [...friends].filter(f => f.startsWith(u + '|')).map(f => f.split('|')[1]).map(name => {
        const done = Object.values(rooms).filter(r => r.status === 'done' && ((r.host === u && r.guest === name) || (r.guest === u && r.host === name)));
        const mine = r => (r.host === u ? 'host' : 'guest');
        return { name, w: done.filter(r => r.result.winner === mine(r)).length, d: done.filter(r => r.result.winner === 'draw').length, l: done.filter(r => r.result.winner !== 'draw' && r.result.winner !== mine(r)).length };
      });
    },
    online_add_friend(a) { const u = auth(a.p_user, a.p_key); const o = (players[a.p_friend.toLowerCase()] || {}).username; if (!o) return 'no_user'; if (o === u) return 'self'; friends.add(u + '|' + o); return 'ok'; },
    online_waiting(a) {
      const u = (players[a.p_user.toLowerCase()] || {}).username;
      return Object.values(rooms).filter(r => r.status === 'playing' && (r.host === u || r.guest === u)).filter(r => { const s = r.host === u ? 'host' : 'guest'; return r.kind === 'duel' ? r.turn === s : !(r.race[s] || {}).done; })
        .map(r => ({ code: r.code, kind: r.kind, variant: r.variant, opp: r.host === u ? r.guest : r.host }));
    },
  };
  return {
    rooms, fns,
    async attach(ctx) {
      await ctx.route('**/rest/v1/rpc/*', async route => {
        const fn = route.request().url().split('/rpc/')[1].split('?')[0], args = JSON.parse(route.request().postData() || '{}');
        if (!fns[fn]) return route.fulfill({ status: 404, body: 'no fn ' + fn });
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fns[fn](args) ?? null) });
      });
      await ctx.route('**/rest/v1/**', r => r.request().url().includes('/rpc/') ? r.fallback() : r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    },
  };
};

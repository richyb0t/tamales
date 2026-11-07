/* Reportes · comparativo, vendedores, merma y control de cortes. */

const dlt = (c, p, inv) => {
  if (p == null) return '';
  if (!p) return c ? '<small class="mut">antes: sin ventas</small>' : '';
  const x = (c / p - 1) * 100;
  if (Math.abs(x) < 0.5) return '<small class="mut">= igual</small>';
  const up = x > 0;
  return `<small class="${(inv ? !up : up) ? 'ok' : 'bad'}">${up ? '▲' : '▼'} ${Math.abs(Math.round(x))}%</small>`;
};

function rpCmp(rows, prev) {
  const r = S.rp,
    a = rpS(rows),
    b = rpS(prev);
  const L = [
    ['Total neto', money(a.net), money(b.net), dlt(a.net, b.net)],
    ['Pedidos', a.n, b.n, dlt(a.n, b.n)],
    ['Ticket promedio', money(a.tk), money(b.tk), dlt(a.tk, b.tk)],
    ['Piezas por pedido', a.pp.toFixed(1), b.pp.toFixed(1), dlt(a.pp, b.pp)],
    ['Promedio por día', money(a.avg), money(b.avg), dlt(a.avg, b.avg)],
    ['Devoluciones', money(a.dr), money(b.dr), dlt(a.dr, b.dr, 1)],
  ];
  return `<div class="card"><h3>Contra el periodo anterior</h3><small>Antes: ${fdd(r.pf)} al ${fdd(r.pt)}</small><div class="wrap"><table><tr><th></th><th>Ahora</th><th>Antes</th><th>Cambio</th></tr>${L.map(x => `<tr><td>${x[0]}</td><td>${x[1]}</td><td>${x[2]}</td><td>${x[3]}</td></tr>`).join('')}</table></div></div>`;
}

function rpSell(rows) {
  const m = {},
    un = u => (S.users.find(x => x.user == u) || {}).name || u || '—';
  rows.forEach(s => {
    const x = (m[s.by] = m[s.by] || { a: 0, d: 0, o: {} }),
      v = nz(s.qty) * nz(s.price);
    if (s.type == 'devolucion') x.d += v;
    else {
      x.a += v;
      x.o[okey(s)] = 1;
    }
  });
  const l = Object.entries(m)
    .map(([u, x]) => {
      const o = Object.keys(x.o).length;
      return { n: un(u), net: x.a - x.d, o, tk: o ? x.a / o : 0, dp: x.a ? (x.d / x.a) * 100 : 0 };
    })
    .sort((a, b) => b.net - a.net);
  if (!l.length) return '';
  return `<div class="card"><h3>Ventas por vendedor</h3><div class="wrap"><table><tr><th>Vendedor</th><th>Neto</th><th>Pedidos</th><th>Ticket</th><th>Devol.</th></tr>${l.map((x, i) => `<tr><td>${esc(x.n)}${i == 0 && l.length > 1 ? ' ⭐' : ''}</td><td>${money(x.net)}</td><td>${x.o}</td><td>${money(x.tk)}</td><td${x.dp >= 8 ? ' class="bad"' : ''}>${x.dp.toFixed(1)}%</td></tr>`).join('')}</table></div><small>Devol. es el % de lo vendido que se devolvió${l.some(x => x.dp >= 8) ? '; en rojo, 8% o más: conviene revisar' : ''}.</small></div>`;
}

/* Merma y sobrantes: compara lo cargado con lo vendido. Lee las cargas del periodo (1 documento por sucursal y día) y solo la primera vez */
const lpk = d => {
  const q = d.q || {};
  return [d.branch, F.map((_, f) => +q['f' + f] || 0), +q.ch || 0];
};

async function rpMerma(force) {
  const r = S.rp;
  if (!r || !r.rows) return;
  if (force === 1) rcClear('loads', r.from, r.to);
  r.mm = { busy: true };
  render(true);
  try {
    const x = await rcFetch('loads', 'loads', r.from, r.to, lpk);
    r.mm = { rows: x.rows, reads: x.reads };
  } catch (e) {
    r.mm = null;
    err(e);
  }
  render(true);
}

function rpMermaHtml(r) {
  const m = r.mm;
  if (!m) return '';
  if (m.busy) return '<div class="card"><small>Leyendo las cargas del periodo…</small></div>';
  const ok = b => r.br == null || b == r.br,
    ld = {},
    use = {};
  m.rows.forEach(([d, a]) => {
    if (ok(a[0])) ld[d + '|' + a[0]] = a;
  });
  r.rows.forEach(s => {
    if (!ok(s.branch)) return;
    const k = s.day + '|' + s.branch;
    if (!ld[k]) return;
    const u = (use[k] = use[k] || {});
    u[s.f] = (u[s.f] || 0) + (s.type == 'devolucion' ? (s.restock ? -1 : 0) : 1) * nz(s.qty);
  });
  const st = F.map(() => ({ c: 0, u: 0, s: 0, ag: 0, k: 0 })),
    ch = { c: 0, u: 0, s: 0, ag: 0, k: 0 },
    dias = new Set();
  Object.entries(ld).forEach(([k, a]) => {
    const u = use[k] || {};
    dias.add(k.split('|')[0]);
    F.forEach((_, f) => {
      const c = a[1][f];
      if (c <= 0) return;
      const us = Math.max(0, u[f] || 0),
        x = st[f];
      x.c += c;
      x.u += us;
      x.s += Math.max(0, c - us);
      x.k++;
      if (us >= c) x.ag++;
    });
    const lc = a[2];
    if (lc > 0) {
      const us = Math.max(
        0,
        CL.reduce((t, v, i) => t + (u[100 + i] || 0) * v, 0)
      );
      ch.c += lc;
      ch.u += us;
      ch.s += Math.max(0, lc - us);
      ch.k++;
      if (us >= lc - 1e-9) ch.ag++;
    }
  });
  const rows = F.map((n, f) => ({ n, f, ...st[f] })).filter(x => x.k && rpCatOk(r.cat, x.f));
  if (ch.k && (r.cat == 't' || r.cat == 'b'))
    rows.push({ n: 'Champurrado (L)', f: 100, L: 1, ...ch, c: r2(ch.c), u: r2(ch.u), s: r2(ch.s) });
  const head = `<div class="card"><h3>Merma y sobrantes</h3>`;
  if (!rows.length) return head + '<small>No hay cargas guardadas en este periodo.</small></div>';
  rows.forEach(x => {
    x.p = x.c ? (x.s / x.c) * 100 : 0;
    x.a = x.k ? x.ag / x.k : 0;
  });
  rows.sort((a, b) => b.p - a.p);
  const val = rows.filter(x => !x.L).reduce((t, x) => t + x.s * price(x.f), 0),
    cost = rows.filter(x => !x.L).reduce((t, x) => t + x.s * cst(x.f), 0),
    baja = rows.filter(x => x.p >= 20 && x.a < 0.5).map(x => esc(x.n)),
    sube = rows.filter(x => x.a >= 0.5).map(x => esc(x.n));
  return (
    head +
    `<small>${dias.size} día${dias.size == 1 ? '' : 's'} con carga${r.br != null ? ' · ' + esc(brs()[r.br]) : ''}</small>
 <p style="margin:8px 0">Lo que sobró de tamales equivale a <b>${money(Math.round(val))}</b> a precio de venta${cost > 0 ? ' (<b>' + money(Math.round(cost)) + '</b> de costo)' : ''}.</p>
 ${baja.length ? `<p style="margin:6px 0">📉 <b>Considera bajar la carga de:</b> ${baja.join(', ')}.</p>` : ''}${sube.length ? `<p style="margin:6px 0">📈 <b>Se agotan seguido, considera subir:</b> ${sube.join(', ')}.</p>` : ''}
 <div class="wrap"><table><tr><th>Sabor</th><th>Cargado</th><th>Vendido</th><th>Sobró</th><th>% sobró</th><th>Se agotó</th></tr>${rows.map(x => `<tr><td>${esc(x.n)}</td><td>${x.c}</td><td>${x.u}</td><td>${x.s}</td><td class="${x.p >= 35 ? 'bad' : x.p >= 20 ? 'low' : ''}">${Math.round(x.p)}%</td><td class="${x.a >= 0.5 ? 'low' : ''}">${x.ag}/${x.k} días</td></tr>`).join('')}</table></div>
 <small>Sobró = cargado − vendido, por día y sucursal. No considera traspasos entre sucursales ni apartados sin entregar, así que es una estimación.</small></div>`
  );
}

/* Cortes de caja y anulaciones por persona (cortes y bitácora del periodo, solo la primera vez) */
const cpk = d => [d.branch, d.by || '', d.name || d.by || '', +d.dif || 0, +d.entregar || 0];

const gpk = d => [
  d.branch == null ? -1 : d.branch,
  d.branch2 == null ? -1 : d.branch2,
  d.by || '',
  d.byName || d.by || '',
  +d.amt || 0,
];

async function rpControl(force) {
  const r = S.rp;
  if (!r || !r.rows) return;
  if (force === 1) {
    rcClear('cuts', r.from, r.to);
    rcClear('logs', r.from, r.to);
  }
  r.ct = { busy: true };
  render(true);
  try {
    const a = await rcFetch('cuts', 'cuts', r.from, r.to, cpk),
      b = await rcFetch('logs', 'logs', r.from, r.to, gpk);
    r.ct = { cuts: a.rows, logs: b.rows, reads: a.reads + b.reads };
  } catch (e) {
    r.ct = null;
    err(e);
  }
  render(true);
}

function rpControlHtml(r) {
  const m = r.ct;
  if (!m) return '';
  if (m.busy) return '<div class="card"><small>Leyendo cortes y anulaciones…</small></div>';
  const v = {},
    g = (u, n) => (v[u] = v[u] || { n, c: 0, dif: 0, fal: 0, sob: 0, ent: 0, an: 0, am: 0 });
  m.cuts.forEach(([d, a]) => {
    if (r.br != null && a[0] != r.br) return;
    const x = g(a[1], a[2]);
    x.c++;
    x.dif += a[3];
    x.ent += a[4];
    if (a[3] < 0) x.fal++;
    else if (a[3] > 0) x.sob++;
  });
  m.logs.forEach(([d, a]) => {
    if (r.br != null && a[0] != r.br && a[1] != r.br) return;
    if (!a[2]) return;
    const x = g(a[2], a[3]);
    x.an++;
    x.am += a[4];
  });
  const l = Object.values(v).sort((a, b) => a.dif - b.dif),
    head = `<div class="card"><h3>Cortes de caja y anulaciones</h3>`;
  if (!l.length) return head + '<small>No hay cortes ni anulaciones en este periodo.</small></div>';
  const rev = l
    .filter(x => x.fal >= 2 || x.an >= 5)
    .map(
      x =>
        esc(x.n) +
        (x.fal >= 2 ? ' (' + x.fal + ' cortes con faltante)' : '') +
        (x.an >= 5 ? ' (' + x.an + ' anulaciones)' : '')
    );
  return (
    head +
    `${rev.length ? `<p style="margin:6px 0">⚠️ <b>Conviene revisar:</b> ${rev.join(', ')}.</p>` : ''}<div class="wrap"><table><tr><th>Persona</th><th>Cortes</th><th>Diferencia</th><th>Faltó</th><th>Sobró</th><th>Entregó</th><th>Anulac.</th></tr>${l.map(x => `<tr><td>${esc(x.n)}</td><td>${x.c}</td><td class="${x.dif < 0 ? 'bad' : x.dif > 0 ? 'low' : ''}">${money(r2(x.dif))}</td><td>${x.fal}</td><td>${x.sob}</td><td>${money(x.ent)}</td><td>${x.an ? x.an + ' · ' + money(x.am) : '–'}</td></tr>`).join('')}</table></div><small>Diferencia: lo contado menos lo esperado (negativo = faltó dinero). Faltó/Sobró cuentan cuántos cortes salieron así. Anulac.: ventas, apartados o traspasos anulados y cancelados.</small></div>`
  );
}

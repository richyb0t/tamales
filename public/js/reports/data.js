/* Reportes · rango de fechas, filtros, caché local de días cerrados y consulta a Firestore. */

const rpA = a => a.reduce((x, s) => x + s.qty * s.price, 0);

/* Filtros del reporte: se aplican en el celular sobre lo ya descargado (no gastan lecturas) */
const rpKeep = () => {
  const r = S.rp || {};
  return { br: r.br == null ? null : r.br, cat: r.cat || 't', cmp: !!r.cmp, gr: r.gr !== false };
};

const rpCatOk = (c, f) =>
  c == 'b' ? f >= 100 : c == 'd' ? f >= 8 && f < 100 : c == 's' ? f < 8 : true;

const rpF = rows => {
  const r = S.rp || {};
  return rows.filter(
    s => s.type != 'apartado' && (r.br == null || s.branch == r.br) && rpCatOk(r.cat, s.f)
  );
};

const rpScope = () => {
  const r = S.rp || {},
    c = { s: 'Salados', d: 'Dulces', b: 'Bebidas' }[r.cat];
  return [r.br != null ? brs()[r.br] : '', c || ''].filter(Boolean).join(' · ');
};

function rpSetRange(f, t) {
  S.rp = { ...rpKeep(), from: f, to: t, rows: null };
  render(true);
}

function rpRange(n) {
  rpSetRange(dayAdd(D, -n + 1), D);
}

function rpMonth() {
  rpSetRange(D.slice(0, 8) + '01', D);
}

function rpPreset(k) {
  let f, t;
  if (k == 'hoy') f = t = D;
  else if (k == 'ayer') f = t = dayAdd(D, -1);
  else if (k == 'sem') {
    const m = dayAdd(D, -((new Date().getDay() + 6) % 7) - 7);
    f = m;
    t = dayAdd(m, 6);
  } else {
    const n = new Date();
    f = dstr(new Date(n.getFullYear(), n.getMonth() - 1, 1));
    t = dstr(new Date(n.getFullYear(), n.getMonth(), 0));
  }
  rpSetRange(f, t);
}

function rpDate(k, v) {
  const r = S.rp;
  if (!v) return;
  r[k] = v;
  if (r.rows) {
    r.rows = null;
    r.prev = null;
    r.mm = null;
    r.ct = null;
  }
  render(true);
}

/* ---- Caché de días cerrados ----
   Un día que ya pasó no cambia: se lee de Firestore una sola vez y se guarda en este dispositivo.
   Así repetir un reporte, cambiar de rango o comparar con el periodo anterior casi no gasta lecturas.
   Hoy siempre se lee de nuevo. Cada consulta pide solo los tramos de días que faltan. */
const RC = {},
  RCK = 'tm_rc1_';

function rcGet(n) {
  if (!RC[n]) {
    let o = {};
    try {
      o = JSON.parse(localStorage.getItem(RCK + n) || '{}') || {};
    } catch (e) {}
    RC[n] = o;
  }
  return RC[n];
}

function rcSave(n) {
  const o = RC[n],
    ks = Object.keys(o).sort();
  let t = '';
  for (;;) {
    t = JSON.stringify(o);
    if (t.length <= 1500000 || ks.length <= 7) break;
    delete o[ks.shift()];
  }
  while (ks.length > 150) {
    delete o[ks.shift()];
  }
  try {
    localStorage.setItem(RCK + n, JSON.stringify(o));
  } catch (e) {
    try {
      localStorage.removeItem(RCK + n);
    } catch (_) {}
  }
}

function rcClear(n, f, t) {
  const c = rcGet(n);
  dayList(f, t).forEach(d => delete c[d]);
}

async function rcFetch(n, col, f, t, pack) {
  const c = rcGet(n),
    days = dayList(f, t),
    out = {},
    need = d => d >= D || !c[d];
  let reads = 0,
    i = 0;
  while (i < days.length) {
    if (!need(days[i])) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < days.length && need(days[j + 1])) j++;
    const q = await db
        .collection(col)
        .where('day', '>=', days[i])
        .where('day', '<=', days[j])
        .get(),
      g = {};
    q.docs.forEach(d => {
      const x = d.data(),
        k = pack(x, d.id);
      if (k) (g[x.day] = g[x.day] || []).push(k);
    });
    reads += q.docs.length;
    for (let k = i; k <= j; k++) {
      const d = days[k];
      out[d] = g[d] || [];
      if (d < D) c[d] = out[d];
    }
    i = j + 1;
  }
  if (reads) rcSave(n);
  const rows = [];
  days.forEach(d => (out[d] || c[d] || []).forEach(x => rows.push([d, x])));
  return { rows, reads };
}

const rpEst = (n, per) => {
  const c = rcGet(n),
    r = S.rp;
  return dayList(r.from, r.to).filter(d => d >= D || !c[d]).length * per;
};

/* Venta compacta (se omiten los apartados sin entregar): [sucursal,sabor,cant,precio,tipo,hora,vendedor,pedido,regresa,motivo] */
const spk = (d, id) =>
  d.type == 'apartado'
    ? null
    : [
        d.branch,
        d.f,
        d.qty,
        d.price,
        d.type == 'devolucion' ? 'd' : 'v',
        d.ts,
        d.by || '',
        d.order || d.pre || d.req || id,
        d.restock ? 1 : 0,
        d.type == 'devolucion' ? d.reason || '' : '',
      ];

const sup = ([day, a]) => ({
  day,
  branch: a[0],
  f: a[1],
  qty: a[2],
  price: a[3],
  type: a[4] == 'd' ? 'devolucion' : 'vendido',
  ts: a[5],
  by: a[6],
  order: a[7],
  restock: a[8] == 1,
  reason: a[9],
});

async function rpRun(force) {
  const r = S.rp || {};
  if (!r.from || !r.to || r.from > r.to) return toast('Revisa las fechas');
  if (r.to > D) r.to = D;
  r.fo = false;
  const len = dayDiff(r.from, r.to) + 1;
  if (len > 92) return toast('Máximo 3 meses por consulta');
  const f = r.from,
    t = r.to,
    keep = rpKeep(),
    pf = dayAdd(f, -len),
    pt = dayAdd(f, -1);
  if (force === 1) rcClear('sales', keep.cmp ? pf : f, t);
  S.rp = { ...keep, from: f, to: t, rows: null, busy: true };
  render(true);
  try {
    const a = await rcFetch('sales', 'sales', f, t, spk);
    let reads = a.reads,
      prev = null;
    if (keep.cmp) {
      const b = await rcFetch('sales', 'sales', pf, pt, spk);
      reads += b.reads;
      prev = b.rows.map(sup);
    }
    S.rp = {
      ...keep,
      from: f,
      to: t,
      busy: false,
      reads,
      stamp: Date.now(),
      rows: a.rows.map(sup),
      prev,
      pf,
      pt,
    };
  } catch (e) {
    S.rp = { ...keep, from: f, to: t, rows: null };
    err(e);
  }
  render(true);
}

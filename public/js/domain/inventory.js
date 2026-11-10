/* Reglas de inventario: precios, existencias, carga, champurrado y apartados que descuentan. */

const brs = () => S.cfg.branches || [1, 2, 3, 4, 5].map(n => 'Sucursal ' + n);

const fondo = () => (S.cfg.fondo == null ? 250 : +S.cfg.fondo);

const isOpen = i => !(S.cfg.closed || []).includes(i);

const BI = () =>
  brs()
    .map((_, i) => i)
    .filter(isOpen);

const price = f => +(S.cfg.prices || {})['f' + f] || (f >= 100 ? CH[f - 100][2] : 0);

/* Nombre del primer sabor (de una lista de sabores) que no tiene precio; null si todos tienen */
const noPrice = ks => {
  const f = ks.find(k => k < 100 && !price(k));
  return f == null ? null : nm(f);
};

const load = (b, f) => +(S.loads[b] || {})['f' + f] || 0;

const used = (b, f) =>
  S.sales
    .filter(s => s.branch == b && s.f == f && !s.dv)
    .reduce(
      (a, s) =>
        a +
        (s.type == 'devolucion'
          ? s.restock
            ? -s.qty
            : 0
          : s.type == 'apartado' && s.exp && s.exp < Date.now()
            ? 0
            : s.qty),
      0
    );

const net = (b, f) =>
  S.sales
    .filter(s => s.branch == b && s.f == f && !s.dv)
    .reduce((a, s) => a + (s.type == 'vendido' ? s.qty : s.type == 'devolucion' ? -s.qty : 0), 0);

const tx = (b, f, k) =>
  S.tr.filter(t => t[k] == b).reduce((a, t) => a + (+(t.q || {})['f' + f] || 0), 0);

const CL = [0.25, 0.5, 1],
  r2 = x => Math.round(x * 100) / 100;

const chLoad = b => +(S.loads[b] || {}).ch || 0;

const txc = (b, k) => S.tr.filter(t => t[k] == b).reduce((a, t) => a + (+(t.q || {}).ch || 0), 0);

const chUsed = b =>
  S.sales
    .filter(s => s.branch == b && s.f >= 100 && !s.dv)
    .reduce(
      (a, s) => a + (s.type == 'devolucion' ? (s.restock ? -1 : 0) : 1) * s.qty * CL[s.f - 100],
      0
    );

const chResv = b =>
  S.pre
    .filter(p => p.branch == b && p.date == D && !(p.exp && p.exp < Date.now()))
    .reduce(
      (a, p) =>
        a +
        Object.entries(p.items || {})
          .filter(([k]) => +k.slice(1) >= 100)
          .reduce((x, [k, v]) => x + (+v || 0) * CL[+k.slice(1) - 100], 0),
      0
    );

const chDvResv = b =>
  (S.dv || [])
    .filter(d => d.branch == b && d.day == D && d.status != 'cancelado' && !d.large)
    .reduce(
      (a, d) =>
        a +
        Object.entries(d.items || {})
          .filter(([k]) => +k.slice(1) >= 100)
          .reduce((x, [k, v]) => x + (+v || 0) * CL[+k.slice(1) - 100], 0),
      0
    );

const chLeft = b => r2(chLoad(b) - chUsed(b) - chResv(b) - chDvResv(b) + txc(b, 'to') - txc(b, 'from'));

const cartLit = x =>
  Object.entries(S.cart).reduce((a, [f, q]) => a + (f >= 100 && f != x ? q * CL[f - 100] : 0), 0);

const loadDone = b => S.loads[b] !== undefined;

const pendAc = b => S.pre.filter(p => p.branch == b && p.date == D && !p.ok);

const resv = (b, f) =>
  S.pre
    .filter(p => p.branch == b && p.date == D && !(p.exp && p.exp < Date.now()))
    .reduce((a, p) => a + (+(p.items || {})['f' + f] || 0), 0);

/* Tamales comprometidos en repartos del día (pendiente/en camino/entregado): no disponibles para venta en mostrador */
const dvResv = (b, f) =>
  (S.dv || [])
    .filter(d => d.branch == b && d.day == D && d.status != 'cancelado' && !d.large)
    .reduce((a, d) => a + (+(d.items || {})['f' + f] || 0), 0);

const left = (b, f) => {
  if (f >= 100) {
    const dvCh = dvResv(b, f) * CL[f - 100];
    return Math.max(0, Math.floor((chLeft(b) - dvCh + 1e-9) / CL[f - 100]));
  }
  return Math.max(0, load(b, f) - used(b, f) + tx(b, f, 'to') - tx(b, f, 'from') - resv(b, f) - dvResv(b, f));
};

const holdMin = () => (S.cfg.hold == null ? 60 : +S.cfg.hold),
  lowT = () => (S.cfg.low == null ? 3 : +S.cfg.low),
  lowL = () => (S.cfg.lowl == null ? 1 : +S.cfg.lowl);

const live = s => !(s.type == 'apartado' && s.exp && s.exp < Date.now());

/* Los apartados de hoy se suman solos a la carga al guardar el inventario */
const paNow = (b, f) => {
  const r = resv(b, f);
  if (!loadDone(b)) return r;
  const fz = +((S.loads[b] || {}).pa || {})['f' + f] || 0,
    dl = S.sales
      .filter(x => x.branch == b && x.f == f && x.pre && x.type == 'vendido')
      .reduce((a, x) => a + x.qty, 0);
  return Math.max(r, Math.min(fz, r + dl));
};

const loadEmpty = b => loadDone(b) && !F.some((_, f) => load(b, f) + tx(b, f, 'to') > 0);

const encBlk = b => S.me && S.me.role == 'enc' && loadDone(b) && !loadEmpty(b);

const cst = f => +(S.cfg.costs || {})['f' + f] || 0,
  hasCost = () =>
    F.map((_, f) => f)
      .concat(100, 101, 102)
      .some(f => cst(f) > 0);

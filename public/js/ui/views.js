/* Pantallas completas por rol: vendedor, pedidos y administrador. */

function vendView() {
const b = S.me.branch,
vt = ['v', 'h', 'r', 'm'].includes(S.vt) ? S.vt : 'v',
mine = S.sales.filter(s => s.branch == b).sort((a, c) => c.ts - a.ts);
const sm = (t, k) =>
mine.filter(s => s.type == t && live(s)).reduce((a, s) => a + s.qty * (k ? s.price : 1), 0);
const dt = t => {
const d = mine.filter(s => s.type == t && s.f >= 100).reduce((a, s) => a + nz(s.qty), 0),
n = sm(t) - d;
return [
n ? n + (n > 1 ? ' tamales' : ' tamal') : '',
d ? d + (d > 1 ? ' bebidas' : ' bebida') : '',
]
.filter(Boolean)
.join(' + ');
};
const pq = S.pre.filter(p => p.branch == b && p.date <= D).reduce((a, p) => a + preQty(p), 0),
dta = () => {
const d = mine
.filter(s => s.type == 'apartado' && live(s) && s.f >= 100)
.reduce((a, s) => a + nz(s.qty), 0),
n = sm('apartado') - d + pq;
return [
n ? n + (n > 1 ? ' tamales' : ' tamal') : '',
d ? d + (d > 1 ? ' bebidas' : ' bebida') : '',
]
.filter(Boolean)
.join(' + ');
};
const kp = `<div class="kp kv"><div><small>Vendidos</small><b>${sm('vendido')}</b><small>${dt('vendido')}</small></div><div><small>Apartados</small><b>${sm('apartado') + pq}</b><small>${dta()}</small></div><div><small>Total neto</small><b>${money(sm('vendido', 1) - sm('devolucion', 1))}</b></div></div>`;
const any = F.some((_, f) => load(b, f) + tx(b, f, 'to') > 0) || chLoad(b) + txc(b, 'to') > 0;
let body;
if (vt == 'v')
body =
(any ? '' : 'El administrador aún no carga el inventario de hoy.') +
seg() +
srch() +
`<div id="fls">${flList(b)}</div>`;
else if (vt == 'h') body = histView(mine);
else if (vt == 'r') body = apView();
else body = corteCard() + trForm(b, false) + trList(b);
return (
head() +
corteBanner() +
inBanner(vt) +
(vt == 'v' ? precioBanner(b) + preBanner() : '') +
(vt == 'm' || vt == 'r' ? '' : kp) +
body +
(vt == 'v' && !corteDone() ? cartBar() : '') +
nav(
[
['v', '🛒', 'Vender'],
['h', '🧾', 'Historial', histN()],
['r', '📌', 'Apartados', pin() + preN() + dvOpenN()],
['m', '⋯', 'Más'],
],
vt,
'vNav'
)
);
}

function encView() {
const t = ['d', 'r', 'a', 's'].includes(S.et) ? S.et : 'd';
const rqN = (S.rq || []).filter(r => ['pendiente', 'aceptado'].includes(rqSt(r))).length;
return (
head() +
(t == 'd' ? alertCard() : '') +
(t == 'r'
? dvPanel()
: t == 'a'
? apViewAdm()
: t == 's'
? reqView()
: largeSoonCard() + `<div class="card"><h3>Disponibilidad de hoy</h3><small>Solo consulta · se actualiza sola.</small>${grid(BI())}</div>`) +
nav(
[
['d', '📋', 'Disponibilidad'],
['r', '🛵', 'Repartos', dvOpenN()],
['a', '📌', 'Apartados', S.pre.length || ''],
['s', '🔁', 'Entre sucursales', rqN || ''],
],
t,
'enNav'
)
);
}

function adminView() {
const raw = (S.me && S.me.role === 'sup' && (S.tab === 'us' || S.tab === 'rp')) ? 'res' : S.tab,
  t = ['res', 'inv', 'tr', 'dv', 'ct', 'aj', 'us', 'ap', 'rp'].includes(raw) ? raw : 'res',
  isSup = S.me && S.me.role === 'sup',
  v = {
    res: resView,
    inv: invView,
    tr: trView,
    dv: dvPanel,
    ct: cortesView,
    aj: ajView,
    us: usView,
    ap: apViewAdm,
    rp: rpView,
  };
const sel0 = navSel(),
  sel = isSup ? sel0.filter(k => k !== 'us' && k !== 'rp') : sel0,
  cu = t || 'res';
return (
head() +
(v[t] || resView)() +
nav(
[...sel.map(k => [k, NAVALL[k][0], NAVALL[k][1], navBadge(k)]), ['more', '⋯', 'Más']],
sel.includes(cu) ? cu : 'more',
'adNav'
)
);
}

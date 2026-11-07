/* Resumen del administrador y detalle de movimientos por sucursal. */

function priceCard() {
  const z = F.map((n, f) => f).filter(
    f => !price(f) && BI().some(b => load(b, f) + tx(b, f, 'to') > 0)
  );
  return z.length
    ? `<div class="card" style="border:2px solid var(--bad)"><b class="bad">⚠️ Faltan precios</b><br><small>Hay inventario cargado de: ${z.map(f => esc(F[f])).join(', ')}. Sin precio los vendedores no pueden venderlos.</small><div class="form"><button class="alt" onclick="setTab('aj')">Ir a Ajustes</button></div></div>`
    : '';
}

function resView() {
  const st = b => {
    const s = S.sales.filter(x => x.branch == b),
      sm = (t, k) =>
        s.filter(x => x.type == t && live(x)).reduce((a, x) => a + x.qty * (k ? x.price : 1), 0);
    return {
      v: sm('vendido'),
      a: sm('apartado'),
      d: sm('devolucion'),
      m: sm('vendido', 1) - sm('devolucion', 1),
      vt: s
        .filter(x => x.f < 100 && live(x))
        .reduce(
          (q, x) => q + (x.type == 'vendido' ? nz(x.qty) : x.type == 'devolucion' ? -nz(x.qty) : 0),
          0
        ),
      cg: F.reduce((q, _, f) => q + load(b, f) + tx(b, f, 'to') - tx(b, f, 'from'), 0),
    };
  };
  const all = BI().map(b => ({ b, ...st(b) })),
    tot = all.reduce((a, x) => a + x.m, 0),
    V = S.sales.filter(x => x.type == 'vendido' && BI().includes(x.branch)),
    np = new Set(V.map(x => x.order || x.pre || x.req || x._id)).size,
    pz = V.reduce((a, x) => a + (x.f < 100 ? nz(x.qty) : 0), 0),
    pc = x => (x.cg > 0 ? Math.max(0, Math.min(100, Math.round((x.vt / x.cg) * 100))) : 0);
  /* Compacto: el total del día y todas las sucursales caben en una sola pantalla del celular */
  return `${priceCard()}${alertCard()}<div class="card rsm"><div class="rph"><small style="text-transform:capitalize">Hoy · ${esc(fdate(D))} · ${BI().length} ${BI().length == 1 ? 'sucursal' : 'sucursales'}</small><b>${money(tot)}</b></div>
 <div class="rsk"><div><b>${np}</b><small>Pedidos</small></div><div><b>${money(np ? Math.round(tot / np) : 0)}</b><small>Ticket prom.</small></div><div><b>${pz}</b><small>Tamales</small></div></div></div>
 <div class="card brl"><div class="pkh"><span>Por sucursal</span><span>toca para ver movimientos</span></div>
 ${all.map(x => `<div class="brr tap" role="button" tabindex="0" onclick="S.mvf='*';showMv(${x.b})"><div class="brn"><b>${esc(brs()[x.b])}</b><small>${x.v} ${x.v == 1 ? 'vendido' : 'vendidos'}${x.a ? ` · <span class="low">${x.a} ${x.a == 1 ? 'apartado' : 'apartados'}</span>` : ''}${x.d ? ` · <span class="bad">${x.d} devol.</span>` : ''}</small></div><div class="brx"><b>${money(x.m)}</b><small>${pc(x)}% vendido</small></div><span class="chv">›</span><div class="bar"><i style="width:${pc(x)}%"></i></div></div>`).join('')}</div>
 <div class="card"><h3>Tamales que quedan</h3>${grid(BI())}</div>${devList()}`;
}

function showMv(b) {
  const m = $('#modal'),
    hm = ts => {
      const d = new Date(ts);
      return pad(d.getHours()) + ':' + pad(d.getMinutes());
    },
    sa = S.sales.filter(s => s.branch == b),
    sum = t => sa.filter(s => s.type == t && live(s)).reduce((a, s) => a + s.qty * s.price, 0),
    ic = { vendido: '💰', apartado: '📌', devolucion: '↩️' },
    R = (ts, k, ico, t, sm, amt, bad) => ({
      ts,
      k,
      h: `<div class="mvr"><span class="mvt">${hm(ts)}</span><div class="mvd"><b>${ico} ${t}</b><small>${sm}</small></div>${amt != null ? `<b class="mva${bad ? ' bad' : ''}">${amt}</b>` : ''}</div>`,
    }),
    l = sa.map(s =>
      R(
        s.ts,
        s.type == 'vendido' ? 'v' : s.type == 'apartado' ? 'a' : 'd',
        ic[s.type] || '',
        nz(s.qty) + '× ' + nm(s.f),
        TL[s.type] +
          (s.client ? ' · ' + esc(s.client) : '') +
          (s.type == 'devolucion' ? ' · ' + esc(s.reason || '') : '') +
          ' · ' +
          esc(s.by),
        (s.type == 'devolucion' ? '−' : '') + money(s.qty * s.price),
        s.type == 'devolucion'
      )
    ),
    t = S.tr
      .filter(x => x.from == b || x.to == b)
      .map(x =>
        R(
          x.ts,
          'tr',
          '🔁',
          x.from == b ? 'Salió a ' + esc(brs()[x.to]) : 'Entró de ' + esc(brs()[x.from]),
          esc(
            Object.entries(x.q || {})
              .map(([k, v]) => (k == 'ch' ? v + ' L champurrado' : v + '× ' + F[+k.slice(1)]))
              .join(', ')
          ),
          null
        )
      ),
    g = (S.lg || [])
      .filter(x => x.branch == b || x.branch2 == b)
      .map(x =>
        R(
          x.ts,
          'x',
          '🚫',
          esc(x.label || 'Anulado'),
          esc(x.txt || '') + ' · por ' + esc(x.byName || x.by),
          x.amt != null ? money(x.amt) : null,
          1
        )
      ),
    all = [...l, ...t, ...g],
    C = k => all.filter(x => x.k == k).length,
    f = C(S.mvf) || S.mvf == '*' ? S.mvf : '*',
    r = all.filter(x => f == '*' || x.k == f).sort((a, c) => c.ts - a.ts),
    chips = [
      ['*', 'Todo', all.length],
      ['v', 'Ventas', C('v')],
      ['a', 'Apartados', C('a')],
      ['d', 'Devoluciones', C('d')],
      ['tr', 'Traspasos', C('tr')],
      ['x', 'Anulados', C('x')],
    ]
      .filter(c => c[0] == '*' || c[2])
      .map(
        ([k, n, c]) =>
          `<button class="${f == k ? 'on' : ''}" onclick="S.mvf='${k}';showMv(${b})">${n} (${c})</button>`
      )
      .join('');
  m.innerHTML = `<div class="card mv mvc"><div class="mvh"><h3>Movimientos · ${esc(brs()[b])}</h3><button class="mx" id="mx" aria-label="Cerrar">✕</button></div>
 <div class="kp"><div><small>Neto</small><b>${money(sum('vendido') - sum('devolucion'))}</b></div><div><small>Apartados</small><b>${money(sum('apartado'))}</b></div><div><small>Devol.</small><b>${money(sum('devolucion'))}</b></div></div>
 <div class="seg wr" style="margin:6px 0">${chips}</div>${r.length ? r.map(x => x.h).join('') : '<small>Sin movimientos hoy.</small>'}<div class="form"><button id="mk" style="flex:1">Cerrar</button></div></div>`;
  m.style.display = 'flex';
  $('#mk').onclick = $('#mx').onclick = () => (m.style.display = 'none');
}

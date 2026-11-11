/* Reportes · agregaciones y resumen estadístico. */

function rpAgg(rows, kf) {
  const m = {};
  rows.forEach(s => {
    const k = kf(s),
      x = (m[k] = m[k] || { u: 0, a: 0, c: 0 }),
      q = nz(s.qty);
    if (s.type == 'devolucion') {
      x.u -= q;
      x.a -= q * nz(s.price);
      if (s.restock) x.c -= q * cst(s.f);
    } else {
      x.u += q;
      x.a += q * nz(s.price);
      x.c += q * cst(s.f);
    }
  });
  return Object.entries(m);
}

const bars = (l, val, ut) => {
  const tot = l.reduce((a, x) => a + Math.max(0, val(x)), 0) || 1,
    mx = Math.max(...l.map(val));
  return `<div class="wrap"><table><tr><th></th><th>Ventas</th><th>% del total</th>${ut ? '<th>Utilidad</th>' : ''}</tr>${l.map(x => `<tr><td>${esc(x[0])}${val(x) == mx && l.length > 1 ? ' ⭐' : ''}</td><td>${money(val(x))}</td><td>${Math.round((Math.max(0, val(x)) / tot) * 100)}%</td>${ut ? `<td>${money(ut(x))}</td>` : ''}</tr>`).join('')}</table></div>`;
};

function rpCharts(rows) {
  if (!hasCost()) return '';
  const ut = x => x[1].a - x[1].c,
    fl = rpAgg(rows, s => s.f)
      .map(([k, x]) => [nm(+k) + ' (' + x.u + ' pzas)', x])
      .sort((a, b) => ut(b) - ut(a));
  return `<div class="card"><h3>Utilidad por sabor</h3>${bars(fl, x => x[1].a, ut)}<small>El champurrado no tiene costo registrado.</small></div>`;
}

const okey = s => s.order || s.pre || s.req || s._id;

function rpS(rows) {
  const ve = rows.filter(s => s.type == 'vendido'),
    de = rows.filter(s => s.type == 'devolucion'),
    oc = {},
    H = {};
  ve.forEach(s => {
    const v = nz(s.qty) * nz(s.price),
      k = okey(s),
      h = new Date(s.ts).getHours();
    oc[k] = (oc[k] || 0) + v;
    const x = (H[h] = H[h] || { u: 0, a: 0 });
    x.u += nz(s.qty);
    x.a += v;
  });
  const n = Object.keys(oc).length,
    gross = ve.reduce((a, s) => a + nz(s.qty) * nz(s.price), 0),
    units = ve.reduce((a, s) => a + nz(s.qty), 0),
    dy = rpAgg(rows, s => s.day).sort((a, b) => b[1].a - a[1].a),
    fl = rpAgg(rows, s => s.f).sort((a, b) => b[1].a - a[1].a),
    dr = de.reduce((a, s) => a + nz(s.qty) * nz(s.price), 0),
    desc = ve.reduce((a, s) => a + nz(s.descuento), 0),
    net = rows.reduce((a, s) => a + (s.type == 'devolucion' ? -1 : 1) * nz(s.qty) * nz(s.price), 0);
  return {
    V: ve,
    D: de,
    H,
    n,
    gross,
    units,
    dy,
    fl,
    dr,
    desc,
    net,
    tk: n ? gross / n : 0,
    pp: n ? units / n : 0,
    dp: gross ? (dr / gross) * 100 : 0,
    avg: dy.length ? net / dy.length : 0,
    ut: fl.reduce((t, [k, v]) => t + v.a - v.c, 0),
  };
}

function rpBrief(rows) {
  const x = rpS(rows);
  if (!x.n) return '';
  const ph = Object.entries(x.H).sort((a, b) => b[1].a - a[1].a)[0],
    t = x.fl[0],
    bd = x.dy[0];
  const L = [
    ['Pedidos', x.n],
    ['Ticket promedio', money(x.tk)],
    ['Piezas por pedido', x.pp.toFixed(1)],
    ['Hora pico', ph[0] + ':00 h'],
    ['Mejor día', bd ? fdd(bd[0]) + ' · ' + money(bd[1].a) : '—'],
    ['Sabor estrella', t ? nm(+t[0]) + ' · ' + t[1].u + ' pzas' : '—'],
    ['Devoluciones', x.dp.toFixed(1) + '% de lo vendido'],
  ];
  return `<div class="card"><h3>Lo importante</h3>${L.map(([a, b]) => `<div class="row"><div>${a}</div><b>${b}</b></div>`).join('')}<small>Descarga el reporte para ver gráficas y el detalle completo.</small></div>`;
}

function rpKpi(rows) {
  const x = rpS(rows),
    hc = hasCost(),
    L = [['Total neto', money(x.net)]];
  if (hc)
    L.push([
      'Utilidad estimada',
      money(x.ut) + ' · ' + (x.net ? Math.round((x.ut / x.net) * 100) : 0) + '%',
    ]);
  L.push(
    ['Pedidos', x.n],
    ['Ticket promedio', money(x.tk)],
    ['Piezas por pedido', x.pp.toFixed(1)],
    ['Promedio por día', money(x.avg)],
    ['Devoluciones', money(x.dr) + ' · ' + x.dp.toFixed(1) + '%']
  );
  return `<div class="kg">${L.map(([a, b]) => `<div><small>${a}</small><b>${b}</b></div>`).join('')}</div>`;
}

function rpMore(rows) {
  const x = rpS(rows),
    V = x.V,
    tot = x.net || 1,
    pc = l => l,
    cat = pc(
      rpAgg(rows, s => (s.f >= 100 ? 'Bebidas' : isD(s.f) ? 'Dulces' : 'Salados')).sort(
        (a, b) => b[1].a - a[1].a
      )
    ),
    hr = Object.entries(x.H)
      .sort((a, b) => a[0] - b[0])
      .map(([h, v]) => [h + ':00', v]),
    W = {};
  x.dy.forEach(([d, v]) => {
    const w = new Date(d + 'T12:00:00').getDay(),
      o = (W[w] = W[w] || { a: 0, n: 0 });
    o.a += v.a;
    o.n++;
  });
  const wd = Object.entries(W)
      .sort((a, b) => ((+a[0] + 6) % 7) - ((+b[0] + 6) % 7))
      .map(([w, o]) => [
        ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][w] + ' (' + o.n + ')',
        { a: o.a / o.n },
      ]),
    bt = brs()
      .map((n, i) => {
        const v = V.filter(s => s.branch == i);
        if (!v.length) return null;
        const o = {};
        v.forEach(s => {
          o[okey(s)] = (o[okey(s)] || 0) + nz(s.qty) * nz(s.price);
        });
        const a = Object.values(o).reduce((p, c) => p + c, 0);
        return [n, Object.keys(o).length, a];
      })
      .filter(Boolean),
    ga = bt.reduce((t, r) => t + r[2], 0) || 1,
    mb = [...new Set(V.map(s => s.branch))].sort(),
    m = {};
  V.forEach(s => {
    const k = s.f + '|' + s.branch;
    m[k] = (m[k] || 0) + nz(s.qty);
  });
  const fr = [...new Set(V.map(s => s.f))]
      .sort((a, b) => a - b)
      .map(f => [f, mb.map(b => m[f + '|' + b] || 0)]),
    mx = Math.max(1, ...fr.flatMap(r => r[1])),
    sold = new Set(V.map(s => s.f)),
    idle = F.map((n, f) => (sold.has(f) ? null : n)).filter(Boolean),
    rs = {};
  x.D.forEach(s => {
    const k = (s.reason || 'Sin motivo').split(':')[0];
    rs[k] = (rs[k] || 0) + nz(s.qty);
  });
  const T = (h, b) =>
    `<div class="wrap"><table><tr>${h.map(c => `<th>${c}</th>`).join('')}</tr>${b}</table></div>`;
  return (
    `<div class="card"><h3>Pedidos por sucursal</h3>${T(['Sucursal', 'Pedidos', 'Ticket prom.', '% del total'], bt.map(r => `<tr><td>${esc(r[0])}</td><td>${r[1]}</td><td>${money(r[2] / r[1])}</td><td>${Math.round((r[2] / ga) * 100)}%</td></tr>`).join(''))}</div>` +
    `<div class="card"><h3>Ventas por categoría</h3>${bars(cat, x => x[1].a)}</div><div class="card"><h3>Ventas por hora</h3>${bars(hr, x => x[1].a)}</div><div class="card"><h3>Promedio por día de la semana</h3><small>Entre paréntesis, cuántos días hubo en el periodo</small>${bars(wd, x => x[1].a)}</div>` +
    `<div class="card"><h3>Piezas por sabor y sucursal</h3>${T(['Sabor', ...mb.map(b => esc(brs()[b] || (b == null ? 'Pedido grande' : b))), 'Total'], fr.map(([f, r]) => `<tr><td>${nm(f)}</td>${r.map(u => `<td style="background:rgba(184,50,31,${((u / mx) * 0.55).toFixed(2)})">${u}</td>`).join('')}<td><b>${r.reduce((a, c) => a + c, 0)}</b></td></tr>`).join(''))}</div>` +
    `<div class="card"><h3>Sin ventas en el periodo</h3><small>${idle.length ? esc(idle.join(', ')) : 'Todos los sabores tuvieron ventas.'}</small></div>` +
    `<div class="card"><h3>Devoluciones por motivo</h3><small>${
      Object.keys(rs).length
        ? Object.entries(rs)
            .sort((a, b) => b[1] - a[1])
            .map(([k, v]) => esc(k) + ': ' + v + ' pzas')
            .join(' · ')
        : 'Sin devoluciones.'
    }</small></div>`
  );
}

function rpTxt(rows) {
  const x = rpS(rows),
    r = S.rp;
  if (!x.n) return '<div class="card"><b>No hubo ventas en este periodo.</b></div>';
  const t = x.fl[0],
    w = x.fl[x.fl.length - 1],
    ph = Object.entries(x.H).sort((a, b) => b[1].a - a[1].a)[0],
    bd = x.dy[0],
    bb = brs()
      .map((n, i) => [
        n,
        rows
          .filter(s => s.branch == i)
          .reduce((a, s) => a + (s.type == 'devolucion' ? -1 : 1) * nz(s.qty) * nz(s.price), 0),
      ])
      .sort((a, b) => b[1] - a[1])[0],
    L = [
      `Del ${fdd(r.from)} al ${fdd(r.to)} vendiste <b>${money(x.net)}</b> en <b>${x.n} pedidos</b>; cada pedido fue de ${money(x.tk)} en promedio (${x.pp.toFixed(1)} piezas).`,
      `Tu sabor más vendido fue <b>${nm(+t[0])}</b> (${t[1].u} piezas)${w && w !== t ? ` y el que menos se vendió fue <b>${nm(+w[0])}</b> (${w[1].u}).` : '.'}`,
      bb && bb[1] > 0
        ? `La sucursal que más vendió fue <b>${esc(bb[0])}</b> con ${money(bb[1])}.`
        : '',
      `Vendes más entre las <b>${ph[0]}:00 y las ${+ph[0] + 1}:00 h</b>.`,
      bd ? `Tu mejor día fue <b>${fdd(bd[0])}</b> con ${money(bd[1].a)}.` : '',
      x.dr > 0
        ? `Hubo devoluciones por ${money(x.dr)} (${x.dp.toFixed(1)}% de lo vendido).`
        : 'No hubo devoluciones.',
    ];
  return `<div class="card"><h3>Resumen en palabras</h3>${L.filter(Boolean)
    .map(l => `<p style="margin:6px 0">${l}</p>`)
    .join('')}</div>`;
}

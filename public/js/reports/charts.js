/* Reportes · gráficas SVG propias y globo de información. */

const GST =
  '<style>.hv{fill:var(--ac,#0b6b5e);fill-opacity:0;cursor:pointer}.hv:hover,.hv:active{fill-opacity:.1}.hs{cursor:pointer}.hs:hover,.hs:active{opacity:.78}</style>';

const PAL = [1, 2, 3, 4, 5, 6, 7].map(n => 'var(--c' + n + ')'),
  svgW = (h, b) =>
    `<svg viewBox="0 0 640 ${h}" style="width:100%;height:auto" role="img">${GST}${b}</svg>`;

const mk = v => {
    v = Math.round(v);
    const a = Math.abs(v);
    return (
      '$' +
      (a >= 10000
        ? Math.round(v / 1000) + 'k'
        : a >= 1000
          ? (v / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
          : v)
    );
  },
  ta = t => 'data-tip="' + esc(t) + '"';

/* Globo de información al pasar el mouse o tocar (sirve igual dentro de la app y en el reporte descargado) */
const TIPJS =
  "(function(){var t=document.createElement('div');t.style.cssText='position:fixed;z-index:99;pointer-events:none;background:var(--pop-bg,#0c1d19);color:var(--pop-fg,#fff);font:600 12px/1.4 system-ui,sans-serif;padding:7px 10px;border-radius:8px;max-width:230px;display:none;box-shadow:0 4px 14px #0a2f2a66;white-space:pre-line';document.body.appendChild(t);function f(e){var x=e.target.closest&&e.target.closest('[data-tip]');if(!x){t.style.display='none';return}t.textContent=x.getAttribute('data-tip');t.style.display='block';var w=t.offsetWidth,h=t.offsetHeight,l=Math.min(innerWidth-w-6,Math.max(6,e.clientX-w/2)),p=e.clientY-h-14;if(p<6)p=e.clientY+18;t.style.left=l+'px';t.style.top=p+'px'}['pointermove','pointerdown'].forEach(function(n){document.addEventListener(n,f)});addEventListener('scroll',function(){t.style.display='none'},true)})();";

try {
  new Function(TIPJS)();
} catch (e) {
  console.warn('tip', e);
}

function gLine(p) {
  const W = 640,
    H = 230,
    L = 56,
    R = 14,
    T = 26,
    B = 28,
    mx = Math.max(1, ...p.map(x => x[1])),
    mn = Math.min(...p.map(x => x[1])),
    X = i => L + (i * (W - L - R)) / (p.length - 1),
    Y = v => T + (H - T - B) * (1 - Math.max(0, v) / mx),
    av = p.reduce((a, x) => a + x[1], 0) / p.length,
    pts = p.map((x, i) => X(i) + ',' + Y(x[1])).join(' '),
    st = Math.ceil(p.length / 8),
    bw = (W - L - R) / (p.length - 1),
    all = p.length <= 10,
    im = p.findIndex(x => x[1] == mx),
    il = p.findIndex(x => x[1] == mn);
  const grid = [0, 0.5, 1]
    .map(
      f =>
        `<line x1="${L}" x2="${W - R}" y1="${Y(mx * f)}" y2="${Y(mx * f)}" stroke="var(--gr,#ddd8cb)" stroke-opacity="${f ? 0.45 : 1}"/><text x="${L - 6}" y="${Y(mx * f) + 4}" text-anchor="end" font-size="11" fill="var(--mut,#505d58)">${mk(mx * f)}</text>`
    )
    .join('');
  return svgW(
    H,
    `${grid}<line x1="${L}" x2="${W - R}" y1="${Y(av)}" y2="${Y(av)}" stroke="var(--mut,#505d58)" stroke-dasharray="5 4"/><text x="${W - R}" y="${Y(av) - 5}" text-anchor="end" font-size="11" fill="var(--mut,#505d58)">prom. ${mk(av)}</text><polygon points="${L},${Y(0)} ${pts} ${X(p.length - 1)},${Y(0)}" fill="var(--ac,#0b6b5e)" fill-opacity=".13"/><polyline points="${pts}" fill="none" stroke="var(--ac,#0b6b5e)" stroke-width="3" stroke-linejoin="round"/>${p.map((x, i) => `<circle cx="${X(i)}" cy="${Y(x[1])}" r="${i == im ? 5.5 : 4}" fill="var(--ac,#0b6b5e)"/>${i % st == 0 || (i == p.length - 1 && p.length <= 8) ? `<text x="${X(i)}" y="${H - 8}" text-anchor="${i == p.length - 1 ? 'end' : i == 0 ? 'start' : 'middle'}" font-size="11" fill="var(--mut,#505d58)">${esc(x[0])}</text>` : ''}${all || i == im || i == il ? `<text x="${X(i)}" y="${Y(x[1]) - 9}" text-anchor="${i == 0 ? 'start' : i == p.length - 1 ? 'end' : 'middle'}" font-size="11" font-weight="700" fill="${i == im ? 'var(--ac,#0b6b5e)' : 'currentColor'}">${mk(x[1])}</text>` : ''}`).join('')}${p.map((x, i) => `<rect class="hv" x="${X(i) - bw / 2}" y="${T - 8}" width="${bw}" height="${H - T - B + 8}" ${ta(x[2] || x[0] + '\n' + money(x[1]))}/>`).join('')}`
  );
}

function gCols(p) {
  const W = 640,
    H = 230,
    L = 10,
    B = 28,
    T = 26,
    mx = Math.max(1, ...p.map(x => x[1])),
    bw = (W - L * 2) / p.length,
    top = p.findIndex(x => x[1] == mx),
    fs = p.length > 12 ? 10 : 12;
  return svgW(
    H,
    `<line x1="${L}" x2="${W - L}" y1="${H - B}" y2="${H - B}" stroke="var(--gr,#ddd8cb)"/>` +
      p
        .map((x, i) => {
          const h = ((H - T - B) * Math.max(0, x[1])) / mx,
            cx = L + i * bw + bw / 2;
          return `<rect x="${cx - bw * 0.35}" y="${H - B - h}" width="${bw * 0.7}" height="${h}" rx="4" fill="${i == top ? 'var(--ac,#0b6b5e)' : 'var(--bar-soft,#c6d6cf)'}"/><text x="${cx}" y="${H - 8}" text-anchor="middle" font-size="11" fill="var(--mut,#505d58)">${esc(x[0])}</text>${x[1] > 0 ? `<text x="${cx}" y="${H - B - h - 5}" text-anchor="middle" font-size="${fs}" font-weight="${i == top ? 700 : 600}" fill="${i == top ? 'var(--ac,#0b6b5e)' : 'currentColor'}">${mk(x[1])}</text>` : ''}<rect class="hv" x="${cx - bw / 2}" y="${T - 8}" width="${bw}" height="${H - T - B + 8}" ${ta(x[2] || x[0] + '\n' + money(x[1]))}/>`;
        })
        .join('')
  );
}

function gDonut(it) {
  const t = it.reduce((a, x) => a + Math.max(0, x[1]), 0) || 1;
  let a0 = -Math.PI / 2;
  const R = 88,
    r = 54,
    P = (a, q) => 100 + q * Math.cos(a) + ' ' + (100 + q * Math.sin(a)),
    arcs = it
      .map((x, i) => {
        const f = Math.max(0, x[1]) / t,
          a1 = a0 + f * 2 * Math.PI,
          c = PAL[i % PAL.length],
          tp = ta(
            x[0] +
              '\n' +
              money(x[1]) +
              ' · ' +
              Math.round(f * 100) +
              '%' +
              (x[2] ? '\n' + x[2] : '')
          );
        let d;
        if (f >= 0.9999)
          d = `<circle class="hs" cx="100" cy="100" r="71" fill="none" stroke="${c}" stroke-width="34" ${tp}/>`;
        else
          d = `<path class="hs" d="M${P(a0, R)}A${R} ${R} 0 ${f > 0.5 ? 1 : 0} 1 ${P(a1, R)}L${P(a1, r)}A${r} ${r} 0 ${f > 0.5 ? 1 : 0} 0 ${P(a0, r)}Z" fill="${c}" ${tp}/>`;
        a0 = a1;
        return d;
      })
      .join('');
  return `<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap"><svg viewBox="0 0 200 200" style="width:190px;height:190px" role="img">${GST}${arcs}<text x="100" y="98" text-anchor="middle" font-size="11" fill="var(--mut,#505d58)" pointer-events="none">total</text><text x="100" y="114" text-anchor="middle" font-size="14" font-weight="700" fill="currentColor" pointer-events="none">${money(Math.round(t))}</text></svg><div style="flex:1;min-width:190px">${it.map((x, i) => `<div style="display:flex;gap:8px;align-items:center;margin:5px 0"><i style="width:12px;height:12px;border-radius:3px;background:${PAL[i % PAL.length]}"></i><span style="flex:1">${esc(x[0])}<br><small>${money(Math.round(x[1]))}${x[2] ? ' · ' + esc(x[2]) : ''}</small></span><b>${Math.round((Math.max(0, x[1]) / t) * 100)}%</b></div>`).join('')}</div></div>`;
}

function rpGraf(rows) {
  const x = rpS(rows);
  if (!x.n) return '';
  const card = (t, svg, txt) =>
      `<div class="card"><h3>${t}</h3>${svg}<p class="how"><b>Cómo leerlo:</b> ${txt} Pasa el mouse (o toca) sobre cada punto, columna o color para ver el detalle.</p></div>`,
    out = [],
    days = [...x.dy].sort((a, b) => (a[0] < b[0] ? -1 : 1)),
    pc = (v, t) => Math.round((v / (t || 1)) * 100),
    od = {},
    oh = {};
  x.V.forEach(s => {
    const k = okey(s),
      h = new Date(s.ts).getHours();
    (od[s.day] = od[s.day] || new Set()).add(k);
    (oh[h] = oh[h] || new Set()).add(k);
  });
  if (days.length > 1) {
    const v = days.map(d => d[1].a),
      h = Math.floor(v.length / 2),
      a1 = v.slice(0, h).reduce((p, c) => p + c, 0) / h,
      a2 = v.slice(h).reduce((p, c) => p + c, 0) / (v.length - h),
      ch = a1 ? Math.round((a2 / a1 - 1) * 100) : 0,
      bd = x.dy[0],
      wd = x.dy[x.dy.length - 1];
    out.push(
      card(
        'Ventas por día',
        gLine(
          days.map(([d, o]) => {
            const c = x.avg ? Math.round((o.a / x.avg - 1) * 100) : 0;
            return [
              d.slice(8) + '/' + d.slice(5, 7),
              o.a,
              fdd(d) +
                '\nVentas: ' +
                money(o.a) +
                '\n' +
                (od[d] || { size: 0 }).size +
                ' pedidos · ' +
                o.u +
                ' piezas\n' +
                pc(o.a, x.net) +
                '% del total del periodo\n' +
                (Math.abs(c) < 1
                  ? 'Igual a tu promedio'
                  : (c > 0 ? '▲ ' : '▼ ') + Math.abs(c) + '% vs tu promedio'),
            ];
          })
        ),
        `la línea punteada es tu promedio (${money(Math.round(x.avg))} al día). Mejor día: ${fdd(bd[0])} (${money(bd[1].a)}). Día más bajo: ${fdd(wd[0])} (${money(wd[1].a)}). ${Math.abs(ch) < 5 ? 'Las ventas se mantienen estables.' : ch > 0 ? `La segunda mitad del periodo vendió ${ch}% más que la primera.` : `La segunda mitad del periodo vendió ${-ch}% menos que la primera.`}`
      )
    );
  }
  const hs = Object.keys(x.H).map(Number),
    h0 = Math.min(...hs),
    h1 = Math.max(...hs),
    hp = [];
  for (let h = h0; h <= h1; h++) {
    const o = x.H[h] || { a: 0, u: 0 };
    hp.push([
      h + 'h',
      o.a,
      h +
        ':00 a ' +
        (h + 1) +
        ':00 h\nVentas: ' +
        money(o.a) +
        '\n' +
        (oh[h] || { size: 0 }).size +
        ' pedidos · ' +
        o.u +
        ' piezas\n' +
        pc(o.a, x.gross) +
        '% del total vendido',
    ]);
  }
  if (hp.length > 1) {
    const pk = hp.reduce((m, c) => (c[1] > m[1] ? c : m)),
      sm = hp.map((_, i) => hp.slice(i, i + 3).reduce((a, c) => a + c[1], 0)),
      bi = sm.indexOf(Math.max(...sm));
    out.push(
      card(
        'Ventas por hora',
        gCols(hp),
        `la columna roja es tu hora más fuerte (${pk[0]}, ${money(pk[1])}). Entre las ${h0 + bi}:00 y las ${h0 + bi + 3}:00 h ocurre el ${pc(sm[bi], x.gross)}% de lo que vendes: ahí conviene tener todo listo.`
      )
    );
  }
  const W = {};
  x.dy.forEach(([d, o]) => {
    const w = new Date(d + 'T12:00:00').getDay(),
      q = (W[w] = W[w] || { a: 0, n: 0 });
    q.a += o.a;
    q.n++;
  });
  if (Object.keys(W).length > 1) {
    const N = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'],
      wk = [1, 2, 3, 4, 5, 6, 0]
        .filter(w => W[w])
        .map(w => [
          N[w].slice(0, 3),
          W[w].a / W[w].n,
          N[w][0].toUpperCase() +
            N[w].slice(1) +
            '\nPromedio por día: ' +
            money(Math.round(W[w].a / W[w].n)) +
            '\nTotal: ' +
            money(W[w].a) +
            ' en ' +
            W[w].n +
            (W[w].n == 1 ? ' día' : ' días'),
          w,
        ]),
      bw = wk.reduce((m, c) => (c[1] > m[1] ? c : m)),
      lw = wk.reduce((m, c) => (c[1] < m[1] ? c : m));
    out.push(
      card(
        'Promedio por día de la semana',
        gCols(wk),
        `cada columna es lo que vendes en promedio ese día. Los ${N[bw[3]]} son tus mejores días (${money(Math.round(bw[1]))}) y los ${N[lw[3]]} los más flojos (${money(Math.round(lw[1]))}).`
      )
    );
  }
  const bt = brs()
      .map((n, i) => {
        const l = rows.filter(s => s.branch == i),
          V = l.filter(s => s.type == 'vendido'),
          o = new Set(V.map(okey)).size;
        return [
          n,
          l.reduce((a, s) => a + (s.type == 'devolucion' ? -1 : 1) * nz(s.qty) * nz(s.price), 0),
          o + ' pedidos',
        ];
      })
      .filter(q => q[1] > 0)
      .sort((a, b) => b[1] - a[1]),
    bsum = bt.reduce((a, q) => a + q[1], 0);
  if (bt.length > 1)
    out.push(
      card(
        'Qué sucursal vende más',
        gDonut(bt),
        `el círculo es el 100% de tus ventas. ${esc(bt[0][0])} aporta ${pc(bt[0][1], bsum)}% y ${esc(bt[bt.length - 1][0])} el ${pc(bt[bt.length - 1][1], bsum)}%.`
      )
    );
  const fl = x.fl.filter(q => q[1].a > 0).map(([k, v]) => [nm(+k), v.a, v.u + ' piezas']),
    fs = fl.reduce((a, q) => a + q[1], 0),
    top = fl.slice(0, 6),
    ot = fl.slice(6).reduce((a, q) => a + q[1], 0);
  if (ot > 0)
    top.push([
      'Otros (' + (fl.length - 6) + ' sabores)',
      ot,
      fl.slice(6).reduce((a, q) => a + parseInt(q[2]), 0) + ' piezas',
    ]);
  if (fl.length > 1)
    out.push(
      card(
        'Qué sabores dejan más dinero',
        gDonut(top),
        `tus 3 sabores más vendidos suman el ${pc(
          fl.slice(0, 3).reduce((a, q) => a + q[1], 0),
          fs
        )}% de las ventas. ${esc(fl[0][0])} va a la cabeza.`
      )
    );
  const ct = rpAgg(rows, s => (s.f >= 100 ? 'Bebidas' : isD(s.f) ? 'Dulces' : 'Salados'))
      .map(([k, v]) => [k, v.a, v.u + ' piezas'])
      .filter(q => q[1] > 0)
      .sort((a, b) => b[1] - a[1]),
    cs = ct.reduce((a, q) => a + q[1], 0);
  if (ct.length > 1)
    out.push(
      card(
        'Salados, dulces y bebidas',
        gDonut(ct),
        `${esc(ct[0][0])} es lo que más pesa en tus ventas (${pc(ct[0][1], cs)}%).`
      )
    );
  return (
    out.join('') ||
    '<div class="card"><small>No hay suficientes datos para graficar. Elige un periodo más largo.</small></div>'
  );
}

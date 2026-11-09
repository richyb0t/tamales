/* Reportes · tarjetas y pantalla del reporte. */

/* Tarjeta principal del reporte: total grande, seis datos clave y descargas */
function rpHero(rows, pS, dias) {
  const x = rpS(rows),
    hc = hasCost(),
    k = (a, b, d) => `<div><small>${a}</small><b>${b}</b>${d || ''}</div>`;
  return `<div class="card"><div class="rph"><small>Total neto</small><b>${money(x.net)}</b>${pS ? dlt(x.net, pS.net) : ''}<small>${dias} día${dias > 1 ? 's' : ''} con ventas${rpScope() ? ' · ' + esc(rpScope()) : ''}</small></div>
 <div class="kp">${k('Pedidos', x.n)}${k('Ticket prom.', money(x.tk), pS ? dlt(x.tk, pS.tk) : '')}${k('Prom. por día', money(Math.round(x.avg)), pS ? dlt(x.avg, pS.avg) : '')}${hc ? k('Utilidad', money(x.ut), `<small class="mut">${x.net ? Math.round((x.ut / x.net) * 100) : 0}% del total</small>`) : k('Piezas/pedido', x.pp.toFixed(1))}${k('Devoluciones', money(x.dr), pS ? dlt(x.dr, pS.dr, 1) : '')}${hc ? k('Piezas/pedido', x.pp.toFixed(1)) : k('Días con ventas', dias)}</div>
 <small>No cuenta apartados sin entregar ni movimientos anulados.</small>
 <div class="ivt"><button class="alt" onclick="rpHtml()"><span>📊</span>Con gráficas</button><button class="alt" onclick="rpCsv()"><span>📄</span>CSV</button><button class="alt" onclick="rpCsv(1)"><span>📑</span>CSV detalle</button></div></div>`;
}

function rpBody(r) {
  const rows = rpF(r.rows),
    prev = r.cmp && r.prev ? rpF(r.prev) : null;
  let h = '';
  if (!rows.length)
    h = '<div class="card"><small>No hay ventas con esos filtros en este rango.</small></div>';
  else {
    const V = rows.filter(s => s.type == 'vendido'),
      R = rows.filter(s => s.type == 'devolucion'),
      tot = rpA(V) - rpA(R),
      dias = new Set(V.map(s => s.day)).size || 1,
      pS = prev ? rpS(prev) : null,
      grp = f => {
        const m = {};
        rows.forEach(s => {
          const g = s.type == 'devolucion' ? -1 : 1,
            k = f(s),
            x = (m[k] = m[k] || { u: 0, a: 0 });
          x.u += g * s.qty;
          x.a += g * s.qty * s.price;
        });
        return Object.entries(m);
      },
      tb = (t, c, l) =>
        `<div class="card"><h3>${t}</h3><div class="sc"><table><tr><th>${c}</th><th>Unid.</th><th>Importe</th></tr>${l.map(([k, x]) => `<tr><td>${esc(k)}</td><td class="n">${x.u}</td><td class="n">${money(x.a)}</td></tr>`).join('')}</table></div></div>`,
      fd = x =>
        new Date(x + 'T12:00:00').toLocaleDateString('es-MX', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        });
    h =
      rpHero(rows, pS, dias) +
      (prev ? rpCmp(rows, prev) : '') +
      rpBrief(rows) +
      (r.gr !== false ? rpGraf(rows) : '') +
      rpSell(rows) +
      tb(
        'Por día',
        'Día',
        grp(s => s.day)
          .sort((a, b) => (a[0] < b[0] ? 1 : -1))
          .map(([k, x]) => [fd(k), x])
      ) +
      tb(
        'Por sucursal',
        'Sucursal',
        grp(s => s.branch)
          .sort((a, b) => b[1].a - a[1].a)
          .map(([k, x]) => [brs()[+k] || 'Sucursal ' + k, x])
      ) +
      tb(
        'Por sabor',
        'Sabor',
        grp(s => s.f)
          .sort((a, b) => b[1].u - a[1].u)
          .map(([k, x]) => [nm(+k), x])
      );
  }
  const ld = r.mm && !r.mm.busy,
    lc = r.ct && !r.ct.busy;
  return (
    h +
    `<div class="card"><h3>Análisis extra</h3><small>Cada botón lee más documentos de Firebase solo la primera vez; los días cerrados quedan guardados en este dispositivo.</small><div class="form"><button class="alt" onclick="rpMerma(${ld ? 1 : 0})">${ld ? '↻ ' : '📦 '}Merma y sobrantes<br><small>${ld ? 'volver a leer' : '~' + rpEst('loads', BI().length) + ' documentos'}</small></button><button class="alt" onclick="rpControl(${lc ? 1 : 0})">${lc ? '↻ ' : '🧾 '}Cortes y anulaciones<br><small>${lc ? 'volver a leer' : '~' + rpEst('cuts', BI().length + 2) + ' documentos'}</small></button></div></div>` +
    rpMermaHtml(r) +
    rpControlHtml(r)
  );
}

function rpView() {
  const r = (S.rp = S.rp || { from: dayAdd(D, -6), to: D, rows: null });
  let body = '';
  if (r.busy) body = '<div class="card"><small>Consultando…</small></div>';
  else if (r.rows) {
    const k = [
      r.stamp,
      r.br,
      r.cat,
      r.cmp ? 1 : 0,
      r.gr !== false ? 1 : 0,
      r.mm ? (r.mm.busy ? 'b' : 'r' + r.mm.reads) : '',
      r.ct ? (r.ct.busy ? 'b' : 'r' + r.ct.reads) : '',
      S.users.length,
    ].join('|');
    if (r.hk !== k) {
      r.hb = rpBody(r);
      r.hk = k;
    }
    body = r.hb;
  }
  const chip = (on, fn, l) => `<button class="${on ? 'on' : ''}" onclick="${fn}">${l}</button>`,
    n0 = new Date(),
    sm = dayAdd(D, -((n0.getDay() + 6) % 7) - 7),
    y = dayAdd(D, -1),
    pz = [
      ['Hoy', "rpPreset('hoy')", D, D],
      ['Ayer', "rpPreset('ayer')", y, y],
      ['7 días', 'rpRange(7)', dayAdd(D, -6), D],
      ['Semana pasada', "rpPreset('sem')", sm, dayAdd(sm, 6)],
      ['Este mes', 'rpMonth()', D.slice(0, 8) + '01', D],
      [
        'Mes pasado',
        "rpPreset('mes')",
        dstr(new Date(n0.getFullYear(), n0.getMonth() - 1, 1)),
        dstr(new Date(n0.getFullYear(), n0.getMonth(), 0)),
      ],
    ],
    fs = x => {
      const [yy, m, d] = x.split('-').map(Number);
      return new Date(yy, m - 1, d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
    },
    per = r.from == r.to ? fs(r.from) : fs(r.from) + ' – ' + fs(r.to),
    open = !r.rows || r.fo,
    rd =
      r.rows && !r.busy
        ? `<small>Lecturas de Firebase: <b>${r.reads}</b>${r.reads ? '' : ' (todo salió de la memoria del dispositivo)'}.</small>`
        : '';
  /* Con resultados, el periodo se resume en una línea para que se vean primero los datos; «Cambiar» abre los controles */
  return `<div class="card"><div class="ivh"><h3>Reportes de ventas</h3>${open ? '' : '<button class="gh" onclick="S.rp.fo=1;render(true)">Cambiar</button>'}</div>
 ${
   open
     ? `<small>Elige el periodo y toca Consultar. Los días ya cerrados se leen de Firebase una sola vez y se guardan en este dispositivo; repetir la consulta casi no gasta.</small>
 <div class="pkh" style="margin-top:12px"><span>Periodo</span></div>
 <div class="seg wr" style="margin:0 0 8px">${pz.map(([l, f, a, z]) => chip(r.from == a && r.to == z, f, l)).join('')}</div>
 <div class="rpd"><label><small>Desde</small><input type="date" id="rpf" aria-label="Desde" value="${r.from}" max="${D}" onchange="rpDate('from',this.value)"></label><label><small>Hasta</small><input type="date" id="rpt" aria-label="Hasta" value="${r.to}" max="${D}" onchange="rpDate('to',this.value)"></label></div>
 <label class="opt"><input type="checkbox" ${r.cmp ? 'checked' : ''} onchange="S.rp.cmp=this.checked;render(true)"> Comparar con el periodo anterior</label>
 <label class="opt"><input type="checkbox" ${r.gr !== false ? 'checked' : ''} onchange="S.rp.gr=this.checked;render(true)"> Mostrar gráficas aquí</label>
 ${r.rows && r.cmp && !r.prev ? '<small class="low">Toca Consultar para traer el periodo anterior.</small>' : ''}
 <div class="form"><button class="go" style="flex:1" onclick="rpRun()">Consultar</button>${r.rows ? '<button class="gh" aria-label="Volver a leer desde Firebase" onclick="rpRun(1)">↻</button>' : ''}</div>${rd}`
     : `<div class="rps"><span>📅 <b>${per}</b></span><button class="gh" aria-label="Volver a leer desde Firebase" onclick="rpRun(1)">↻ Actualizar</button></div>${rd}`
 }</div>
 <div class="card"><div class="pkh"><span>Filtrar resultados</span></div><small>Solo filtran lo ya consultado.</small>
 <div class="pkh" style="margin-top:10px"><span>Sucursal</span></div><div class="seg wr" style="margin:0 0 6px">${chip(r.br == null, 'S.rp.br=null;render(true)', 'Todas')}${brs()
   .map((n, i) => (!isOpen(i) ? '' : chip(r.br === i, `S.rp.br=${i};render(true)`, esc(n))))
   .join('')}</div>
 <div class="pkh"><span>Categoría</span></div><div class="seg wr" style="margin:0">${[
   ['t', 'Todo'],
   ['s', 'Salados'],
   ['d', 'Dulces'],
   ['b', 'Bebidas'],
 ]
   .map(([k, l]) => chip((r.cat || 't') == k, `S.rp.cat='${k}';render(true)`, l))
   .join('')}</div>
  <div class="pkh" style="margin-top:10px"><span>Tipo de venta</span></div><div class="seg wr" style="margin:0">${[
    ['t', 'Todo'],
    ['mostrador', 'Mostrador'],
    ['dv', 'A domicilio'],
  ]
    .map(([k, l]) => chip((r.dv || 't') == k, `S.rp.dv='${k}';render(true)`, l))
    .join('')}</div></div>${body}`;
}

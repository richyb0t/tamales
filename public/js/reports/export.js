/* Reportes · descarga en HTML y CSV. */

function rpHtml() {
  const r = S.rp;
  if (!r || !r.rows) return;
  const rows = rpF(r.rows),
    prev = r.cmp && r.prev ? rpF(r.prev) : null;
  if (!rows.length) return toast('No hay ventas para descargar');
  const css =
      ':root{--ac:#0a4f45;--go:#0a4f45;--bd:#e6e2d7;--mut:#505d58;--gr:#ddd8cb;--bar-soft:#c6d6cf;--c1:#0a4f45;--c2:#b8934a;--c3:#8e3b52;--c4:#3c5a78;--c5:#5e4b7a;--c6:#6b7f3e;--c7:#8a8f88}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{font:15px/1.4 system-ui,sans-serif;max-width:760px;margin:0 auto;padding:16px;color:#0f1f1b}.card{border:1px solid var(--bd);border-radius:14px;padding:12px;margin:12px 0;break-inside:avoid}h1,h3{margin:0 0 8px}small{color:var(--mut)}.kg{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:12px 0}.kg div{border:1px solid var(--bd);border-radius:12px;padding:10px}.kg b{display:block;font-size:20px}table{border-collapse:collapse;width:100%;font-size:13px}td,th{padding:5px 8px;border-bottom:1px solid var(--bd);text-align:right}td:first-child,th:first-child{text-align:left}.wrap{overflow-x:auto}.how{font-size:13px;color:var(--mut);margin:8px 0 0}h2{margin:22px 0 4px}small.ok,td.ok{color:#2c6a43}small.bad,td.bad,b.bad{color:#a32b24}small.low,td.low,b.low{color:#855400}',
    sc = rpScope(),
    h = `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reporte ${esc(r.from)} a ${esc(r.to)}</title><style>${css}</style><h1>🫔 Reporte de ventas</h1><small>${esc(r.from)} al ${esc(r.to)}${sc ? ' · ' + esc(sc) : ''}</small>${rpTxt(rows)}${rpKpi(rows)}${prev ? rpCmp(rows, prev) : ''}<h2>📊 Gráficos</h2>${rpGraf(rows)}<h2>📋 Detalle en tablas</h2>${rpCharts(rows)}${rpSell(rows)}${rpMore(rows)}${rpMermaHtml(r)}${rpControlHtml(r)}<script>${TIPJS}<\/script></html>`,
    a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([h], { type: 'text/html' }));
  a.download = 'reporte_' + r.from + '_' + r.to + '.html';
  a.click();
}

function rpCsv(det) {
  const r = S.rp;
  if (!r || !r.rows) return;
  const rows = rpF(r.rows),
    q = v => '"' + String(v).replace(/"/g, '""') + '"';
  let t;
  if (det)
    t =
      '﻿dia,hora,sucursal,vendedor,producto,tipo,cantidad,precio,importe,descuento,pedido\n' +
      rows
        .slice()
        .sort((a, b) => a.ts - b.ts)
        .map(s =>
          [
            s.day,
            hm(s.ts),
            brs()[s.branch] || (s.branch == null ? 'Pedido grande' : s.branch),
            s.by,
            nm(s.f),
            s.type,
            s.qty,
            s.price,
            (s.type == 'devolucion' ? -1 : 1) * s.qty * s.price,
            s.descuento || 0,
            s.order,
          ]
            .map(q)
            .join(',')
        )
        .join('\n');
  else {
    const m = {};
    rows.forEach(s => {
      const k = [s.day, brs()[s.branch] || (s.branch == null ? 'Pedido grande' : s.branch), nm(s.f)].join('|'),
        x = (m[k] = m[k] || { u: 0, a: 0 }),
        g = s.type == 'devolucion' ? -1 : 1;
      x.u += g * s.qty;
      x.a += g * s.qty * s.price;
    });
    t =
      '﻿dia,sucursal,producto,unidades,importe\n' +
      Object.entries(m)
        .sort()
        .map(([k, x]) => k.split('|').map(q).join(',') + ',' + x.u + ',' + x.a)
        .join('\n');
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([t], { type: 'text/csv' }));
  a.download = (det ? 'detalle_' : 'ventas_') + r.from + '_' + r.to + '.csv';
  a.click();
}

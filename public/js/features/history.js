/* Historial por pedido: anular, devolver y agrupar lo cobrado al mismo tiempo. */

async function anular(id) {
  const s = S.sales.find(x => x._id == id);
  if (!s) return;
  if (S.me.role == 'vend' && s.type != 'apartado' && corteBlk()) return;
  if (s.type == 'vendido' && net(s.branch, s.f) - s.qty < 0)
    return toast('Primero hay que anular la devolución de ese sabor');
  ask('¿Anular este movimiento? El inventario se ajusta solo.', async () => {
    try {
      /* la anulación y su registro en la bitácora van juntos: las reglas no dejan borrar una venta cobrada sin bitácora */
      const bt = db.batch();
      bt.set(
        'logs/del_' + id,
        logD({
          branch: s.branch,
          kind: 'anulacion',
          label:
            'Anulado · ' +
            ({ vendido: 'venta', apartado: 'apartado', devolucion: 'devolución' }[s.type] ||
              s.type),
          txt: s.qty + '× ' + nm(s.f) + (s.client ? ' · ' + s.client : ''),
          amt: s.qty * s.price,
        })
      );
      bt.delete('sales/' + id);
      await bt.commit();
      toast('Anulado');
    } catch (e) {
      err(e);
    }
  });
}

function devList() {
  const l = S.sales.filter(s => s.type == 'devolucion').sort((a, c) => c.ts - a.ts);
  if (!l.length) return '';
  return `<div class="card"><h3>Devoluciones de hoy</h3>${l
    .map(s => {
      const d = new Date(s.ts);
      return `<div class="row"><div>${nz(s.qty)}× ${nm(s.f)} · ${esc(brs()[s.branch])}<br><small>${pad(d.getHours())}:${pad(d.getMinutes())} · ${esc(s.reason)} · ${s.restock ? 'regresó al inventario' : 'no regresó al inventario'} · ${esc(s.by)}</small></div></div>`;
    })
    .join('')}</div>`;
}

const reg = ids => (S.ar.push(ids), S.ar.length - 1);

function anularMany(ids, msg) {
  const L = ids.map(i => S.sales.find(x => x._id == i)).filter(Boolean);
  if (!L.length) return;
  if (S.me.role == 'vend' && L.some(x => x.type != 'apartado') && corteBlk()) return;
  const dv = {};
  L.forEach(s => {
    if (s.type == 'vendido') dv[s.f] = (dv[s.f] || 0) + s.qty;
    if (s.type == 'devolucion') dv[s.f] = (dv[s.f] || 0) - s.qty;
  });
  const bad = Object.keys(dv).find(f => net(L[0].branch, +f) - dv[f] < 0);
  if (bad) return toast('Primero hay que anular la devolución de ' + nm(+bad));
  ask(msg, async () => {
    try {
      const bt = db.batch();
      L.forEach(x => {
        bt.set(
          'logs/del_' + x._id,
          logD({
            branch: x.branch,
            kind: 'anulacion',
            label:
              'Anulado · ' +
              ({ vendido: 'venta', apartado: 'apartado', devolucion: 'devolución' }[x.type] ||
                x.type),
            txt: x.qty + '× ' + nm(x.f) + (x.client ? ' · ' + x.client : ''),
            amt: x.qty * x.price,
          })
        );
        bt.delete('sales/' + x._id);
      });
      await bt.commit();
      toast('Anulado');
    } catch (e) {
      err(e);
    }
  });
}

function anularR(n, k) {
  anularMany(
    S.ar[n] || [],
    k
      ? '¿Anular esta devolución? El inventario se ajusta solo.'
      : '¿Anular el pedido completo? El inventario se ajusta solo.'
  );
}

function grpHtml(i) {
  const k = S.gk[i],
    l = S.gg[k],
    sl = l.filter(s => s.type != 'devolucion').sort((a, c) => a.ts - c.ts),
    rl = l.filter(s => s.type == 'devolucion'),
    tot = sl.reduce((a, s) => a + s.qty * s.price, 0) - rl.reduce((a, s) => a + s.qty * s.price, 0),
    lv = sl.some(s => s.type == 'apartado' && live(s)),
    ex = !lv && sl.length > 0 && sl.every(s => s.type == 'apartado' && !live(s)),
    st = lv
      ? ['low', 'Apartado']
      : ex
        ? ['bad', 'Vencido']
        : sl.length
          ? rl.length
            ? ['bad', 'Con devolución']
            : ['ok', 'Cobrado']
          : ['bad', 'Devolución'],
    line = x =>
      `<div class="hxl"><b class="hxq">${nz(x.qty)}×</b><div class="hxn">${nm(x.f)}<small>${hm(x.ts)} · ${live(x) ? TL[x.type] : '<b class="bad">Vencido</b>'}${x.client ? ' · ' + esc(x.client) : ''}${x.type == 'devolucion' ? ' · ' + esc(x.reason || '') : ''}</small></div><span class="hxv${x.type == 'devolucion' ? ' bad' : ''}">${x.type == 'devolucion' ? '−' : ''}${money(x.qty * x.price)}</span>${x.type == 'apartado' && live(x) && !x.req && !x.order ? `<button class="go" onclick="deliver('${x._id}')">Entregar y cobrar</button>` : ''}<button class="gh" onclick="anular('${x._id}')">Anular</button></div>`,
    dv = sl.find(x => x.type == 'apartado' && live(x) && !x.req && x.order),
    ft = [
      dv ? `<button class="go" onclick="deliver('${dv._id}')">Entregar y cobrar</button>` : '',
      sl.some(x => x.type == 'vendido')
        ? `<button class="gh" onclick="devPed(${i})">Devolver</button>`
        : '',
      l.length > 1
        ? `<button class="gh bad" onclick="anularR(${reg(l.map(x => x._id))},0)">Anular pedido</button>`
        : '',
    ].join(''),
    rg = {};
  rl.forEach(x => (rg[x.ret || x._id] = rg[x.ret || x._id] || []).push(x));
  const rb = Object.values(rg)
    .map(
      g =>
        `<div class="hxr">${g.length > 1 ? `<div class="hxrh"><b class="bad">Devolución · ${hm(g[0].ts)}</b><button class="gh" onclick="anularR(${reg(g.map(x => x._id))},1)">Anular devolución</button></div>` : ''}${g.map(line).join('')}</div>`
    )
    .join('');
  return `<div class="hx hx-${st[0]}"><div class="hxh"><span class="chip ${st[0]}">${st[1]}</span><small>${hm(sl.length ? sl[0].ts : rl[0].ts)}${sl.length > 1 ? ' · ' + sl.length + ' artículos' : ''}</small><b class="hxm">${tot < 0 ? '−' : ''}${money(Math.abs(tot))}</b></div>${sl.map(line).join('')}${rb}${ft ? `<div class="hxa">${ft}</div>` : ''}</div>`;
}

function histView(mine) {
  S.ar = [];
  const g = {},
    ord = [];
  mine.forEach(s => {
    const k = s.order || s.pre || s.req || s._id;
    if (!g[k]) {
      g[k] = [];
      ord.push(k);
    }
    g[k].push(s);
  });
  const ap = k => g[k].some(s => s.type == 'apartado' && live(s)),
    keys = [...ord.filter(ap), ...ord.filter(k => !ap(k))].slice(0, 200);
  S.gk = keys;
  S.gg = g;
  const np = keys.filter(ap).length;
  if (!keys.length)
    return '<div class="card hxe"><b>Todavía no hay movimientos</b><small>Cuando cobres o apartes algo, aparece aquí.</small></div>';
  return keys
    .map(
      (_, i) =>
        (np && i == 0 ? `<div class="hxs">Por entregar · ${np}</div>` : '') +
        (np && i == np ? '<div class="hxs">Del día</div>' : '') +
        grpHtml(i)
    )
    .join('');
}

function devPed(i) {
  const k = S.gk[i],
    l = S.gg[k] || [],
    R = {};
  l.filter(s => s.type == 'vendido').forEach(s => (R[s.f] = (R[s.f] || 0) + s.qty));
  l.filter(s => s.type == 'devolucion').forEach(s => (R[s.f] = (R[s.f] || 0) - s.qty));
  const fs = Object.keys(R)
    .map(f => [+f, R[f]])
    .filter(x => x[1] > 0);
  if (!fs.length) return toast('Este pedido ya se devolvió completo');
  S.dp = { k, fs };
  const m = $('#modal');
  m.innerHTML = `<div class="card mv"><h3>Devolver del pedido</h3><small>Escribe cuántas devuelves de cada uno.</small>${fs.map(([f, mx]) => `<div class="row"><div>${nm(f)}<br><small>máx. ${mx}</small></div><input type="number" min="0" max="${mx}" id="dp${f}" value="0"></div>`).join('')}<div class="form"><button class="gh" onclick="S.dp.fs.forEach(([f,x])=>$('#dp'+f).value=x)">Todo el pedido</button></div><div class="form"><select id="dpr" aria-label="Motivo"><option>Mal estado</option><option>Pedido equivocado</option><option>Cliente no satisfecho</option><option>Otro</option></select><input id="dpt" placeholder="Detalle"></div><label><input type="checkbox" id="dps"> El producto regresa al inventario</label><div class="form"><button id="dpk">Devolver</button><button class="alt" id="dpn">Cancelar</button></div></div>`;
  m.style.display = 'flex';
  $('#dpn').onclick = () => (m.style.display = 'none');
  $('#dpk').onclick = saveDevPed;
}

async function saveDevPed() {
  const b = S.me.branch,
    r = $('#dpr').value,
    t = $('#dpt').value.trim(),
    ts = Date.now(),
    rid = 'r' + ts,
    k = S.dp.k,
    rs = $('#dps').checked,
    it = [];
  S.dp.fs.forEach(([f, mx]) => {
    const q = Math.min(mx, Math.max(0, parseInt($('#dp' + f).value) || 0));
    if (q > 0) it.push([f, q]);
  });
  if (!it.length) return toast('Escribe cuántas devuelves');
  if (r == 'Otro' && !t) return toast('Escribe el motivo');
  const pr = f => {
    const x = (S.gg[k] || []).find(s => s.type == 'vendido' && s.f == f);
    return x ? x.price : price(f);
  };
  /* candado: con red lenta el botón seguía activo y un segundo toque registraba la devolución dos veces */
  if (corteBlk()) return;
  if (!lock('dp' + k)) return;
  const kb = $('#dpk');
  if (kb) kb.disabled = true;
  try {
    const bt = db.batch();
    it.forEach(([f, q], i) => {
      const origSale = (S.gg[k] || []).find(s => s.type == 'vendido' && s.f == f);
      bt.add('sales', {
        day: D,
        branch: b,
        f,
        qty: q,
        type: 'devolucion',
        price: pr(f),
        reason: r + (t ? ': ' + t : ''),
        restock: rs,
        order: k,
        ret: rid,
        orig: origSale ? origSale._id : null,
        by: S.me.user,
        ts: ts + i,
      });
    });
    await bt.commit();
    $('#modal').style.display = 'none';
    toast('Devolución registrada');
  } catch (e) {
    delete lock.s['dp' + k];
    if (kb) kb.disabled = false;
    err(e);
  }
}

const histN = () => {
  const g = {};
  S.sales.forEach(s => {
    if (S.me && s.branch == S.me.branch && s.type == 'apartado' && live(s))
      g[s.order || s.pre || s.req || s._id] = 1;
  });
  return Object.keys(g).length;
};

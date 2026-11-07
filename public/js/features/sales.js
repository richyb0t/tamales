/* Vender: carrito, cobro, cambio y entrega de apartados. */

function cadd(f, n) {
  if (n > 0 && corteBlk()) return;
  if (n > 0 && f < 100 && !price(f))
    return toast('Falta el precio de ' + nm(f) + '. Avísale al administrador');
  const c = (S.cart[f] || 0) + n,
    b = S.me.branch;
  if (
    c < 0 ||
    c > (f >= 100 ? Math.floor((chLeft(b) - cartLit(f) + 1e-9) / CL[f - 100]) : left(b, f))
  ) {
    if (f >= 100 && n > 0) toast('No alcanza el champurrado para ese tamaño');
    return;
  }
  if (c) S.cart[f] = c;
  else delete S.cart[f];
  render(true);
}

const ctot = () => Object.entries(S.cart).reduce((a, [f, q]) => a + q * price(+f), 0);

async function order(t, p) {
  if (order.b) return;
  const b = S.me.branch,
    e = Object.entries(S.cart).map(([f, q]) => [+f, q]);
  if (!e.length) return;
  if (corteBlk()) return;
  const z0 = noPrice(e.map(x => x[0]));
  if (z0)
    return toast('Falta el precio de ' + z0 + '. Avísale al administrador para poder venderlo');
  if (e.some(([f, q]) => f < 100 && q > left(b, f)) || cartLit(-1) > chLeft(b) + 1e-9)
    return toast('Cambió el inventario, revisa las cantidades');
  const total = ctot(),
    lines = e.map(([f, q]) => q + '× ' + nm(f)).join(', '),
    ts = Date.now(),
    oid = S.me.id + '-' + ts;
  const cart = S.cart;
  order.b = 1;
  S.cart = {};
  S.cd = false;
  render(true);
  try {
    const bt = db.batch();
    e.forEach(([f, q], i) =>
      bt.add('sales', {
        day: D,
        branch: b,
        f,
        qty: q,
        type: t,
        price: price(f),
        order: oid,
        by: S.me.user,
        ts: ts + i,
      })
    );
    await bt.commit();
    try {
      navigator.vibrate && navigator.vibrate(40);
    } catch (_) {}
    note(
      t == 'vendido' ? 'Pedido cobrado' : 'Pedido apartado',
      lines,
      total,
      t == 'vendido' ? p : null
    );
  } catch (x) {
    S.cart = cart;
    render(true);
    err(x);
  } finally {
    order.b = 0;
  }
}

function pay() {
  const tot = ctot();
  if (!Object.keys(S.cart).length) return;
  const m = $('#modal');
  m.innerHTML = `<div class="card"><small>Cobro</small><div class="big" style="font-size:38px">${money(tot)}</div><div class="form"><input type="number" min="0" inputmode="decimal" id="pg" class="wide" aria-label="Con cuánto paga el cliente" placeholder="Paga con $" oninput="chg()"></div><div class="form">${[
    20, 50, 100, 200, 500, 1000,
  ]
    .filter(v => v >= tot)
    .slice(0, 3)
    .map(v => `<button class="gh" onclick="pgSet(${v})">$${v}</button>`)
    .join(
      ''
    )}<button class="gh" onclick="pgSet(${tot})">Exacto</button></div><div id="cg" class="big" style="font-size:26px"></div><div class="form"><button id="mk">Confirmar cobro</button><button class="alt" id="mn">Cancelar</button></div></div>`;
  m.style.display = 'flex';
  $('#mn').onclick = () => (m.style.display = 'none');
  $('#mk').onclick = () => {
    const p = $('#pg').value === '' ? tot : +$('#pg').value;
    if (p < tot) return toast('El pago no alcanza');
    m.style.display = 'none';
    order('vendido', p);
  };
  chg();
}

function pgSet(v) {
  $('#pg').value = v;
  chg();
}

/* Ventana de cobro para entregas de apartados: mismo cobro y cambio que una venta normal; al confirmar llama go(pagó) */
function payAsk(tot, head, line, go) {
  const m = $('#modal');
  m.innerHTML = `<div class="card"><small>${esc(head)}</small><p>${esc(line)}</p><small>Cobro</small><div class="big" style="font-size:38px">${money(tot)}</div><div class="form"><input type="number" min="0" inputmode="decimal" id="pq" class="wide" aria-label="Con cuánto paga el cliente" placeholder="Paga con $" oninput="pqChg(${tot})"></div><div class="form">${[
    20, 50, 100, 200, 500, 1000,
  ]
    .filter(v => v >= tot)
    .slice(0, 3)
    .map(v => `<button class="gh" onclick="pqSet(${v},${tot})">$${v}</button>`)
    .join(
      ''
    )}<button class="gh" onclick="pqSet(${tot},${tot})">Exacto</button></div><div id="cq" class="big" style="font-size:26px"></div><div class="form"><button id="mk">Confirmar cobro</button><button class="alt" id="mn">Cancelar</button></div></div>`;
  m.style.display = 'flex';
  $('#mn').onclick = () => (m.style.display = 'none');
  $('#mk').onclick = () => {
    const v = $('#pq').value,
      pg = v === '' ? tot : +v;
    if (pg < tot) return toast('El pago no alcanza');
    m.style.display = 'none';
    go(pg);
  };
}

function pqChg(tot) {
  const v = $('#pq').value,
    e = $('#cq');
  if (v === '') {
    e.textContent = '';
    return;
  }
  const d = +v - tot;
  e.className = 'big ' + (d < 0 ? 'bad' : 'ok');
  e.textContent = d < 0 ? 'Faltan ' + money(-d) : 'Cambio: ' + money(d);
}

function pqSet(v, tot) {
  $('#pq').value = v;
  pqChg(tot);
}

function chg() {
  const tot = ctot(),
    v = $('#pg').value,
    e = $('#cg');
  if (v === '') {
    e.textContent = '';
    return;
  }
  const d = +v - tot;
  e.className = 'big ' + (d < 0 ? 'bad' : 'ok');
  e.textContent = d < 0 ? 'Faltan ' + money(-d) : 'Cambio: ' + money(d);
}

function note(h, l, t, p) {
  const m = $('#modal');
  m.innerHTML = `<div class="card"><small>${esc(h)}</small><p>${esc(l)}</p><small>Total</small><div class="big" style="font-size:38px">${money(t)}</div>${p != null ? `<small>Pagó ${money(p)}</small><br><small>Cambio</small><div class="big ok" style="font-size:38px">${money(p - t)}</div>` : ''}<div class="form"><button id="mk">Listo</button></div></div>`;
  m.style.display = 'flex';
  $('#mk').onclick = () => (m.style.display = 'none');
}

/* Entregar un apartado hecho desde Vender: cobra con la misma ventana de cobro y cambio. Si el apartado fue un pedido de varios renglones, se cobra y entrega el pedido completo. */
function deliver(id) {
  const s = S.sales.find(x => x._id == id);
  if (!s) return;
  if (corteBlk()) return;
  const g = s.order
    ? S.sales.filter(x => x.order == s.order && x.type == 'apartado' && live(x))
    : [s];
  if (!g.length) return;
  const tot = g.reduce((a, x) => a + x.qty * x.price, 0),
    line = g.map(x => x.qty + '× ' + nm(x.f)).join(', ');
  payAsk(tot, 'Entregar y cobrar' + (s.client ? ' · ' + s.client : ''), line, async pg => {
    if (
      g.some(x => {
        const c = S.sales.find(y => y._id == x._id);
        return !c || c.type != 'apartado';
      })
    )
      return toast('Este apartado ya cambió');
    try {
      await Promise.all(
        g.map(x => db.doc('sales/' + x._id).update({ type: 'vendido', by: S.me.user }))
      );
      try {
        navigator.vibrate && navigator.vibrate(40);
      } catch (_) {}
      note('Apartado entregado' + (s.client ? ' · ' + s.client : ''), line, tot, pg);
    } catch (e) {
      err(e);
    }
  });
}

function cartBar() {
  const e = Object.entries(S.cart);
  if (!e.length) return '';
  const n = e.reduce((a, [f, q]) => a + (+f < 100 ? q : 0), 0),
    m = e.reduce((a, [f, q]) => a + (+f >= 100 ? q : 0), 0),
    lbl = [
      n ? n + (n > 1 ? ' tamales' : ' tamal') : '',
      m ? m + (m > 1 ? ' champurrados' : ' champurrado') : '',
    ]
      .filter(Boolean)
      .join(' + ');
  return `<div class="cart"><div class="ct">${S.cd ? `<div class="cd">${e.map(([f, q]) => `<div class="row"><div>${q}× ${nm(f)}</div><b style="font-size:16px">${money(q * price(+f))}</b></div>`).join('')}</div>` : ''}<div class="ci" onclick="S.cd=!S.cd;render(true)"><small>${lbl} · ${S.cd ? 'ocultar' : 'ver pedido'}</small><b>${money(ctot())}</b></div><button class="gh" aria-label="Vaciar pedido" onclick="S.cart={};S.cd=false;render(true)">✕</button><button class="alt" onclick="order('apartado')">Apartar</button><button class="go" onclick="pay()">Cobrar</button></div></div>`;
}

function precioBanner(b) {
  const z = F.map((n, f) => f).filter(f => !price(f) && left(b, f) > 0);
  return z.length
    ? `<div class="card" style="border:2px solid var(--bad)"><b class="bad">⚠️ Sin precio: ${z.map(f => esc(F[f])).join(', ')}</b><br><small>No se pueden vender hasta que el administrador guarde sus precios en Ajustes.</small></div>`
    : '';
}

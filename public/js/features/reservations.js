/* Apartados por fecha: hoy y otros días (formulario, entrega, cancelación). */

const preN = () => S.pre.filter(p => p.date <= D).length;

const preTxt = p =>
  Object.entries(p.items || {})
    .map(([k, v]) => v + '× ' + nm(+k.slice(1)))
    .join(', ');

const preTot = p => {
  const base = Object.entries(p.items || {}).reduce((a, [k, v]) => a + v * price(+k.slice(1)), 0);
  const tamQty = Object.entries(p.items || {}).filter(([k]) => +k.slice(1) < 100).reduce((a, [, v]) => a + (+v || 0), 0);
  const chQty = Object.entries(p.items || {}).filter(([k]) => +k.slice(1) >= 100).reduce((a, [, v]) => a + (+v || 0), 0);
  const disc = (tamQty * (+(p.descTamal) || 0)) + (chQty * (+(p.descChamp) || 0));
  return Math.max(0, base - disc);
};

const preQty = p => Object.values(p.items || {}).reduce((a, v) => a + (+v || 0), 0);

/* Las cantidades se guardan con dos formas de llave: 102 en el formulario y f102 en Firestore. */
const fNum = k => +String(k).replace(/^f/, '');

/* Litros que representa cada presentación de champurrado: 250 ml, 500 ml y 1 l. */
const CH_L = [0.25, 0.5, 1];

/* Mayoreo de champurrado: 5 L cuestan $45 por litro y 10 L cuestan $35 por litro.
   Devuelve los litros, el precio por litro que aplica y el descuento promedio por pieza. */
const preChamp = items => {
  let liters = 0,
    base = 0,
    qty = 0;
  Object.entries(items || {}).forEach(([k, v]) => {
    const f = fNum(k),
      i = f - 100,
      q = +v || 0;
    if (f < 100 || q <= 0 || !CH[i]) return;
    liters += q * CH_L[i];
    base += q * price(f);
    qty += q;
  });
  liters = Math.round(liters * 100) / 100;
  const perL = liters >= 10 ? 35 : liters >= 5 ? 45 : 0,
    total = perL ? liters * perL : base,
    disc = Math.max(0, base - total);
  return { liters, base, qty, perL, total, disc, unit: qty ? disc / qty : 0 };
};

const champNote = c =>
  c.qty
    ? `Champurrado: ${c.liters} L · ${c.perL ? money(c.perL) + '/L · ' + money(c.total) : 'precio normal'}`
    : 'Champurrado al mayoreo: 5 L = $45/L · 10 L = $35/L.';

/* Líneas del pedido grande en orden: primero tamales y luego champurrado, con su descuento por pieza. */
const pdLines = (items, descTamal) => {
  const ch = preChamp(items);
  return [
    ...F.map((name, f) => ({ f, name, qty: +(items[f] || 0), unit: price(f), disc: +descTamal || 0 })),
    ...CH.map((c, i) => {
      const f = 100 + i;
      return { f, name: 'Champurrado ' + c[0], qty: +(items[f] || 0), unit: price(f), disc: ch.unit };
    }),
  ].filter(x => x.qty > 0);
};

/* Resumen corto de piezas para el botón de guardar: tamales y champurrado por separado. */
const pdQtyText = items => {
  const sum = min => Object.entries(items).reduce((a, [k, v]) => a + ((+k < 100) === min ? +v || 0 : 0), 0),
    tam = sum(true),
    ch = sum(false),
    parts = [];
  if (tam) parts.push(tam + (tam == 1 ? ' tamal' : ' tamales'));
  if (ch) parts.push(ch + (ch == 1 ? ' champurrado' : ' champurrados'));
  return parts.join(' · ');
};

const preSum = l => {
  const items = [];
  F.forEach((n, f) => {
    const q = l.reduce((a, p) => a + (+(p.items || {})['f' + f] || 0), 0);
    if (q > 0) items.push(q + ' ' + n);
  });
  CH.forEach((c, i) => {
    const f = 100 + i;
    const q = l.reduce((a, p) => a + (+(p.items || {})['f' + f] || 0), 0);
    if (q > 0) items.push(q + ' champurrado ' + c[0].toLowerCase());
  });
  return items.join(' · ');
};

function nd() {
  const id = (S.me && S.me.id) || 'anon';
  S.nds = S.nds || {};
  if (!S.nds[id])
    S.nds[id] = { date: tmr(1), items: {}, name: '', phone: '', note: '', branch: BI()[0], large: false, addr: '', time: '', fee: '', descTamal: '', descChamp: '', step: 1 };
  const n = S.nds[id];
  if (n.date < D) n.date = tmr(1);
  if (!BI().includes(n.branch)) n.branch = BI()[0];
  if (n.date < D || (n.date == D && !n.large && (S.me.role == 'vend' || encBlk(n.branch))))
    n.date = tmr(1);
  return n;
}

function pdAdd(f, n) {
  const x = nd();
  x.items = { ...x.items, [f]: Math.max(0, Math.min(499, (x.items[f] || 0) + n)) };
  render(true);
}

/* Cantidad escrita a mano: se guarda sin volver a dibujar la pantalla para no perder el foco ni el botón Guardar */
function pdSet(f, v, el) {
  const q = Math.max(0, Math.min(499, Math.floor(+v) || 0));
  nd().items = { ...nd().items, [f]: q };
  const r = el.closest('.fl');
  if (r) r.classList.toggle('sel', q > 0);
  if (!nd().large) {
    const b = document.querySelector('.cart .ct .go'),
      t = pdQtyText(nd().items);
    if (b) b.textContent = 'Guardar apartado' + (t ? ' · ' + t : '');
  }
  const tEl = document.getElementById('pdt');
  if (tEl) {
    const t = Object.entries(nd().items).reduce((a, [k, x]) => a + (+x || 0) * price(+k), 0),
      qty = Object.values(nd().items).reduce((a, x) => a + (+x || 0), 0);
    tEl.textContent = qty
      ? 'Productos: ' + money(t) + ' · ' + qty + (qty == 1 ? ' pieza' : ' piezas')
      : 'Elige los productos del pedido';
  }
  const e = document.getElementById('pdc');
  if (e) e.textContent = champNote(preChamp(nd().items));
}

/* Pedido grande: alterna el modo y reinicia el asistente. Al apagarlo borra los datos que solo aplican al mayoreo. */
function pdLarge() {
  const n = nd();
  n.large = !n.large;
  n.step = 1;
  if (!n.large) {
    n.addr = '';
    n.time = '';
    n.fee = '';
    n.descTamal = '';
    n.descChamp = '';
  }
  render(true);
}

function pdStep(s) {
  nd().step = Math.min(4, Math.max(1, +s || 1));
  renderNow(true);
  requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

/* Recalcula el resumen del paso de precios sin volver a pintar toda la pantalla. */
function pdCalc() {
  const n = nd();
  if (!n.large) return;
  const lines = pdLines(n.items, n.descTamal),
    base = lines.reduce((a, x) => a + x.qty * x.unit, 0),
    desc = lines.reduce((a, x) => a + x.qty * x.disc, 0),
    fee = +(n.fee || 0) || 0,
    total = Math.max(0, base - desc),
    set = (id, text) => {
      const e = document.getElementById(id);
      if (e) e.textContent = text;
    };
  lines.forEach(x => {
    set('pdlt' + x.f, money(Math.max(0, x.qty * (x.unit - x.disc))));
    set('pdld' + x.f, money(x.unit) + ' c/u' + (x.disc ? ' · desc. ' + money(x.disc) + ' c/u' : ''));
  });
  set('pds', money(base));
  set('pdd2', '−' + money(desc));
  set('pdt2', money(total));
  set('pdf', money(fee));
  set('pdtot', money(total + fee));
  set('pdc', champNote(preChamp(n.items)));
}

function pdBr(i) {
  nd().branch = i;
  render(true);
}

function pdDate(v) {
  if (!v || v < D) return toast('Elige hoy o una fecha futura');
  if (v == D && S.me.role == 'vend') return toast('Para hoy no se puede: lo hace el administrador');
  if (v == D && !nd().large && encBlk(nd().branch))
    return toast('Para hoy ya no se puede: el inventario de esa sucursal ya se hizo');
  nd().date = v;
  render(true);
}

function preCard(p) {
  const m = S.me,
    V = m.role == 'vend',
    A = m.role == 'admin',
    can = A || V || p.by == m.user;
  return `<div class="card"><div class="row"><div><b>${esc(p.client)}</b>${p.phone ? ' · ' + esc(p.phone) : ''}<br><small>${V ? '' : p.large ? '📦 Pedido grande · ' : esc(brs()[p.branch]) + ' · '}${p.date < D ? '<b class="bad">Pendiente desde ' + esc(fdate(p.date)) + '</b> · ' : p.date > D ? esc(fdate(p.date)) + ' · ' : ''}${p.exp && p.exp < Date.now() ? '<b class="bad">Vencido</b> · ' : ''}${p.large && p.time ? '🕒 ' + ftime(p.time) + ' · ' : ''}lo apartó ${esc(p.byName || p.by)}${p.ok ? ' · <b class="ok">✅ Aceptado</b>' : ''}</small></div><b>${money(preTot(p))}</b></div><div>${esc(preTxt(p))}</div>${p.large && p.addr ? `<div>📍 ${esc(p.addr)}</div>` : ''}${p.note ? `<small>📝 ${esc(p.note)}</small>` : ''}<div class="form">${(V || A) && p.date <= D && !(p.exp && p.exp < Date.now()) ? `<button class="go" onclick="deliverPre('${p._id}')">Entregar y cobrar</button>` : ''}${p.large && p.status == 'pendiente' && (A || m.role == 'enc' || m.role == 'sup') ? `<button class="alt" onclick="editPre('${p._id}')">Editar</button>` : ''}${p.large && p.addr && !(p.dvId && (S.dv || []).some(x => x._id == p.dvId)) && (A || m.role == 'enc' || m.role == 'sup') ? `<button class="alt" onclick="dvAddFromPre('${p._id}')">Agregar reparto</button>` : ''}${can ? `<button class="gh" style="color:var(--bad)" onclick="cancelPre('${p._id}')">Cancelar</button>` : ''}</div></div>`;
}

const newBtn =
  '<div class="form" style="margin:0 0 10px"><button class="alt" style="flex:1" onclick="S.apt=\'o\';S.anew=false;admNew()">＋ Nuevo apartado</button></div>';

function preToday(l) {
  if (!l.length)
    return newBtn + '<div class="card"><small>No hay apartados para entregar hoy.</small></div>';
  const g = {};
  l.forEach(p => (g[p.date] = g[p.date] || []).push(p));
  return (
    newBtn +
    Object.keys(g)
      .sort()
      .map(
        d =>
          (d < D
            ? `<h3 style="margin:12px 4px 6px;text-transform:capitalize">Sin entregar · ${esc(fdate(d))}</h3>`
            : `<h3 style="margin:6px 4px">Para hoy</h3>`) +
          g[d]
            .sort((a, c) => a.ts - c.ts)
            .map(preCard)
            .join('')
      )
      .join('')
  );
}

function preLater(l) {
  if (!l.length) return '<div class="card"><small>No hay apartados para otros días.</small></div>';
  const g = {};
  l.forEach(p => (g[p.date] = g[p.date] || []).push(p));
  return Object.keys(g)
    .sort()
    .map(
      d =>
        `<h3 style="margin:14px 4px 2px;text-transform:capitalize">${esc(fdate(d))}</h3><small style="display:block;margin:0 4px 6px">${g[d].length} apartado${g[d].length > 1 ? 's' : ''} · ${esc(preSum(g[d]))}</small>` +
        g[d]
          .sort((a, c) => a.ts - c.ts)
          .map(preCard)
          .join('')
    )
    .join('');
}

function apForm(hoy) {
  const m = S.me,
    V = m.role == 'vend',
    n = nd(),
    fb = !V && S.apb != null && BI().includes(S.apb),
    _f = fb && (n.branch = S.apb),
    cl = V || (!n.large && encBlk(n.branch)),
    sel = n.items,
    ch = preChamp(sel),
    tot = Object.values(sel).reduce((a, v) => a + v, 0),
    large = !!n.large,
    step = large ? Math.min(4, Math.max(1, +n.step || 1)) : 0,
    steps = ['Cliente', 'Productos', 'Precios', 'Fecha'],
    base = Object.entries(sel).reduce((a, [k, v]) => a + (+v || 0) * price(+k), 0),
    lines = pdLines(sel, n.descTamal),
    fee = +(n.fee || 0) || 0,
    descTotal = lines.reduce((a, x) => a + x.qty * x.disc, 0),
    totalP = Math.max(0, base - descTotal);
  if (large) n.step = step;

  const canLarge = !V && (m.role == 'admin' || m.role == 'enc' || m.role == 'sup');
  const head = `<div class="card" id="apf"><h3>${large ? 'Nuevo pedido grande' : 'Nuevo apartado'}</h3>${
    large
      ? `<small>Paso ${step} de 4 · ${steps[step - 1]}</small><div style="display:flex;gap:4px;margin:6px 0 10px">${steps.map((s, i) => `<div style="flex:1;height:4px;border-radius:2px;background:${i + 1 <= step ? 'var(--ac)' : 'var(--bd)'}"></div>`).join('')}</div>`
      : '<small>Elige para qué día. El administrador lo ve antes de preparar el inventario de ese día.</small>'
  }
 ${V || large ? '' : fb ? `<small style="display:block;margin-top:8px">Sucursal: <b>${esc(brs()[n.branch])}</b></small>` : `<small style="display:block;margin-top:8px">¿Para qué sucursal?</small>` + bchips(n.branch, 'pdBr')}
  ${canLarge && (!large || step === 1) ? `<div class="form" style="margin:${large ? '4px 0 0' : '8px 0'}"><button class="${large ? 'gh' : 'alt'}" style="flex:1" onclick="pdLarge()">${large ? 'Cambiar a apartado de sucursal' : '📦 Convertir en pedido grande'}</button></div>` : ''}`;

  const dateBox = large
    ? `<small style="display:block;margin-top:8px;font-weight:700">Fecha de entrega</small><div class="form" style="margin-top:4px"><input type="date" id="pdd" aria-label="Fecha de entrega" min="${D}" value="${n.date}" onchange="pdDate(this.value)" style="flex:1"></div>`
    : hoy
      ? `<small style="display:block;margin-top:8px">Fecha</small><small style="display:block"><b>Hoy · ${esc(fdate(D))}</b></small>${!V && loadDone(n.branch) ? `<small style="display:block">${loadEmpty(n.branch) ? 'La carga de hoy está vacía: puedes apartar sin límite y se suman al volver a guardar la carga.' : encBlk(n.branch) ? 'La carga de hoy ya está guardada: ya no se puede apartar para hoy en ' + esc(brs()[n.branch]) + '.' : 'La carga de hoy ya está guardada: el apartado se descuenta de lo que queda en ' + esc(brs()[n.branch]) + '.'}</small>` : ''}`
      : `<small style="display:block;margin-top:8px">Fecha</small>${cl ? (encBlk(n.branch) ? `<small class="low" style="display:block">La carga de hoy ya está guardada: ya no se puede apartar para hoy en ${esc(brs()[n.branch])}.</small>` : '') : !V && loadDone(n.branch) ? `<small style="display:block">${loadEmpty(n.branch) ? 'La carga de hoy está vacía: puedes apartar sin límite y se suman al volver a guardar la carga.' : encBlk(n.branch) ? 'La carga de hoy ya está guardada: ya no se puede apartar para hoy en ' + esc(brs()[n.branch]) + '.' : 'La carga de hoy ya está guardada: el apartado de hoy se descuenta de lo que queda en ' + esc(brs()[n.branch]) + '.'}</small>` : `<small style="display:block">Para hoy solo se puede antes de hacer el inventario.</small>`}<div class="seg" style="margin:4px 0">${[0, 1, 2]
          .filter(k => !(k == 0 && cl))
          .map(k => `<button class="${n.date == tmr(k) ? 'on' : ''}" onclick="pdDate('${tmr(k)}')">${k == 0 ? 'Hoy' : k == 1 ? 'Mañana' : 'Pasado mañana'}</button>`)
          .join('')}</div>
 <div class="form"><input type="date" id="pdd" aria-label="Fecha del apartado" min="${cl ? tmr(1) : D}" value="${n.date}" onchange="pdDate(this.value)" style="flex:1"></div>`;

  const prodBox = `${F.map((nm, f) => `<div class="fl ${sel[f] ? 'sel' : ''}"><div class="fn"><b>${esc(nm)}</b><small>${money(price(f))}</small></div><div class="st"><button class="gh" onclick="pdAdd(${f},-1)">−</button><input type="number" min="0" max="499" inputmode="numeric" value="${sel[f] || 0}" aria-label="Cantidad de ${esc(nm)}" oninput="pdSet(${f},this.value,this)" onchange="this.value=nd().items[${f}]||0"><button onclick="pdAdd(${f},1)" aria-label="Más">+</button></div></div>`).join('')}
  <small style="display:block;margin:8px 0 6px">Champurrado</small>
  ${large ? '<small style="display:block;margin:0 0 6px;opacity:.8">Mayoreo: 5 L = $45/L · 10 L = $35/L (usa “Grande 1 l”).</small>' : ''}
  ${CH.map((cc, i) => { const f = 100 + i; return price(f) ? `<div class="fl ${sel[f] ? 'sel' : ''}"><div class="fn"><b>Champurrado ${esc(cc[0])}</b><small>${esc(cc[1])} · ${money(price(f))}</small></div><div class="st"><button class="gh" onclick="pdAdd(${f},-1)">−</button><input type="number" min="0" max="499" inputmode="numeric" value="${sel[f] || 0}" aria-label="Cantidad de champurrado ${esc(cc[0])}" oninput="pdSet(${f},this.value,this)" onchange="this.value=nd().items[${f}]||0"><button onclick="pdAdd(${f},1)" aria-label="Más">+</button></div></div>` : ''; }).join('')}`;

  let body = '';
  if (!large) {
    body = `
  ${dateBox}
  ${prodBox}
  <div class="form"><input id="pdn" placeholder="Cliente" value="${esc(n.name)}" oninput="nd().name=this.value" style="flex:1"><input placeholder="Teléfono" inputmode="tel" value="${esc(n.phone)}" oninput="nd().phone=this.value" style="flex:1"></div>
  <div class="form"><input placeholder="Nota" value="${esc(n.note)}" oninput="nd().note=this.value" style="flex:1"></div>`;
  } else if (step === 1) {
    body = `
  <div style="margin-top:4px">
   <small style="display:block;font-weight:700;color:var(--fg);margin-bottom:4px">Cliente</small>
   <div class="form" style="margin:0">
    <input id="pdn" placeholder="Nombre" value="${esc(n.name)}" oninput="nd().name=this.value" style="flex:1 1 0;min-width:0">
    <input placeholder="Teléfono" inputmode="tel" value="${esc(n.phone)}" oninput="nd().phone=this.value" style="flex:1 1 0;min-width:0">
   </div>
  </div>
  <div style="margin-top:14px">
   <small style="display:block;font-weight:700;color:var(--fg);margin-bottom:4px">Entrega</small>
   <div class="form" style="margin:0">
    <input id="pdaddr" placeholder="Dirección (opcional)" value="${esc(n.addr)}" oninput="nd().addr=this.value" style="flex:1 1 100%">
   </div>
   <small style="display:block;margin-top:4px;opacity:.7">Déjala vacía si van a recoger.</small>
   <div class="form" style="margin:8px 0 0;align-items:flex-end">
    <div style="flex:0 0 128px;min-width:0">
     <small style="display:block;margin-bottom:4px;opacity:.75">Hora</small>
     <input type="time" id="pdtime" aria-label="Hora de entrega (opcional)" value="${esc(n.time)}" oninput="nd().time=this.value" style="width:100%">
    </div>
    <div style="flex:1 1 0;min-width:0">
     <small style="display:block;margin-bottom:4px;opacity:.75">Nota</small>
     <input placeholder="Opcional" value="${esc(n.note)}" oninput="nd().note=this.value" style="width:100%">
    </div>
   </div>
  </div>`;
  } else if (step === 2) {
    body = `
  ${prodBox}
  <small id="pdt" style="display:block;margin-top:8px;opacity:.75">${tot ? 'Productos: ' + money(base) + ' · ' + tot + (tot == 1 ? ' pieza' : ' piezas') : 'Elige los productos del pedido'}</small>`;
  } else if (step === 3) {
    body = `
  <div class="form"><input type="number" step="0.5" min="0" placeholder="Desc. tamal $" aria-label="Descuento por tamal" value="${esc(n.descTamal)}" oninput="nd().descTamal=this.value;pdCalc()" style="flex:1"><input type="number" step="0.5" min="0" placeholder="Envío $" aria-label="Costo de envío" value="${esc(n.fee)}" oninput="nd().fee=this.value;pdCalc()" style="flex:1"></div>
  ${ch.qty ? `<small id="pdc" style="display:block;margin-top:6px;opacity:.85">${champNote(ch)}</small>` : ''}
  <div style="margin-top:10px">
   <small style="display:block;font-weight:700;margin-bottom:2px">Desglose</small>
   ${lines.length ? lines.map(x => `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;padding:6px 0;border-bottom:1px solid var(--bd)">
     <div style="min-width:0"><small style="display:block"><b>${x.qty}×</b> ${esc(x.name)}</small><small id="pdld${x.f}" style="display:block;opacity:.7">${money(x.unit)} c/u${x.disc ? ' · desc. ' + money(x.disc) + ' c/u' : ''}</small></div>
     <b id="pdlt${x.f}" style="white-space:nowrap">${money(Math.max(0, x.qty * (x.unit - x.disc)))}</b>
    </div>`).join('') : '<small style="display:block;opacity:.75">Sin productos</small>'}
  </div>
  <div style="margin-top:10px;padding:10px;border-radius:12px;background:var(--fill)">
   <div style="display:flex;justify-content:space-between"><small>Subtotal</small><small id="pds">${money(base)}</small></div>
   <div style="display:flex;justify-content:space-between"><small>Descuento</small><small id="pdd2">−${money(descTotal)}</small></div>
   <div style="display:flex;justify-content:space-between;margin-top:4px"><b>Total</b><b id="pdt2">${money(totalP)}</b></div>
   <div style="display:flex;justify-content:space-between"><small>Envío</small><small id="pdf">${money(fee)}</small></div>
   <div style="display:flex;justify-content:space-between"><b>Total con envío</b><b id="pdtot">${money(totalP + fee)}</b></div>
  </div>`;
  } else {
    body = `
  ${dateBox}
  <div style="margin-top:10px;padding:10px;border-radius:12px;background:var(--fill)">
   <small style="display:block"><b>${esc(n.name || 'Sin cliente')}</b>${n.phone ? ' · ' + esc(n.phone) : ''}</small>
   <small style="display:block;margin-top:2px">${n.addr.trim() ? '📍 ' + esc(n.addr) : '🏪 Recoge en el local'}${n.time ? ' · 🕒 ' + ftime(n.time) : ''}</small>
   <div style="margin-top:8px">
    ${lines.length ? lines.map(x => `<div style="display:flex;justify-content:space-between;gap:8px"><small><b>${x.qty}×</b> ${esc(x.name)}</small><small>${money(Math.max(0, x.qty * (x.unit - x.disc)))}</small></div>`).join('') : '<small style="opacity:.75">Sin productos</small>'}
   </div>
   <div style="display:flex;justify-content:space-between;margin-top:8px;border-top:1px solid var(--bd);padding-top:6px"><b>Total</b><b>${money(totalP)}</b></div>
   ${fee ? `<div style="display:flex;justify-content:space-between"><small>Envío</small><small>${money(fee)}</small></div><div style="display:flex;justify-content:space-between"><b>Total con envío</b><b>${money(totalP + fee)}</b></div>` : ''}
  </div>`;
  }

  const cart = large
    ? `<div class="cart"><div class="ct">${step > 1 ? `<button class="alt" style="flex:1" onclick="pdStep(${step - 1})">← Atrás</button>` : ''}${step < 4 ? `<button class="go" style="flex:1" onclick="pdStep(${step + 1})">${step == 1 ? 'Siguiente: Productos →' : step == 2 ? 'Siguiente: Precios →' : 'Siguiente: Fecha →'}</button>` : `<button class="go" style="flex:1" onclick="savePre()">Guardar pedido grande</button>`}</div></div>`
    : `<div class="cart"><div class="ct"><button class="go" style="flex:1" onclick="savePre()"${hoy && encBlk(n.branch) ? ' disabled' : ''}>Guardar apartado${pdQtyText(sel) ? ' · ' + pdQtyText(sel) : ''}</button></div></div>`;

  return head + body + '</div>' + cart;
}
async function savePre() {
  const n = nd(),
    V = S.me.role == 'vend',
    b = V ? S.me.branch : n.large ? null : n.branch,
    items = {};
  Object.entries(n.items).forEach(([f, v]) => {
    if (v > 0) items['f' + f] = v;
  });
  if (!Object.keys(items).length) {
    toast('Elige los tamales que apartan');
    if (n.large) {
      n.step = 2;
      renderNow(true);
    }
    return;
  }
  if (!n.name.trim()) {
    toast('Escribe el nombre del cliente');
    if (n.large) {
      n.step = 1;
      renderNow(true);
    }
    const e = $('#pdn');
    if (e) {
      e.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setTimeout(() => {
        try {
          e.focus({ preventScroll: true });
        } catch (_) {
          e.focus();
        }
      }, 350);
      e.classList.add('need');
      setTimeout(() => e.classList.remove('need'), 3000);
    }
    return;
  }
  if (!n.date || n.date < D) {
    toast('Elige hoy o una fecha futura');
    if (n.large) {
      n.step = 4;
      renderNow(true);
    }
    return;
  }
  if (n.date == D && S.me.role == 'vend')
    return toast('Para hoy no se puede: lo hace el administrador');
  if (!n.large && n.date == D && encBlk(b))
    return toast('Para hoy ya no se puede: el inventario de esa sucursal ya se hizo');
  if (!n.large && n.date == D && loadDone(b)) {
    const sh = loadEmpty(b)
      ? null
      : Object.entries(items).find(([k, v]) => v > left(b, +k.slice(1)));
    if (sh)
      return toast(
        'En ' +
          brs()[b] +
          ' solo quedan ' +
          Math.max(0, left(b, +sh[0].slice(1))) +
          ' de ' +
          F[+sh[0].slice(1)] +
          '. Sube la carga o aparta menos'
      );
  }
  if (n.large) {
    n.descTamal = Math.max(0, +(n.descTamal) || 0);
    n.descChamp = preChamp(items).unit;
    const bad = Object.entries(items).find(([k]) => {
      const f = +k.slice(1);
      return f < 100 && price(f) > 0 && n.descTamal >= price(f);
    });
    if (bad) {
      toast('El descuento es mayor o igual al precio de ' + nm(+bad[0].slice(1)));
      if (n.large) {
        n.step = 3;
        renderNow(true);
      }
      return;
    }
  } else n.descChamp = 0;
  if (n.large && !S.skipDupWarn) {
    const sameDay = (S.pre || []).filter(p => p.large && p.date == n.date && p.status != 'cancelado' && p.status != 'entregado' && p.status != 'fallido' && p._id != S.editPreId);
    if (sameDay.length) {
      ask(
        'Ya hay ' +
          sameDay.length +
          ' pedido' +
          (sameDay.length > 1 ? 's' : '') +
          ' grande' +
          (sameDay.length > 1 ? 's' : '') +
          ' para ' +
          fdate(n.date) +
          '. ¿Aun así quieres hacer el pedido?',
        () => {
          S.skipDupWarn = true;
          savePre();
          S.skipDupWarn = false;
        }
      );
      return;
    }
  }
  if (!lock('sp')) return;
  const isEdit = !!S.editPreId;
  const preId = isEdit ? S.editPreId : 'lg' + Date.now();
  const oldP = isEdit ? S.pre.find(x => x._id == preId) : null;
  try {
    const preData = {
      branch: b,
      date: n.date,
      items,
      client: n.name.trim(),
      phone: n.phone.trim(),
      note: n.note.trim(),
      time: n.large ? (n.time || '').trim() : '',
      status: 'pendiente',
      by: S.me.user,
      byName: S.me.name,
      role: S.me.role,
      ts: Date.now(),
      large: !!n.large,
      delivery: !!(n.large && n.addr.trim()),
      addr: n.addr.trim(),
      fee: +(n.fee || 0) || 0,
      descTamal: +(n.descTamal || 0) || 0,
      descChamp: +(n.descChamp || 0) || 0,
    };
    if (isEdit) {
      await db.doc('pre/' + preId).update(preData);
      if (oldP && oldP.dvId) {
        try {
          await db.doc('deliveries/' + oldP.dvId).delete();
        } catch (_) {}
      }
    } else {
      await db.doc('pre/' + preId).set(preData);
    }
    if (n.large && n.addr.trim()) {
      const dvId = 'dv' + Date.now();
      const tamQty = Object.entries(items).filter(([k]) => +k.slice(1) < 100).reduce((a, [, v]) => a + v, 0);
      const chQty = Object.entries(items).filter(([k]) => +k.slice(1) >= 100).reduce((a, [, v]) => a + v, 0);
      const desc = (tamQty * (+(n.descTamal) || 0)) + (chQty * (+(n.descChamp) || 0));
      const totalList = Object.entries(items).reduce((a, [k, v]) => a + v * price(+k.slice(1)), 0);
      await db.doc('deliveries/' + dvId).set({
        day: n.date,
        branch: b,
        client: n.name.trim(),
        phone: n.phone.trim(),
        addr: n.addr.trim(),
        note: n.note.trim(),
        time: (n.time || '').trim(),
        fee: +(n.fee || 0) || 0,
        items,
        total: Math.max(0, totalList - desc),
        descTamal: +(n.descTamal || 0) || 0,
        descChamp: +(n.descChamp || 0) || 0,
        descuento: desc,
        status: 'pendiente',
        by: S.me.user,
        byName: S.me.name,
        ts: Date.now(),
        large: true,
        preId: preId,
      });
      await db.doc('pre/' + preId).update({ dvId: dvId, descTamal: +(n.descTamal || 0) || 0, descChamp: +(n.descChamp || 0) || 0 });
    } else if (isEdit) {
      await db.doc('pre/' + preId).update({ dvId: null });
    }
    if (S.nds) delete S.nds[(S.me && S.me.id) || 'anon'];
    S.editPreId = null;
    S.anew = false;
    S.apt = n.date == D ? 'h' : 'o';
    toast(
      n.large
        ? isEdit
          ? n.addr.trim()
            ? 'Pedido grande a domicilio actualizado'
            : 'Pedido grande actualizado'
          : n.addr.trim()
          ? 'Pedido grande a domicilio guardado'
          : 'Pedido grande guardado'
        : n.date == D
        ? 'Apartado guardado para hoy'
        : 'Apartado guardado para ' + fdate(n.date)
    );
    render(true);
  } catch (e) {
    delete lock.s.sp;
    err(e);
  }
}

function cancelPre(id) {
  const p = S.pre.find(x => x._id == id);
  if (!p) return;
  ask(
    '¿Cancelar el apartado de ' + p.client + '? Los tamales vuelven a quedar disponibles.',
    async () => {
      try {
        const dv = p.dvId ? (S.dv || []).find(x => x._id == p.dvId) : null;
        if (dv && dv.status != 'pendiente') return toast('El reparto ya no está pendiente');
        const bt = db.batch();
        bt.update('pre/' + id, { status: 'cancelado', doneAt: Date.now(), doneBy: S.me.user });
        if (p.dvId) bt.delete('deliveries/' + p.dvId);
        await bt.commit();
        toast('Apartado cancelado');
        logEv({
          branch: p.branch,
          kind: 'cancelacion',
          label: 'Apartado cancelado',
          txt: p.client + ' · ' + preTxt(p) + (p.date != D ? ' · para ' + fdate(p.date) : ''),
          amt: preTot(p),
        });
      } catch (e) {
        err(e);
      }
    }
  );
}

function editPre(id) {
  const p = S.pre.find(x => x._id == id);
  if (!p || !p.large || p.status != 'pendiente') return;
  const x = nd();
  x.large = true;
  x.step = 1;
  x.date = p.date;
  x.items = {};
  Object.entries(p.items || {}).forEach(([k, v]) => {
    x.items[+k.slice(1)] = +v;
  });
  x.name = p.client || '';
  x.phone = p.phone || '';
  x.addr = p.addr || '';
  x.time = p.time || '';
  x.fee = p.fee || '';
  x.descTamal = p.descTamal || '';
  x.descChamp = p.descChamp || '';
  x.note = p.note || '';
  x.branch = null;
  S.editPreId = id;
  if (S.me.role == 'admin' || S.me.role == 'sup') {
    S.tab = 'ap';
    S.apt = p.date == D ? 'h' : 'o';
  } else if (S.me.role == 'enc') {
    S.et = 'a';
    S.apt = p.date == D ? 'h' : 'o';
  }
  S.anew = true;
  renderNow(true);
  setTimeout(() => {
    const e = $('#apf');
    if (e) e.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 80);
}

function deliverPre(id) {
  const p = S.pre.find(x => x._id == id);
  if (!p) return;
  if (corteBlk()) return;
  const z0 = noPrice(Object.keys(p.items || {}).map(k => +k.slice(1)));
  if (z0) return toast('Falta el precio de ' + z0 + '. Avísale al administrador');
  payAsk(preTot(p), 'Entregar y cobrar · ' + p.client, preTxt(p), async pg => {
    const q = S.pre.find(x => x._id == id);
    if (!q) return toast('Este apartado ya no está pendiente');
    const ts = Date.now(),
      it = Object.entries(q.items || {}).filter(([_, v]) => v > 0);
    if (!lock('pre' + id)) return;
    try {
      const bt = db.batch();
      bt.update('pre/' + id, { status: 'entregado', doneAt: ts, doneBy: S.me.user });
      if (q.dvId) bt.update('deliveries/' + q.dvId, { status: 'entregado', cobrado: preTot(q), tsDone: ts });
      it.forEach(([k, v], i) => {
        const f = +k.slice(1);
        const disc = f >= 100 ? (+(q.descChamp) || 0) : (+(q.descTamal) || 0);
        const discPrice = Math.max(0, price(f) - disc);
        bt.set('sales/p' + id + '_' + i, {
          day: D,
          branch: q.branch,
          f: f,
          qty: v,
          type: 'vendido',
          price: discPrice,
          pre: id,
          client: q.client,
          by: S.me.user,
          ts: ts + i,
          descuento: disc * v,
          ...(q.dvId ? { dv: q.dvId } : {}),
        });
      });
      await bt.commit();
      try {
        navigator.vibrate && navigator.vibrate(40);
      } catch (_) {}
      toast('Entregado' + (pg > preTot(q) ? ' · cambio ' + money(pg - preTot(q)) : ''));
    } catch (e) {
      delete lock.s['pre' + id];
      err(e);
    }
  });
}


function apView() {
  const m = S.me,
    V = m.role == 'vend',
    A = m.role == 'admin',
    t = S.apt || (V && pin() ? 's' : 'h');
  const l = S.pre.filter(p =>
      V ? p.branch == m.branch : A && S.apb != null ? p.large || p.branch == S.apb : true
    ),
    hoy = l.filter(p => p.date <= D && !(V && p.large)),
    otro = l.filter(p => p.date > D && !(V && p.large));
  const hN = hoy.length + (V ? dvOpenN() : 0);
  const tabs = [
    ['h', 'Hoy' + (hN ? ' (' + hN + ')' : '')],
    ['o', 'Otro día' + (otro.length ? ' (' + otro.length + ')' : '')],
    ...(V ? [['s', 'Entre sucursales' + (pin() ? ' (' + pin() + ')' : '')]] : []),
  ];
  const bf = A
    ? `<div class="seg" style="margin-bottom:8px"><button class="${S.apb == null ? 'on' : ''}" onclick="S.apb=null;render(true)">Todas</button>${brs()
        .map((n, i) =>
          !isOpen(i)
            ? ''
            : `<button class="${S.apb === i ? 'on' : ''}" onclick="S.apb=${i};render(true)">${esc(n)}</button>`
        )
        .join('')}</div>`
    : '';
  return (
    bf +
    `<div class="seg" style="margin-bottom:10px">${tabs.map(([k, n]) => `<button class="${t == k ? 'on' : ''}" onclick="S.apt='${k}';S.anew=false;if(S.me.role=='vend'){S.apt=='s'?stockOn():stockOff()}render(true)">${n}</button>`).join('')}</div>` +
    (t == 'o' ? admBtn() + preLater(otro) + admFrm('o') : t == 's' && V ? reqView() : preToday(hoy) + (V ? dvToday() : ''))
  );
}

function preBanner() {
  const n = preN() + dvOpenN();
  return n
    ? `<div class="card" style="border:2px solid var(--ac)" onclick="S.apt='h';setVt('r')"><b>📌 ${n} apartado${n > 1 ? 's' : ''} para entregar hoy</b><br><small>Toca para ver</small></div>`
    : '';
}

function preInvCard(b) {
  const mine = S.pre.filter(p => p.branch == b),
    td = mine.filter(p => p.date == D).sort((a, c) => a.ts - c.ts),
    od = mine.filter(p => p.date < D).sort((a, c) => a.ts - c.ts),
    q = td.reduce((a, p) => a + preQty(p), 0),
    fz = f => +((S.loads[b] || {}).pa || {})['f' + f] || 0,
    miss = F.reduce((a, _, f) => a + Math.max(0, resv(b, f) - fz(f)), 0),
    oth = BI()
      .filter(i => i != b)
      .map(i => [
        i,
        S.pre.filter(p => p.branch == i && p.date == D).reduce((a, p) => a + preQty(p), 0),
      ])
      .filter(x => x[1]),
    ot = S.pre.filter(p => p.date > D).length;
  return `<div class="card"><h3>📌 Apartados de hoy${q ? ' · ' + q + (q == 1 ? ' tamal' : ' tamales') : ''}</h3>
 ${td.length ? td.map(p => `<div class="row"><div><b>${esc(p.client)}</b>${p.ok ? ' ✅' : ' ⏳'}<br><small>${esc(preTxt(p))}${p.note ? ' · 📝 ' + esc(p.note) : ''}</small></div></div>`).join('') + (loadDone(b) ? (miss ? `<small class="low" style="display:block;margin-top:8px"><b>${miss} ${miss == 1 ? 'tamal apartado' : 'tamales apartados'} después de guardar la carga: ${loadEmpty(b) ? 'guarda la carga otra vez para incluirlos.' : 'ya se descontaron de lo que queda.'}</b></small>` : '<small class="ok" style="display:block;margin-top:8px">✅ Ya incluidos en la carga</small>') : '<small style="display:block;margin-top:8px">Se suman solos a la carga al guardar</small>') : `<small>Sin apartados para hoy en ${esc(brs()[b])}.</small>`}
 ${od.length ? `<div class="row"><div><small class="bad"><b>${od.length} pendiente${od.length > 1 ? 's' : ''} de días anteriores</b> · no se suman a la carga de hoy</small></div><button class="gh" onclick="admAp(${b})">Ver</button></div>` : ''}
 ${oth.length ? `<small style="display:block;margin-top:10px">También hay apartados hoy en:</small><div class="form">${oth.map(([i, n]) => `<button class="alt" onclick="setIb(${i})">${esc(brs()[i])} · ${n}</button>`).join('')}</div>` : ''}
 ${ot ? `<div class="row"><div><small>📅 ${ot} apartado${ot > 1 ? 's' : ''} para otros días</small></div><button class="gh" onclick="S.apt='o';S.anew=false;S.apb=null;setTab('ap')">Ver</button></div>` : ''}</div>`;
}

/* Apartados por fecha: hoy y otros días (formulario, entrega, cancelación). */

const preN = () => S.pre.filter(p => p.date <= D).length;

const preTxt = p =>
  Object.entries(p.items || {})
    .map(([k, v]) => v + '× ' + nm(+k.slice(1)))
    .join(', ');

const preTot = p =>
  Object.entries(p.items || {}).reduce((a, [k, v]) => a + v * price(+k.slice(1)), 0);

const preQty = p => Object.values(p.items || {}).reduce((a, v) => a + (+v || 0), 0);

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
  if (!S.nd) S.nd = { date: tmr(1), items: {}, name: '', phone: '', note: '', branch: BI()[0] };
  if (S.nd.date < D) S.nd.date = tmr(1);
  if (!BI().includes(S.nd.branch)) S.nd.branch = BI()[0];
  if (S.nd.date < D || (S.nd.date == D && (S.me.role == 'vend' || encBlk(S.nd.branch))))
    S.nd.date = tmr(1);
  return S.nd;
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
  const b = document.querySelector('.cart .ct .go'),
    t = Object.values(nd().items).reduce((a, x) => a + x, 0);
  if (b)
    b.textContent = 'Guardar apartado' + (t ? ' · ' + t + (t == 1 ? ' tamal' : ' tamales') : '');
}

function pdBr(i) {
  nd().branch = i;
  render(true);
}

function pdDate(v) {
  if (!v || v < D) return toast('Elige hoy o una fecha futura');
  if (v == D && S.me.role == 'vend') return toast('Para hoy no se puede: lo hace el administrador');
  if (v == D && encBlk(nd().branch))
    return toast('Para hoy ya no se puede: el inventario de esa sucursal ya se hizo');
  nd().date = v;
  render(true);
}

function preCard(p) {
  const m = S.me,
    V = m.role == 'vend',
    A = m.role == 'admin',
    can = A || V || p.by == m.user;
  return `<div class="card"><div class="row"><div><b>${esc(p.client)}</b>${p.phone ? ' · ' + esc(p.phone) : ''}<br><small>${V ? '' : esc(brs()[p.branch]) + ' · '}${p.date < D ? '<b class="bad">Pendiente desde ' + esc(fdate(p.date)) + '</b> · ' : p.date > D ? esc(fdate(p.date)) + ' · ' : ''}${p.exp && p.exp < Date.now() ? '<b class="bad">Vencido</b> · ' : ''}lo apartó ${esc(p.byName || p.by)}${p.ok ? ' · <b class="ok">✅ Aceptado</b>' : ''}</small></div><b>${money(preTot(p))}</b></div><div>${esc(preTxt(p))}</div>${p.note ? `<small>📝 ${esc(p.note)}</small>` : ''}<div class="form">${(V || A) && p.date <= D && !(p.exp && p.exp < Date.now()) ? `<button class="go" onclick="deliverPre('${p._id}')">Entregar y cobrar</button>` : ''}${can ? `<button class="gh" style="color:var(--bad)" onclick="cancelPre('${p._id}')">Cancelar</button>` : ''}</div></div>`;
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
    cl = V || encBlk(n.branch),
    sel = n.items,
    tot = Object.values(sel).reduce((a, v) => a + v, 0);
  return `<div class="card" id="apf"><h3>Nuevo apartado</h3><small>Elige para qué día. El administrador lo ve antes de preparar el inventario de ese día.</small>
 ${V ? '' : fb ? `<small style="display:block;margin-top:8px">Sucursal: <b>${esc(brs()[n.branch])}</b></small>` : `<small style="display:block;margin-top:8px">¿Para qué sucursal?</small>` + bchips(n.branch, 'pdBr')}
 ${
   hoy
     ? `<small style="display:block;margin-top:8px">Fecha</small><small style="display:block"><b>Hoy · ${esc(fdate(D))}</b></small>${!V && loadDone(n.branch) ? `<small style="display:block">${loadEmpty(n.branch) ? 'La carga de hoy está vacía: puedes apartar sin límite y se suman al volver a guardar la carga.' : encBlk(n.branch) ? 'La carga de hoy ya está guardada: ya no se puede apartar para hoy en ' + esc(brs()[n.branch]) + '.' : 'La carga de hoy ya está guardada: el apartado se descuenta de lo que queda en ' + esc(brs()[n.branch]) + '.'}</small>` : ''}`
     : `<small style="display:block;margin-top:8px">Fecha</small>${cl ? (encBlk(n.branch) ? `<small class="low" style="display:block">La carga de hoy ya está guardada: ya no se puede apartar para hoy en ${esc(brs()[n.branch])}.</small>` : '') : !V && loadDone(n.branch) ? `<small style="display:block">${loadEmpty(n.branch) ? 'La carga de hoy está vacía: puedes apartar sin límite y se suman al volver a guardar la carga.' : encBlk(n.branch) ? 'La carga de hoy ya está guardada: ya no se puede apartar para hoy en ' + esc(brs()[n.branch]) + '.' : 'La carga de hoy ya está guardada: el apartado de hoy se descuenta de lo que queda en ' + esc(brs()[n.branch]) + '.'}</small>` : `<small style="display:block">Para hoy solo se puede antes de hacer el inventario.</small>`}<div class="seg" style="margin:4px 0">${[
         0, 1, 2,
       ]
         .filter(k => !(k == 0 && cl))
         .map(
           k =>
             `<button class="${n.date == tmr(k) ? 'on' : ''}" onclick="pdDate('${tmr(k)}')">${k == 0 ? 'Hoy' : k == 1 ? 'Mañana' : 'Pasado mañana'}</button>`
         )
         .join('')}</div>
 <div class="form"><input type="date" id="pdd" aria-label="Fecha del apartado" min="${cl ? tmr(1) : D}" value="${n.date}" onchange="pdDate(this.value)" style="flex:1"></div>`
 }
 ${F.map((nm, f) => `<div class="fl ${sel[f] ? 'sel' : ''}"><div class="fn"><b>${esc(nm)}</b><small>${money(price(f))}</small></div><div class="st"><button class="gh" onclick="pdAdd(${f},-1)">−</button><input type="number" min="0" max="499" inputmode="numeric" value="${sel[f] || 0}" aria-label="Cantidad de ${esc(nm)}" oninput="pdSet(${f},this.value,this)" onchange="this.value=nd().items[${f}]||0"><button onclick="pdAdd(${f},1)" aria-label="Más">+</button></div></div>`).join('')}
  <small style="display:block;margin:8px 0 6px">Champurrado</small>
  ${CH.map((cc, i) => { const f = 100 + i; return price(f) ? `<div class="fl ${sel[f] ? 'sel' : ''}"><div class="fn"><b>Champurrado ${esc(cc[0])}</b><small>${esc(cc[1])} · ${money(price(f))}</small></div><div class="st"><button class="gh" onclick="pdAdd(${f},-1)">−</button><input type="number" min="0" max="499" inputmode="numeric" value="${sel[f] || 0}" aria-label="Cantidad de champurrado ${esc(cc[0])}" oninput="pdSet(${f},this.value,this)" onchange="this.value=nd().items[${f}]||0"><button onclick="pdAdd(${f},1)" aria-label="Más">+</button></div></div>` : ''; }).join('')}
 <div class="form"><input id="pdn" placeholder="Nombre del cliente" value="${esc(n.name)}" oninput="nd().name=this.value" style="flex:1"><input placeholder="Teléfono (opcional)" inputmode="tel" value="${esc(n.phone)}" oninput="nd().phone=this.value" style="flex:1"></div>
 <div class="form"><input placeholder="Nota (hora de entrega, detalles)" value="${esc(n.note)}" oninput="nd().note=this.value" style="flex:1"></div>
 </div><div class="cart"><div class="ct"><button class="go" style="flex:1" onclick="savePre()"${hoy && encBlk(n.branch) ? ' disabled' : ''}>Guardar apartado${tot ? ' · ' + tot + (tot == 1 ? ' tamal' : ' tamales') : ''}</button></div></div>`;
}

async function savePre() {
  const n = nd(),
    V = S.me.role == 'vend',
    b = V ? S.me.branch : n.branch,
    items = {};
  Object.entries(n.items).forEach(([f, v]) => {
    if (v > 0) items['f' + f] = v;
  });
  if (!Object.keys(items).length) return toast('Elige los tamales que apartan');
  if (!n.name.trim()) {
    toast('Escribe el nombre del cliente');
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
  if (!n.date || n.date < D) return toast('Elige hoy o una fecha futura');
  if (n.date == D && S.me.role == 'vend')
    return toast('Para hoy no se puede: lo hace el administrador');
  if (n.date == D && encBlk(b))
    return toast('Para hoy ya no se puede: el inventario de esa sucursal ya se hizo');
  if (n.date == D && loadDone(b)) {
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
  if (!lock('sp')) return;
  try {
    await db.collection('pre').add({
      branch: b,
      date: n.date,
      items,
      client: n.name.trim(),
      phone: n.phone.trim(),
      note: n.note.trim(),
      status: 'pendiente',
      by: S.me.user,
      byName: S.me.name,
      role: S.me.role,
      ts: Date.now(),
    });
    S.nd = null;
    S.anew = false;
    S.apt = n.date == D ? 'h' : 'o';
    toast(n.date == D ? 'Apartado guardado para hoy' : 'Apartado guardado para ' + fdate(n.date));
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
        await db
          .doc('pre/' + id)
          .update({ status: 'cancelado', doneAt: Date.now(), doneBy: S.me.user });
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

function deliverPre(id) {
  const p = S.pre.find(x => x._id == id);
  if (!p) return;
  if (corteBlk()) return;
  const z0 = noPrice(Object.keys(p.items || {}).map(k => +k.slice(1)));
  if (z0) return toast('Falta el precio de ' + z0 + '. Avísale al administrador');
  const tot = preTot(p);
  const m = $('#modal');
  m.innerHTML = '<div class="card"><small>Entregar · ' + esc(p.client) + '</small><p>' + esc(preTxt(p)) + '</p><small>Total de lista: ' + money(tot) + '</small><div class="form"><input type="number" min="0" step="0.5" inputmode="decimal" id="dpd" class="wide" aria-label="Descuento" placeholder="Descuento $ (opcional)" oninput="dpChg(' + tot + ')"></div><div id="dpq" class="big" style="font-size:26px"></div><div class="form"><button id="mk">Entregar y cobrar</button><button class="alt" id="mn">Cancelar</button></div></div>';
  m.style.display = 'flex';
  $('#mn').onclick = () => (m.style.display = 'none');
  $('#mk').onclick = async () => {
    const disc = Math.max(0, +($('#dpd').value || 0));
    if (disc > tot) return toast('El descuento no puede ser mayor al total');
    const due = Math.max(0, tot - disc);
    m.style.display = 'none';
    payAsk(due, 'Entregar y cobrar · ' + p.client, preTxt(p) + (disc ? ' · descuento ' + money(disc) : ''), async pg => {
      const q = S.pre.find(x => x._id == id);
      if (!q) return toast('Este apartado ya no está pendiente');
      const ts = Date.now();
      if (!lock('pre' + id)) return;
      try {
        const tot0 = preTot(q);
        const ratio = tot0 > 0 ? (tot0 - disc) / tot0 : 1;
        const bt = db.batch();
        bt.update('pre/' + id, { status: 'entregado', doneAt: ts, doneBy: S.me.user, descuento: disc });
        Object.entries(q.items || {}).filter(([_, v]) => v > 0).forEach(([k, v], i) => {
          const listPrice = price(+k.slice(1));
          const discPrice = Math.round(listPrice * ratio * 100) / 100;
          bt.set('sales/p' + id + '_' + (ts + i), {
            day: D,
            branch: q.branch,
            f: +k.slice(1),
            qty: v,
            type: 'vendido',
            price: discPrice,
            pre: id,
            client: q.client,
            by: S.me.user,
            ts: ts + i,
            descuento: Math.round((listPrice - discPrice) * v * 100) / 100,
          });
        });
        await bt.commit();
        try { navigator.vibrate && navigator.vibrate(40); } catch (_) {}
        toast('Entregado' + (disc ? ' · descuento ' + money(disc) : '') + (pg > due ? ' · cambio ' + money(pg - due) : ''));
      } catch (e) {
        delete lock.s['pre' + id];
        err(e);
      }
    });
  };
}

function dpChg(tot) {
  const v = $('#dpd').value,
    d = v === '' ? 0 : +v,
    due = Math.max(0, tot - (d < 0 ? 0 : d)),
    e = $('#dpq');
  if (e) e.textContent = due > 0 ? 'Cobrar ' + money(due) : '';
}

function apView() {
  const m = S.me,
    V = m.role == 'vend',
    A = m.role == 'admin',
    t = S.apt || (V && pin() ? 's' : 'h');
  const l = S.pre.filter(p =>
      V ? p.branch == m.branch : A && S.apb != null ? p.branch == S.apb : true
    ),
    hoy = l.filter(p => p.date <= D),
    otro = l.filter(p => p.date > D);
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

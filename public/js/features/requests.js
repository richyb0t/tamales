/* Apartados entre sucursales: solicitudes, aceptación, entrega y publicación de existencias. */

const rqTot = r =>
  Object.entries(r.items || {}).reduce((a, [k, v]) => a + v * price(+k.slice(1)), 0);

const rqTxt = r =>
  Object.entries(r.items || {})
    .map(([k, v]) => v + '× ' + F[+k.slice(1)])
    .join(', ');

const rqSt = r => {
  const n = Date.now();
  return r.status == 'pendiente' && n - r.ts > holdMin() * 60000
    ? 'sinresp'
    : r.status == 'aceptado' && r.exp < n
      ? 'vencido'
      : r.status;
};

const rqFrom = r =>
  r.from == null ? 'Pedidos' + (r.byName ? ' · ' + r.byName : '') : brs()[r.from];

const RL = {
  pendiente: ['Pendiente', 'low'],
  aceptado: ['Aceptado', 'ok'],
  rechazado: ['No hay', 'bad'],
  entregado: ['Entregado', 'ok'],
  cancelado: ['Cancelado', ''],
  vencido: ['Vencido', 'bad'],
  sinresp: ['Sin respuesta', 'bad'],
};

const pin = () =>
  S.me && S.me.role == 'vend'
    ? (S.rq || []).filter(r => r.to == S.me.branch && rqSt(r) == 'pendiente').length
    : 0;

const rqShort = (r, b) =>
  Object.entries(r.items || {})
    .map(([k, v]) => [+k.slice(1), v, left(b, +k.slice(1))])
    .filter(x => x[2] < x[1]);

let stUn = null,
  lastSt = {},
  stT = null;

function stockOn() {
  if (stUn) return;
  stUn = db.collection('stock').onSnapshot(q => {
    S.stock = {};
    q.docs.forEach(d => (S.stock[d.id] = d.data()));
    render();
  }, err);
}

function stockOff() {
  if (stUn) {
    stUn();
    stUn = null;
  }
}

function schedSt() {
  clearTimeout(stT);
  stT = setTimeout(syncStock, 1500);
}

async function syncStock() {
  if (!S.me || S.me.role == 'enc') return;
  if (S.me.role == 'vend' && !vendReady()) return;
  for (const b of S.me.role == 'vend' ? [S.me.branch] : BI()) {
    const f = {};
    F.forEach((_, i) => (f['f' + i] = Math.max(0, left(b, i))));
    const v = { branch: b, f, ch: Math.max(0, chLeft(b)) },
      j = JSON.stringify(v);
    if (lastSt[b] === j) continue;
    lastSt[b] = j;
    try {
      await db.doc('stock/' + b).set({ ...v, at: Date.now() });
    } catch (e) {
      console.error(e);
    }
  }
}

function subReqs(m, M, b) {
  const L = (f, v) => {
      let q = db.collection('reqs').where('day', '==', D);
      return v != null ? q.where(f, '==', v) : q;
    },
    mp = q => q.docs.map(d => ({ _id: d.id, ...d.data() }));
  if (M) {
    let A = [],
      B = [];
    const mg = () => {
      const o = {};
      [...A, ...B].forEach(r => (o[r._id] = r));
      S.rq = Object.values(o);
      onReqs();
      render();
    };
    subs.push(
      L('from', b).onSnapshot(q => {
        A = mp(q);
        mg();
      }, err)
    );
    subs.push(
      L('to', b).onSnapshot(q => {
        B = mp(q);
        mg();
      }, err)
    );
  } else if (m.role == 'enc')
    subs.push(
      L('by', m.user).onSnapshot(q => {
        S.rq = mp(q);
        onReqs();
        render();
      }, err)
    );
  else
    subs.push(
      L().onSnapshot(q => {
        S.rq = mp(q);
        onReqs();
        render();
      }, err)
    );
}

function onReqs() {
  const prev = S.rqPrev,
    cur = {};
  S.rq.forEach(r => (cur[r._id] = r.status));
  if (prev && Date.now() > S.alAfter && S.me && S.me.role == 'vend') {
    const b = S.me.branch;
    S.rq.forEach(r => {
      const p = prev[r._id];
      if (r.to == b && r.status == 'pendiente' && p === undefined) {
        toast('📌 Solicitud de ' + rqFrom(r) + ': ' + r.client);
        vib();
      }
      if (r.from == b && p == 'pendiente' && r.status == 'aceptado') {
        toast('✅ ' + brs()[r.to] + ' aceptó el apartado de ' + r.client);
        vib();
      }
      if (r.from == b && p == 'pendiente' && r.status == 'rechazado') {
        toast('❌ ' + brs()[r.to] + ' no tiene lo que pediste para ' + r.client);
        vib();
      }
    });
  }
  if (prev && Date.now() > S.alAfter && S.me && S.me.role == 'enc') {
    S.rq.forEach(r => {
      const p = prev[r._id];
      if (p == 'pendiente' && r.status == 'aceptado') {
        toast('✅ ' + brs()[r.to] + ' aceptó el apartado de ' + r.client);
        vib();
      }
      if (p == 'pendiente' && r.status == 'rechazado') {
        toast('❌ ' + brs()[r.to] + ' no tiene lo que pediste para ' + r.client);
        vib();
      }
    });
  }
  S.rqPrev = cur;
}

/* vista del vendedor: pestaña Apartados */
function inBanner(vt) {
  const n = pin();
  return vt != 'r' && n > 0
    ? `<div class="card" style="border:2px solid var(--ac)" onclick="setVt('r')"><b>📌 ${n} solicitud${n > 1 ? 'es' : ''} de apartado</b><br><small>Toca para revisar</small></div>`
    : '';
}

function reqView() {
  const b = S.me.role == 'enc' ? null : S.me.branch;
  S.rd = S.rd || { items: {} };
  const R = (S.rq || []).slice().sort((a, c) => c.ts - a.ts),
    inc = R.filter(r => r.to == b),
    out = R.filter(r => r.from == b);
  const pend = inc.filter(r => rqSt(r) == 'pendiente'),
    hold = inc.filter(r => rqSt(r) == 'aceptado'),
    done = inc.filter(r => !['pendiente', 'aceptado'].includes(rqSt(r))).slice(0, 8);
  const top = (r, x) =>
    `<div class="card"><div class="row"><div><b>${esc(r.client)}</b>${r.phone ? ' · ' + esc(r.phone) : ''}<br><small>${x}</small></div><b>${money(rqTot(r))}</b></div><div>${esc(rqTxt(r))}</div>`;
  const o = BI().filter(i => i != b),
    to = o.includes(S.rd.to) ? S.rd.to : o[0],
    st =
      S.me.role == 'enc'
        ? {
            at: Date.now(),
            f: Object.fromEntries(F.map((_, f) => ['f' + f, Math.max(0, left(to, f))])),
          }
        : (S.stock || {})[to],
    sel = S.rd.items || {};
  const fl = st ? F.map((n, f) => [n, f, (st.f || {})['f' + f] || 0]).filter(x => x[2] > 0) : [];
  const form = o.length
    ? `<div class="card" id="rdf"><h3>${S.me.role == 'enc' ? 'Apartar en una sucursal' : 'Apartar en otra sucursal'}</h3><small>${S.me.role == 'enc' ? 'Elige la sucursal y los tamales. La sucursal debe aceptar; después se guardan ' + holdMin() + ' min para el cliente.' : 'Para cuando se te acabó un sabor. La otra sucursal debe aceptar antes de que se aparte.'}</small><div class="seg" style="flex-wrap:wrap">${o.map(i => `<button class="${i == to ? 'on' : ''}" onclick="rdTo(${i})">${esc(brs()[i])}</button>`).join('')}</div>
 ${st ? `<small>Disponibilidad de ${esc(brs()[to])} · ${ago(st.at)}</small>` : '<small>Aún no hay datos de esa sucursal.</small>'}
 ${fl.map(x => `<div class="fl ${sel[x[1]] ? 'sel' : ''}"><div class="fn"><b>${x[0]}</b><small>hay ${x[2]}</small></div><div class="st"><button class="gh" onclick="rdAdd(${to},${x[1]},-1)">−</button><input type="number" min="0" max="${x[2]}" inputmode="numeric" value="${sel[x[1]] || 0}" aria-label="Cantidad de ${x[0]}" oninput="rdSet(${to},${x[1]},this.value,this)" onchange="this.value=(S.rd.items||{})[${x[1]}]||0"><button onclick="rdAdd(${to},${x[1]},1)" aria-label="Más">+</button></div></div>`).join('') || (st ? '<small>Esa sucursal no tiene tamales disponibles.</small>' : '')}
 <div class="form"><input id="rdn" placeholder="Nombre del cliente" value="${esc(S.rd.name || '')}" oninput="S.rd.name=this.value" style="flex:1"><input placeholder="Teléfono (opcional)" inputmode="tel" value="${esc(S.rd.phone || '')}" oninput="S.rd.phone=this.value" style="flex:1"></div>
 <div class="form"><button class="go" id="rdi" style="flex:1" onclick="sendReq(${to})">Enviar solicitud</button></div></div><div class="cart" id="rdb" ${S.me.role == 'enc' ? 'hidden' : ''}><div class="ct"><button class="go" style="flex:1" onclick="sendReq(${to})">Enviar solicitud${(n => (n ? ' · ' + n + (n == 1 ? ' tamal' : ' tamales') : ''))(Object.values(sel).reduce((a, v) => a + (+v || 0), 0))}</button></div></div>`
    : '';
  return `${pend.length ? '<h3 style="margin:6px 4px">Solicitudes que recibiste</h3>' : ''}${pend
    .map(r => {
      const sh = rqShort(r, b);
      return (
        top(r, 'De ' + esc(rqFrom(r)) + ' · ' + hm(r.ts)) +
        (sh.length
          ? `<small class="bad">No alcanza: ${sh.map(x => esc(F[x[0]]) + ' (piden ' + x[1] + ', hay ' + Math.max(0, x[2]) + ')').join(', ')}</small>`
          : '') +
        `<div class="form"><button class="go" ${sh.length ? 'disabled' : ''} onclick="acceptReq('${r._id}')">Aceptar y apartar</button><button class="gh" onclick="rejectReq('${r._id}')">No hay</button></div></div>`
      );
    })
    .join('')}
 ${hold.length ? '<h3 style="margin:6px 4px">Apartados por entregar</h3>' : ''}${hold.map(r => top(r, 'De ' + esc(rqFrom(r)) + ' · guardado hasta las ' + hm(r.exp)) + `<div class="form"><button class="go" onclick="deliverReq('${r._id}')">Entregar y cobrar ${money(rqTot(r))}</button><button class="gh" onclick="cancelHold('${r._id}')">Cancelar</button></div></div>`).join('')}
 ${form}
 <div class="card"><h3>Lo que enviaste hoy</h3>${
   out
     .map(r => {
       const s = rqSt(r),
         t = RL[s];
       return `<div class="row" style="flex-wrap:wrap"><div><b>${esc(r.client)}</b> → ${esc(brs()[r.to])}<br><small>${esc(rqTxt(r))} · ${hm(r.ts)}</small></div><span class="chip ${t[1]}">${t[0]}</span>${s == 'aceptado' ? `<small style="width:100%">Dile al cliente que pase a ${esc(brs()[r.to])} antes de las ${hm(r.exp)}.</small>` : s == 'rechazado' ? `<small style="width:100%">${esc(r.reason || 'No hay suficiente')}</small>` : ''}${s == 'pendiente' ? `<button class="gh" onclick="cancelReq('${r._id}')">Cancelar solicitud</button>` : ''}</div>`;
     })
     .join('') || '<small>Todavía no has enviado solicitudes hoy.</small>'
 }</div>
 ${
   done.length
     ? `<div class="card"><h3>Recibidas · ya cerradas</h3>${done
         .map(r => {
           const t = RL[rqSt(r)];
           return `<div class="row"><div><b>${esc(r.client)}</b> · ${esc(rqFrom(r))}<br><small>${esc(rqTxt(r))}</small></div><span class="chip ${t[1]}">${t[0]}</span></div>`;
         })
         .join('')}</div>`
     : ''
 }`;
}

function rdTo(i) {
  S.rd = { ...S.rd, to: i, items: {} };
  render(true);
}

function rdSet(to, f, v, el) {
  S.rd = S.rd || { items: {} };
  S.rd.to = to;
  const mx =
      S.me.role == 'enc'
        ? Math.max(0, left(to, f))
        : (((S.stock || {})[to] || {}).f || {})['f' + f] || 0,
    c = Math.max(0, Math.min(mx, Math.floor(+v) || 0));
  S.rd.items = { ...S.rd.items, [f]: c };
  const r = el.closest('.fl');
  if (r) r.classList.toggle('sel', c > 0);
  const b = document.querySelector('#rdb .go'),
    n = Object.values(S.rd.items).reduce((a, x) => a + (+x || 0), 0);
  if (b)
    b.textContent = 'Enviar solicitud' + (n ? ' · ' + n + (n == 1 ? ' tamal' : ' tamales') : '');
}

function rdAdd(to, f, n) {
  S.rd = S.rd || { items: {} };
  S.rd.to = to;
  const mx =
      S.me.role == 'enc'
        ? Math.max(0, left(to, f))
        : (((S.stock || {})[to] || {}).f || {})['f' + f] || 0,
    c = Math.max(0, Math.min(mx, ((S.rd.items || {})[f] || 0) + n));
  S.rd.items = { ...S.rd.items, [f]: c };
  render(true);
}

async function sendReq(to) {
  const r = S.rd || {},
    items = {};
  Object.entries(r.items || {}).forEach(([f, v]) => {
    if (v > 0) items['f' + f] = v;
  });
  if (!Object.keys(items).length) return toast('Elige los tamales que necesitas');
  if (!(r.name || '').trim()) {
    toast('Escribe el nombre del cliente');
    const e = $('#rdn');
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
  if (!lock('sr')) return;
  try {
    await db.collection('reqs').add({
      day: D,
      from: S.me.role == 'enc' ? null : S.me.branch,
      to,
      items,
      client: r.name.trim(),
      phone: (r.phone || '').trim(),
      status: 'pendiente',
      by: S.me.user,
      byName: S.me.name,
      ts: Date.now(),
    });
    S.rd = { items: {} };
    toast('Solicitud enviada a ' + brs()[to]);
    render(true);
  } catch (e) {
    delete lock.s.sr;
    err(e);
  }
}

async function cancelReq(id) {
  const r = S.rq.find(x => x._id == id);
  try {
    await db.doc('reqs/' + id).update({ status: 'cancelado' });
    toast('Solicitud cancelada');
    if (r)
      logEv({
        branch: r.from != null ? r.from : r.to,
        branch2: r.from != null ? r.to : null,
        kind: 'cancelacion',
        label: 'Solicitud de apartado cancelada',
        txt: r.client + ' · ' + rqTxt(r),
        amt: rqTot(r),
      });
  } catch (e) {
    err(e);
  }
}

async function acceptReq(id) {
  const r = S.rq.find(x => x._id == id),
    b = S.me.branch;
  if (!r) return;
  if (rqShort(r, b).length) return toast('Ya no alcanza el inventario');
  const z0 = noPrice(Object.keys(r.items || {}).map(k => +k.slice(1)));
  if (z0) return toast('Falta el precio de ' + z0 + '. Avísale al administrador');
  const exp = Date.now() + holdMin() * 60000;
  if (!lock('ac' + id)) return;
  try {
    const bt = db.batch();
    bt.update('reqs/' + id, { status: 'aceptado', exp, acceptedBy: S.me.user });
    Object.entries(r.items).forEach(([k, v], i) =>
      bt.set('sales/q' + id + '_' + i, {
        day: D,
        branch: b,
        f: +k.slice(1),
        qty: v,
        type: 'apartado',
        price: price(+k.slice(1)),
        req: id,
        client: r.client,
        exp,
        by: S.me.user,
        ts: Date.now() + i,
      })
    );
    await bt.commit();
    toast('Apartado guardado hasta las ' + hm(exp));
  } catch (e) {
    err(e);
  }
}

async function rejectReq(id) {
  try {
    await db
      .doc('reqs/' + id)
      .update({ status: 'rechazado', reason: 'No hay suficiente', rejectedBy: S.me.user });
    toast('Avisamos que no hay');
  } catch (e) {
    err(e);
  }
}

function deliverReq(id) {
  const r = S.rq.find(x => x._id == id);
  if (!r) return;
  if (corteBlk()) return;
  payAsk(rqTot(r), 'Entregar y cobrar · ' + r.client, rqTxt(r), async pg => {
    if (!lock('rq' + id)) return;
    try {
      const bt = db.batch();
      bt.update('reqs/' + id, { status: 'entregado', deliveredBy: S.me.user, dts: Date.now() });
      S.sales
        .filter(x => x.req == id && x.type == 'apartado')
        .forEach(x => bt.update('sales/' + x._id, { type: 'vendido', by: S.me.user }));
      await bt.commit();
      try {
        navigator.vibrate && navigator.vibrate(40);
      } catch (_) {}
      note('Apartado entregado · ' + r.client, rqTxt(r), rqTot(r), pg);
    } catch (e) {
      err(e);
    }
  });
}

function cancelHold(id) {
  const r = S.rq.find(x => x._id == id);
  if (!r) return;
  ask(
    '¿Cancelar el apartado de ' + r.client + '? Los tamales regresan al inventario.',
    async () => {
      try {
        const bt = db.batch();
        S.sales
          .filter(x => x.req == id && x.type == 'apartado')
          .forEach(x => bt.delete('sales/' + x._id));
        bt.update('reqs/' + id, { status: 'cancelado' });
        await bt.commit();
        toast('Apartado cancelado');
        logEv({
          branch: r.to,
          branch2: r.from,
          kind: 'cancelacion',
          label: 'Apartado cancelado (entre sucursales)',
          txt: r.client + ' · ' + rqTxt(r),
          amt: rqTot(r),
        });
      } catch (e) {
        err(e);
      }
    }
  );
}

function reqAdmin() {
  const l = (S.rq || []).slice().sort((a, c) => c.ts - a.ts);
  if (!l.length) return '';
  return `<div class="card"><h3>Apartados entre sucursales</h3>${l
    .map(r => {
      const t = RL[rqSt(r)];
      return `<div class="row"><div><b>${esc(r.client)}</b> · ${esc(rqFrom(r))} → ${esc(brs()[r.to])}<br><small>${esc(rqTxt(r))} · ${hm(r.ts)}</small></div><span class="chip ${t[1]}">${t[0]}</span></div>`;
    })
    .join('')}</div>`;
}

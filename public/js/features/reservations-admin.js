/* Apartados (administrador): aceptar, rechazar y ver por sucursal. */

const admBtn = () =>
  '<div class="form" style="margin:0 0 10px"><button class="alt" style="flex:1" onclick="admNew()">' +
  (S.anew ? '✕ Cerrar formulario' : '＋ Nuevo apartado') +
  '</button></div>';

const admFrm = t => {
  if (!S.anew) return '';
  if (t == 'o') return apForm();
  nd().date = D;
  return apForm(true);
};

function admNew() {
  S.anew = !S.anew;
  if (S.anew) {
    const x = nd();
    x.date = S.apt == 'o' ? (x.date > D ? x.date : tmr(1)) : D;
    if (S.apb != null && BI().includes(S.apb)) x.branch = S.apb;
  }
  renderNow(true);
  if (S.anew)
    setTimeout(() => {
      const e = $('#apf');
      if (e) e.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
}

function admTab(k) {
  S.anew = false;
  S.apt = k;
  if (k == 'o') {
    const x = nd();
    if (x.date <= D) x.date = tmr(1);
  }
  renderNow(true);
}

const admAp = b => {
    S.apt = 'h';
    S.anew = false;
    setTab('ap');
  },
  admInv = b => {
    S.ib = b;
    setTab('inv');
  };

function admCard(p) {
  const od = p.date < D,
    fut = p.date > D,
    A = S.me.role == 'admin',
    mine = A || p.by == S.me.user,
    ph = (p.phone || '').trim(),
    bt =
      (A
        ? p.ok
          ? `<button class="gh p" onclick="accPre('${p._id}')">Deshacer aceptación</button>`
          : `<button class="go p" onclick="accPre('${p._id}')">✓ Aceptar</button>`
        : '') +
      (A ? `<button class="alt" onclick="admRejectPre('${p._id}')">Rechazar</button>` : '') +
      (mine
        ? `<button class="gh" style="color:var(--bad)" onclick="cancelPre('${p._id}')">Cancelar</button>`
        : '');
  return `<div class="card apc${p.ok ? ' ok' : ''}"><div class="aph"><div><b class="n">${esc(p.client)}</b><div class="apm">${p.large ? '📦 Pedido grande' : esc(brs()[p.branch])} · ${od ? '<b class="bad">Pendiente desde ' + esc(fdate(p.date)) + '</b>' : fut ? esc(fdate(p.date)) : 'Para hoy'} · lo apartó ${esc(p.byName || p.by)}${p.large && p.time ? ' · 🕒 ' + ftime(p.time) : ''}</div></div><div style="text-align:right;flex:none"><b>${money(preTot(p))}</b><br><span class="chip ${p.ok ? 'ok' : 'low'}">${p.ok ? '✓ Aceptado' : 'Por aceptar'}</span></div></div>
 <div class="apt">${esc(preTxt(p))}</div>${p.large && p.addr ? `<div>📍 ${esc(p.addr)}</div>` : ''}${ph ? `<div><a href="tel:${esc(ph.replace(/[^0-9+]/g, ''))}" style="color:var(--ac);font-weight:800;text-decoration:none">📞 ${esc(ph)}</a></div>` : ''}${p.note ? `<small>📝 ${esc(p.note)}</small>` : ''}${bt ? `<div class="apa">${bt}</div>` : ''}</div>`;
}

function admToday(l) {
  const q = l.reduce((a, p) => a + preQty(p), 0),
    tot = l.reduce((a, p) => a + preTot(p), 0),
    g = {};
  l.forEach(p => {
    const k = p.large ? 'lg' : p.branch;
    (g[k] = g[k] || []).push(p);
  });
  if (!l.length)
    return (
      admBtn() +
      '<div class="card"><small>No hay apartados para entregar hoy.</small></div>' +
      admFrm()
    );
  const pend = l.filter(p => !p.ok).length,
    sum = `<div class="kp" style="margin-bottom:8px"><div><small>Apartados</small><b>${l.length}</b></div><div><small>Piezas</small><b>${q}</b></div><div><small>Total</small><b>${money(tot)}</b></div></div>${S.me.role == 'admin' || S.me.role == 'sup' ? `<div class="form" style="margin:0 0 10px"><span class="chip ${pend ? 'low' : 'ok'}">${pend ? pend + (pend == 1 ? ' por aceptar' : ' por aceptar') : '✓ Todos aceptados'}</span></div>` : ''}`;
  return (
    sum +
    admBtn() +
    Object.keys(g)
      .sort((a, b) => (a == 'lg' ? 1 : 0) - (b == 'lg' ? 1 : 0) || a - b)
      .map(b => {
        const isLg = b == 'lg';
        const a = g[b].sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : x.ts - y.ts)),
          td = a.filter(p => p.date == D),
          od = a.filter(p => p.date < D),
          pt = [];
        if (td.length) pt.push(preSum(td));
        if (a.length) pt.push(a.filter(p => p.ok).length + '/' + a.length + ' aceptados');
        if (od.length) pt.push('<b class="bad">' + od.length + ' de días anteriores</b>');
        if (!isLg && td.length) pt.push(loadDone(b) ? '✅ ya en la carga' : 'se suma al guardar la carga');
        return (
          `<div class="apg"><div class="row" style="border:0;padding:0"><div><h3 style="margin:0">${isLg ? '📦 Pedidos grandes' : esc(brs()[b]) + (isOpen(b) ? '' : ' · cerrada')}</h3><small>${pt.join(' · ')}</small></div>${S.me.role == 'admin' && !isLg ? `<button class="gh" onclick="admInv(${b})">Inventario</button>` : ''}</div><div class="bar"><i style="width:${Math.round((a.filter(p => p.ok).length / a.length) * 100)}%"></i></div></div>` +
          a.map(admCard).join('')
        );
      })
      .join('') +
    admFrm()
  );
}

function admLater(l) {
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
          .map(admCard)
          .join('')
    )
    .join('');
}

function apViewAdm() {
  S.apb = null;
  const t = ['h', 'o', ...(S.me.role == 'admin' ? ['s'] : [])].includes(S.apt) ? S.apt : 'h',
    l = S.pre.filter(p => p.large || S.apb == null || p.branch == S.apb),
    hoy = l.filter(p => p.date <= D),
    otro = l.filter(p => p.date > D),
    rp = (S.rq || []).filter(r => rqSt(r) == 'pendiente').length,
    tabs = [
      ['h', 'Hoy' + (hoy.length ? ' (' + hoy.length + ')' : '')],
      ['o', 'Otro día' + (otro.length ? ' (' + otro.length + ')' : '')],
      ...(S.me.role == 'admin' ? [['s', 'Entre sucursales' + (rp ? ' (' + rp + ')' : '')]] : []),
    ];
  return (
    `<div class="seg" style="margin-bottom:10px">${tabs.map(([k, n]) => `<button class="${t == k ? 'on' : ''}" onclick="admTab('${k}')">${n}</button>`).join('')}</div>` +
    (t == 'o'
      ? admBtn() + admLater(otro) + admFrm('o')
      : t == 's'
        ? reqAdmin() ||
          '<div class="card"><small>Hoy no hay apartados entre sucursales.</small></div>'
        : admToday(hoy))
  );
}

/* Checklist del administrador: marca (o desmarca) que aceptó el apartado. La entrega y el cobro los hace la sucursal. */
async function accPre(id) {
  const p = S.pre.find(x => x._id == id);
  if (!p || S.me.role != 'admin') return;
  const v = !p.ok;
  try {
    await db
      .doc('pre/' + id)
      .update({ ok: v, okAt: v ? Date.now() : null, okBy: v ? S.me.user : null });
    toast(v ? 'Aceptado: ' + p.client : 'Se quitó la aceptación de ' + p.client);
  } catch (e) {
    err(e);
  }
}

/* Rechazar un apartado que no se puede surtir (ej. sin materia prima): queda con motivo y los tamales se liberan */
function admRejectPre(id) {
  const p = S.pre.find(x => x._id == id);
  if (!p) return;
  const m = $('#modal');
  m.innerHTML = `<div class="card"><h3>Rechazar apartado</h3><small>${esc(p.client)} · ${esc(preTxt(p))}. Los tamales vuelven a quedar disponibles.</small><div class="form"><input id="rjr" placeholder="Motivo" value="Sin materia prima" style="flex:1"></div><div class="form"><button id="rjk">Rechazar</button><button class="alt" id="rjn">Volver</button></div></div>`;
  m.style.display = 'flex';
  $('#rjn').onclick = () => (m.style.display = 'none');
  $('#rjk').onclick = async () => {
    const r = ($('#rjr').value || '').trim() || 'Sin materia prima';
    m.style.display = 'none';
    if (!S.pre.find(x => x._id == id)) return toast('Este apartado ya no está pendiente');
    try {
      await db
        .doc('pre/' + id)
        .update({ status: 'rechazado', reason: r, doneAt: Date.now(), doneBy: S.me.user });
      toast('Apartado rechazado');
      logEv({
        branch: p.branch,
        kind: 'cancelacion',
        label: 'Apartado rechazado',
        txt: p.client + ' · ' + preTxt(p) + ' · ' + r,
        amt: preTot(p),
      });
    } catch (e) {
      err(e);
    }
  };
}

/* Sucursal del día: cada vendedor elige la suya (un vendedor por sucursal y por día). */

/* Un solo vendedor por sucursal y por día: lo garantizan las reglas con un documento claims/<sucursal>. */
const claimOf = b => S.claims.find(c => c.branch == b && c.day == day());

const brTaken = (b, ex) => {
  const c = claimOf(b);
  return c && c.uid != ex ? c : null;
};

const vbr = u => {
  const c = S.claims.find(c => c.uid == u.id && c.day == day());
  return c ? c.branch : null;
};

const vendReady = () => {
  const m = S.me;
  if (!m || m.role != 'vend' || !m.placed || m.branch == null || !isOpen(m.branch)) return false;
  return !S.clOk || S.claims.some(c => c.branch == m.branch && c.day == day() && c.uid == m.id);
};

let clUn = null;

function subClaims() {
  if (clUn) return;
  clUn = db.collection('claims').where('day', '==', day()).onSnapshot(
    q => {
      S.claims = q.docs.map(d => ({ id: d.id, ...d.data() }));
      S.clOk = true;
      if (S.me && S.me.role == 'vend') startSubs();
      render();
    },
    e => {
      console.warn('claims', e);
      S.clOk = true;
      render();
    }
  );
}

function stopClaims() {
  if (clUn) {
    clUn();
    clUn = null;
  }
  S.claims = [];
  S.clOk = false;
  S.cfgOk = false;
}

async function pickBr(b) {
  const m = S.me;
  if (!m || m.role != 'vend') return;
  if (b >= brs().length || !isOpen(b)) return toast('Esa sucursal ya no está disponible');
  const o = brTaken(b, m.id);
  if (o) return toast(brs()[b] + ' ya la tiene ' + o.name);
  if (!lock('pk')) return;
  try {
    const bt = db.batch();
    S.claims.filter(c => c.uid == m.id && c.branch != b).forEach(c => bt.delete('claims/' + c.id));
    bt.set('claims/' + b, {
      branch: b,
      day: day(),
      uid: m.id,
      user: m.user,
      name: m.name,
      ts: Date.now(),
    });
    bt.update('users/' + m.id, { branch: b, brDay: day() });
    await bt.commit();
    saveBr(m, b);
    try {
      navigator.vibrate && navigator.vibrate(30);
    } catch (_) {}
    toast('Estás en ' + brs()[b]);
  } catch (e) {
    delete lock.s.pk;
    if (e && e.code == 'permission-denied')
      toast('No se pudo: otro vendedor acaba de tomar ' + brs()[b]);
    else err(e);
  }
}

/* Última sucursal de cada vendedor en este dispositivo (el número no cambia aunque se agreguen o quiten sucursales) */
const lastBr = m => {
  try {
    const v = localStorage.getItem('tm_lb_' + m.id);
    return v == null ? null : +v;
  } catch (e) {
    return null;
  }
};

const saveBr = (m, b) => {
    try {
      localStorage.setItem('tm_lb_' + m.id, b);
    } catch (e) {}
  },
  clearBr = m => {
    try {
      localStorage.removeItem('tm_lb_' + m.id);
    } catch (e) {}
  };

/* Lista dinámica: toma las sucursales abiertas de Ajustes. Libres arriba (la última vez, primero); ocupadas, en una lista compacta abajo.
   Hasta 6 libres, una columna; más de 6, dos columnas. */
function pickView() {
  const m = S.me,
    o = BI(),
    n = esc((m.name || '').split(' ')[0]),
    fr = o.filter(i => !brTaken(i, m.id)),
    tk = o.filter(i => brTaken(i, m.id)),
    lb = lastBr(m),
    lf = fr.includes(lb) ? lb : null,
    btn = i =>
      `<button onclick="pickBr(${i})"${i === lf ? ' class="pkl"' : ''}><span>${esc(brs()[i])}${i === lf ? '<i>Tu última sucursal</i>' : ''}</span></button>`,
    ord = [...(lf != null ? [lf] : []), ...fr.filter(i => i !== lf)];
  return `<div class="hero" style="padding:32px 0 12px"><div class="logo">🫔</div><h1 style="margin:6px 0 4px">Hola, ${n}</h1><small>¿En qué sucursal vas a vender hoy?</small></div>
 <div class="card">${
   !o.length
     ? '<small>No hay sucursales abiertas. Pídele al administrador que agregue una.</small>'
     : `${fr.length ? `<div class="pkh"><span>Disponibles</span><span>${fr.length}</span></div><div class="pk${fr.length > 6 ? ' two' : ''}">${ord.map(btn).join('')}</div>` : '<p style="margin:4px 0 14px">Todas las sucursales ya tienen vendedor hoy. Si te toca una, pídele al administrador que la libere.</p>'}${tk.length ? `<div class="pkh"><span>Ocupadas hoy</span><span>${tk.length}</span></div>${tk.map(i => `<div class="pkt"><span>${esc(brs()[i])}</span><span>${esc(brTaken(i, m.id).name)}</span></div>`).join('')}` : ''}<small style="display:block;margin-top:6px">Vale para hoy. Si te equivocas, puedes cambiarla desde el menú mientras no hayas registrado ventas.</small>`
 }</div>
 <div class="card"><button class="alt" style="width:100%" onclick="logout()">Salir</button></div>`;
}

/* El vendedor deja su sucursal (solo si todavía no registra nada hoy) para elegir otra */
function chBr() {
  const m = S.me;
  if (!m || m.role != 'vend' || m.branch == null) return;
  if (corteDone()) return toast('Ya hiciste el corte de hoy: no puedes cambiar de sucursal');
  if (S.sales.some(s => s.by == m.user))
    return toast(
      'Ya registraste movimientos hoy en ' +
        brs()[m.branch] +
        '. Para cambiar, pídele al administrador que libere la sucursal'
    );
  const b = m.branch;
  ask('¿Cambiar de sucursal? Dejas ' + brs()[b] + ' libre para otro vendedor.', async () => {
    if (!lock('rl')) return;
    try {
      S.cart = {};
      await db.doc('claims/' + b).delete();
      clearBr(m);
    } catch (e) {
      delete lock.s.rl;
      err(e);
    }
  });
}

/* El administrador libera la sucursal de un vendedor (se fue, se equivocó, perdió el celular…) */
function freeBr(b) {
  b = +b;
  const c = claimOf(b);
  if (!c) return;
  ask(
    '¿Liberar ' + brs()[b] + '? ' + c.name + ' tendrá que elegir sucursal otra vez.',
    async () => {
      try {
        await db.doc('claims/' + b).delete();
        toast('Sucursal liberada');
      } catch (e) {
        err(e);
      }
    }
  );
}

/* Reinicio diario: si cambia el dia (app abierta de un dia para otro), el vendedor debe elegir sucursal otra vez. */
let _lastDay = day();
function resetIfNewDay() {
  const today = day();
  if (today === _lastDay) return;
  _lastDay = today;
  try { D = today; } catch (e) {}
  const m = S.me;
  if (m && m.role == 'vend') {
    m.placed = false;
    m.branch = null;
    try { stopSubs(); } catch (e) {}
    try { stopClaims(); } catch (e) {}
    subClaims();
    try { startSubs(); } catch (e) {}
    render(true);
  } else {
    try { stopClaims(); } catch (e) {}
    subClaims();
    render(true);
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') resetIfNewDay();
});
setInterval(resetIfNewDay, 60000);

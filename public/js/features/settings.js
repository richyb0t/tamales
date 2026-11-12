/* Ajustes: sucursales, precios y costos, alertas y fondo inicial. */

function closeBr(i) {
  if (BI().length <= 1) return toast('Debe quedar al menos una sucursal');
  if (S.pre.some(p => p.branch == i))
    return toast('Tiene apartados pendientes: entrégalos o cancélalos primero');
  if (claimOf(i))
    return toast('Hay un vendedor en esa sucursal hoy: libérala primero (en Usuarios)');
  if (F.some((_, f) => left(i, f) > 0) || chLeft(i) > 0)
    return toast('Aún tiene tamales o champurrado hoy: pásalos a otra sucursal en Traspasos');
  ask(
    '¿Eliminar "' + brs()[i] + '"? Ya no aparecerá, pero sus ventas anteriores se conservan.',
    async () => {
      try {
        await db.doc('config/main').set({ closed: [...(S.cfg.closed || []), i] }, { merge: true });
        toast('Sucursal eliminada');
      } catch (e) {
        err(e);
      }
    }
  );
}

async function openBr(i) {
  try {
    await db
      .doc('config/main')
      .set({ closed: (S.cfg.closed || []).filter(x => x !== i) }, { merge: true });
    toast('Sucursal reabierta');
  } catch (e) {
    err(e);
  }
}

async function addBranch() {
  const nums = brs().map(n => {
    const m = String(n).match(/(\d+)/);
    return m ? +m[1] : 0;
  });
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  const b = [...brs(), 'Sucursal ' + next];
  try {
    await db.doc('config/main').set({ branches: b }, { merge: true });
    toast('Sucursal agregada. Ponle nombre y guarda.');
  } catch (e) {
    err(e);
  }
}

async function deleteBrForever(i) {
  if (brs().length <= 1) return toast('Debe quedar al menos una sucursal');
  if (isOpen(i))
    return toast('Ciérrala primero con "Cerrar" y luego elimínala definitivamente');
  if (S.pre.some(p => p.branch == i))
    return toast('Tiene apartados pendientes: entrégalos o cancélalos primero');
  if (claimOf(i))
    return toast('Hay un vendedor en esa sucursal hoy: libérala primero (en Usuarios)');
  if (F.some((_, f) => left(i, f) > 0) || chLeft(i) > 0)
    return toast('Aún tiene tamales o champurrado hoy: pásalos a otra sucursal en Traspasos');
  try {
    const qs = await db.collection('sales').where('branch', '==', i).limit(1).get();
    if (!qs.empty) return toast('Esta sucursal tiene ventas registradas: no se puede eliminar definitivamente');
  } catch (e) {
    return toast('No se pudo verificar el historial de la sucursal');
  }
  ask(
    '¿Eliminar definitivamente "' +
      brs()[i] +
      '"? Esta acción no se puede deshacer. Sus ventas anteriores se conservan, pero la sucursal ya no existirá.',
    async () => {
      try {
        const oldBranches = brs();
        const oldLocs = S.cfg.branchLocs || [];
        const newBranches = oldBranches.filter((_, idx) => idx !== i);
        const newLocs = oldBranches
          .map((_, idx) => (idx === i ? null : oldLocs[idx] ?? null))
          .filter((_, idx) => idx !== i);
        const oldClosed = S.cfg.closed || [];
        const newClosed = oldClosed
          .filter(x => x !== i)
          .map(x => (x > i ? x - 1 : x));
        await db.doc('config/main').set(
          { branches: newBranches, branchLocs: newLocs, closed: newClosed },
          { merge: true }
        );
        toast('Sucursal eliminada definitivamente');
      } catch (e) {
        err(e);
      }
    }
  );
}

/* Zona de peligro: borra todos los datos de prueba (admin). Conserva usuarios, sucursales, precios y costos. */
async function resetTestData() {
  const code = prompt('Escribe RESET para confirmar el borrado de todos los datos de prueba.');
  if (code !== 'RESET') return toast('Cancelado');
  const pin = prompt('Escribe tu PIN de administrador para autorizar el borrado.');
  if (!pin) return toast('Cancelado');
  try {
    await FB.verifyPin(pin.trim());
  } catch (e) {
    return toast('PIN incorrecto');
  }
  ask(
    '¿Seguro? Se borrarán ventas, cargas, apartados, traspasos, cortes, solicitudes, repartos y existencias publicadas. Los logs de anulación no se pueden borrar. Usuarios, sucursales, precios y costos se conservan.',
    async () => {
      if (!lock('rst')) return;
      try {
        const cols = ['sales', 'loads', 'transfers', 'cuts', 'pre', 'claims', 'deliveries', 'reqs', 'stock'];
        for (const c of cols) {
          let snap;
          try {
            snap = await db.collection(c).get();
          } catch (e) {
            console.warn(c, e);
            continue;
          }
          const docs = snap.docs || [];
          for (let i = 0; i < docs.length; i += 400) {
            const bt = db.batch();
            docs.slice(i, i + 400).forEach(d => bt.delete(c + '/' + d.id));
            await bt.commit();
          }
        }
        try {
          await db.doc('config/main').set({ closed: [] }, { merge: true });
        } catch (e) {
          console.warn(e);
        }
        toast('Datos de prueba borrados');
        try {
          localStorage.removeItem('tm_v');
        } catch (e) {}
        setTimeout(() => location.reload(), 900);
      } catch (e) {
        delete lock.s.rst;
        err(e);
      }
    }
  );
}

/* Precios y costos: bloqueados por defecto (los campos están desactivados) para que no se cambien por error. Se vuelven a bloquear al guardar o al volver a Ajustes. */
function plUnlock() {
  ask(
    '¿Desbloquear precios y costos para editarlos? Los cambios de precio aplican a ventas nuevas.',
    () => {
      S.pl = false;
      renderNow(true);
    }
  );
}

function plLock() {
  S.pl = true;
  renderNow(true);
}

function removeFlavor(i) {
  if (!S.ajFlavors) S.ajFlavors = F.slice();
  if (!S.ajDisabled) S.ajDisabled = [];
  if (S.ajFlavors.length <= 1) return toast('Debe quedar al menos un sabor');
  ask('¿Quitar "' + S.ajFlavors[i] + '"? Se puede reabrir después. Las ventas anteriores se conservan.', () => {
    const name = S.ajFlavors.splice(i, 1)[0];
    if (name) S.ajDisabled.push(name);
    renderNow(true);
  });
}

function reopenFlavor(i) {
  if (!S.ajFlavors) S.ajFlavors = F.slice();
  if (!S.ajDisabled) S.ajDisabled = [];
  const name = S.ajDisabled.splice(i, 1)[0];
  if (name) {
    if (S.ajFlavors.includes(name)) return toast('Ya está activo');
    S.ajFlavors.push(name);
  }
  renderNow(true);
}

function addFlavor() {
  const inp = $('#flNew');
  const n = (inp ? inp.value : '').trim();
  if (!n) return toast('Escribe el nombre del sabor');
  if (!S.ajFlavors) S.ajFlavors = F.slice();
  if (!S.ajDisabled) S.ajDisabled = [];
  if (S.ajFlavors.includes(n) || S.ajDisabled.includes(n)) return toast('Ese sabor ya existe');
  S.ajFlavors.push(n);
  if (inp) inp.value = '';
  renderNow(true);
}

function ajView() {
  S.ajFlavors = F.slice();
  F = S.ajFlavors;
  S.ajDisabled = (S.cfg.disabledFlavors || []).slice();
  const op = BI().length,
    lk = S.pl !== false,
    isAdmin = S.me && S.me.role === 'admin',
    isSup = S.me && S.me.role === 'sup',
    dis = lk ? ' disabled' : '',
    ni = (id, v, ph, st, lb) =>
      `<input type="number" min="0" ${st || ''} inputmode="decimal" id="${id}" value="${v}" ${ph ? `placeholder="${ph}"` : ''} aria-label="${lb}">`,
    pr = (a, z) =>
      F.map((n, f) =>
        f >= a && f < z
           ? `<div class="row" style="position:relative;padding-right:30px"><div>${n}</div>${ni('pr' + f, price(f), '', 'style="width:4rem;text-align:center" ' + dis, 'Precio de ' + n)}${ni('co' + f, cst(f) || '', '—', 'step="0.5" style="width:4rem;text-align:center" ' + dis, 'Costo de ' + n)}${!lk && F.length > 1 ? `<button class="gh" style="color:var(--bad);position:absolute;right:4px;top:50%;transform:translateY(-50%);min-height:24px;padding:2px 6px;font-size:11px" onclick="removeFlavor(${f})">✕</button>` : ''}</div>`
          : ''
      ).join(''),
    al = (t, sm, inp) =>
      `<div class="row"><div>${t}${sm ? `<br><small>${sm}</small>` : ''}</div>${inp}</div>`;
  return `<div class="card"><div class="ivh"><h3>🏪 Sucursales</h3><span class="chip">${op} ${op == 1 ? 'abierta' : 'abiertas'}</span></div><small>Cambia el nombre y guarda. "Cerrar" oculta la sucursal (se puede reabrir). "Eliminar" la borra definitivamente (solo si está cerrada y sin datos activos). Las ventas anteriores se conservan.</small>
 ${brs()
    .map(
      (n, i) =>
        `<div class="form ajb"><input id="bn${i}" aria-label="Nombre de la sucursal ${i + 1}" value="${esc(n)}" style="flex:1;min-width:0;${isOpen(i) ? '' : 'opacity:.5'}">${isOpen(i) ? `<button class="gh" style="color:var(--bad)" onclick="closeBr(${i})">Cerrar</button>` : `<button class="gh" onclick="openBr(${i})">Reabrir</button><button class="gh" style="color:var(--bad)" onclick="deleteBrForever(${i})">Eliminar</button>`}</div>`
    )
    .join('')}
 <div class="form"><button class="alt" style="width:100%" onclick="addBranch()">＋ Agregar sucursal</button></div></div>
  ${isAdmin ? `<div class="card ${lk ? 'plk' : ''}"><div class="ivh"><h3>${lk ? '🔒' : '🔓'} Ubicaciones (lat, lng)</h3><button class="${lk ? 'alt' : 'gh'}" onclick="${lk ? 'plUnlock()' : 'plLock()'}">${lk ? 'Desbloquear' : 'Bloquear'}</button></div><small>Para logística de repartos: sucursal más cercana al pedido. ${lk ? 'Bloqueadas para que no se cambien por error.' : 'Desbloqueadas: edita y toca Guardar ajustes.'}</small>${brs().map((n, i) => `<div class="form" style="margin:2px 0 8px"><small style="flex:1 1 100%;font-weight:700">${esc(n)}</small><input id="blat${i}" type="number" step="0.0001" placeholder="Latitud" aria-label="Latitud ${esc(n)}" value="${esc((S.cfg.branchLocs || [])[i]?.lat ?? '')}" ${dis} style="flex:1"><input id="blng${i}" type="number" step="0.0001" placeholder="Longitud" aria-label="Longitud ${esc(n)}" value="${esc((S.cfg.branchLocs || [])[i]?.lng ?? '')}" ${dis} style="flex:1"></div>`).join('')}</div>` : ''}
  ${isAdmin ? `<div class="card"><div class="ivh"><h3>🔔 OneSignal (notificaciones push)</h3></div><small>Para que el repartidor reciba avisos con la app cerrada. Crea la app en onesignal.com, copia el App ID y la REST API Key, y pégalos aquí. Toca Guardar ajustes.</small><div class="form" style="margin:4px 0"><input id="osAppId" placeholder="App ID (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)" aria-label="OneSignal App ID" value="${esc((S.cfg.onesignalAppId) || '')}" style="flex:1"></div><div class="form" style="margin:4px 0"><input id="osRestKey" type="password" placeholder="REST API Key" aria-label="OneSignal REST API Key" value="${esc((S.cfg.onesignalRestKey) || '')}" style="flex:1"></div></div>` : ''}
  <div class="card"><h3>🔔 Apartados y alertas</h3>${al('Minutos que se guarda un apartado de otra sucursal', 'Cuenta desde que la otra sucursal lo acepta', ni('holdIn', holdMin(), '', '', 'Minutos de apartado').replace('min="0"', 'min="5"'))}${al('Avisar cuando queden esta cantidad de tamales o menos', 'Por cada sabor', ni('lowIn', lowT(), '', '', 'Aviso de tamales'))}${al('Avisar cuando queden estos litros o menos de champurrado', '', ni('lowlIn', lowL(), '', 'step="0.25"', 'Aviso de champurrado'))}</div>
  <div class="card"><h3>💵 Fondo inicial por vendedor</h3>${al('Efectivo con el que empieza cada vendedor', 'Se usa en el corte de caja', ni('fondoIn', fondo(), '', '', 'Fondo inicial'))}</div>
  ${isAdmin ? navCard() : ''}
  ${isAdmin ? `<div class="card ${lk ? 'plk' : ''}"><div class="ivh"><h3>${lk ? '🔒' : '🔓'} Precios y costos</h3><button class="${lk ? 'alt' : 'gh'}" onclick="${lk ? 'plUnlock()' : 'plLock()'}">${lk ? 'Desbloquear' : 'Bloquear'}</button></div>
  <small>${lk ? 'Bloqueados para que no se cambien por error. Toca Desbloquear para editarlos.' : 'Desbloqueados: edita y toca Guardar ajustes. Los cambios de precio aplican a ventas nuevas. El costo es opcional y sirve para calcular la utilidad en Reportes.'}</small>
   <div class="row pch" style="padding-right:30px"><div style="flex:1 1 9rem;min-width:0"></div><small style="flex:0 0 4rem;text-align:center">Precio $</small><small style="flex:0 0 4rem;text-align:center">Costo $</small></div>
  <div class="pkh" style="margin-top:6px"><span>Salados</span></div>${pr(0, 8)}<div class="pkh" style="margin-top:10px"><span>Dulces</span></div>${pr(8, F.length)}
  ${!lk ? `<div style="margin-top:8px">${(S.ajDisabled || []).length ? `<small style="display:block;font-weight:600;margin:4px 0 2px;opacity:.7">Desactivados</small>${(S.ajDisabled || []).map((n, i) => `<div class="row" style="opacity:.6"><div>${esc(n)}</div><button class="gh" style="min-height:28px;padding:2px 8px;font-size:11px" onclick="reopenFlavor(${i})">Reabrir</button></div>`).join('')}` : ''}<div class="form" style="margin-top:6px"><input id="flNew" placeholder="Nuevo sabor" aria-label="Nuevo sabor" style="flex:1"><button class="alt" onclick="addFlavor()">＋ Agregar</button></div>` : ''}
  <div class="pkh" style="margin-top:10px"><span>Bebidas · precio y costo por vaso</span></div>${CH.map((c, i) => `<div class="row"><div>Champurrado ${c[0].toLowerCase()}<br><small>${c[1]}</small></div>${ni('pr' + (100 + i), price(100 + i), '', dis, 'Precio de champurrado ' + c[0].toLowerCase())}${ni('co' + (100 + i), cst(100 + i) || '', '—', 'step="0.5"' + dis, 'Costo de champurrado ' + c[0].toLowerCase())}</div>`).join('')}</div>
</div>` : ''}
  <div class="cartsp"></div><div class="cart"><div class="ct one"><button class="go" style="flex:1" onclick="saveAj()">Guardar ajustes</button></div></div>
  ${isAdmin ? `<div class="card" style="border:2px solid var(--bad);margin-top:12px"><div class="ivh"><h3 style="color:var(--bad)">⚠️ Zona de peligro</h3></div><small>Borra todos los datos de prueba (ventas, cargas, apartados, traspasos, cortes, solicitudes, repartos y existencias publicadas). Conserva usuarios, sucursales, precios y costos. Los logs de anulación no se pueden borrar. Úsalo solo para demos o reinicio.</small><div class="form"><button class="gh bad" style="width:100%" onclick="resetTestData()">🗑️ Resetear datos de prueba</button></div></div>` : ''}`;
}

async function saveAj() {
  const flavors = (S.ajFlavors && S.ajFlavors.length ? S.ajFlavors : F).map((n, i) => {
      const e = $('#fl' + i);
      return e ? e.value.trim() || n : n;
    }),
    branches = brs().map((n, i) => {
      const e = $('#bn' + i);
      return e ? e.value.trim() || n : n;
    }),
    prices = {},
    costs = {};
  flavors.forEach((_, f) => {
    const e = $('#pr' + f);
    prices['f' + f] = e ? Math.max(0, +e.value || 0) : (S.cfg.prices || {})['f' + f] || 0;
    const c = $('#co' + f);
    costs['f' + f] = c ? Math.max(0, +c.value || 0) : (S.cfg.costs || {})['f' + f] || 0;
  });
  CH.forEach((c, i) => {
    prices['f' + (100 + i)] = Math.max(1, +$('#pr' + (100 + i)).value || c[2]);
    costs['f' + (100 + i)] = Math.max(0, +$('#co' + (100 + i)).value || 0);
  });
  try {
    await db.doc('config/main').set(
      {
        branches,
        flavors,
        disabledFlavors: S.ajDisabled || [],
        branchLocs: brs().map((_, i) => {
          const la = $('#blat' + i),
            lo = $('#blng' + i);
          if (!la && !lo) return (S.cfg.branchLocs || [])[i] || null;
          return { lat: +((la && la.value) || 0) || null, lng: +((lo && lo.value) || 0) || null };
        }),
        prices,
        costs,
        fondo: Math.max(0, +$('#fondoIn').value || 0),
        hold: Math.max(5, +$('#holdIn').value || 60),
        low: Math.max(0, +$('#lowIn').value || 0),
        lowl: Math.max(0, +$('#lowlIn').value || 0),
        onesignalAppId: ($('#osAppId') && $('#osAppId').value || '').trim(),
      },
      { merge: true }
    );
    if (isAdmin) {
      await db.doc('config/onesignal').set(
        { restKey: ($('#osRestKey') && $('#osRestKey').value || '').trim() },
        { merge: true }
      );
    }
    F = flavors.slice();
    if (S.ajFlavors) S.ajFlavors = flavors.slice();
    if (S.ajDisabled) S.ajDisabled = (S.ajDisabled || []).slice();
    toast('Ajustes guardados');
    S.pl = true;
    S.cfg = S.cfg || {};
    S.cfg.branchLocs = brs().map((_, i) => {
      const la = $('#blat' + i), lo = $('#blng' + i);
      if (!la && !lo) return (S.cfg.branchLocs || [])[i] || null;
      return { lat: +((la && la.value) || 0) || null, lng: +((lo && lo.value) || 0) || null };
    });
    S.cfg.onesignalAppId = ($('#osAppId') && $('#osAppId').value || '').trim();
    S.cfg.onesignalRestKey = null;
    renderNow(true);
  } catch (e) {
    err(e);
  }
}

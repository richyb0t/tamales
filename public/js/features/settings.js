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
  const b = [...brs(), 'Sucursal ' + (brs().length + 1)];
  try {
    await db.doc('config/main').set({ branches: b }, { merge: true });
    toast('Sucursal agregada. Ponle nombre y guarda.');
  } catch (e) {
    err(e);
  }
}

/* Precios y costos: bloqueados por defecto (los campos están desactivados) para que no se cambien por error. Se vuelven a bloquear al guardar o al volver a Ajustes. */
function plUnlock() {
  ask(
    '¿Desbloquear precios y costos para editarlos? Los cambios de precio aplican a ventas nuevas.',
    () => {
      S.pl = false;
      render(true);
    }
  );
}

function plLock() {
  S.pl = true;
  render(true);
}

function ajView() {
  const op = BI().length,
    lk = S.pl !== false,
    dis = lk ? ' disabled' : '',
    ni = (id, v, ph, st, lb) =>
      `<input type="number" min="0" ${st || ''} inputmode="decimal" id="${id}" value="${v}" ${ph ? `placeholder="${ph}"` : ''} aria-label="${lb}">`,
    pr = (a, z) =>
      F.map((n, f) =>
        f >= a && f < z
          ? `<div class="row"><div>${n}</div>${ni('pr' + f, price(f), '', dis, 'Precio de ' + n)}${ni('co' + f, cst(f) || '', '—', 'step="0.5"' + dis, 'Costo de ' + n)}</div>`
          : ''
      ).join(''),
    al = (t, sm, inp) =>
      `<div class="row"><div>${t}${sm ? `<br><small>${sm}</small>` : ''}</div>${inp}</div>`;
  return `<div class="card"><div class="ivh"><h3>🏪 Sucursales</h3><span class="chip">${op} ${op == 1 ? 'abierta' : 'abiertas'}</span></div><small>Cambia el nombre y guarda. Al eliminar una sucursal se conservan sus ventas anteriores.</small>
 ${brs()
    .map(
      (n, i) =>
        `<div class="form ajb"><input id="bn${i}" aria-label="Nombre de la sucursal ${i + 1}" value="${esc(n)}" style="flex:1;min-width:0;${isOpen(i) ? '' : 'opacity:.5'}">${isOpen(i) ? `<button class="gh" style="color:var(--bad)" onclick="closeBr(${i})">Eliminar</button>` : `<button class="gh" onclick="openBr(${i})">Reabrir</button>`}</div>`
    )
    .join('')}
 <div class="form"><button class="alt" style="width:100%" onclick="addBranch()">＋ Agregar sucursal</button></div></div>
  <div class="card ${lk ? 'plk' : ''}"><div class="ivh"><h3>${lk ? '🔒' : '🔓'} Ubicaciones (lat, lng)</h3><button class="${lk ? 'alt' : 'gh'}" onclick="${lk ? 'plUnlock()' : 'plLock()'}">${lk ? 'Desbloquear' : 'Bloquear'}</button></div><small>Para logística de repartos: sucursal más cercana al pedido. ${lk ? 'Bloqueadas para que no se cambien por error.' : 'Desbloqueadas: edita y toca Guardar ajustes.'}</small>${brs().map((n, i) => `<div class="form" style="margin:2px 0 8px"><input id="blat${i}" type="number" step="0.0001" placeholder="Latitud suc. ${i + 1}" aria-label="Latitud sucursal ${i + 1}" value="${esc((S.cfg.branchLocs || [])[i]?.lat ?? '')}" ${dis} style="flex:1"><input id="blng${i}" type="number" step="0.0001" placeholder="Longitud suc. ${i + 1}" aria-label="Longitud sucursal ${i + 1}" value="${esc((S.cfg.branchLocs || [])[i]?.lng ?? '')}" ${dis} style="flex:1"></div>`).join('')}</div>
  <div class="card"><h3>🔔 Apartados y alertas</h3>${al('Minutos que se guarda un apartado de otra sucursal', 'Cuenta desde que la otra sucursal lo acepta', ni('holdIn', holdMin(), '', '', 'Minutos de apartado').replace('min="0"', 'min="5"'))}${al('Avisar cuando queden esta cantidad de tamales o menos', 'Por cada sabor', ni('lowIn', lowT(), '', '', 'Aviso de tamales'))}${al('Avisar cuando queden estos litros o menos de champurrado', '', ni('lowlIn', lowL(), '', 'step="0.25"', 'Aviso de champurrado'))}</div>
  <div class="card"><h3>💵 Fondo inicial por vendedor</h3>${al('Efectivo con el que empieza cada vendedor', 'Se usa en el corte de caja', ni('fondoIn', fondo(), '', '', 'Fondo inicial'))}</div>
  ${navCard()}
  <div class="card ${lk ? 'plk' : ''}"><div class="ivh"><h3>${lk ? '🔒' : '🔓'} Precios y costos</h3><button class="${lk ? 'alt' : 'gh'}" onclick="${lk ? 'plUnlock()' : 'plLock()'}">${lk ? 'Desbloquear' : 'Bloquear'}</button></div>
  <small>${lk ? 'Bloqueados para que no se cambien por error. Toca Desbloquear para editarlos.' : 'Desbloqueados: edita y toca Guardar ajustes. Los cambios de precio aplican a ventas nuevas. El costo es opcional y sirve para calcular la utilidad en Reportes.'}</small>
  <div class="row pch"><div></div><small>Precio $</small><small>Costo $</small></div>
  <div class="pkh" style="margin-top:6px"><span>Salados</span></div>${pr(0, 8)}<div class="pkh" style="margin-top:10px"><span>Dulces</span></div>${pr(8, F.length)}
  <div class="pkh" style="margin-top:10px"><span>Bebidas · precio y costo por vaso</span></div>${CH.map((c, i) => `<div class="row"><div>Champurrado ${c[0].toLowerCase()}<br><small>${c[1]}</small></div>${ni('pr' + (100 + i), price(100 + i), '', dis, 'Precio de champurrado ' + c[0].toLowerCase())}${ni('co' + (100 + i), cst(100 + i) || '', '—', 'step="0.5"' + dis, 'Costo de champurrado ' + c[0].toLowerCase())}</div>`).join('')}</div>
  <div class="cartsp"></div><div class="cart"><div class="ct one"><button class="go" style="flex:1" onclick="saveAj()">Guardar ajustes</button></div></div>`;
}

async function saveAj() {
  const branches = brs().map((n, i) => {
      const e = $('#bn' + i);
      return e ? e.value.trim() || n : n;
    }),
    prices = {};
  const costs = {};
  F.forEach((_, f) => {
    prices['f' + f] = Math.max(0, +$('#pr' + f).value || 0);
    costs['f' + f] = Math.max(0, +$('#co' + f).value || 0);
  });
  CH.forEach((c, i) => {
    prices['f' + (100 + i)] = Math.max(1, +$('#pr' + (100 + i)).value || c[2]);
    costs['f' + (100 + i)] = Math.max(0, +$('#co' + (100 + i)).value || 0);
  });
  try {
    await db.doc('config/main').set(
      {
        branches,
         branchLocs: brs().map((_, i) => ({ lat: +($("#blat" + i)?.value || 0) || null, lng: +($("#blng" + i)?.value || 0) || null })),
        prices,
        costs,
        fondo: Math.max(0, +$('#fondoIn').value || 0),
        hold: Math.max(5, +$('#holdIn').value || 60),
        low: Math.max(0, +$('#lowIn').value || 0),
        lowl: Math.max(0, +$('#lowlIn').value || 0),
      },
      { merge: true }
    );
    toast('Ajustes guardados');
    S.pl = true;
    render(true);
  } catch (e) {
    err(e);
  }
}

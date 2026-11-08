/* Repartos a domicilio: alta (administrador y pedidos) y entrega (repartidor). */

const DV = {
  pendiente: ['Por tomar', 'low'],
  en_ruta: ['En camino', 'ok'],
  entregado: ['Entregado', 'ok'],
  fallido: ['No entregado', 'bad'],
  cancelado: ['Cancelado', ''],
};

const dvTxt = d =>
  Object.entries(d.items || {})
    .map(([k, v]) => v + '× ' + F[+k.slice(1)])
    .join(', ');

const dvDue = d => nz(d.total) + nz(d.fee);

const dvSum = n => Object.entries(n.items).reduce((a, [f, v]) => a + v * price(+f), 0);

function dvn() {
  if (!S.dvn)
    S.dvn = { branch: BI()[0], items: {}, client: '', phone: '', addr: '', note: '', fee: '', lat: '', lng: '' };
  if (!BI().includes(S.dvn.branch)) S.dvn.branch = BI()[0];
  return S.dvn;
}

function dvBr(i) {
  dvn().branch = i;
  render(true);
}

async function dvGeocode() {
  const n = dvn();
  const q = (n.addr || '').trim();
  if (!q) return toast('Escribe la dirección primero');
  const b = document.getElementById('dvgeo');
  if (b) { b.disabled = true; b.textContent = 'Buscando…'; }
  try {
    const r = await fetch('https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent(q + ', Guadalajara, Jalisco, Mexico') + '&format=json&limit=1', { headers: { 'Accept-Language': 'es' } });
    const data = await r.json();
    if (!data || !data.length) {
      toast('No se encontró la dirección. Pega las coordenadas manualmente o usa GPS.');
      return;
    }
    n.lat = +data[0].lat;
    n.lng = +data[0].lon;
    toast('Ubicación encontrada: ' + (data[0].display_name || '').slice(0, 60));
    render(true);
  } catch (e) {
    toast('Error al buscar. Pega las coordenadas manualmente.');
  } finally {
    if (b) { b.disabled = false; b.textContent = '🔍 Buscar ubicación de la dirección'; }
  }
}

function dvGps() {
  if (!navigator.geolocation) return toast('Tu dispositivo no soporta ubicación');
  const b = document.getElementById('dvgps');
  if (b) { b.disabled = true; b.textContent = 'Capturando…'; }
  navigator.geolocation.getCurrentPosition(
    pos => {
      const n = dvn();
      n.lat = pos.coords.latitude;
      n.lng = pos.coords.longitude;
      if (b) { b.disabled = false; b.textContent = '📍 Usar mi ubicación'; }
      toast('Ubicación capturada');
      render(true);
    },
    err => {
      if (b) { b.disabled = false; b.textContent = '📍 Usar mi ubicación'; }
      toast(err.code == 1 ? 'Permiso de ubicación denegado' : 'No se pudo obtener la ubicación');
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

function dvAdd(f, n) {
  const x = dvn();
  x.items = { ...x.items, [f]: Math.max(0, Math.min(499, (x.items[f] || 0) + n)) };
  render(true);
}

/* Cantidad escrita a mano: no vuelve a pintar para no perder el foco */
function dvQty(f, v, el) {
  const q = Math.max(0, Math.min(499, Math.floor(+v) || 0));
  dvn().items = { ...dvn().items, [f]: q };
  const r = el.closest('.fl');
  if (r) r.classList.toggle('sel', q > 0);
}

function dvToggle() {
  S.dvf = !S.dvf;
  render(true);
}

function dvForm() {
  const n = dvn(),
    sel = n.items,
    tot = dvSum(n),
    pcs = Object.values(sel).reduce((a, v) => a + v, 0);
  return `<div class="card" id="dvf"><h3>Nuevo reparto</h3><small>Escribe los datos del cliente y elige qué lleva. El repartidor lo verá y lo tomará.</small>
 <small style="display:block;margin-top:8px">¿De qué sucursal sale?</small>
${(() => {
  const items = Object.entries(sel).filter(([k, v]) => v > 0);
  const lat = +n.lat, lng = +n.lng;
  // nearest branch (if location captured)
  let nearest = null;
  if (lat && lng) {
    const ranked = BI().map(i => {
      const l = (S.cfg.branchLocs || [])[i];
      const d = l ? distKm({ lat, lng }, l) : null;
      return { i, d };
    }).filter(x => x.d != null).sort((a, b) => a.d - b.d);
    if (ranked.length) nearest = ranked[0].i;
  }
  return `<div class="seg" style="flex-wrap:wrap">${BI().map(i => {
    const ok = items.length ? items.every(([k, v]) => left(i, +k.slice(1)) >= v) : null;
    const light = ok === null ? '' : (ok ? ' 🟢' : ' 🔴');
    const isNear = i === nearest;
    return `<button class="${i == n.branch ? 'on' : ''}" onclick="dvBr(${i})" style="position:relative">${isNear ? '<span style="position:absolute;top:2px;right:4px;font-size:9px">📍</span>' : ''}${esc(brs()[i])}${light}</button>`;
  }).join('')}</div>${nearest !== null ? `<small style="display:block;margin:4px 0 8px;opacity:.75">Sucursal más cercana: <b>${esc(brs()[nearest])}</b>${items.length && !items.every(([k, v]) => left(nearest, +k.slice(1)) >= v) ? ' <span style="color:var(--bad)">(sin disponibilidad completa, elige otra)</span>' : ''}</small>` : ''}`;
})()}
 ${F.map((nombre, f) =>
   price(f)
     ? `<div class="fl ${sel[f] ? 'sel' : ''}"><div class="fn"><b>${esc(nombre)}</b><small>${money(price(f))}</small></div><div class="st"><button class="gh" onclick="dvAdd(${f},-1)" aria-label="Quitar uno">−</button><input type="number" min="0" max="499" inputmode="numeric" value="${sel[f] || 0}" aria-label="Cantidad de ${esc(nombre)}" oninput="dvQty(${f},this.value,this)" onchange="this.value=dvn().items[${f}]||0"><button onclick="dvAdd(${f},1)" aria-label="Agregar uno">+</button></div></div>`
     : ''
  ).join('')}
${CH.map((c, i) => {
  const f = 100 + i;
  return price(f) ? `<div class="fl ${sel[f] ? 'sel' : ''}"><div class="fn"><b>Champurrado ${esc(c[0])}</b><small>${esc(c[1])} · ${money(price(f))}</small></div><div class="st"><button class="gh" onclick="dvAdd(${f},-1)" aria-label="Quitar uno">−</button><input type="number" min="0" max="499" inputmode="numeric" value="${sel[f] || 0}" aria-label="Cantidad de champurrado ${esc(c[0])}" oninput="dvQty(${f},this.value,this)" onchange="this.value=dvn().items[${f}]||0"><button onclick="dvAdd(${f},1)" aria-label="Agregar uno">+</button></div></div>` : '';
}).join('')}
  <div class="form"><input id="dvc" placeholder="Nombre del cliente" value="${esc(n.client)}" oninput="dvn().client=this.value" style="flex:1"><input placeholder="Teléfono (opcional)" inputmode="tel" value="${esc(n.phone)}" oninput="dvn().phone=this.value" style="flex:1"></div>
 <div class="form"><input id="dva" placeholder="Dirección de entrega" value="${esc(n.addr)}" oninput="dvn().addr=this.value" style="flex:1 1 100%"></div>
<div class="form"><button class="alt" style="flex:1" onclick="dvGeocode()" id="dvgeo">🔍 Buscar ubicación de la dirección</button></div>
<div class="form"><button class="alt" style="flex:1" onclick="dvGps()" id="dvgps">📍 Capturar ubicación del pedido</button>${n.lat && n.lng ? `<small style="flex-basis:100%;opacity:.7">Ubicación del pedido: ${(+n.lat).toFixed(5)}, ${(+n.lng).toFixed(5)} (${esc(n.addr || '')})</small><iframe src="https://www.google.com/maps?q=${n.lat},${n.lng}&z=16&output=embed" width="100%" height="140" style="border:0;border-radius:8px;margin-top:4px" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>` : '<small style="flex-basis:100%;opacity:.7">Ve al lugar del pedido (o pega las coordenadas del cliente) y captura la ubicación para saber qué sucursal queda más cerca.</small>'}</div>
<details style="margin:4px 0"><summary style="cursor:pointer;opacity:.7;font-size:12px">Ingresar coordenadas manualmente</summary><div class="form"><input type="number" step="0.0001" placeholder="Latitud" aria-label="Latitud del pedido" value="${esc(n.lat ?? '')}" oninput="dvn().lat=this.value" style="flex:1"><input type="number" step="0.0001" placeholder="Longitud" aria-label="Longitud del pedido" value="${esc(n.lng ?? '')}" oninput="dvn().lng=this.value" style="flex:1"></div></details>
${(() => {
  const lat = +n.lat, lng = +n.lng;
  if (!lat || !lng) return '';
  const near = brs().map((nm, i) => {
    const l = (S.cfg.branchLocs || [])[i];
    const d = l ? distKm({ lat, lng }, l) : null;
    return { i, nm, d, open: BI().includes(i) };
  }).filter(x => x.d != null).sort((a, b) => a.d - b.d);
  if (!near.length) return '<small style="display:block;opacity:.7">Sin ubicaciones de sucursales configuradas en Ajustes.</small>';
  const best = near[0];
  return '<small style="display:block;margin-top:4px">Sucursal mas cercana: <b>' + esc(brs()[best.i]) + '</b> (' + best.d.toFixed(1) + ' km)' + (near.length > 1 ? ' · ' + near.slice(1).map(x => esc(brs()[x.i]) + ' ' + x.d.toFixed(1) + 'km').join(' · ') : '') + '</small>';
})()}
 <div class="form"><input placeholder="Nota (referencias, hora)" value="${esc(n.note)}" oninput="dvn().note=this.value" style="flex:1"><input type="number" min="0" inputmode="decimal" placeholder="Envío $" aria-label="Costo de envío" value="${esc(n.fee)}" oninput="dvn().fee=this.value"></div>
 <small style="display:block">Productos: <b>${money(tot)}</b>${pcs ? ' · ' + pcs + (pcs == 1 ? ' tamal' : ' tamales') : ''}</small>
 <div class="form"><button class="go" style="flex:1" onclick="saveDv()">Guardar reparto</button></div></div>`;
}

async function saveDv() {
  const n = dvn(),
    items = {};
  Object.entries(n.items).forEach(([f, v]) => {
    if (v > 0) items['f' + f] = v;
  });
  if (!Object.keys(items).length) return toast('Elige los tamales del reparto');
  const z0 = noPrice(Object.keys(items).map(k => +k.slice(1)));
  if (z0) return toast('Falta el precio de ' + z0 + '. Revisa Ajustes');
  if (!n.client.trim()) return toast('Escribe el nombre del cliente');
  if (!n.addr.trim()) return toast('Escribe la dirección de entrega');
  const b = n.branch;
  const sh = Object.entries(items).find(([k, v]) => v > left(b, +k.slice(1)));
  if (sh)
    return toast(
      'En ' +
        brs()[b] +
        ' solo quedan ' +
        Math.max(0, left(b, +sh[0].slice(1))) +
        ' de ' +
        F[+sh[0].slice(1)] +
        '. Elige otra sucursal o menos'
    );
  if (!lock('dv')) return;
  try {
    await db.collection('deliveries').add({
      day: D,
      branch: n.branch,
      items,
      client: n.client.trim(),
      phone: n.phone.trim(),
      addr: n.addr.trim(),
      lat: +n.lat || null,
      lng: +n.lng || null,
      note: n.note.trim(),
      total: dvSum(n),
      fee: Math.max(0, +n.fee || 0),
      status: 'pendiente',
      by: S.me.user,
      byName: S.me.name,
      drv: null,
      drvName: null,
      ts: Date.now(),
    });
    S.dvn = null;
    S.dvf = false;
    toast('Reparto guardado');
    render(true);
  } catch (e) {
    delete lock.s.dv;
    err(e);
  }
}

async function dvSet(id, patch, msg) {
  try {
    await db.doc('deliveries/' + id).update(patch);
    if (msg) toast(msg);
  } catch (e) {
    err(e);
  }
}

const dvTake = id =>
  dvSet(
    id,
    { status: 'en_ruta', drv: S.me.user, drvName: S.me.name, tsTake: Date.now() },
    'Reparto tomado'
  );

const dvRelease = id =>
  ask('¿Soltar este reparto? Vuelve a quedar disponible para otro repartidor.', () =>
    dvSet(id, { status: 'pendiente', drv: null, drvName: null }, 'Reparto liberado')
  );

const dvCancel = id =>
  ask('¿Cancelar este reparto?', () => dvSet(id, { status: 'cancelado' }, 'Reparto cancelado'));

function dvChg(due) {
  const v = $('#dvp').value,
    e = $('#dvq');
  if (v === '') {
    e.textContent = '';
    return;
  }
  const d = +v - due;
  e.className = 'big ' + (d < 0 ? 'bad' : 'ok');
  e.textContent = d < 0 ? 'Faltan ' + money(-d) : 'Cambio: ' + money(d);
}

function dvDone(id) {
  const d = (S.dv || []).find(x => x._id == id);
  if (!d) return;
  const due = dvDue(d),
    m = $('#modal');
  m.innerHTML = `<div class="card"><small>Entregar · ${esc(d.client)}</small><p>${esc(dvTxt(d))}</p><small>Cobrar${d.fee ? ' (incluye envío ' + money(d.fee) + ')' : ''}</small><div class="big" style="font-size:38px">${money(due)}</div><div class="form"><input type="number" min="0" inputmode="decimal" id="dvp" class="wide" aria-label="Con cuánto paga el cliente" placeholder="Paga con $" oninput="dvChg(${due})"></div><div id="dvq" class="big" style="font-size:26px"></div><div class="form"><button id="mk">Confirmar entrega</button><button class="alt" id="mn">Cancelar</button></div></div>`;
  m.style.display = 'flex';
  $('#mn').onclick = () => (m.style.display = 'none');
  $('#mk').onclick = () => {
    const v = $('#dvp').value,
      p = v === '' ? due : +v;
    if (p < due) return toast('El pago no alcanza');
    m.style.display = 'none';
    dvSet(
      id,
      { status: 'entregado', cobrado: due, tsDone: Date.now() },
      'Entregado' + (p > due ? ' · cambio ' + money(p - due) : '')
    );
  };
}

function dvFail(id) {
  const d = (S.dv || []).find(x => x._id == id);
  if (!d) return;
  const m = $('#modal');
  m.innerHTML = `<div class="card"><h3>No se pudo entregar</h3><small>${esc(d.client)} · ${esc(d.addr)}</small><div class="form"><select id="dvr" aria-label="Motivo"><option>Cliente no contestó</option><option>Cliente no estaba</option><option>Dirección incorrecta</option><option>Cliente canceló</option><option>Otro</option></select></div><div class="form"><button id="mk">Confirmar</button><button class="alt" id="mn">Volver</button></div></div>`;
  m.style.display = 'flex';
  $('#mn').onclick = () => (m.style.display = 'none');
  $('#mk').onclick = () => {
    const r = $('#dvr').value;
    m.style.display = 'none';
    dvSet(id, { status: 'fallido', reason: r, tsDone: Date.now() }, 'Marcado como no entregado');
  };
}

function dvCard(d, rep) {
  const t = DV[d.status] || ['', ''],
    me = S.me,
    ph = (d.phone || '').trim(),
    mapUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(d.addr || ''),
    A = me.role == 'admin';
  let bt = '';
  if (rep) {
    if (d.status == 'pendiente') bt = `<button class="go p" onclick="dvTake('${d._id}')">Tomar reparto</button>`;
    else if (d.status == 'en_ruta' && d.drv == me.user)
      bt = `<button class="go p" onclick="dvDone('${d._id}')">Entregar y cobrar ${money(dvDue(d))}</button><button class="alt" onclick="dvFail('${d._id}')">No se pudo</button><button class="gh" onclick="dvRelease('${d._id}')">Soltar</button>`;
  } else if (
    (A && ['pendiente', 'en_ruta'].includes(d.status)) ||
    (d.status == 'pendiente' && d.by == me.user)
  )
    bt = `<button class="gh" style="color:var(--bad)" onclick="dvCancel('${d._id}')">Cancelar</button>`;
  return `<div class="card apc${d.status == 'entregado' ? ' ok' : ''}"><div class="aph"><div><b class="n">${esc(d.client)}</b><div class="apm">${esc(brs()[d.branch] || '')} · ${hm(d.ts)} · lo capturó ${esc(d.byName || d.by)}${d.drvName ? ' · 🛵 ' + esc(d.drvName) : ''}</div></div><div style="text-align:right;flex:none"><b>${money(dvDue(d))}</b><br><span class="chip ${t[1]}">${t[0]}</span></div></div>
 <div class="apt">${esc(dvTxt(d))}${d.fee ? '<br><small>Envío ' + money(d.fee) + '</small>' : ''}</div>
 <div>📍 <a href="${mapUrl}" target="_blank" rel="noopener" style="color:var(--ac);font-weight:700;text-decoration:none">${esc(d.addr)}  <div>📍 <a href="${mapUrl}" target="_blank" rel="noopener" style="color:var(--ac);font-weight:700;text-decoration:none">${esc(d.addr)}</a></div>${d.lat != null && d.lng != null ? `<div style="margin:4px 0"><iframe src="https://www.google.com/maps?q=${d.lat},${d.lng}&z=16&output=embed" width="100%" height="180" style="border:0;border-radius:8px" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe><div style="margin-top:4px"><a href="https://www.google.com/maps?q=${d.lat},${d.lng}" target="_blank" rel="noopener" style="display:inline-block;padding:4px 8px;border:1px solid var(--ac);border-radius:6px;color:var(--ac);font-size:12px;text-decoration:none">🗺️ Abrir en Google Maps</a></div></div>` : ''}${(() => {
    if (d.lat == null || d.lng == null) return '';
    const near = brs().map((nm, i) => {
      const l = (S.cfg.branchLocs || [])[i];
      const dd = l ? distKm({ lat: d.lat, lng: d.lng }, l) : null;
      return { i, nm, dd };
    }).filter(x => x.dd != null).sort((a, b) => a.dd - b.dd);
    if (!near.length) return '';
    const best = near[0];
    return '<small style="display:block;margin-top:2px">Sucursal mas cercana: <b>' + esc(brs()[best.i]) + '</b> (' + best.dd.toFixed(1) + ' km)' + (near.length > 1 ? ' · ' + near.slice(1).map(x => esc(brs()[x.i]) + ' ' + x.dd.toFixed(1) + 'km').join(' · ') : '') + '</small>';
  })()}
 ${ph ? `<div><a href="tel:${esc(ph.replace(/[^0-9+]/g, ''))}" style="color:var(--ac);font-weight:800;text-decoration:none">📞 ${esc(ph)}</a></div>` : ''}${d.note ? `<small>📝 ${esc(d.note)}</small>` : ''}${d.status == 'fallido' ? `<small class="bad" style="display:block">${esc(d.reason || '')}</small>` : ''}${bt ? `<div class="apa">${bt}</div>` : ''}</div>`;
}

/* Administrador y Pedidos */
function dvPanel() {
  const L = (S.dv || []).slice().sort((a, b) => b.ts - a.ts),
    n = s => L.filter(d => d.status == s).length,
    cash = L.filter(d => d.status == 'entregado').reduce((a, d) => a + nz(d.cobrado), 0);
  return `<div class="kp" style="margin-bottom:8px"><div><small>Por tomar</small><b>${n('pendiente')}</b></div><div><small>En camino</small><b>${n('en_ruta')}</b></div><div><small>Entregados</small><b>${n('entregado')}</b></div></div>
 ${S.me.role == 'admin' ? `<div class="card"><div class="row" style="border:0;padding:0"><div>Efectivo cobrado por repartidores<br><small>Lo que deben entregar hoy</small></div><b>${money(cash)}</b></div></div>` : ''}
 <div class="form" style="margin:0 0 10px"><button class="alt" style="flex:1" onclick="dvToggle()">${S.dvf ? '✕ Cerrar formulario' : '＋ Nuevo reparto'}</button></div>
 ${S.dvf ? dvForm() : ''}
 ${L.map(d => dvCard(d, false)).join('') || '<div class="card"><small>Todavía no hay repartos hoy.</small></div>'}`;
}

/* Repartidor */
function repView() {
  const me = S.me.user,
    L = (S.dv || []).slice().sort((a, b) => a.ts - b.ts),
    free = L.filter(d => d.status == 'pendiente'),
    mine = L.filter(d => d.drv == me && d.status == 'en_ruta'),
    ok = L.filter(d => d.drv == me && d.status == 'entregado'),
    bad = L.filter(d => d.drv == me && d.status == 'fallido'),
    cash = ok.reduce((a, d) => a + nz(d.cobrado), 0);
  return (
    head() +
    alertSpace() +
    `<div class="kp kv"><div><small>En camino</small><b>${mine.length}</b></div><div><small>Entregados</small><b>${ok.length}</b></div><div><small>Efectivo a rendir</small><b>${money(cash)}</b></div></div>` +
    (mine.length ? '<h3 style="margin:12px 4px 6px">Mis repartos en camino</h3>' + mine.map(d => dvCard(d, true)).join('') : '') +
    '<h3 style="margin:12px 4px 6px">Disponibles</h3>' +
    (free.map(d => dvCard(d, true)).join('') || '<div class="card"><small>No hay repartos por tomar. Se actualiza solo.</small></div>') +
    (ok.length + bad.length
      ? '<h3 style="margin:12px 4px 6px">Terminados hoy</h3>' + [...ok, ...bad].map(d => dvCard(d, true)).join('')
      : '')
  );
}

const alertSpace = () => '';

function initMinimaps() {
  if (typeof L === 'undefined') {
    setTimeout(initMinimaps, 300);
    return;
  }
  const maps = document.querySelectorAll('.minimap');
  if (!maps.length) return;
  maps.forEach(el => {
    if (el.dataset.inited) return;
    el.dataset.inited = '1';
    const lat = +el.dataset.lat, lng = +el.dataset.lng;
    if (!lat || !lng) { el.style.display = 'none'; return; }
    let locs = [];
    try { locs = JSON.parse(el.dataset.branchlocs || '[]'); } catch (e) { locs = []; }
    try {
      const map = L.map(el, { zoomControl: false, attributionControl: false });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
      const bounds = [];
      L.circleMarker([lat, lng], { radius: 8, color: '#c0392b', fillColor: '#e74c3c', fillOpacity: 1 }).addTo(map).bindPopup('Pedido');
      bounds.push([lat, lng]);
      locs.forEach((l, i) => {
        if (l && l.lat != null && l.lng != null) {
          L.circleMarker([l.lat, l.lng], { radius: 7, color: '#1f6feb', fillColor: '#58a6ff', fillOpacity: 0.9 }).addTo(map).bindPopup('Sucursal ' + (i + 1));
          bounds.push([l.lat, l.lng]);
        }
      });
      if (bounds.length > 1) map.fitBounds(bounds, { padding: [20, 20] });
      else map.setView([lat, lng], 15);
      setTimeout(() => { try { map.invalidateSize(); } catch (e) {} }, 100);
    } catch (e) {
      console.error('minimap error', e);
      // fallback: show google maps iframe
      el.innerHTML = '<iframe src="https://www.google.com/maps?q=' + lat + ',' + lng + '&z=16&output=embed" width="100%" height="100%" style="border:0;border-radius:8px" loading="lazy"></iframe>';
    }
  });
}
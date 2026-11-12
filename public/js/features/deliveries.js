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
    .map(([k, v]) => v + '× ' + nm(+k.slice(1)))
    .join(', ');

const dvDue = d => nz(d.total) + nz(d.fee);

const dvSum = n => Object.entries(n.items).reduce((a, [f, v]) => a + v * price(+f), 0);

function dvn() {
  if (!S.dvn)
    S.dvn = { branch: BI()[0], items: {}, client: '', phone: '', addr: '', time: '', note: '', fee: '', lat: '', lng: '', step: 1 };
  if (!BI().includes(S.dvn.branch)) S.dvn.branch = BI()[0];
  return S.dvn;
}

function dvBr(i) {
  dvn().branch = i;
  renderNow(true);
}

async function dvGeocode() {
  const n = dvn();
  const q = (n.addr || '').trim();
  if (!q) return toast('Escribe la dirección primero');
  const b = document.getElementById('dvgeo');
  if (b) { b.disabled = true; b.textContent = 'Buscando…'; }
  try {
    const full = q + ', Guadalajara, Jalisco, México';
    let lat = null,
      lng = null,
      label = '';
    /* 1) Mapbox: preciso para direcciones mexicanas, sin tarjeta de crédito. */
    try {
      const r = await fetch(
        'https://api.mapbox.com/geocoding/v5/mapbox.places/' +
          encodeURIComponent(full) +
          '.json?access_token=' + atob('cGsuZXlKMUlqb2lZMkZ6ZEhKdmMzUmhiV0ZzWlhNaUxDSmhJam9pWTIxM1pETTRaVGg2TURobk5qTXhjSFp6T1hsbGNubG5kaUo5LnhXZ2p0T2VLa3RiakUzQkxkYldNZmc=') +
          '&country=mx&limit=1&types=address,place,postcode'
      );
      const d = await r.json();
      const f = d.features && d.features[0];
      if (f && f.center) {
        lng = +f.center[0];
        lat = +f.center[1];
        label = f.place_name || '';
      }
    } catch (e) {
      /* sin conexión con Mapbox: se usa el respaldo */
    }
    /* 2) ArcGIS: acierta el número de casa, igual que Google Maps, sin API key. */
    if (lat == null || lng == null) {
      try {
        const r = await fetch(
          'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?SingleLine=' +
            encodeURIComponent(full) +
            '&f=json&maxLocations=1&countryCode=MEX&outSR=4326'
        );
        const d = await r.json();
        const c = d.candidates && d.candidates[0];
        if (c && c.score >= 80 && c.location) {
          lat = +c.location.y;
          lng = +c.location.x;
          label = c.address || '';
        }
      } catch (e) {
        /* sin conexión con ArcGIS: se usa el respaldo */
      }
    }
    /* 3) Respaldo: Nominatim, quitando el número de casa si no lo tiene. */
    if (lat == null || lng == null) {
      const street = q
        .replace(/^\s*\d{1,5}[A-Za-z-]?\s+/, '')
        .replace(/\s+\d{1,5}[A-Za-z-]?\s*$/, '')
        .trim();
      const tries = [full];
      if (street && street !== q) tries.push(street + ', Guadalajara, Jalisco, México');
      let data = null;
      for (let i = 0; i < tries.length; i++) {
        if (i) await new Promise(r => setTimeout(r, 1100));
        try {
          const r = await fetch(
            'https://nominatim.openstreetmap.org/search?q=' +
              encodeURIComponent(tries[i]) +
              '&format=json&limit=1&countrycodes=mx',
            { headers: { 'Accept-Language': 'es' } }
          );
          data = await r.json();
          if (data && data.length) break;
        } catch (e) { /* sin conexión */ }
      }
      if (data && data.length) {
        lat = +data[0].lat;
        lng = +data[0].lon;
        label = data[0].display_name || '';
      }
    }
    if (lat == null || lng == null) {
      toast('No se encontró la dirección. Pega las coordenadas manualmente o usa GPS.');
      return;
    }
    n.lat = lat;
    n.lng = lng;
    const ranked = BI().map(i => {
      const l = (S.cfg.branchLocs || [])[i];
      const d = l ? distKm({ lat: n.lat, lng: n.lng }, l) : null;
      return { i, d };
    }).filter(x => x.d != null).sort((a, c) => a.d - c.d);
    if (ranked.length) n.branch = ranked[0].i;
    toast('Ubicación encontrada: ' + (label || '').slice(0, 60));
    renderNow(true);
  } catch (e) {
    toast('Error al buscar. Pega las coordenadas manualmente.');
  } finally {
    if (b) { b.disabled = false; b.textContent = '🔍 Buscar ubicación de la dirección'; }
  }
}

function dvAdd(f, n) {
  const x = dvn();
  x.items = { ...x.items, [f]: Math.max(0, Math.min(499, (x.items[f] || 0) + n)) };
  renderNow(true);
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
  if (S.dvf) S.dvn = null;
  renderNow(true);
  requestAnimationFrame(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

function dvForm() {
  const n = dvn(),
    sel = n.items,
    tot = dvSum(n),
    pcs = Object.values(sel).reduce((a, v) => a + v, 0),
    mq = (n.addr || '').trim() || (n.lat && n.lng ? n.lat + ',' + n.lng : '');
  if (!n.step) n.step = 1;
  const step = n.step;
  const steps = ['Dirección', 'Productos', 'Sucursal', 'Guardar'];
  const head = `<div class="card" id="dvf"><h3>Nuevo reparto</h3><small>Paso ${step} de 4 · ${steps[step - 1]}</small><div style="display:flex;gap:4px;margin:6px 0 10px">${steps.map((s, i) => `<div style="flex:1;height:4px;border-radius:2px;background:${i + 1 <= step ? 'var(--ac)' : 'var(--bd)'}"></div>`).join('')}</div>`;
  const nav = (back, next, nextLabel) =>
    `<div class="form" style="margin-top:10px">${back ? `<button class="alt" style="flex:1" onclick="dvStep(${back})">← Atrás</button>` : ''}${next ? `<button class="go" style="flex:1" onclick="dvStep(${next})">${nextLabel || 'Siguiente →'}</button>` : ''}</div>`;
  let body = '';
  if (step === 1) {
    body = `
     <div class="form"><input id="dva" placeholder="Dirección" value="${esc(n.addr)}" oninput="dvn().addr=this.value" style="flex:1 1 100%"></div>
     <div class="form"><button class="alt" style="flex:1" onclick="dvGeocode()" id="dvgeo">🔍 Buscar ubicación de la dirección</button></div>
     ${n.lat && n.lng ? `<small style="display:block;opacity:.7;margin:4px 0">Ubicación: ${(+n.lat).toFixed(5)}, ${(+n.lng).toFixed(5)} (${esc(n.addr || '')}) · <a href="https://www.google.com/maps?q=${encodeURIComponent(mq)}" target="_blank" rel="noopener" style="color:var(--ac);font-weight:700">Ver en Google Maps</a></small><iframe src="https://www.google.com/maps?q=${encodeURIComponent(mq)}&z=16&output=embed" width="100%" height="140" style="border:0;border-radius:8px;margin:4px 0" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>` : '<small style="display:block;opacity:.7;margin:4px 0">Opcional: busca la ubicación para saber qué sucursal queda más cerca.</small>'}
     <details style="margin:4px 0"><summary style="cursor:pointer;opacity:.7;font-size:12px">Ingresar coordenadas manualmente</summary><div class="form"><input type="number" step="0.0001" placeholder="Latitud" aria-label="Latitud del pedido" value="${esc(n.lat ?? '')}" oninput="dvn().lat=this.value" style="flex:1"><input type="number" step="0.0001" placeholder="Longitud" aria-label="Longitud del pedido" value="${esc(n.lng ?? '')}" oninput="dvn().lng=this.value" style="flex:1"></div></details>
     ${(() => {
       const lat = +n.lat, lng = +n.lng;
       if (!lat || !lng) return '';
       const ranked = BI().map(i => {
         const l = (S.cfg.branchLocs || [])[i];
         const d = l ? distKm({ lat, lng }, l) : null;
         return { i, d };
       }).filter(x => x.d != null).sort((a, b) => a.d - b.d);
       if (!ranked.length) return '';
       const nearest = ranked[0].i;
       return '<small style="display:block;margin:4px 0;opacity:.75">Sucursal más cercana: <b>' + esc(brs()[nearest]) + '</b> (' + ranked[0].d.toFixed(1) + ' km)</small>';
     })()}
     ${nav(false, 2, 'Siguiente: Productos →')}
    `;
  } else if (step === 2) {
    body = `
     <small style="display:block;margin-bottom:6px">Tamales</small>
     ${F.map((nombre, f) =>
       price(f)
         ? `<div class="fl ${sel[f] ? 'sel' : ''}"><div class="fn"><b>${esc(nombre)}</b><small>${money(price(f))}</small></div><div class="st"><button class="gh" onclick="dvAdd(${f},-1)" aria-label="Quitar uno">−</button><input type="number" min="0" max="499" inputmode="numeric" value="${sel[f] || 0}" aria-label="Cantidad de ${esc(nombre)}" oninput="dvQty(${f},this.value,this)" onchange="this.value=dvn().items[${f}]||0"><button onclick="dvAdd(${f},1)" aria-label="Agregar uno">+</button></div></div>`
         : ''
     ).join('')}
     <small style="display:block;margin:8px 0 6px">Champurrado</small>
     ${CH.map((c, i) => {
       const f = 100 + i;
       return price(f) ? `<div class="fl ${sel[f] ? 'sel' : ''}"><div class="fn"><b>Champurrado ${esc(c[0])}</b><small>${esc(c[1])} · ${money(price(f))}</small></div><div class="st"><button class="gh" onclick="dvAdd(${f},-1)" aria-label="Quitar uno">−</button><input type="number" min="0" max="499" inputmode="numeric" value="${sel[f] || 0}" aria-label="Cantidad de champurrado ${esc(c[0])}" oninput="dvQty(${f},this.value,this)" onchange="this.value=dvn().items[${f}]||0"><button onclick="dvAdd(${f},1)" aria-label="Agregar uno">+</button></div></div>` : '';
     }).join('')}
     <small style="display:block;margin-top:8px;opacity:.7">Total: ${money(tot)} · ${pcs} ${pcs == 1 ? 'tamal' : 'tamales'}</small>
     ${nav(1, 3, 'Siguiente: Sucursal →')}
    `;
  } else if (step === 3) {
    const items = Object.entries(sel).filter(([k, v]) => v > 0);
    const lat = +n.lat, lng = +n.lng;
    let ranked = [];
    let nearest = null;
    let autoBr = null;
    if (lat && lng) {
      ranked = BI().map(i => {
        const l = (S.cfg.branchLocs || [])[i];
        const d = l ? distKm({ lat, lng }, l) : null;
        return { i, d };
      }).filter(x => x.d != null).sort((a, b) => a.d - b.d);
      if (ranked.length) nearest = ranked[0].i;
    }
    if (items.length) {
      const has = i => items.every(([k, v]) => left(i, +k.slice(1)) >= v);
      if (!has(n.branch)) {
        const cand = ranked.filter(r => has(r.i)).sort((a, b) => a.d - b.d)[0];
        if (cand) {
          n.branch = cand.i;
          autoBr = cand.i;
        }
      }
    }
    body = `
     <small style="display:block;margin-bottom:6px">¿De qué sucursal sale?</small>
     <div class="seg" style="flex-wrap:wrap;overflow:visible;padding-top:8px">${BI().map(i => {
       const ok = items.length ? items.every(([k, v]) => left(i, +k.slice(1)) >= v) : null;
       const isNear = i === nearest;
       const dot = ok === null ? '' : `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${ok ? '#22c55e' : '#ef4444'};box-shadow:0 0 6px ${ok ? 'rgba(34,197,94,.6)' : 'rgba(239,68,68,.6)'};margin-left:6px;vertical-align:middle"></span>`;
               const badgeA = `<span style="position:absolute;top:-8px;right:-4px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;font-size:9px;font-weight:700;padding:2px 7px;border-radius:999px;box-shadow:0 2px 6px rgba(0,0,0,.3);letter-spacing:.3px;white-space:nowrap;z-index:2">MÁS CERCANA</span>`;
        const badgeB = `<span style="position:absolute;top:-8px;right:-4px;background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;font-size:9px;font-weight:700;padding:2px 7px;border-radius:999px;box-shadow:0 2px 6px rgba(0,0,0,.3);letter-spacing:.3px;white-space:nowrap;z-index:2">INDICADA</span>`;
        const badge = i === nearest ? badgeA : autoBr && i === autoBr ? badgeB : '';
       return `<button class="${i == n.branch ? 'on' : ''}" onclick="dvBr(${i})" style="position:relative;padding:8px 12px;overflow:visible">${badge}${esc(brs()[i])}${dot}</button>`;
     }).join('')}</div>
     ${nearest !== null ? `<small style="display:block;margin:4px 0 8px;opacity:.75">Más cercana: <b>${esc(brs()[nearest])}</b>${items.length && !items.every(([k, v]) => left(nearest, +k.slice(1)) >= v) ? ' <span style="color:var(--bad)">(sin disponibilidad completa, elige otra)</span>' : ''}</small>` : ''}
     ${ranked.length ? ranked.filter(r => items.every(([k, v]) => left(r.i, +k.slice(1)) >= v)).map((r, idx) => `<div class="row"><b>${idx + 1}. ${esc(brs()[r.i])}</b> · ${r.d.toFixed(1)} km</div>`).join('') : ''}
     ${nav(2, 4, 'Siguiente: Datos →')}
    `;
  } else {
    body = `
     <div class="form"><input id="dvc" placeholder="Cliente" value="${esc(n.client)}" oninput="dvn().client=this.value" style="flex:1"><input placeholder="Teléfono" inputmode="tel" value="${esc(n.phone)}" oninput="dvn().phone=this.value" style="flex:1"></div>
     <div class="form"><input id="dva" placeholder="Dirección" value="${esc(n.addr)}" oninput="dvn().addr=this.value" style="flex:1 1 100%"></div>
     <div class="form"><button class="alt" style="flex:1" onclick="dvGeocode()" id="dvgeo">🔍 Buscar ubicación de la dirección</button></div>
     ${n.lat && n.lng ? `<small style="display:block;opacity:.7;margin:4px 0">Ubicación: ${(+n.lat).toFixed(5)}, ${(+n.lng).toFixed(5)} (${esc(n.addr || '')})</small><iframe src="https://www.google.com/maps?q=${encodeURIComponent(mq)}&z=16&output=embed" width="100%" height="140" style="border:0;border-radius:8px;margin:4px 0" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>` : ''}
     <details style="margin:4px 0"><summary style="cursor:pointer;opacity:.7;font-size:12px">Ingresar coordenadas manualmente</summary><div class="form"><input type="number" step="0.0001" placeholder="Latitud" aria-label="Latitud del pedido" value="${esc(n.lat ?? '')}" oninput="dvn().lat=this.value" style="flex:1"><input type="number" step="0.0001" placeholder="Longitud" aria-label="Longitud del pedido" value="${esc(n.lng ?? '')}" oninput="dvn().lng=this.value" style="flex:1"></div></details>
     <div class="form"><input type="number" min="0" inputmode="decimal" placeholder="Envío $" aria-label="Costo de envío" value="${esc(n.fee)}" oninput="dvn().fee=this.value" style="flex:1"></div>
     <div class="form"><input placeholder="Nota" value="${esc(n.note)}" oninput="dvn().note=this.value" style="flex:1"></div>
     <small style="display:block;margin:8px 0;opacity:.7">Productos: <b>${money(tot)}</b>${pcs ? ' · ' + pcs + (pcs == 1 ? ' tamal' : ' tamales') : ''}${n.fee ? ' · Envío ' + money(+n.fee || 0) : ''}</small>
     <div class="form"><button class="go" style="flex:1" onclick="saveDv()">Guardar reparto</button></div>
     ${nav(3, false, '')}
    `;
  }
  return head + body + '</div>';
}

function dvStep(s) {
  const n = dvn();
  if (s === 4 && n.step === 3) {
    const items = Object.entries(n.items || {}).filter(([_, v]) => +v > 0);
    if (items.length) {
      const b = n.branch;
      const ok = items.every(([k, v]) => left(b, +k.slice(1)) >= +v);
      if (!ok) {
        let cand = BI().filter(i => items.every(([k, v]) => left(i, +k.slice(1)) >= +v));
        if (!cand.length) {
          toast('Ninguna sucursal tiene suficiente stock para este reparto');
          return;
        }
        const lat = +n.lat,
          lng = +n.lng;
        if (lat && lng) {
          const ranked = cand
            .map(i => {
              const l = (S.cfg.branchLocs || [])[i];
              const d = l ? distKm({ lat, lng }, l) : null;
              return { i, d };
            })
            .filter(x => x.d != null)
            .sort((a, b) => a.d - b.d);
          if (ranked.length) cand = [ranked[0].i];
        }
        const nb = cand[0];
        if (nb !== b) {
          n.branch = nb;
          toast('La sucursal seleccionada no tiene suficiente. Se cambió a ' + brs()[nb]);
        }
      }
    }
  }
  n.step = Math.min(4, Math.max(1, +s || 1));
  renderNow(true);
  requestAnimationFrame(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
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
      time: (n.time || '').trim(),
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
    renderNow(true);
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

async function dvTake(id) {
  try {
    await db.takeDelivery(id, S.me.user, S.me.name);
    toast('Reparto tomado');
  } catch (e) {
    if (e && e.code == 'taken') toast('Ese reparto ya lo tomó otro repartidor');
    else err(e);
  }
}

const dvRelease = id =>
  ask('¿Soltar este reparto? Vuelve a quedar disponible para otro repartidor.', () =>
    dvSet(id, { status: 'pendiente', drv: null, drvName: null }, 'Reparto liberado')
  );

const dvCancel = id =>
  ask('¿Cancelar y eliminar este reparto?', async () => {
    try {
      const d = (S.dv || []).find(x => x._id == id);
      /* S.pre solo trae apartados pendientes. Si el apartado ya se rechazó o canceló,
         las reglas no dejan tocarlo: se borra solo el reparto. */
      const preOpen = !!(d && d.large && d.preId && (S.pre || []).some(x => x._id == d.preId));
      if (preOpen) {
        const bt = db.batch();
        bt.delete('deliveries/' + id);
        bt.update('pre/' + d.preId, { status: 'cancelado', doneAt: Date.now(), doneBy: S.me.user, dvId: null });
        await bt.commit();
      } else {
        await db.doc('deliveries/' + id).delete();
      }
      toast('Reparto eliminado');
    } catch (e) {
      err(e);
    }
  });

async function dvAddFromPre(preId) {
  const p = (S.pre || []).find(x => x._id == preId);
  if (!p || !p.large || !(p.addr || '').trim()) return toast('Este apartado no tiene entrega a domicilio');
  if (p.dvId && (S.dv || []).some(x => x._id == p.dvId)) return toast('Ya tiene reparto');
  try {
    const dvId = 'dv' + Date.now();
    const items = p.items || {};
    const tamQty = Object.entries(items).filter(([k]) => +k.slice(1) < 100).reduce((a, [, v]) => a + (+v || 0), 0);
    const chQty = Object.entries(items).filter(([k]) => +k.slice(1) >= 100).reduce((a, [, v]) => a + (+v || 0), 0);
    const desc = (tamQty * (+(p.descTamal) || 0)) + (chQty * (+(p.descChamp) || 0));
    const totalList = Object.entries(items).reduce((a, [k, v]) => a + (+v || 0) * price(+k.slice(1)), 0);
    await db.doc('deliveries/' + dvId).set({
      day: p.date,
      branch: p.branch,
      client: p.client,
      phone: p.phone || '',
      addr: p.addr,
      note: p.note || '',
      time: p.time || '',
      fee: +(p.fee || 0) || 0,
      items,
      total: Math.max(0, totalList - desc),
      descTamal: +(p.descTamal || 0) || 0,
      descChamp: +(p.descChamp || 0) || 0,
      descuento: desc,
      status: 'pendiente',
      by: p.by,
      byName: p.byName,
      ts: Date.now(),
      large: true,
      preId: preId,
    });
    await db.doc('pre/' + preId).update({ dvId: dvId });
    toast('Reparto agregado');
  } catch (e) {
    err(e);
  }
}

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
  $('#mk').onclick = async () => {
    const v = $('#dvp').value,
      p = v === '' ? due : +v;
    if (p < due) return toast('El pago no alcanza');
    m.style.display = 'none';
    const ts = Date.now();
    const it = Object.entries(d.items || {}).filter(([_, v]) => v > 0);
    if (!lock('dv' + id)) return;
    try {
      const bt = db.batch();
      bt.update('deliveries/' + id, { status: 'entregado', cobrado: due, tsDone: ts });
      if (d.large && d.preId) bt.update('pre/' + d.preId, { status: 'entregado', doneAt: ts });
      it.forEach(([k, v], i) => {
        const f = +k.slice(1);
        const disc = f >= 100 ? (+(d.descChamp) || 0) : (+(d.descTamal) || 0);
        bt.set('sales/dv' + id + '_' + i, {
          day: D,
          branch: d.branch,
          f: f,
          qty: v,
          type: 'vendido',
          price: Math.max(0, price(f) - disc),
          descuento: disc * v,
          dv: id,
          ...(d.preId ? { pre: d.preId } : {}),
          client: d.client,
          by: S.me.user,
          ts: ts + i,
        });
      });
      await bt.commit();
      try {
        navigator.vibrate && navigator.vibrate(40);
      } catch (_) {}
      toast('Entregado' + (p > due ? ' · cambio ' + money(p - due) : ''));
    } catch (e) {
      delete lock.s['dv' + id];
      err(e);
    }
  };
}

function dvFail(id) {
  const d = (S.dv || []).find(x => x._id == id);
  if (!d) return;
  const m = $('#modal');
  m.innerHTML = `<div class="card"><h3>No se pudo entregar</h3><small>${esc(d.client)} · ${esc(d.addr)}</small><div class="form"><select id="dvr" aria-label="Motivo"><option>Cliente no contestó</option><option>Cliente no estaba</option><option>Dirección incorrecta</option><option>Cliente canceló</option><option>Otro</option></select></div><div class="form"><button id="mk">Confirmar</button><button class="alt" id="mn">Volver</button></div></div>`;
  m.style.display = 'flex';
  $('#mn').onclick = () => (m.style.display = 'none');
  $('#mk').onclick = async () => {
    const r = $('#dvr').value;
    m.style.display = 'none';
    const d0 = (S.dv || []).find(x => x._id == id);
    if (d0 && d0.large && d0.preId) {
      try {
        const bt = db.batch();
        bt.update('deliveries/' + id, { status: 'fallido', reason: r, tsDone: Date.now() });
        bt.update('pre/' + d0.preId, { status: 'fallido', reason: r, doneAt: Date.now() });
        await bt.commit();
        toast('Marcado como no entregado');
      } catch (e) { err(e); }
    } else {
      dvSet(id, { status: 'fallido', reason: r, tsDone: Date.now() }, 'Marcado como no entregado');
    }
  };
}

function dvCard(d, rep) {
  const t = DV[d.status] || ['', ''],
    me = S.me,
    ph = (d.phone || '').trim(),
    q = (d.addr || '').trim() || (d.lat != null && d.lng != null ? d.lat + ',' + d.lng : ''),
    mapUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q),
    A = me.role == 'admin',
    rt = rep && d.status == 'en_ruta' && d.drv == me.user;
  let bt = '';
  if (rep) {
    if (d.status == 'pendiente') bt = `<button class="go p" onclick="dvTake('${d._id}')">Tomar reparto</button>`;
    else if (d.status == 'en_ruta' && d.drv == me.user)
      bt = `<button class="go p" onclick="dvDone('${d._id}')">Entregar y cobrar ${money(dvDue(d))}</button><button class="alt" onclick="dvFail('${d._id}')">No se pudo</button><button class="gh" onclick="dvRelease('${d._id}')">Soltar</button>`;
  } else if ((A || me.role == 'enc' || me.role == 'sup') && d.status == 'pendiente')
    bt = `<button class="gh" style="color:var(--bad)" onclick="dvCancel('${d._id}')">Cancelar</button>`;
  return `<div class="card apc${d.status == 'entregado' ? ' ok' : d.status == 'fallido' ? ' fail' : ''}"><div class="aph"><div><b class="n">${esc(d.client)}</b>${d.large ? ' <span class="chip ok">📦 Grande</span>' : ''}<div class="apm">${d.large ? '📦 Pedido grande' : esc(brs()[d.branch] || '')} · ${d.time ? '🕒 ' + ftime(d.time) + ' · ' : ''}${hm(d.ts)} · lo capturó ${esc(d.byName || d.by)}${d.drvName ? ' · 🛵 ' + esc(d.drvName) : ''}</div></div><div style="text-align:right;flex:none"><b>${money(dvDue(d))}</b><br><span class="chip ${t[1]}">${t[0]}</span></div></div>
 <div class="apt">${esc(dvTxt(d))}${d.fee ? '<br><small>Envío ' + money(d.fee) + '</small>' : ''}</div>
 <div>📍 <a href="${mapUrl}" target="_blank" rel="noopener" style="color:var(--ac);font-weight:700;text-decoration:none">${esc(d.addr)}</a></div>${q ? `<div style="margin:4px 0"><iframe src="https://www.google.com/maps?q=${encodeURIComponent(q)}&z=16&output=embed" width="100%" height="180" style="border:0;border-radius:8px" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe><div style="margin-top:4px"><a href="https://www.google.com/maps?q=${encodeURIComponent(q)}" target="_blank" rel="noopener" style="display:inline-block;padding:4px 8px;border:1px solid var(--ac);border-radius:6px;color:var(--ac);font-size:12px;text-decoration:none">🗺️ Abrir en Google Maps</a></div></div>` : ''}${(() => {
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
 ${ph ? `<div><a href="tel:${esc(ph.replace(/[^0-9+]/g, ''))}" style="color:var(--ac);font-weight:800;text-decoration:none">📞 ${esc(ph)}</a></div>` : ''}${d.note ? `<small>📝 ${esc(d.note)}</small>` : ''}${d.status == 'fallido' ? `<small class="bad" style="display:block">${esc(d.reason || '')}</small>` : ''}${d.out ? `<small class="ok" style="display:block">✅ Salida confirmada${d.outAt ? ' · ' + hm(d.outAt) : ''}${d.outName ? ' por ' + esc(d.outName) : ''}</small>` : ''}${rt ? (S.dvRoute == d._id ? dvRouteMap(d) : `<div class="form" style="margin-top:8px"><button class="dvnav" style="flex:1" onclick="dvRoute('${d._id}')">🧭 Ver recorrido</button></div>`) : ''}${bt ? `<div class="apa"${rt ? ' style="margin-top:20px"' : ''}>${bt}</div>` : ''}</div>`;
}

/* Ubicación actual del repartidor (GPS del celular) */
function dvWhere() {
  return new Promise((ok, bad) => {
    if (!navigator.geolocation) return bad(new Error('Este dispositivo no permite usar la ubicación'));
    navigator.geolocation.getCurrentPosition(
      p => ok({ lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6) }),
      () => bad(new Error('Activa el GPS y permite la ubicación para ver el recorrido')),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  });
}

/* Recorrido: ubicación del repartidor → sucursal → domicilio del pedido */
async function dvRoute(id) {
  const d = (S.dv || []).find(x => x._id == id);
  if (!d) return;
  toast('Buscando tu ubicación…');
  try {
    S.dvLoc = await dvWhere();
    S.dvRoute = id;
    renderNow(true);
  } catch (e) {
    toast((e && e.message) || 'No se pudo obtener tu ubicación');
  }
}

function dvRouteMap(d) {
  if (!S.dvLoc || S.dvRoute != d._id) return '';
  const dest = (d.addr || '').trim() || (d.lat != null && d.lng != null ? d.lat + ',' + d.lng : '');
  if (!dest) return '<div class="card"><small>Este reparto no tiene dirección para trazar el recorrido.</small></div>';
  const b = (S.cfg.branchLocs || [])[d.branch],
    bq = b && b.lat != null && b.lng != null ? b.lat + ',' + b.lng : '',
    origin = S.dvLoc.lat + ',' + S.dvLoc.lng,
    bn = brs()[d.branch] || 'sucursal',
    leg = (a, z, label) =>
      `<small style="display:block;margin-top:6px"><b>${label}</b></small><iframe src="https://www.google.com/maps?saddr=${encodeURIComponent(a)}&daddr=${encodeURIComponent(z)}&output=embed" width="100%" height="190" style="border:0;border-radius:8px" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`,
    dir =
      'https://www.google.com/maps/dir/?api=1&origin=' +
      encodeURIComponent(origin) +
      '&destination=' +
      encodeURIComponent(dest) +
      (bq ? '&waypoints=' + encodeURIComponent(bq) : '') +
      '&travelmode=driving';
  return `<div class="dvroute">${bq ? leg(origin, bq, '1. Tu ubicación → ' + esc(bn)) : ''}${leg(bq || origin, dest, (bq ? '2. ' + esc(bn) + ' → ' : 'Tu ubicación → ') + 'domicilio')}<div class="dvacts"><button class="dvnav" onclick="dvRoute('${d._id}')">🔄 Actualizar</button><a class="dvnav" href="${dir}" target="_blank" rel="noopener">🧭 Navegar</a></div></div>`;
}


/* Administrador y Pedidos */
function dvPanel() {
  const L = (S.dv || []).slice().sort((a, b) => b.ts - a.ts),
    old = (S.dvOld || []).slice().sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : a.ts - b.ts)),
    n = s => L.filter(d => d.status == s).length,
    cash = L.filter(d => d.status == 'entregado').reduce((a, d) => a + nz(d.cobrado), 0);
  return `<div class="kp" style="margin-bottom:8px"><div><small>Por tomar</small><b>${n('pendiente')}</b></div><div><small>En camino</small><b>${n('en_ruta')}</b></div><div><small>Entregados</small><b>${n('entregado')}</b></div></div>
 ${S.me.role == 'admin' ? `<div class="card"><div class="row" style="border:0;padding:0"><div>Efectivo cobrado por repartidores<br><small>Lo que deben entregar hoy</small></div><b>${money(cash)}</b></div></div>` : ''}
 ${S.me.role == 'admin' && n('fallido') ? `<div class="card" style="border:2px solid var(--bad)"><div class="row" style="border:0;padding:0"><div>⚠️ Merma (no entregados)<br><small>Repartos fallidos de hoy</small></div><b>${n('fallido')}</b></div></div>` : ''}
  ${old.length ? (S.dvOldHide ? `<div class="card alb" style="border:2px solid var(--bad)"><span>⚠️ ${old.length} reparto${old.length > 1 ? 's' : ''} de ayer sin cumplir</span><button class="gh" onclick="S.dvOldHide=false;render(true)">Mostrar</button></div>` : `<div class="card" style="border:2px solid var(--bad);margin-bottom:10px"><div class="alr"><h3 style="margin:0">⚠️ Repartos de ayer sin cumplir</h3><button class="gh" onclick="S.dvOldHide=true;render(true)">Ocultar</button></div><small>${old.length} reparto${old.length > 1 ? 's' : ''} que no se entregó${old.length > 1 ? 'n' : ''} ayer</small>${old.map(d => `<div class="row"><div><b>${esc(d.client || 'Pedido a domicilio')}</b><br><small>${esc(fdate(d.day))} · ${esc(d.addr || '')}${d.byName ? ' · ' + esc(d.byName) : ''}</small></div><b>${money(dvDue(d))}</b></div>`).join('')}</div>`) : ''}
 <div class="form" style="margin:0 0 10px"><button class="alt" style="flex:1" onclick="dvToggle()">${S.dvf ? '✕ Cerrar formulario' : '＋ Nuevo reparto'}</button></div>
 ${S.dvf ? dvForm() : ''}
 ${L.map(d => dvCard(d, false)).join('') || '<div class="card"><small>Todavía no hay repartos hoy.</small></div>'}`;
}

/* Tarjeta mínima para el vendedor: solo el pedido y cuánto apartar (sin dirección ni mapa) */
function dvVendCard(d) {
  const t = DV[d.status] || ['', ''],
    items = Object.entries(d.items || {}).filter(([, v]) => v > 0),
    tam = items.reduce((a, [k, v]) => a + (+k.slice(1) < 100 ? v : 0), 0),
    ch = items.reduce((a, [k, v]) => a + (+k.slice(1) >= 100 ? v : 0), 0),
    list = items.map(([k, v]) => v + '× ' + esc(nm(+k.slice(1)))).join(' · ');
  return `<div class="card apc${d.status == 'entregado' ? ' ok' : d.status == 'fallido' ? ' fail' : ''}"><div class="aph"><div><b class="n">${esc(d.client || 'Pedido a domicilio')}</b><div class="apm">${hm(d.ts)} · 🛵 A domicilio</div></div><div style="text-align:right;flex:none"><span class="chip ${t[1]}">${t[0]}</span></div></div>
 <div class="apt">${list}</div>
 <div><b>Apartar: ${tam} ${tam == 1 ? 'tamal' : 'tamales'}${ch ? ' + ' + ch + ' ' + (ch == 1 ? 'champurrado' : 'champurrados') : ''}</b></div>
 <div style="display:flex;justify-content:space-between;margin-top:6px"><span><b>Total del pedido</b></span><b>${money(dvDue(d))}</b></div>${d.fee ? `<small style="display:block;opacity:.7">Incluye envío ${money(d.fee)}</small>` : ''}
 ${d.out ? `<div class="ok" style="margin-top:6px"><b>✅ Salida confirmada${d.outAt ? ' · ' + hm(d.outAt) : ''}</b></div>` : d.status == 'pendiente' || d.status == 'en_ruta' ? `<div class="form" style="margin-top:6px"><button class="alt" style="flex:1" onclick="dvOut('${d._id}')">✅ Marcar salida</button></div>` : ''}</div>`;
}

/* El vendedor confirma que el pedido salió de la sucursal */
async function dvOut(id) {
  try {
    await db.doc('deliveries/' + id).update({
      out: true,
      outBy: S.me.user,
      outName: S.me.name,
      outAt: Date.now(),
    });
    toast('Salida confirmada');
  } catch (e) {
    err(e);
  }
}

const seenDv = new Set();
try {
  JSON.parse(localStorage.getItem('tm_seen_dv') || '[]').forEach(x => seenDv.add(x));
} catch (_) {}

function enableNotif() {
  if (!('Notification' in window)) return toast('Este navegador no soporta notificaciones');
  Notification.requestPermission().then(p => {
    if (p == 'granted') toast('Notificaciones activadas');
    else toast('No se activaron las notificaciones');
    renderNow(true);
  });
}

function notifyNewDv() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const nw = (S.dv || []).filter(d => d.status == 'pendiente' && !seenDv.has(d._id));
  if (!nw.length) return;
  nw.forEach(d => {
    seenDv.add(d._id);
    try {
      new Notification(d.large ? 'Nuevo pedido grande' : 'Nuevo reparto', {
        body: (d.client || 'Cliente') + (d.addr ? ' · ' + d.addr : '') + ' · ' + money(dvDue(d)),
        tag: d._id,
      });
    } catch (_) {}
    try {
      toast('Nuevo reparto: ' + (d.client || 'Cliente'));
    } catch (_) {}
  });
  try {
    localStorage.setItem('tm_seen_dv', JSON.stringify([...seenDv]));
  } catch (_) {}
}
  (S.dv || []).filter(d => d.status == 'pendiente' || d.status == 'en_ruta').length;

/* Repartos de hoy dentro de Apartados (vendedor, solo consulta) */
function dvToday() {
  const L = (S.dv || []).slice().sort((a, b) => a.ts - b.ts);
  return (
    '<h3 style="margin:16px 4px 6px">🛵 Repartos a domicilio de hoy</h3>' +
    (L.length
      ? L.map(d => dvVendCard(d)).join('')
      : '<div class="card"><small>No hay repartos a domicilio hoy.</small></div>')
  );
}

/* Repartidor */
function repView() {
  const me = S.me.user,
    t = ['e', 'c', 't'].includes(S.rt) ? S.rt : 'e',
    L = (S.dv || []).slice().sort((a, b) => a.ts - b.ts),
    free = L.filter(d => d.status == 'pendiente'),
    mine = L.filter(d => d.drv == me && d.status == 'en_ruta'),
    ok = L.filter(d => d.drv == me && d.status == 'entregado'),
    bad = L.filter(d => d.drv == me && d.status == 'fallido'),
    done = [...ok, ...bad].sort((a, b) => (b.tsDone || b.ts) - (a.tsDone || a.ts)),
    cash = ok.reduce((a, d) => a + nz(d.cobrado), 0),
    due = mine.reduce((a, d) => a + dvDue(d), 0);
  const kp =
    t == 't'
      ? `<div class="kp kv"><div><small>Entregados</small><b>${ok.length}</b></div><div><small>No entregados</small><b>${bad.length}</b></div><div><small>Efectivo cobrado</small><b>${money(cash)}</b></div></div>`
      : t == 'c'
        ? `<div class="kp kv"><div><small>En camino</small><b>${mine.length}</b></div><div><small>Por cobrar</small><b>${money(due)}</b></div><div><small>Efectivo a rendir</small><b>${money(cash)}</b></div></div>`
        : `<div class="kp kv"><div><small>Disponibles</small><b>${free.length}</b></div><div><small>En camino</small><b>${mine.length}</b></div><div><small>Entregados</small><b>${ok.length}</b></div></div>`;
  const body =
    t == 't'
      ? '<h3 style="margin:12px 4px 6px">Terminados hoy</h3>' +
        (done.length
          ? done.map(d => dvCard(d, true)).join('')
          : '<div class="card"><small>No hay repartos terminados hoy.</small></div>')
      : t == 'c'
        ? '<h3 style="margin:12px 4px 6px">Mis repartos en camino</h3>' +
          (mine.length
            ? mine.map(d => dvCard(d, true)).join('')
            : '<div class="card"><small>No tienes repartos en camino.</small></div>')
        : '<h3 style="margin:12px 4px 6px">Disponibles para tomar</h3>' +
          (free.map(d => dvCard(d, true)).join('') ||
            '<div class="card"><small>No hay repartos por tomar. Se actualiza solo.</small></div>');
  return (
    head() +
    alertSpace() +
    (typeof Notification !== 'undefined' && Notification.permission !== 'granted'
      ? `<div class="card"><button class="go" style="width:100%" onclick="enableNotif()">🔔 Activar notificaciones</button><small>Para recibir pedidos grandes aunque la app esté en segundo plano.</small></div>`
      : '') +
    kp +
    body +
    nav(
      [
        ['e', '🛵', 'Repartos', free.length || ''],
        ['c', '🚚', 'En camino', mine.length || ''],
        ['t', '✅', 'Terminados'],
        ['more', '⋯', 'Más'],
      ],
      t,
      'repNav'
    )
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


async function initFcm() {
  if (!('Notification' in window) || !window.FB || !FB.messaging) return;
  if (Notification.permission !== 'granted') return;
  if (!window.VAPID_PUBLIC_KEY) return;
  try {
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const token = await FB.getToken(reg);
    if (token && S.me && S.me.id) {
      await db.doc('users/' + S.me.id).update({ fcmToken: token });
    }
    FB.onMessage((payload) => {
      const title = (payload.notification && payload.notification.title) || 'Nuevo reparto';
      const body = (payload.notification && payload.notification.body) || '';
      try {
        new Notification(title, { body });
      } catch (_) {}
      try {
        toast(title + (body ? ' · ' + body : ''));
      } catch (_) {}
    });
  } catch (e) {
    console.warn('FCM init', e);
  }
}
const dvOpenN = () => (S.dv || []).filter(d => d.status == 'pendiente' || d.status == 'en_ruta').length;


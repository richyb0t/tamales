/* Repartos a domicilio: alta (administrador y pedidos) y entrega (repartidor). */

/* Cada inicio o limpieza de push invalida las operaciones anteriores: así un inicio de
   sesión de repartidor no compite con la limpieza que dejó la pantalla de entrada. */
let pushSeq = 0;

/* App ID público de OneSignal. Se usa como respaldo para poder apagar el push desde la
   pantalla de entrada, donde la configuración de Firestore todavía no está cargada. */
const OS_APP_ID = '48fb9d48-43ac-485c-b399-a08b9557a0f7';
const OS_SAFARI_ID = 'web.onesignal.auto.52db6e33-5c43-4c7e-8893-c04dfe7146e4';

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

const dvStopTxt = s =>
  Object.entries(s.items || {})
    .filter(([, v]) => +v > 0)
    .map(([k, v]) => v + '× ' + nm(+k.slice(1)))
    .join(', ');

const dvDue = d => nz(d.total) + nz(d.fee);

const dvSum = n => Object.entries(n.items).reduce((a, [f, v]) => a + v * price(+f), 0);

function dvn() {
  if (!S.dvn)
    S.dvn = { branch: null, autoBr: null, items: {}, client: '', phone: '', addr: '', time: '', note: '', fee: '', lat: '', lng: '', step: 1, geoAddr: '', geoBusy: false };
  if (S.dvn.branch != null && !BI().includes(S.dvn.branch)) S.dvn.branch = null;
  return S.dvn;
}

function dvBr(i) {
  const n = dvn();
  n.branch = i;
  n.autoBr = null;
  renderNow(true);
}

async function dvGeocode(silent) {
  const n = dvn();
  const q = (n.addr || '').trim();
  if (!q) {
    if (!silent) toast('Escribe la dirección primero');
    return;
  }
  if (n.geoBusy) return;
  n.geoBusy = true;
  n.geoAddr = q;
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
      if (!silent) toast('No se encontró la dirección. Pega las coordenadas manualmente o usa GPS.');
      return;
    }
    n.lat = lat;
    n.lng = lng;
    n.geoAddr = q;
    if (!silent) toast('Ubicación encontrada: ' + (label || '').slice(0, 60));
    renderNow(true);
  } catch (e) {
    if (!silent) toast('Error al buscar. Pega las coordenadas manualmente.');
  } finally {
    n.geoBusy = false;
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

/* Reparte los productos entre sucursales: primero la elegida y luego las más cercanas.
   Las paradas se ordenan de la más lejana a la más cercana al domicilio, para que el
   repartidor termine en la sucursal más próxima al cliente antes de entregar. */
function dvPlan(n) {
  const items = Object.entries(n.items || {}).filter(([, v]) => +v > 0);
  if (!items.length) return { stops: [], missing: [], branches: [], primary: null };
  const need = {};
  items.forEach(([f, v]) => (need[+f] = (need[+f] || 0) + (+v || 0)));
  const lat = +n.lat,
    lng = +n.lng;
  const dist = i => {
    const l = (S.cfg.branchLocs || [])[i];
    return lat && lng && l ? distKm({ lat, lng }, l) : null;
  };
  const base = n.branch != null && BI().includes(n.branch) ? n.branch : null;
  const rest = BI()
    .filter(i => i != base)
    .sort((a, b) => {
      const da = dist(a),
        db = dist(b);
      if (da == null && db == null) return a - b;
      if (da == null) return 1;
      if (db == null) return -1;
      return da - db;
    });
  const order = base == null ? rest : [base, ...rest];
  const stops = [];
  for (const b of order) {
    const s = { branch: b, items: {} };
    for (const f of Object.keys(need)) {
      const q = need[f];
      if (q <= 0) continue;
      const avail = Math.max(0, left(b, +f));
      const take = Math.min(q, Math.floor(avail));
      if (take > 0) {
        s.items['f' + f] = take;
        need[f] -= take;
      }
    }
    if (Object.keys(s.items).length) stops.push(s);
  }
  const missing = Object.entries(need)
    .filter(([, v]) => v > 0)
    .map(([f, v]) => ({ f: +f, qty: v }));
  /* La sucursal principal (la que arma el pedido) es la primera de la asignación,
     no la primera de la ruta. La ruta va de la más lejana a la más cercana. */
  const primary = stops.length ? stops[0].branch : null;
  const route = stops.slice().sort((a, b) => {
    const da = dist(a.branch),
      db = dist(b.branch);
    if (da == null && db == null) return 0;
    if (da == null) return 1;
    if (db == null) return -1;
    return db - da;
  });
  return { stops: route, missing, branches: route.map(s => s.branch), primary };
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
    const items = Object.entries(sel).filter(([k, v]) => +v > 0);
    const lat = +n.lat, lng = +n.lng;
    const addr = (n.addr || '').trim();
    /* Si no se tocó "Buscar ubicación", se geocodifica sola al entrar al paso. */
    if ((!lat || !lng) && addr && n.geoAddr !== addr && !n.geoBusy) {
      n.geoAddr = addr;
      setTimeout(() => {
        if (S.dvn === n && n.step === 3) dvGeocode(true);
      }, 0);
    }
    let ranked = [];
    let nearest = null;
    if (lat && lng) {
      ranked = BI().map(i => {
        const l = (S.cfg.branchLocs || [])[i];
        const d = l ? distKm({ lat, lng }, l) : null;
        return { i, d };
      }).filter(x => x.d != null).sort((a, b) => a.d - b.d);
      if (ranked.length) nearest = ranked[0].i;
    }
    /* Cobertura de cada sucursal: completa, parcial o nula. */
    const cov = i => {
      const out = { full: items.length > 0, any: false };
      items.forEach(([k, v]) => {
        const f = +k.slice(1);
        const have = Math.max(0, left(i, f));
        const take = Math.min(+v, Math.floor(have));
        if (take > 0) out.any = true;
        if (take < +v) out.full = false;
      });
      return out;
    };
    /* Todas las sucursales abiertas: primero las geolocalizadas por cercanía,
       después las que no tienen coordenadas configuradas. */
    const seen = new Set(ranked.map(r => r.i));
    const list = [
      ...ranked.map(r => ({ i: r.i, d: r.d })),
      ...BI().filter(i => !seen.has(i)).map(i => ({ i, d: null })),
    ];
    /* Al entrar se preselecciona la más cercana que tenga todo; si ninguna lo tiene,
       la más cercana con algo. El resto se completa con las siguientes. */
    if (n.branch == null || !BI().includes(n.branch)) {
      let auto = null;
      if (items.length) {
        const full = list.map(x => x.i).filter(i => cov(i).full);
        const some = list.map(x => x.i).filter(i => cov(i).any);
        auto = full.length ? full[0] : some.length ? some[0] : null;
      } else auto = nearest != null ? nearest : list.length ? list[0].i : null;
      n.branch = auto;
      n.autoBr = auto;
    }
    const autoBr = n.autoBr;
    const plan = dvPlan(n);
    const multi = plan.stops.length > 1;
    const kmOf = i => {
      const r = list.find(x => x.i == i);
      return r && r.d != null ? ' · ' + r.d.toFixed(1) + ' km' : '';
    };
    body = `
     <small style="display:block;margin-bottom:6px">¿De qué sucursal sale?</small>
     <div class="seg" style="flex-wrap:wrap;overflow:visible;padding-top:8px">${BI().map(i => {
       const c = cov(i);
       const ok = items.length ? c.full : null;
       const color = ok === null ? '' : ok ? '#22c55e' : c.any ? '#f59e0b' : '#ef4444';
       const isNear = i === nearest;
       const dot = ok === null ? '' : `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};box-shadow:0 0 6px ${ok ? 'rgba(34,197,94,.6)' : c.any ? 'rgba(245,158,11,.6)' : 'rgba(239,68,68,.6)'};margin-left:6px;vertical-align:middle"></span>`;
       const badgeA = `<span style="position:absolute;top:-8px;right:-4px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;font-size:9px;font-weight:700;padding:2px 7px;border-radius:999px;box-shadow:0 2px 6px rgba(0,0,0,.3);letter-spacing:.3px;white-space:nowrap;z-index:2">MÁS CERCANA</span>`;
       const badgeB = `<span style="position:absolute;top:-8px;right:-4px;background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;font-size:9px;font-weight:700;padding:2px 7px;border-radius:999px;box-shadow:0 2px 6px rgba(0,0,0,.3);letter-spacing:.3px;white-space:nowrap;z-index:2">INDICADA</span>`;
       const badge = isNear ? badgeA : autoBr != null && i === autoBr ? badgeB : '';
       return `<button class="${i == n.branch ? 'on' : ''}" onclick="dvBr(${i})" style="position:relative;padding:8px 12px;overflow:visible">${badge}${esc(brs()[i])}${dot}</button>`;
     }).join('')}</div>
     ${items.length && !plan.stops.length ? '<small style="display:block;margin:4px 0 8px;color:var(--bad)">Ninguna sucursal tiene existencia. Ajusta cantidades o carga inventario.</small>' : ''}
     ${plan.stops.length ? `<div style="border:1px solid var(--bd);border-radius:10px;padding:8px 10px;margin:8px 0">
       <small style="display:block;margin-bottom:2px"><b>${multi ? 'Se recoge en ' + plan.stops.length + ' sucursales' : 'Sale de ' + esc(brs()[plan.stops[0].branch])}</b></small>
       ${plan.stops.map((s, idx) => `<div class="row" style="border:0;padding:3px 0"><div><b>${idx + 1}. ${esc(brs()[s.branch])}</b>${kmOf(s.branch)}<br><small>${esc(dvStopTxt(s))}</small></div></div>`).join('')}
       ${multi ? '<small style="display:block;margin-top:4px;opacity:.75">Ruta: primero la sucursal más lejana y al final la más cercana al domicilio.</small>' : ''}
       ${plan.missing.length ? `<small class="bad" style="display:block;margin-top:4px">Falta en todas: ${plan.missing.map(x => x.qty + '× ' + esc(nm(x.f))).join(', ')}</small>` : ''}
     </div>` : ''}
     ${nearest !== null ? `<small style="display:block;margin:4px 0 8px;opacity:.75">Más cercana: <b>${esc(brs()[nearest])}</b>${items.length && !cov(nearest).full ? ' <span style="color:var(--bad)">(no tiene todo; se completa con otra sucursal)</span>' : ''}</small>` : ''}
     ${!ranked.length ? `<small style="display:block;margin:4px 0 8px;opacity:.7">${n.geoBusy ? 'Calculando distancias…' : lat && lng ? 'Las sucursales no tienen ubicación configurada. Revísalas en Ajustes.' : addr ? 'No se pudo ubicar la dirección. Revísala o usa GPS.' : 'Escribe la dirección para calcular los km.'}</small>` : ''}
     ${list.length ? list.map((r, idx) => {
       const c = cov(r.i);
       const est = !items.length ? '' : c.full ? ' · <span style="color:#22c55e">tiene todo</span>' : c.any ? ' · <span style="color:#f59e0b">tiene parte</span>' : ' · <span style="color:var(--bad)">sin existencia</span>';
       return `<div class="row"><b>${idx + 1}. ${esc(brs()[r.i])}</b>${r.d != null ? ' · ' + r.d.toFixed(1) + ' km' : ' · sin ubicación'}${est}</div>`;
     }).join('') : '<small style="display:block;margin:4px 0 8px;opacity:.7">No hay sucursales abiertas.</small>'}
     ${nav(2, 4, 'Siguiente: Datos →')}
    `;
  } else {
    const plan = dvPlan(n);
    body = `
     <div class="form"><input id="dvc" placeholder="Cliente" value="${esc(n.client)}" oninput="dvn().client=this.value" style="flex:1"><input placeholder="Teléfono" inputmode="tel" value="${esc(n.phone)}" oninput="dvn().phone=this.value" style="flex:1"></div>
     <div class="form"><input id="dva" placeholder="Dirección" value="${esc(n.addr)}" oninput="dvn().addr=this.value" style="flex:1 1 100%"></div>
     <div class="form"><button class="alt" style="flex:1" onclick="dvGeocode()" id="dvgeo">🔍 Buscar ubicación de la dirección</button></div>
     ${n.lat && n.lng ? `<small style="display:block;opacity:.7;margin:4px 0">Ubicación: ${(+n.lat).toFixed(5)}, ${(+n.lng).toFixed(5)} (${esc(n.addr || '')})</small><iframe src="https://www.google.com/maps?q=${encodeURIComponent(mq)}&z=16&output=embed" width="100%" height="140" style="border:0;border-radius:8px;margin:4px 0" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>` : ''}
     <details style="margin:4px 0"><summary style="cursor:pointer;opacity:.7;font-size:12px">Ingresar coordenadas manualmente</summary><div class="form"><input type="number" step="0.0001" placeholder="Latitud" aria-label="Latitud del pedido" value="${esc(n.lat ?? '')}" oninput="dvn().lat=this.value" style="flex:1"><input type="number" step="0.0001" placeholder="Longitud" aria-label="Longitud del pedido" value="${esc(n.lng ?? '')}" oninput="dvn().lng=this.value" style="flex:1"></div></details>
     <div class="form"><input type="number" min="0" inputmode="decimal" placeholder="Envío $" aria-label="Costo de envío" value="${esc(n.fee)}" oninput="dvn().fee=this.value" style="flex:1"></div>
     <div class="form"><input placeholder="Nota" value="${esc(n.note)}" oninput="dvn().note=this.value" style="flex:1"></div>
     ${plan.stops.length ? `<div style="border:1px solid var(--bd);border-radius:10px;padding:8px 10px;margin:4px 0 8px">
       <small style="display:block;margin-bottom:2px"><b>${plan.stops.length > 1 ? 'Recoger en ' + plan.stops.length + ' sucursales' : 'Recoger en ' + esc(brs()[plan.stops[0].branch])}</b></small>
       ${plan.stops.map((s, idx) => `<div class="row" style="border:0;padding:3px 0"><div><b>${idx + 1}. ${esc(brs()[s.branch])}</b><br><small>${esc(dvStopTxt(s))}</small></div></div>`).join('')}
       ${plan.missing.length ? `<small class="bad" style="display:block;margin-top:4px">Falta en todas: ${plan.missing.map(x => x.qty + '× ' + esc(nm(x.f))).join(', ')}</small>` : ''}
     </div>` : ''}
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
    if (!items.length) {
      toast('Elige los tamales del reparto');
      return;
    }
    if (n.branch == null) {
      toast('Elige de qué sucursal sale el reparto');
      return;
    }
    const plan = dvPlan(n);
    if (!plan.stops.length) {
      toast('Ninguna sucursal tiene existencia para este reparto');
      return;
    }
    if (plan.missing.length) {
      toast(
        'Falta en todas las sucursales: ' +
          plan.missing.map(x => x.qty + '× ' + nm(x.f)).join(', ')
      );
      return;
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
  if (b == null) return toast('Elige de qué sucursal sale el reparto');
  const plan = dvPlan(n);
  if (!plan.stops.length) return toast('Ninguna sucursal tiene existencia para este reparto');
  if (plan.missing.length)
    return toast(
      'Falta en todas las sucursales: ' +
        plan.missing.map(x => x.qty + '× ' + nm(x.f)).join(', ')
    );
  if (!lock('dv')) return;
  try {
    await db.collection('deliveries').add({
      day: D,
      branch: plan.primary,
      branches: plan.branches,
      pickups: plan.stops,
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
    if (typeof pushNotify === 'function')
      pushNotify(
        'Nuevo reparto',
        n.client.trim() +
          ' · ' +
          (plan.stops.length > 1
            ? plan.stops.length + ' sucursales'
            : brs()[plan.stops[0].branch]) +
          ' · ' +
          n.addr.trim()
      );
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
      by: S.me.user,
      byName: S.me.name,
      ts: Date.now(),
      large: true,
      preId: preId,
    });
    await db.doc('pre/' + preId).update({ dvId: dvId });
    toast('Reparto agregado');
    if (typeof pushNotify === 'function') pushNotify('Nuevo pedido grande', p.client + ' · ' + (p.addr || ''));
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
    const stops = dvPickups(d);
    const multi = stops.length > 1;
    if (!lock('dv' + id)) return;
    try {
      const bt = db.batch();
      bt.update('deliveries/' + id, { status: 'entregado', cobrado: due, tsDone: ts });
      if (d.large && d.preId) bt.update('pre/' + d.preId, { status: 'entregado', doneAt: ts });
      let n = 0;
      stops.forEach((s, si) => {
        Object.entries(s.items || {})
          .filter(([, v]) => +v > 0)
          .forEach(([k, v], i) => {
            const f = +k.slice(1);
            const disc = f >= 100 ? (+(d.descChamp) || 0) : (+(d.descTamal) || 0);
            bt.set('sales/' + (multi ? 'dv' + id + '_' + si + '_' + i : 'dv' + id + '_' + n), {
              day: D,
              branch: s.branch,
              f: f,
              qty: v,
              type: 'vendido',
              price: Math.max(0, price(f) - disc),
              descuento: disc * v,
              dv: id,
              ...(d.preId ? { pre: d.preId } : {}),
              client: d.client,
              by: S.me.user,
              ts: ts + n,
            });
            n++;
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
    picks = dvPickups(d).filter(s => Object.keys(s.items || {}).length),
    multi = picks.length > 1,
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
  return `<div class="card apc${d.status == 'entregado' ? ' ok' : d.status == 'fallido' ? ' fail' : ''}"><div class="aph"><div><b class="n">${esc(d.client)}</b>${d.large ? ' <span class="chip ok">📦 Grande</span>' : ''}<div class="apm">${d.large ? '📦 Pedido grande' : multi ? '🚏 ' + picks.length + ' sucursales' : esc(brs()[d.branch] || '')} · ${d.time ? '🕒 ' + ftime(d.time) + ' · ' : ''}${hm(d.ts)} · lo capturó ${esc(d.byName || d.by)}${d.drvName ? ' · 🛵 ' + esc(d.drvName) : ''}</div></div><div style="text-align:right;flex:none"><b>${money(dvDue(d))}</b><br><span class="chip ${t[1]}">${t[0]}</span></div></div>
 <div class="apt">${esc(dvTxt(d))}${d.fee ? '<br><small>Envío ' + money(d.fee) + '</small>' : ''}${multi ? '<br><small style="display:block;margin-top:4px"><b>Recoger en:</b></small>' + picks.map((s, i) => `<small style="display:block">${i + 1}. <b>${esc(brs()[s.branch])}</b>: ${esc(dvStopTxt(s))}</small>`).join('') : ''}</div>
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
 ${ph ? `<div><a href="tel:${esc(ph.replace(/[^0-9+]/g, ''))}" style="color:var(--ac);font-weight:800;text-decoration:none">📞 ${esc(ph)}</a></div>` : ''}${d.note ? `<small>📝 ${esc(d.note)}</small>` : ''}${d.status == 'fallido' ? `<small class="bad" style="display:block">${esc(d.reason || '')}</small>` : ''}${d.out ? `<small class="ok" style="display:block">✅ Salida confirmada (principal)${d.outAt ? ' · ' + hm(d.outAt) : ''}${d.outName ? ' por ' + esc(d.outName) : ''}</small>` : ''}
${d.outs ? Object.keys(d.outs).map(br => `<small class="ok" style="display:block">✅ Salida confirmada en ${esc(brs()[+br])}${d.outs[br].at ? ' · ' + hm(d.outs[br].at) : ''}${d.outs[br].name ? ' por ' + esc(d.outs[br].name) : ''}</small>`).join('') : ''}${rt ? (S.dvRoute == d._id ? dvRouteMap(d) : `<div class="form" style="margin-top:8px"><button class="dvnav" style="flex:1" onclick="dvRoute('${d._id}')">🧭 Ver recorrido</button></div>`) : ''}${bt ? `<div class="apa"${rt ? ' style="margin-top:20px"' : ''}>${bt}</div>` : ''}</div>`;
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
  const origin = S.dvLoc.lat + ',' + S.dvLoc.lng;
  const stops = dvPickups(d)
    .filter(s => s.branch != null)
    .map(s => {
      const l = (S.cfg.branchLocs || [])[s.branch];
      return l && l.lat != null && l.lng != null
        ? { name: brs()[s.branch] || 'sucursal', q: l.lat + ',' + l.lng }
        : null;
    })
    .filter(Boolean);
  const leg = (a, z, label) =>
    `<small style="display:block;margin-top:6px"><b>${label}</b></small><iframe src="https://www.google.com/maps?saddr=${encodeURIComponent(a)}&daddr=${encodeURIComponent(z)}&output=embed" width="100%" height="190" style="border:0;border-radius:8px" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`;
  const legs = [];
  let prev = origin,
    prevName = 'Tu ubicación';
  stops.forEach((s, i) => {
    legs.push(leg(prev, s.q, i + 1 + '. ' + esc(prevName) + ' → ' + esc(s.name)));
    prev = s.q;
    prevName = s.name;
  });
  legs.push(leg(prev, dest, stops.length + 1 + '. ' + esc(prevName) + ' → domicilio'));
  const dir =
    'https://www.google.com/maps/dir/?api=1&origin=' +
    encodeURIComponent(origin) +
    '&destination=' +
    encodeURIComponent(dest) +
    (stops.length ? '&waypoints=' + encodeURIComponent(stops.map(s => s.q).join('|')) : '') +
    '&travelmode=driving';
  return `<div class="dvroute">${legs.join('')}<div class="dvacts"><button class="dvnav" onclick="dvRoute('${d._id}')">🔄 Actualizar</button><a class="dvnav" href="${dir}" target="_blank" rel="noopener">🧭 Navegar</a></div></div>`;
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
  ${old.length ? (S.dvOldHide ? `<div class="card alb" style="border:2px solid var(--bad)"><span>⚠️ ${old.length} reparto${old.length > 1 ? 's' : ''} de ayer sin cumplir</span><button class="gh" onclick="S.dvOldHide=false;render(true)">Mostrar</button></div>` : `<div class="card" style="border:2px solid var(--bad);margin-bottom:10px"><div class="alr"><h3 style="margin:0">⚠️ Repartos de ayer sin cumplir</h3><button class="gh" onclick="S.dvOldHide=true;render(true)">Ocultar</button></div><small>${old.length} reparto${old.length > 1 ? 's' : ''} que no se entregó${old.length > 1 ? 'n' : ''} ayer</small>${old.map(d => {
  const q = (d.addr || '').trim() || (d.lat != null && d.lng != null ? d.lat + ',' + d.lng : '');
  const mapUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
  const ph = (d.phone || '').trim();
  return `<div class="row"><div><b>${esc(d.client || 'Pedido a domicilio')}</b><br><small>${esc(fdate(d.day))} · ${esc(d.addr || '')}${d.large ? ' · 📦 Grande' : ''}${d.byName ? ' · ' + esc(d.byName) : ''}${d.drvName ? ' · 🛵 ' + esc(d.drvName) : ''}</small>${esc(dvTxt(d)) ? `<br><small>${esc(dvTxt(d))}</small>` : ''}${ph ? `<br><a href="tel:${esc(ph.replace(/[^0-9+]/g, ''))}" style="color:var(--ac);font-weight:800;text-decoration:none">📞 ${esc(ph)}</a>` : ''}${q ? `<br><a href="${mapUrl}" target="_blank" rel="noopener" style="color:var(--ac);font-weight:700;text-decoration:none">🗺️ Ver en Google Maps</a>` : ''}</div><b>${money(dvDue(d))}</b></div>`;
}).join('')}</div>`) : ''}
 <div class="form" style="margin:0 0 10px"><button class="alt" style="flex:1" onclick="dvToggle()">${S.dvf ? '✕ Cerrar formulario' : '＋ Nuevo reparto'}</button></div>
 ${S.dvf ? dvForm() : ''}
 ${L.map(d => dvCard(d, false)).join('') || '<div class="card"><small>Todavía no hay repartos hoy.</small></div>'}`;
}

/* Tarjeta mínima para el vendedor: solo el pedido y cuánto apartar (sin dirección ni mapa) */
function dvVendCard(d) {
  const t = DV[d.status] || ['', ''],
    picks = dvPickups(d).filter(s => Object.keys(s.items || {}).length),
    items = Object.entries(d.items || {}).filter(([, v]) => +v > 0),
    mine = picks.find(s => s.branch == (S.me && S.me.branch)),
    myItems = mine
      ? Object.entries(mine.items || {}).filter(([, v]) => +v > 0)
      : d.large
        ? items
        : [],
    list = items.map(([k, v]) => `<li>${v} ${esc(nm(+k.slice(1)))}</li>`).join(''),
    others = mine ? picks.filter(s => s.branch != mine.branch) : [],
    primary = d.branch == (S.me && S.me.branch),
    myOut = (d.outs && d.outs[S.me && S.me.branch]) || (primary && d.out ? { by: d.outBy, name: d.outName, at: d.outAt } : null);
  return `<div class="card apc${d.status == 'entregado' ? ' ok' : d.status == 'fallido' ? ' fail' : ''}"><div class="aph"><div><b class="n">${esc(d.client || 'Pedido a domicilio')}</b><div class="apm">${hm(d.ts)} · 🛵 A domicilio${picks.length > 1 ? ' · 🚏 ' + picks.length + ' sucursales' : ''}</div></div><div style="text-align:right;flex:none"><span class="chip ${t[1]}">${t[0]}</span></div></div>
 <div class="apt"><ul style="margin:0;padding-left:18px">${list}</ul></div>
 <div><b>Apartar aquí:</b>${myItems.length ? `<ul style="margin:4px 0 0;padding-left:18px">${myItems.map(([k, v]) => `<li>${v} ${esc(nm(+k.slice(1)))}</li>`).join('')}</ul>` : ' <span style="opacity:.7">No te toca surtir este reparto</span>'}</div>
 ${others.length ? `<small style="display:block;margin-top:4px;opacity:.75">El resto se recoge en ${others.map(s => esc(brs()[s.branch])).join(', ')}.</small>` : ''}
 <div style="display:flex;justify-content:space-between;margin-top:6px"><span><b>Total del pedido</b></span><b>${money(dvDue(d))}</b></div>${d.fee ? `<small style="display:block;opacity:.7">Incluye envío ${money(d.fee)}</small>` : ''}
 ${myOut ? `<div class="ok" style="margin-top:6px"><b>✅ Salida confirmada${myOut.at ? ' · ' + hm(myOut.at) : ''}${myOut.name ? ' por ' + esc(myOut.name) : ''}</b></div>` : (d.status == 'pendiente' || d.status == 'en_ruta' ? `<div class="form" style="margin-top:6px"><button class="alt" style="flex:1" onclick="dvOut('${d._id}')">✅ Marcar salida</button></div>` : '')}</div>`;
}

/* El vendedor confirma que el pedido salió de su sucursal */
async function dvOut(id) {
  const d = (S.dv || []).find(x => x._id == id);
  if (!d) return;
  const b = S.me && S.me.branch;
  if (b == null) return;
  try {
    const patch = {};
    patch['outs.' + b] = { by: S.me.user, name: S.me.name, at: Date.now() };
    /* Compatibilidad con repartos viejos: la sucursal principal también deja la bandera simple. */
    if (b === d.branch) {
      patch.out = true;
      patch.outBy = S.me.user;
      patch.outName = S.me.name;
      patch.outAt = Date.now();
    }
    await db.doc('deliveries/' + id).update(patch);
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
  const appId = (S.cfg && S.cfg.onesignalAppId) || OS_APP_ID;
  /* El SDK carga con `defer`; OneSignalDeferred espera a que esté listo. */
  const seq = ++pushSeq;
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async function (OneSignal) {
    if (seq !== pushSeq) return;
    try {
      await OneSignal.init({
        appId,
        safari_web_id: OS_SAFARI_ID,
        serviceWorkerPath: '/sw.js',
        serviceWorkerParam: { scope: '/' },
        notifyButton: { enable: false },
      });
      if (seq !== pushSeq) return;
      hookOneSignalForeground(OneSignal);
      const perm = await OneSignal.Notifications.requestPermission();
      if (!perm) {
        toast('No se activaron las notificaciones');
        renderNow(true);
        return;
      }
      if (S.me && S.me.id) {
        OneSignal.User.addTag('role', S.me.role);
        try {
          localStorage.setItem('tm_push_role', S.me.role);
          localStorage.setItem('tm_push_appid', appId);
        } catch (_) {}
        try { await OneSignal.User.PushSubscription.optIn(); } catch (_) {}
        const id = await OneSignal.User.PushSubscription.id;
        if (id) await db.doc('users/' + S.me.id).update({ onesignalId: id });
      }
      toast('Notificaciones activadas');
      renderNow(true);
    } catch (e) {
      console.warn('OneSignal perm error:', e);
      toast('Error: ' + (e && e.message ? e.message : e));
    }
  });
}

/* Muestra una notificación. En Android el constructor `new Notification` está prohibido:
   hay que usar el service worker. En escritorio se conserva como respaldo. */
async function notifShow(title, body, tag) {
  const opts = {
    body: body || '',
    tag: tag || 'tamales',
    /* Izquierda: scooter (badge). Derecha: logo de tamales (icon).
       El scooter es de Twemoji 🛵 (CC-BY 4.0). */
    icon: '/icons/icon-192.png',
    badge: '/icons/scooter-192.png',
    data: { url: '/', local: true },
  };
  if ('serviceWorker' in navigator) {
    try {
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, rej) => setTimeout(() => rej(new Error('sw-timeout')), 2000)),
      ]);
      if (reg && reg.showNotification) {
        await reg.showNotification(title, opts);
        return true;
      }
    } catch (e) {
      console.warn('showNotification', e);
    }
  }
  try {
    new Notification(title, opts);
    return true;
  } catch (e) {
    console.warn('Notification', e);
    return false;
  }
}

/* Envía el push real a los repartidores a través del Worker de Cloudflare.
   No bloquea el guardado: si falla, solo se avisa en consola. */
async function pushNotify(title, body) {
  if (!PUSH_URL || !S.fu || typeof S.fu.getIdToken !== 'function') return;
  try {
    const token = await S.fu.getIdToken();
    const r = await fetch(PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ title: title, body: body }),
    });
    const txt = await r.text();
    if (r.ok) console.log('[push] enviado', txt);
    else console.warn('[push] error', r.status, txt);
  } catch (e) {
    console.warn('push', e);
  }
}

function notifyNewDv() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const nw = (S.dv || []).filter(d => d.status == 'pendiente' && !seenDv.has(d._id));
  if (!nw.length) return;
  /* Si la app está a la vista, la notificación local es la única: OneSignal la
     silencia en primer plano. Si está oculta, OneSignal muestra el push. */
  const visible = document.visibilityState === 'visible';
  nw.forEach(d => {
    seenDv.add(d._id);
    if (visible) {
      try {
        notifShow(
          d.large ? 'Nuevo pedido grande' : 'Nuevo reparto',
          (d.client || 'Cliente') +
            (d.addr ? ' · ' + d.addr : '') +
            (d.pickups && d.pickups.length > 1 ? ' · ' + d.pickups.length + ' sucursales' : '') +
            ' · ' +
            money(dvDue(d)),
          d._id
        );
      } catch (_) {}
    }
    try {
      toast('Nuevo reparto: ' + (d.client || 'Cliente'));
    } catch (_) {}
  });
  try {
    localStorage.setItem('tm_seen_dv', JSON.stringify([...seenDv]));
  } catch (_) {}
}

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
  if (!window.VAPID_PUBLIC_KEY || window.VAPID_PUBLIC_KEY.indexOf('REEMPLAZA') !== -1) return;
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
        notifShow(title, body, 'fcm');
      } catch (_) {}
      try {
        toast(title + (body ? ' · ' + body : ''));
      } catch (_) {}
    });
  } catch (e) {
    console.warn('FCM init', e);
  }
}
let osFgHooked = false;
function hookOneSignalForeground(OneSignal) {
  if (osFgHooked) return;
  osFgHooked = true;
  try {
    OneSignal.Notifications.addEventListener('foregroundWillDisplay', event => {
      /* La app ya muestra su propia notificación local: evita la duplicada. */
      event.preventDefault();
    });
  } catch (e) {
    console.warn('[OneSignal] foreground hook', e);
  }
}

async function initOnesignal() {
  const seq = ++pushSeq;
  const appId = (S.cfg && S.cfg.onesignalAppId) || OS_APP_ID;
  console.log('[OneSignal] initOnesignal called, appId:', appId.slice(0, 8) + '...');
  if (!('Notification' in window)) { console.log('[OneSignal] skipped: no Notification API'); return; }
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async function (OneSignal) {
    if (seq !== pushSeq) return;
    try {
      console.log('[OneSignal] SDK loaded, initializing...');
      await OneSignal.init({ appId, safari_web_id: OS_SAFARI_ID, serviceWorkerPath: '/sw.js', serviceWorkerParam: { scope: '/' }, notifyButton: { enable: false } });
      if (seq !== pushSeq) return;
      hookOneSignalForeground(OneSignal);
      console.log('[OneSignal] init OK, permission:', Notification.permission);
      if (S.me && S.me.id) {
        OneSignal.User.addTag('role', S.me.role);
        try {
          localStorage.setItem('tm_push_role', S.me.role);
          localStorage.setItem('tm_push_appid', appId);
        } catch (_) {}
        if (Notification.permission === 'granted') {
          try { await OneSignal.User.PushSubscription.optIn(); } catch (_) {}
          const id = await OneSignal.User.PushSubscription.id;
          console.log('[OneSignal] PushSubscription.id:', id);
          if (id) await db.doc('users/' + S.me.id).update({ onesignalId: id });
        } else {
          console.log('[OneSignal] permission not granted yet; user needs to tap Activar notificaciones');
        }
      }
    } catch (e) {
      console.warn('[OneSignal] init error:', e);
    }
  });
}

/* Quita la etiqueta role y apaga la suscripción de este dispositivo (al salir, cambiar de rol
   o quedar inactivo). Así un teléfono que fue de repartidor deja de recibir avisos, incluso
   si el servidor tarda en aplicar la etiqueta.
   `force` limpia aunque no exista la marca local (teléfonos que se actualizaron después). */
async function clearPushTag(force) {
  let appId = '';
  try {
    if (!force && localStorage.getItem('tm_push_role') !== 'rep') return;
    appId = localStorage.getItem('tm_push_appid') || '';
  } catch (_) {
    if (!force) return;
  }
  appId = appId || (S.cfg && S.cfg.onesignalAppId) || OS_APP_ID;
  const seq = ++pushSeq;
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  await new Promise(resolve => {
    window.OneSignalDeferred.push(async function (OneSignal) {
      if (seq !== pushSeq) return resolve();
      try {
        await OneSignal.init({ appId, safari_web_id: OS_SAFARI_ID, serviceWorkerPath: '/sw.js', serviceWorkerParam: { scope: '/' }, notifyButton: { enable: false } });
        /* Si mientras tanto entró un repartidor, no apagues su suscripción. */
        if (seq !== pushSeq) return resolve();
        try { await OneSignal.User.removeTag('role'); } catch (e) { console.warn('[OneSignal] remove tag', e); }
        /* Si entró un repartidor mientras se quitaba la etiqueta, no lo apagues. */
        if (seq !== pushSeq) return resolve();
        /* Apagar la suscripción corta el envío de inmediato en este dispositivo. */
        try { await OneSignal.User.PushSubscription.optOut(); } catch (e) { console.warn('[OneSignal] optOut', e); }
        try {
          localStorage.removeItem('tm_push_role');
          localStorage.removeItem('tm_push_appid');
        } catch (_) {}
        console.log('[OneSignal] etiqueta role eliminada y suscripción apagada');
      } catch (e) {
        console.warn('[OneSignal] clear tag', e);
      }
      resolve();
    });
  });
}



const dvOpenN = () => (S.dv || []).filter(d => d.status == 'pendiente' || d.status == 'en_ruta').length;


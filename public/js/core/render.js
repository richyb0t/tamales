/* Motor de pintado: render con retardo, renderNow y rotulado de controles. */

/* Evita que el navegador restaure el scroll al recargar: cada pantalla empieza arriba. */
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

let rT = 0,
  rForce = false,
  rLastForce = 0,
  vk = '';

/* Clave de la pantalla visible: al cambiar de pantalla se vuelve hasta arriba. */
function viewKey() {
  const m = S.me;
  if (!m) return '';
  if (m.role == 'admin' || m.role == 'sup') return 'a:' + (S.tab || 'res') + ':' + (S.ib || 0) + ':' + (S.apt || 'h');
  if (m.role == 'vend') return 'v:' + (S.vt || 'v') + ':' + (S.apt || 'h');
  if (m.role == 'rep') return 'e:' + (S.rt || 'e');
  return 'e:' + (S.et || 'd') + ':' + (S.apt || 'h');
}

function render(force) {
  if (force) rLastForce = Date.now();
  if (!force && rLastForce && Date.now() - rLastForce < 250) {
    clearTimeout(rT);
    rT = setTimeout(() => render(false), 260);
    return;
  }
  if (force) rForce = true;
  clearTimeout(rT);
  // Agrupa llamadas síncronas/consecutivas en un solo pintado para evitar parpadeo
  rT = setTimeout(() => {
    const f = rForce;
    rForce = false;
    renderNow(f);
  }, rForce ? 16 : 100);
}

function renderNow(force) {
  if (!force && /INPUT|SELECT/.test(document.activeElement?.tagName || '')) {
    pend = true;
    return;
  }
  if (force) S.dt = 0;
  else if (S.dt && Date.now() - S.dt < 3000) {
    clearTimeout(rT);
    rT = setTimeout(() => renderNow(false), 3200 - (Date.now() - S.dt));
    return;
  }
  pend = false;
  const a = $('#app'),
    w = '<p class="mut" style="padding:24px;text-align:center">Cargando…</p>';
  if (!db || !S.au) {
    a.innerHTML = w;
    return;
  }
  if (!S.fu) {
    vk = '';
    a.innerHTML = S.setup ? setupView() : loginView();
    return;
  }
  if (!S.me) {
    vk = '';
    a.innerHTML = S.pf ? noAccess() : w;
    return;
  }
  if (S.me.role == 'vend' && !vendReady()) {
    a.innerHTML = S.clOk && S.cfgOk ? pickView() : w;
    return;
  }
  a.innerHTML = (
    { admin: adminView, sup: adminView, vend: vendView, enc: encView, rep: repView  }[S.me.role] || (() => '<p>Rol no válido</p>')
  )();
  const k = viewKey();
  if (k !== vk) {
    vk = k;
    scrollTo(0, 0);
  }
  if (!['vend', 'rep'].includes(S.me.role)) chkAlerts();
  if (!['enc', 'rep'].includes(S.me.role)) schedSt();
  labelControls();
  if (typeof initMinimaps === 'function') initMinimaps();
}

function labelControls() {
  document.querySelectorAll('#app input[type=number]').forEach(e => (e.enterKeyHint = 'next'));
  document.querySelectorAll('#app input:not([aria-label]):not([type=checkbox])').forEach(e => {
    const r = e.closest('.row'),
      n = r && r.firstElementChild !== e ? r.firstElementChild : null,
      t = n && [...n.childNodes].find(x => x.nodeType == 3 && x.textContent.trim()),
      l = e.placeholder || (t && t.textContent.trim());
    if (l) e.setAttribute('aria-label', l);
  });
}

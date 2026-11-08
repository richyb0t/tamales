/* Motor de pintado: render con retardo, renderNow y rotulado de controles. */

let rT = 0,
  rForce = false;

function render(force) {
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
  else if (S.dt && Date.now() - S.dt < 15000) {
    clearTimeout(rT);
    rT = setTimeout(() => renderNow(false), 15200 - (Date.now() - S.dt));
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
    a.innerHTML = S.setup ? setupView() : loginView();
    return;
  }
  if (!S.me) {
    a.innerHTML = S.pf ? noAccess() : w;
    return;
  }
  if (S.me.role == 'vend' && !vendReady()) {
    a.innerHTML = S.clOk && S.cfgOk ? pickView() : w;
    return;
  }
  a.innerHTML = (
    { admin: adminView, vend: vendView, enc: encView, rep: repView  }[S.me.role] || (() => '<p>Rol no válido</p>')
  )();
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

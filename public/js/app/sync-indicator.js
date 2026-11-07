/* Indicador «Guardando…» y aviso cuando el servidor rechaza una escritura. */

(() => {
  const e = document.createElement('div');
  e.id = 'sync';
  e.setAttribute('role', 'status');
  e.style.cssText =
    'position:fixed;top:calc(env(safe-area-inset-top,0px) + 4px);right:8px;z-index:20;background:var(--low);color:var(--on-low,#fff);font:700 12px/1 system-ui;padding:6px 10px;border-radius:14px;display:none';
  document.body.appendChild(e);
  let t = 0;
  addEventListener('wp', x => {
    clearTimeout(t);
    const n = x.detail;
    if (!n) {
      e.style.display = 'none';
      return;
    }
    t = setTimeout(
      () => {
        e.textContent = navigator.onLine ? 'Guardando…' : 'Sin conexión · ' + n + ' sin enviar';
        e.style.display = 'block';
      },
      n && !navigator.onLine ? 0 : 2000
    );
  });
  addEventListener('werr', x => {
    const m = $('#modal');
    m.innerHTML =
      '<div class="card"><h3>⚠️ No se guardó un movimiento</h3><p>' +
      esc(fe(x.detail)) +
      '</p><small>Se mostró como guardado, pero el servidor lo rechazó. Revisa el historial y vuelve a registrarlo si falta.</small><div class="form"><button id="mk">Entendido</button></div></div>';
    m.style.display = 'flex';
    $('#mk').onclick = () => (m.style.display = 'none');
  });
  document.addEventListener('input', x => {
    const t = x.target;
    if (t.closest && t.closest('#app') && t.id != 'sq') S.dt = Date.now();
  });
  document.addEventListener(
    'click',
    x => {
      if (x.target.closest && x.target.closest('button'))
        setTimeout(() => {
          S.dt = 0;
        });
    },
    true
  );
})();

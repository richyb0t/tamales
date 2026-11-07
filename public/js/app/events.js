/* Eventos globales: reintento de pintado al salir de un campo, pasos de login, Escape, teclado virtual, conexión y diálogos. */

document.addEventListener('focusout', () =>
  setTimeout(() => {
    if (pend) render();
  }, 200)
);

addEventListener('popstate', () => {
  if (S.fu) {
    ld = 0;
    return;
  }
  if (ld <= 0) return;
  ld--;
  if (S.lp) {
    S.lp = null;
    if (prList().filter(p => p.role == S.lr).length < 2) S.lr = null;
  } else S.lr = null;
  render(true);
});

document.addEventListener('keydown', e => {
  if (e.key == 'Escape') {
    menu(0);
    const m = $('#modal');
    if (m) m.style.display = 'none';
  }
});

(() => {
  const vv = window.visualViewport;
  let H = 0,
    W = 0;
  const kb = () => {
    if (innerWidth != W) {
      W = innerWidth;
      H = innerHeight;
    }
    H = Math.max(H, innerHeight);
    document.body.classList.toggle('kb', H - (vv ? vv.height : innerHeight) > 150);
  };
  if (vv) vv.addEventListener('resize', kb);
  addEventListener('resize', kb);
  kb();
  const net = () => {
    const e = $('#net');
    if (e) e.style.display = navigator.onLine ? 'none' : 'block';
  };
  addEventListener('online', net);
  addEventListener('offline', net);
  net();
  document.addEventListener('focusin', e => {
    const t = e.target;
    if ((t.tagName != 'INPUT' && t.tagName != 'SELECT') || t.type == 'checkbox') return;
    if (t.type == 'number')
      try {
        t.select();
      } catch (_) {}
    setTimeout(() => {
      try {
        t.scrollIntoView({ block: 'center', behavior: 'smooth' });
      } catch (_) {}
    }, 300);
  });
  document.addEventListener('keydown', e => {
    const t = e.target;
    if (e.key != 'Enter' || t.tagName != 'INPUT') return;
    if (t.id == 'pg') {
      const k = $('#mk');
      if (k) k.click();
      return;
    }
    if (t.type != 'number') return;
    const l = [...document.querySelectorAll('#app input[type=number]')],
      n = l[l.indexOf(t) + 1];
    e.preventDefault();
    n ? n.focus() : t.blur();
  });
})();

/* Diálogos: tocar fuera de la tarjeta también los cierra */
(() => {
  const m = $('#modal');
  m.addEventListener('click', e => {
    if (e.target === m) m.style.display = 'none';
  });
})();

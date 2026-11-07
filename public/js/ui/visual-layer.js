/* Capa visual (sin lógica de negocio): íconos de línea, transición entre secciones, pulso del carrito y aviso por estado. */

(() => {
  const P = {
    chart: 'M5 20v-7M12 20V5m7 15v-10',
    box: 'M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8',
    swap: 'M4 8h14l-3-3M20 16H6l3 3',
    receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
    pin: 'M7 3h10v18l-5-4-5 4z',
    trend: 'M3 17l6-6 4 4 8-8M15 7h6v6',
    users:
      'M9 11a3 3 0 100-6 3 3 0 000 6zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M17 11a3 3 0 000-6M21 20c0-2.5-1.5-4.5-4-5.5',
    sliders: 'M4 7h10M18 7h2M4 17h2M10 17h10M16 5v4M8 15v4',
    cart: 'M3 4h2l2 12h11l2-8H6M9 20h.01M17 20h.01',
    cash: 'M3 7h18v10H3zM12 14a2 2 0 100-4 2 2 0 000 4z',
    clip: 'M9 4h6v3H9zM7 5H5v16h14V5h-2M9 12h6M9 16h4',
    loc: 'M12 21s7-6 7-11a7 7 0 10-14 0c0 5 7 11 7 11zM12 12a2 2 0 100-4 2 2 0 000 4z',
    key: 'M12 15a4 4 0 11-8 0 4 4 0 018 0zM11 12l9-9M16 7l3 3',
    exit: 'M10 4H5v16h5M15 8l4 4-4 4M19 12H9',
    menu: 'M4 7h16M4 12h16M4 17h16',
    x: 'M6 6l12 12M18 6L6 18',
    search: 'M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4',
    dots: 'M5 12a1.2 1.2 0 102.4 0 1.2 1.2 0 10-2.4 0zM10.8 12a1.2 1.2 0 102.4 0 1.2 1.2 0 10-2.4 0zM16.6 12a1.2 1.2 0 102.4 0 1.2 1.2 0 10-2.4 0z',
  };
  const M = {
    '📊': 'chart',
    '📦': 'box',
    '🔁': 'swap',
    '🧾': 'receipt',
    '📌': 'pin',
    '📈': 'trend',
    '👥': 'users',
    '⚙': 'sliders',
    '🛒': 'cart',
    '💵': 'cash',
    '📋': 'clip',
    '📍': 'loc',
    '🔑': 'key',
    '🚪': 'exit',
    '☰': 'menu',
    '✕': 'x',
    '🔍': 'search',
    '⋯': 'dots',
  };
  const TAMAL =
    '<svg viewBox="0 0 512 512" aria-hidden="true"><rect width="512" height="512" fill="#0B6B5E"/><g transform="translate(15.4 15.4) scale(.94)"><path d="M180 186L196 104L256 156L316 104L332 186Z" fill="#E8D3A8"/><path d="M180 346L196 428L256 376L316 428L332 346Z" fill="#E8D3A8"/><rect x="164" y="170" width="184" height="190" rx="46" fill="#F3E3C3"/><path d="M226 184V346M256 180V350M286 184V346" stroke="#DCC796" stroke-width="6" stroke-linecap="round" fill="none"/><rect x="156" y="200" width="200" height="16" rx="8" fill="#C9A96A"/><rect x="156" y="314" width="200" height="16" rx="8" fill="#C9A96A"/><path d="M222 88C202 72 242 60 222 42M256 80C236 64 276 52 256 34M290 88C270 72 310 60 290 42" stroke="#F3E3C3" stroke-width="10" stroke-linecap="round" fill="none"/></g></svg>';
  const T = document.createElement('template');
  const skin = r =>
    r &&
    r
      .querySelectorAll('.nav button>span,.mi>span,.nvi>span,.hb,.mx,.lupa,.ct>.gh,.logo')
      .forEach(e => {
        const n = e.firstChild;
        if (!n || n.nodeType !== 3) return;
        const s = n.nodeValue.trim().replace(/\ufe0f/g, '');
        if (e.classList.contains('logo')) {
          e.innerHTML = TAMAL;
          return;
        }
        const k = M[s];
        if (!k) return;
        T.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + P[k] + '"/></svg>';
        n.replaceWith(T.content.cloneNode(true));
      });
  const app = document.getElementById('app'),
    cn = () => Object.values(S.cart || {}).reduce((a, b) => a + (+b || 0), 0);
  let vk = '',
    cc = cn(),
    t1 = 0,
    t2 = 0;
  const rn = renderNow;
  window.renderNow = function () {
    const k = [S.me && S.me.id, S.tab, S.vt].join('|'),
      r = rn.apply(this, arguments);
    skin(app);
    if (k !== vk) {
      vk = k;
      app.classList.add('vin');
      clearTimeout(t1);
      t1 = setTimeout(() => app.classList.remove('vin'), 400);
    }
    const c = cn();
    if (c !== cc) {
      if (c > cc && navigator.vibrate) navigator.vibrate(8);
      cc = c;
      app.classList.add('cch');
      clearTimeout(t2);
      t2 = setTimeout(() => app.classList.remove('cch'), 320);
    }
    return r;
  };
  const mn = menu;
  window.menu = function (o) {
    mn.apply(this, arguments);
    if (o) skin(document.getElementById('drawer'));
  };
  const tt = toast;
  window.toast = function (t) {
    tt(t);
    const e = document.getElementById('toast');
    e.dataset.k = /^(✅|✓)/.test(t)
      ? 'ok'
      : /^(⚠|❌|🚫|Error|No se pudo)|ya la tiene|no está disponible/i.test(t)
        ? 'bad'
        : '';
  };
  skin(app);
})();

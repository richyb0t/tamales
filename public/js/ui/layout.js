/* Componentes de navegación: barra inferior, encabezado, menú lateral y atajos de pantalla. */

function nav(it, cur, fn) {
  return `<nav class="nav">${it.map(([k, i, l, n]) => `<button class="${cur == k ? 'on' : ''}"${cur == k ? ' aria-current="page"' : ''} onclick="${fn}('${k}')"><span>${i}${n ? `<em class="bdg">${n}</em>` : ''}</span>${l}</button>`).join('')}</nav>`;
}

function bchips(cur, fn) {
  return `<div class="seg">${brs()
    .map((n, i) =>
      !isOpen(i)
        ? ''
        : `<button class="${i == cur ? 'on' : ''}" onclick="${fn}(${i})">${esc(n)}</button>`
    )
    .join('')}</div>`;
}

function setTab(t) {
  if (t == 'aj') S.pl = true;
  S.tab = t;
  render(true);
  scrollTo(0, 0);
}

function setVt(t) {
  S.vt = t;
  if (t == 'r') {
    if (stUn) {
      // ya suscrito: los datos ya están, pintar ya
      render(true);
    } else {
      // suscribir; el primer onSnapshot pinta cuando lleguen los datos (evita parpadeo vacío→lleno)
      stockOn();
    }
  } else {
    stockOff();
    render(true);
  }
  scrollTo(0, 0);
}

function setRt(t) {
  S.rt = t;
  render(true);
  scrollTo(0, 0);
}

function setIb(i) {
  S.ib = i;
  render(true);
}

function head() {
  const m = S.me,
    A = m.role == 'admin',
    V = m.role == 'vend',
    n = V ? pin() : A ? lowList().length : 0;
  return `<header class="top"><button class="hb" onclick="menu(1)" aria-label="Abrir menú">☰${n ? `<i class="dot">${n}</i>` : ''}</button><div class="ht"><b class="ttl">${esc(V ? (S.vt == 'd' ? 'Repartos · ' + brs()[m.branch] : brs()[m.branch]) : A ? SEC[S.tab] || 'Resumen' : m.role == 'rep' ? (S.rt == 't' ? 'Terminados' : S.rt == 'c' ? 'En camino' : 'Repartos') : 'Pedidos')}</b><small>${A ? 'Administrador · ' : ''}${esc(m.name)} · ${D}</small></div></header>`;
}

function menu(o) {
  const d = $('#drawer');
  if (!d) return;
  if (!o) {
    const f = d.contains(document.activeElement);
    d.classList.remove('open');
    document.body.classList.remove('nolock');
    if (f) {
      const h = $('.hb');
      if (h) h.focus();
    }
    return;
  }
  const m = S.me,
    A = m.role == 'admin',
    V = m.role == 'vend';
  /* Grupos del menú: el administrador ve «Operación» (el día a día) y «Análisis y gestión» (lo que se usa menos) */
    const G = A
    ? [
        [
          'Operación',
          [
            ['res', '📊', 'Resumen', lowList().length],
            ['inv', '📦', 'Inventario'],
            ['tr', '🔁', 'Traspasos'],
            ['ct', '🧾', 'Cortes'],
            ['ap', '📌', 'Apartados', preN()],
            ['dv', '🛵', 'Repartos'],
          ],
        ],
        [
          'Análisis y gestión',
          [
            ['rp', '📈', 'Reportes'],
            ['us', '👥', 'Usuarios'],
            ['aj', '⚙️', 'Ajustes'],
          ],
        ],
      ]
    : V
      ? [
          [
            '',
            [
              ['v', '🛒', 'Vender'],
              ['h', '🧾', 'Historial', histN()],
              ['r', '📌', 'Apartados', pin() + preN()],
              ['d', '🛵', 'Repartos', dvActive()],
              ['m', '💵', 'Corte y traspasos'],
            ],
          ],
        ]
      : m.role == 'rep'
        ? [
            [
              '',
              [
                ['e', '🛵', 'Repartos disponibles'],
                ['c', '🚚', 'En camino'],
                ['t', '✅', 'Terminados hoy'],
              ],
            ],
          ]
        : [
            [
              '',
              [
                ['d', '📋', 'Disponibilidad'],
                ['r', '🛵', 'Repartos'],
                ['a', '📌', 'Apartados'],
                ['s', '🔁', 'Entre sucursales'],
              ],
            ],
          ];
  const cur = A ? S.tab || 'res' : V ? S.vt || 'v' : m.role == 'enc' ? S.et || 'd' : S.rt || 'e',
    it = ([k, i, l, n]) =>
      `<button class="mi ${cur == k ? 'on' : ''}" onclick="go('${k}')"${cur == k ? ' aria-current="page"' : ''}><span>${i}</span><em>${l}</em>${n ? `<i class="dot2">${n}</i>` : ''}</button>`;
  d.innerHTML = `<div class="bk" onclick="menu(0)"></div><div class="pn"><div class="mh"><span class="mav" style="background:${avC(m.user || m.id)}">${avI(m.name)}</span><div class="mt"><b>${esc(m.name)}</b><small>${ROLE[m.role] || ''}</small>${V && m.branch != null ? `<span class="chip">📍 ${esc(brs()[m.branch])}</span>` : ''}</div><button class="mx" onclick="menu(0)" aria-label="Cerrar menú">✕</button></div>${G.map(([t, l]) => (t ? `<div class="mg">${t}</div>` : '') + l.map(it).join('')).join('')}<div class="mf">${V ? '<button class="mi" onclick="menu(0);setTimeout(chBr,400)"><span>📍</span><em>Cambiar de sucursal</em></button>' : ''}<button class="mi" onclick="menu(0);setTimeout(pinDlg,400)"><span>🔑</span><em>Cambiar mi PIN</em></button><button class="mi out" onclick="menu(0);logout()"><span>🚪</span><em>Salir</em></button></div></div>`;
  document.body.classList.add('nolock');
  requestAnimationFrame(() => {
    d.classList.add('open');
    const f = d.querySelector('.mi');
    if (f) f.focus({ preventScroll: true });
  });
}

function go(k) {
  menu(0);
  const m = S.me;
  if (m.role == 'admin') setTab(k);
  else if (m.role == 'vend') setVt(k);
  else if (m.role == 'enc') {
    S.et = k;
    render(true);
  } else setRt(k);
}

const adNav = k => (k == 'more' ? menu(1) : setTab(k)),
  vNav = k => (k == 'm' ? menu(1) : setVt(k)),
  repNav = k => (k == 'more' ? menu(1) : setRt(k)),
  enNav = k => {
    S.anew = false;
    if (k == 'a') S.apt = S.apt == 's' ? 'h' : S.apt;
    S.et = k;
    render(true);
  };

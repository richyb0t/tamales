/* Acceso: pantalla de bienvenida, perfiles, PIN, login y logout. */

function setupView() {
  return `<div class="card"><h2>🫔 Bienvenido</h2><p>Crea la cuenta de <b>administrador</b> para empezar.</p><div class="form"><input id="un" placeholder="Nombre"><input id="uu" placeholder="Usuario"><input id="up" placeholder="PIN (6 dígitos)" type="password" inputmode="numeric"></div><button onclick="addUser('admin')">Crear administrador</button></div>`;
}

let prU = null;

function profSub() {
  if (prU) return;
  try {
    prU = db.collection('profiles').onSnapshot(
      q => {
        S.prs = q.docs.map(d => ({ id: d.id, ...d.data() }));
        S.prE = false;
        if (!S.fu) render();
      },
      e => {
        console.warn('profiles', e);
        S.prE = true;
        if (!S.fu) render();
      }
    );
  } catch (e) {
    S.prE = true;
  }
  setTimeout(() => {
    if (!S.prs && !S.fu) {
      S.prE = true;
      render();
    }
  }, 3000);
}

function profOff() {
  if (prU) {
    prU();
    prU = null;
  }
}

const prList = () =>
  (S.prs || [])
    .filter(p => p.active !== false && p.user)
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'));

let ld = 0;

/* pasos de login apilados en el historial (rol, perfil) para que el botón atrás del celular regrese un paso */
function pick(u) {
  S.lp = prList().find(p => p.user == u) || null;
  if (!S.lr) ld = 0;
  ld++;
  history.pushState({ lg: 1 }, '');
  renderNow(true);
  const e = $('#lp');
  if (e) e.focus();
}

function loginView() {
  const l = prList();
  if (S.lp && !l.some(p => p.user == S.lp.user)) S.lp = null;
  if (S.lp) return pinView(S.lp);
  if (!S.prs && !S.prE)
    return '<p class="mut" style="padding:24px;text-align:center">Cargando perfiles…</p>';
  if (S.lm || S.prE || !l.length)
    return (
      loginForm() +
      (l.length
        ? '<div class="who"><button class="gh" onclick="S.lm=false;renderNow(true)">← Volver a los perfiles</button></div>'
        : '')
    );
  const LOGO = '<div style="font-size:42px">🫔</div>',
    ok = l.every(p => ROLE[p.role]),
    R = ok
      ? [
          ['vend', 'Vendedor', 'Vendedores', 'Vendo en una sucursal'],
          ['enc', 'Pedidos', 'Pedidos', 'Pedidos, apartados y disponibilidad'],
          ['rep', 'Repartidor', 'Repartidores', 'Entregas a domicilio'],
          ['admin', 'Administrador', 'Administradores', 'Inventario, ventas y cortes'],
        ].filter(x => l.some(p => p.role == x[0] || (x[0] == 'admin' && p.role == 'sup')))
      : [];
  let r = S.lr;
  if (!R.some(x => x[0] == r)) r = R.length == 1 ? R[0][0] : null;
  if (!r && ok)
    return `<div class="who">${LOGO}<h1>¿Quién eres?</h1><small>Elige tu rol</small><div class="rls">${R.map(x => `<button class="rb ${x[0]}" onclick="pickRole('${x[0]}')"><span class="ri">${RI[x[0]]}</span><b>${x[1]}</b><small>${x[3]}</small></button>`).join('')}</div></div>`;
  const A = ok ? l.filter(p => p.role == r || (r == 'admin' && p.role == 'sup')) : l,
    T = ok ? R.find(x => x[0] == r)[2] : 'Elige tu perfil';
  return `<div class="who">${LOGO}<h1>¿Quién entra?</h1><small>${T}</small><div class="pf">${A.map(p => `<button data-u="${esc(p.user)}" onclick="pick(this.dataset.u)" aria-label="${esc(p.name)}, ${ROLE[p.role] || ''}"><span class="av" style="background:${avC(p.user)}">${avI(p.name)}</span><b>${esc(p.name)}</b></button>`).join('')}</div>${R.length > 1 ? '<button class="gh" style="margin-top:24px" onclick="backRole()">← Cambiar de rol</button>' : ''}</div>`;
}

const RI = {
  vend: '<svg viewBox="0 0 24 24"><path d="M3 4h2.2l2.3 10.2a1 1 0 0 0 1 .8h8.4a1 1 0 0 0 1-.8L19.5 8H6.1"/><circle cx="9.5" cy="19" r="1.4"/><circle cx="16.5" cy="19" r="1.4"/></svg>',
  enc: '<svg viewBox="0 0 24 24"><rect x="5.5" y="4.5" width="13" height="16.5" rx="2.5"/><path d="M9 4.5h6V7.5H9zM9.5 12h5M9.5 16h5"/></svg>',
  admin: '<svg viewBox="0 0 24 24"><path d="M5 20v-8M12 20V4M19 20v-5"/></svg>',
  rep: '<svg viewBox="0 0 24 24"><path d="M6 17l4-8h4l4 8M10 9H8"/><circle cx="6" cy="17" r="2"/><circle cx="18" cy="17" r="2"/></svg>',
};

function pickRole(r) {
  S.lr = r;
  const a = prList().filter(p => p.role == r || (r == 'admin' && p.role == 'sup'));
  if (a.length == 1) S.lp = a[0];
  ld = 1;
  history.pushState({ lg: 1 }, '');
  renderNow(true);
  const e = $('#lp');
  if (e) e.focus();
}

function backProf() {
  if (ld > 0) {
    history.back();
    return;
  }
  S.lp = null;
  if (prList().filter(p => p.role == S.lr).length < 2) S.lr = null;
  renderNow(true);
}

function backRole() {
  if (ld > 0) {
    history.back();
    return;
  }
  S.lr = null;
  renderNow(true);
}

function pinView(p) {
  return `<div class="who"><span class="av big" style="background:${avC(p.user)}">${avI(p.name)}</span><h1>${esc(p.name)}</h1><small>${ROLE[p.role] || ''}</small><div class="card pin"><input id="lp" type="password" inputmode="numeric" autocomplete="current-password" enterkeyhint="go" aria-label="PIN de ${esc(p.name)}" placeholder="PIN" onkeydown="if(event.key=='Enter')login()"><button class="go" style="width:100%;margin-top:12px;font-size:18px" onclick="login()">Entrar</button><button class="gh" style="width:100%;margin-top:8px" onclick="backProf()">${prList().filter(q => q.role == p.role).length < 2 ? 'Cambiar de rol' : 'Cambiar de perfil'}</button></div></div>`;
}

function loginForm() {
  return `<div class="hero"><div class="logo">🫔</div><h1>Tamales</h1><small>Control de sucursales</small></div><div class="card"><div class="form"><input id="lu" placeholder="Usuario" aria-label="Usuario" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="next" style="flex:1 1 100%"><input id="lp" placeholder="PIN (6 dígitos)" aria-label="PIN" type="password" inputmode="numeric" autocomplete="current-password" enterkeyhint="go" onkeydown="if(event.key=='Enter')login()" style="flex:1 1 100%"></div><button class="go" style="width:100%;font-size:18px" onclick="login()">Entrar</button></div>`;
}

const mail = u => u + '@tamalescastro.com';

const fe = e =>
  ({
    'auth/invalid-credential': 'Usuario o PIN incorrecto',
    'auth/invalid-login-credentials': 'Usuario o PIN incorrecto',
    'auth/user-not-found': 'Usuario o PIN incorrecto',
    'auth/wrong-password': 'Usuario o PIN incorrecto',
    'auth/email-already-in-use': 'Ese usuario ya existe',
    'auth/weak-password': 'El PIN debe tener al menos 6 dígitos',
    'auth/too-many-requests': 'Demasiados intentos, espera unos minutos',
    'auth/network-request-failed': 'Sin conexión a internet',
    'old-user':
      'Ese usuario existió antes con otro PIN. Usa otro nombre de usuario (por ejemplo ana2)',
    'permission-denied': 'No tienes permiso para hacer eso',
  })[e && e.code] ||
  (e && e.message) ||
  'Error';

function noAccess() {
  return `<div class="hero"><div class="logo">🫔</div><h1>Sin acceso</h1><small>Tu cuenta no está activa o aún no tiene permisos. Pide al administrador que la revise.</small></div><div class="card"><button style="width:100%" onclick="logout()">Salir</button></div>`;
}

async function login() {
  const u = S.lp
      ? S.lp.user
      : $('#lu')
          .value.trim()
          .toLowerCase()
          .replace(/[^a-z0-9_.]/g, ''),
    p = $('#lp').value.trim();
  if (!u || !p) return toast(S.lp ? 'Escribe tu PIN' : 'Escribe usuario y PIN');
  try {
    await FB.login(mail(u), p);
  } catch (e) {
    toast(fe(e));
    const i = $('#lp');
    if (i) {
      i.value = '';
      i.focus();
    }
  }
}

async function logout() {
  S.cart = {};
  try {
    localStorage.removeItem('tm_v');
  } catch (e) {}
  try {
    vRest = false;
  } catch (e) {}
  try {
    vSig = '';
  } catch (e) {}
  try {
    /* Espera a apagar la suscripción, pero sin dejar la pantalla trabada si no hay internet. */
    if (typeof clearPushTag === 'function')
      await Promise.race([clearPushTag(), new Promise(r => setTimeout(r, 4000))]);
  } catch (e) {}
  try {
    await FB.logout();
  } catch (e) {
    err(e);
  }
}

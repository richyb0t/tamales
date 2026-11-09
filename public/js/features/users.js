/* Usuarios: alta, baja, desactivación, perfiles públicos y cambio de PIN. */

function usView() {
  return `<div class="card"><h3>Nuevo usuario</h3><div class="form"><input id="un" placeholder="Nombre"><input id="uu" placeholder="Usuario" autocapitalize="none"><input id="up" placeholder="PIN (6 dígitos)" inputmode="numeric"><select id="ur" aria-label="Rol"><option value="vend">Vendedor</option><option value="enc">Encargado de pedidos</option><option value="admin">Administrador</option><option value="rep">Repartidor</option></select></div><small>Cada vendedor elige su sucursal al entrar a la app.</small><div class="form"><button onclick="addUser()">Crear usuario</button></div></div>
 <div class="card"><h3>Usuarios</h3>${S.users.map(u => `<div class="row" style="flex-wrap:wrap"><div><b>${esc(u.name)}${u.active === false ? ' <small class="bad">(desactivado)</small>' : ''}</b><br><small>${esc(u.user || u.id)} · ${ROLE[u.role] || ''}${u.role == 'vend' ? ' · ' + (vbr(u) != null ? 'Hoy: ' + esc(brs()[vbr(u)]) : 'Sin sucursal hoy') : ''}</small></div>${u.role == 'vend' && vbr(u) != null ? `<button class="gh" data-b="${vbr(u)}" onclick="freeBr(this.dataset.b)">Liberar sucursal</button>` : ''}${u.id == S.me.id ? '' : `<button class="gh" data-id="${esc(u.id)}" onclick="pinUser(this.dataset.id)">Cambiar PIN</button><button class="gh" data-id="${esc(u.id)}" onclick="delUser(this.dataset.id,${u.active === false})">${u.active === false ? 'Reactivar' : 'Desactivar'}</button><button class="gh" style="color:var(--bad)" data-id="${esc(u.id)}" onclick="rmUser(this.dataset.id)">Eliminar</button>`}<button class="gh" data-id="${esc(u.id)}" onclick="renameUser(this.dataset.id)">Cambiar nombre</button></div>`).join('')}</div>`;
}

/* El administrador mantiene 'profiles' igual que 'users' (altas, bajas, desactivados, cambios de nombre) */
function syncProf() {
  if (!S.me || S.me.role != 'admin' || !S.pr || !S.users.length) return;
  const want = {};
  S.users.forEach(
    u =>
      (want[u.id] = {
        user: u.user || '',
        name: u.name || '',
        role: u.role || '',
        active: u.active !== false,
      })
  );
  const ops = [];
  Object.entries(want).forEach(([id, w]) => {
    const p = S.pr[id];
    if (!p || p.user !== w.user || p.name !== w.name || p.role !== w.role || p.active !== w.active)
      ops.push(['s', id, w]);
  });
  Object.keys(S.pr).forEach(id => {
    if (!want[id]) ops.push(['d', id]);
  });
  const sig = JSON.stringify(ops);
  if (!ops.length || sig === S.psig) return;
  S.psig = sig;
  ops.forEach(([k, id, w]) => {
    try {
      (k == 's' ? db.doc('profiles/' + id).set(w) : db.doc('profiles/' + id).delete()).catch(e =>
        console.warn('profiles', e)
      );
    } catch (e) {
      console.warn(e);
    }
  });
}

async function addUser(first) {
  const n = $('#un').value.trim(),
    u = $('#uu')
      .value.trim()
      .toLowerCase()
      .replace(/[^a-z0-9_.]/g, ''),
    p = $('#up').value.trim(),
    r = first || $('#ur').value;
  if (!n || !u || !/^\d{6,}$/.test(p))
    return toast('Completa nombre, usuario y PIN (solo números, mínimo 6)');
  if (S.users.some(x => x.user == u)) return toast('Ese usuario ya existe');
  const prof = { user: u, name: n, role: r, active: true };
  try {
    if (first) await FB.bootstrap(mail(u), p, prof);
    else {
      await FB.newUser(mail(u), p, prof);
      ['un', 'uu', 'up'].forEach(i => ($('#' + i).value = ''));
      toast('Usuario creado');
    }
  } catch (e) {
    toast(fe(e));
  }
}

function rmUser(id) {
  const n = (S.users.find(x => x.id == id) || {}).name || 'este usuario';
  if (id == S.me.id) return;
  ask(
    '¿Eliminar a ' + n + '? Ya no podrá entrar a la app. Sus ventas anteriores se conservan.',
    async () => {
      try {
        try {
          await FB.call('deleteUser', { uid: id });
        } catch (e) {
          if (e.code != 'functions/not-found') throw e;
          await db.doc('users/' + id).delete();
        }
        toast('Usuario eliminado');
      } catch (e) {
        err(e);
      }
    }
  );
}

function delUser(id, off) {
  if (id == S.me.id) return;
  const u0 = S.users.find(x => x.id == id);
  ask(
    off ? '¿Reactivar este usuario?' : '¿Desactivar este usuario? Ya no podrá entrar.',
    async () => {
      try {
        await db.doc('users/' + id).update({ active: !!off });
        const cb = !off && u0 ? vbr(u0) : null;
        if (cb != null) db.doc('claims/' + cb).delete();
      } catch (e) {
        err(e);
      }
    }
  );
}

/* Cambiar mi PIN */
function pinDlg() {
  const m = $('#modal');
  m.innerHTML = `<div class="card mv pd"><h3>Cambiar mi PIN</h3><small>Tu PIN debe tener 6 números o más.</small><div class="form" style="flex-direction:column"><input id="po" type="password" inputmode="numeric" placeholder="PIN actual" autocomplete="current-password"><input id="pn" type="password" inputmode="numeric" placeholder="PIN nuevo" autocomplete="new-password"><input id="pr" type="password" inputmode="numeric" placeholder="Repite el PIN nuevo" autocomplete="new-password" onkeydown="if(event.key=='Enter')savePin()"></div><div class="form"><button class="gh" id="pc">Cancelar</button><button class="go" id="ps" onclick="savePin()">Guardar PIN</button></div></div>`;
  m.style.display = 'flex';
  $('#pc').onclick = () => (m.style.display = 'none');
  setTimeout(() => {
    const e = $('#po');
    if (e) e.focus();
  }, 150);
}

async function savePin() {
  const o = $('#po').value.trim(),
    n = $('#pn').value.trim(),
    r = $('#pr').value.trim();
  if (!o) return toast('Escribe tu PIN actual');
  if (!/^\d{6,}$/.test(n)) return toast('El PIN nuevo debe tener solo números, mínimo 6');
  if (n !== r) return toast('Los PIN nuevos no coinciden');
  if (n === o) return toast('El PIN nuevo debe ser distinto al actual');
  const b = $('#ps');
  b.disabled = true;
  try {
    await FB.changePin(o, n);
    $('#modal').style.display = 'none';
    toast('PIN cambiado');
  } catch (e) {
    b.disabled = false;
    toast(
      ['auth/invalid-credential', 'auth/wrong-password', 'auth/invalid-login-credentials'].includes(
        e.code
      )
        ? 'El PIN actual es incorrecto'
        : fe(e)
    );
  }
}

function pinUser(id) {
  const u = S.users.find(x => x.id == id);
  if (!u) return;
  S.pu = id;
  const m = $('#modal');
  m.innerHTML = `<div class="card mv pd"><h3>Nuevo PIN de ${esc(u.name)}</h3><small>6 números o más. Dáselo en persona; su sesión actual se cerrará.</small><div class="form"><input id="npn" type="password" inputmode="numeric" placeholder="PIN nuevo" autocomplete="new-password" onkeydown="if(event.key=='Enter')doPinUser()"></div><div class="form"><button class="gh" id="pc">Cancelar</button><button class="go" id="ps" onclick="doPinUser()">Guardar PIN</button></div></div>`;
  m.style.display = 'flex';
  $('#pc').onclick = () => (m.style.display = 'none');
  setTimeout(() => {
    const e = $('#npn');
    if (e) e.focus();
  }, 150);
}

async function doPinUser() {
  const p = ($('#npn').value || '').trim();
  if (!/^\d{6,}$/.test(p)) return toast('El PIN debe ser solo números, mínimo 6');
  const b = $('#ps');
  b.disabled = true;
  try {
    await FB.call('resetPin', { uid: S.pu, pin: p });
    $('#modal').style.display = 'none';
    toast('PIN cambiado');
  } catch (e) {
    b.disabled = false;
    toast(e.code == 'functions/not-found' ? 'Falta publicar las Cloud Functions' : fe(e));
  }
}

function renameUser(id) {
  const u = S.users.find(x => x.id == id);
  if (!u) return;
  const m = $('#modal');
  m.innerHTML = `<div class="card mv pd"><h3>Cambiar nombre</h3><small>Nombre actual: ${esc(u.name)}</small><div class="form"><input id="rn" value="${esc(u.name)}" placeholder="Nuevo nombre" aria-label="Nuevo nombre" onkeydown="if(event.key=='Enter')doRenameUser('${esc(id)}')"></div><div class="form"><button class="gh" id="rc">Cancelar</button><button class="go" id="rs" onclick="doRenameUser('${esc(id)}')">Guardar</button></div></div>`;
  m.style.display = 'flex';
  $('#rc').onclick = () => (m.style.display = 'none');
  setTimeout(() => {
    const e = $('#rn');
    if (e) {
      e.focus();
      e.select();
    }
  }, 150);
}

async function doRenameUser(id) {
  const n = ($('#rn').value || '').trim();
  if (!n) return toast('Escribe un nombre');
  const b = $('#rs');
  b.disabled = true;
  try {
    await db.doc('users/' + id).update({ name: n });
    if (S.me && S.me.id == id) S.me.name = n;
    $('#modal').style.display = 'none';
    toast('Nombre actualizado');
  } catch (e) {
    b.disabled = false;
    err(e);
  }
}

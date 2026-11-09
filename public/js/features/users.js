/* Usuarios: alta, baja, desactivación, perfiles públicos y cambio de PIN. */

function usView() {
  return `<div class="card"><h3>Nuevo usuario</h3><div class="form"><input id="un" placeholder="Nombre"><input id="uu" placeholder="Usuario" autocapitalize="none"><input id="up" placeholder="PIN (6 dígitos)" inputmode="numeric"><select id="ur" aria-label="Rol"><option value="vend">Vendedor</option><option value="enc">Encargado de pedidos</option><option value="rep">Repartidor</option><option value="sup">Supervisor</option><option value="admin">Administrador</option></select></div><small>Cada vendedor elige su sucursal al entrar a la app.</small><div class="form"><button onclick="addUser()">Crear usuario</button></div></div>
 <div class="card"><h3>Usuarios</h3>${S.users.map(u => {
    const acts = [];
    if (u.role == 'vend' && vbr(u) != null) acts.push(`<button class="gh" data-b="${vbr(u)}" onclick="freeBr(this.dataset.b)">Liberar sucursal</button>`);
    acts.push(`<button class="gh" data-id="${esc(u.id)}" onclick="renameUser(this.dataset.id)">Cambiar nombre</button>`);
    if (u.id != S.me.id) {
      acts.push(`<button class="gh" data-id="${esc(u.id)}" onclick="pinUser(this.dataset.id)">Cambiar PIN</button>`);
      acts.push(`<button class="gh" data-id="${esc(u.id)}" onclick="delUser(this.dataset.id,${u.active === false})">${u.active === false ? 'Reactivar' : 'Desactivar'}</button>`);
      acts.push(`<button class="gh" style="color:var(--bad)" data-id="${esc(u.id)}" onclick="rmUser(this.dataset.id)">Eliminar</button>`);
    }
    return `<div class="ucard"><div class="uinfo"><div class="uav" style="background:${avC(u.user || u.id)}">${avI(u.name)}</div><div style="min-width:0;flex:1"><b>${esc(u.name)}${u.active === false ? ' <small class="bad">(desactivado)</small>' : ''}</b><br><small>${esc(u.user || u.id)} · ${ROLE[u.role] || ''}${u.role == 'vend' ? ' · ' + (vbr(u) != null ? esc(brs()[vbr(u)]) : 'Sin sucursal hoy') : ''}</small></div></div><div class="uacts">${acts.join('')}</div></div>`;
  }).join('')}</div>`;
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
  if (!n) return toast('Falta el nombre');
  if (!u) return toast('Falta el usuario (solo letras, números, punto o guion bajo)');
  if (!/^\d{6,}$/.test(p)) return toast('El PIN debe tener solo números, mínimo 6');
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

/* Cambiar mi cuenta (usuario y/o PIN) en una sola opción */
function accountDlg() {
  const m = $('#modal');
  const cur = S.me ? S.me.user : '';
  const name = S.me ? S.me.name : '';
  const role = S.me ? ROLE[S.me.role] || '' : '';
  const initial = (name || '?').charAt(0).toUpperCase();
  const avBg = typeof avC === 'function' ? avC(S.me ? S.me.user : '') : 'var(--ac)';
  const userOpen = false;
  const pinOpen = false;
  m.innerHTML = `<div class="card mv pd" style="max-width:400px">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--bd)">
      <span class="av big" style="background:${avBg}">${esc(initial)}</span>
      <div>
        <h3 style="margin:0;font-size:16px">Mi cuenta</h3>
        <small style="opacity:.7">${esc(name)} · ${esc(role)}</small>
      </div>
    </div>

    <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0">
      <div>
        <small style="display:block;opacity:.6;font-size:11px">Usuario actual</small>
        <b>${esc(cur)}</b>
      </div>
      <button type="button" id="toggleUser" style="background:transparent;border:0;color:var(--ac);font-weight:600;font-size:13px;cursor:pointer;padding:4px 8px;min-height:auto">Cambiar</button>
    </div>
    <div id="userSection" style="display:none;padding:6px 0 2px">
      <label style="display:block;font-size:12px;font-weight:600;margin:0 0 3px">Usuario nuevo</label>
      <input id="cun" type="text" autocapitalize="none" autocomplete="username" enterkeyhint="next" placeholder="ej. ana2" style="width:100%">
      <small style="display:block;margin-top:2px;opacity:.6;font-size:11px">Solo letras minúsculas, números, punto o guion bajo.</small>
      <small id="userWarn" style="display:none;color:var(--bad);margin-top:2px;font-size:11px">Al guardar tendrás que entrar de nuevo con el nuevo usuario.</small>
    </div>

    <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-top:1px solid var(--bd);margin-top:4px">
      <div>
        <small style="display:block;opacity:.6;font-size:11px">PIN</small>
        <b>••••••</b>
      </div>
      <button type="button" id="togglePin" style="background:transparent;border:0;color:var(--ac);font-weight:600;font-size:13px;cursor:pointer;padding:4px 8px;min-height:auto">Cambiar</button>
    </div>
    <div id="pinSection" style="display:none;padding:6px 0 2px">
      <label style="display:block;font-size:12px;font-weight:600;margin:0 0 3px">PIN nuevo</label>
      <div style="display:flex;gap:6px;align-items:center">
        <input id="cpn" type="password" inputmode="numeric" autocomplete="new-password" enterkeyhint="next" placeholder="Mínimo 6 números" style="flex:1">
        <button type="button" id="eyeBtn" aria-label="Mostrar u ocultar PIN" style="min-height:32px;padding:4px 8px;font-size:16px;background:var(--fill);border:0;border-radius:var(--r-ctl);cursor:pointer">👁</button>
      </div>
      <small id="pinMsg" style="display:block;margin-top:2px;font-size:11px;opacity:.7"></small>
      <label style="display:block;font-size:12px;font-weight:600;margin:8px 0 3px">Repite el PIN nuevo</label>
      <input id="cpr" type="password" inputmode="numeric" autocomplete="new-password" enterkeyhint="done" placeholder="Repite el PIN" style="width:100%" onkeydown="if(event.key=='Enter')saveAccount()">
      <small id="pinMatch" style="display:block;margin-top:2px;font-size:11px;opacity:.7"></small>
    </div>

    <div id="confirmSection" style="display:none;margin-top:10px;padding-top:8px;border-top:1px solid var(--bd)">
      <label style="display:block;font-size:12px;font-weight:600;margin:0 0 3px">Confirma con tu PIN actual</label>
      <input id="cuo" type="password" inputmode="numeric" autocomplete="current-password" placeholder="PIN actual" style="width:100%">
    </div>

    <div style="display:flex;gap:8px;margin-top:14px">
      <button class="gh" id="ac" type="button" style="flex:1">Cancelar</button>
      <button class="go" id="as" type="button" style="flex:1" disabled>Guardar cambios</button>
    </div>
  </div>`;
  m.style.display = 'flex';
  $('#ac').onclick = () => (m.style.display = 'none');

  const toggleUser = $('#toggleUser');
  const togglePin = $('#togglePin');
  const userSection = $('#userSection');
  const pinSection = $('#pinSection');
  const confirmSection = $('#confirmSection');
  const cun = $('#cun');
  const cpn = $('#cpn');
  const cpr = $('#cpr');
  const cuo = $('#cuo');
  const eyeBtn = $('#eyeBtn');
  const pinMsg = $('#pinMsg');
  const pinMatch = $('#pinMatch');
  const userWarn = $('#userWarn');
  const saveBtn = $('#as');

  let showPin = false;
  eyeBtn.onclick = () => {
    showPin = !showPin;
    cpn.type = showPin ? 'text' : 'password';
    cpr.type = showPin ? 'text' : 'password';
    cuo.type = showPin ? 'text' : 'password';
    eyeBtn.textContent = showPin ? '🙈' : '👁';
  };

  function updateState() {
    const nu = (cun.value || '').trim().toLowerCase().replace(/[^a-z0-9_.]/g, '');
    const np = (cpn.value || '').trim();
    const nr = (cpr.value || '').trim();
    const po = (cuo.value || '').trim();
    const changeUser = !!nu && nu !== (S.me ? S.me.user : '');
    const changePin = !!np;

    userWarn.style.display = changeUser ? 'block' : 'none';

    if (np.length > 0) {
      if (!/^\d{6,}$/.test(np)) {
        pinMsg.textContent = 'Mínimo 6 números';
        pinMsg.style.color = 'var(--bad)';
        pinMsg.style.opacity = '1';
      } else {
        pinMsg.textContent = '✓ PIN válido';
        pinMsg.style.color = 'var(--ok)';
        pinMsg.style.opacity = '1';
      }
    } else {
      pinMsg.textContent = '';
    }
    if (nr.length > 0) {
      if (np && nr === np) {
        pinMatch.textContent = '✓ Los PIN coinciden';
        pinMatch.style.color = 'var(--ok)';
        pinMatch.style.opacity = '1';
      } else {
        pinMatch.textContent = 'Los PIN no coinciden';
        pinMatch.style.color = 'var(--bad)';
        pinMatch.style.opacity = '1';
      }
    } else {
      pinMatch.textContent = '';
    }

    const anyChange = changeUser || changePin;
    const pinValid = !changePin || (/^\d{6,}$/.test(np) && np === nr);
    const needsConfirm = anyChange;
    confirmSection.style.display = needsConfirm ? 'block' : 'none';
    saveBtn.disabled = !(anyChange && pinValid && po.length >= 6);
  }

  toggleUser.onclick = () => {
    const open = userSection.style.display === 'none';
    userSection.style.display = open ? 'block' : 'none';
    toggleUser.textContent = open ? 'Cerrar' : 'Cambiar';
    if (open) setTimeout(() => cun.focus(), 50);
    updateState();
  };
  togglePin.onclick = () => {
    const open = pinSection.style.display === 'none';
    pinSection.style.display = open ? 'block' : 'none';
    togglePin.textContent = open ? 'Cerrar' : 'Cambiar';
    if (open) setTimeout(() => cpn.focus(), 50);
    updateState();
  };

  [cun, cpn, cpr, cuo].forEach(el => el.addEventListener('input', updateState));
  updateState();

  cun.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); cpn.focus(); } });
  cpn.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); cpr.focus(); } });
  cpr.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); cuo.focus(); } });
  cuo.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); saveAccount(); } });

  saveBtn.onclick = saveAccount;
}

async function saveAccount() {
  const o = ($('#cuo').value || '').trim();
  const nuRaw = ($('#cun').value || '').trim();
  const np = ($('#cpn').value || '').trim();
  const nr = ($('#cpr').value || '').trim();
  if (!o) return toast('Escribe tu PIN actual');
  const nu = nuRaw ? nuRaw.toLowerCase().replace(/[^a-z0-9_.]/g, '') : '';
  const changeUser = !!nu && nu !== (S.me ? S.me.user : '');
  const changePin = !!np;
  if (!changeUser && !changePin) return toast('Cambia al menos el usuario o el PIN');
  if (changeUser && (!nu || nu.length < 3)) return toast('El usuario debe tener al menos 3 caracteres válidos');
  if (changeUser && S.users.some(x => x.user == nu && x.id !== S.me.id)) return toast('Ese usuario ya existe');
  if (changePin) {
    if (!/^\d{6,}$/.test(np)) return toast('El PIN nuevo debe tener solo números, mínimo 6');
    if (np !== nr) return toast('Los PIN nuevos no coinciden');
    if (np === o) return toast('El PIN nuevo debe ser distinto al actual');
  }
  if (changeUser) {
    const ok = confirm('Al guardar tendrás que entrar de nuevo con "' + nu + '". ¿Continuar?');
    if (!ok) return;
  }
  const b = $('#as');
  b.disabled = true;
  try {
    if (changeUser) await FB.changeUser(o, nu);
    if (changePin) await FB.changePin(o, np);
    $('#modal').style.display = 'none';
    toast('Cuenta actualizada');
    try {
      localStorage.removeItem('tm_v');
    } catch (e) {}
    if (changeUser) await FB.logout();
  } catch (e) {
    b.disabled = false;
    toast(
      ['auth/invalid-credential', 'auth/wrong-password', 'auth/invalid-login-credentials'].includes(e.code)
        ? 'El PIN actual es incorrecto'
        : e.code == 'auth/email-already-in-use'
          ? 'Ese usuario ya existe'
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
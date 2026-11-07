/* Avisos y diálogos básicos: toast, errores, candado anti doble toque y confirmación. */

function toast(t) {
  const e = $('#toast');
  e.textContent = t;
  e.style.display = 'block';
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (e.style.display = 'none'), 2200);
}

const err = e => {
  console.error(e);
  toast(
    e && e.code == 'permission-denied'
      ? 'No se pudo: ya cambió o no tienes permiso'
      : 'Error: ' + ((e && e.message) || e)
  );
};

const lock = k => {
  lock.s = lock.s || {};
  if (lock.s[k]) return false;
  lock.s[k] = 1;
  setTimeout(() => {
    delete lock.s[k];
  }, 4000);
  return true;
};

function ask(msg, fn) {
  const m = $('#modal');
  m.innerHTML = `<div class="card"><p>${esc(msg)}</p><div class="form"><button id="mk">Sí</button><button class="alt" id="mn">Cancelar</button></div></div>`;
  m.style.display = 'flex';
  $('#mn').onclick = () => (m.style.display = 'none');
  $('#mk').onclick = () => {
    m.style.display = 'none';
    fn();
  };
}

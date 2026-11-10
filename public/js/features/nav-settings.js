/* Menú de abajo personalizable del administrador (con arrastrar y soltar). */

/* Menú de abajo personalizable (administrador) */
const NAVALL = {
    res: ['📊', 'Resumen'],
    inv: ['📦', 'Inventario'],
    tr: ['🔁', 'Traspasos'],
    ct: ['🧾', 'Cortes'],
    ap: ['📌', 'Apartados'],
    rp: ['📈', 'Reportes'],
    us: ['👥', 'Usuarios'],
    dv: ['🛵', 'Repartos'],
    aj: ['⚙️', 'Ajustes'],
  },
  NAVDEF = ['res', 'inv', 'tr', 'ct'];

const navSel = () => {
  const a = (S.cfg.anav || NAVDEF).filter((k, i, r) => NAVALL[k] && r.indexOf(k) == i).slice(0, 4);
  return a.length >= 2 ? a : NAVDEF;
};

const navBadge = k =>
  k == 'res'
    ? lowList().length
    : k == 'ap'
      ? preN()
      : k == 'dv'
        ? (S.dv || []).filter(d => d.status == 'pendiente').length
        : k == 'lg'
          ? (S.dv || []).filter(d => d.large && d.status == 'pendiente').length
          : 0;

async function setNav(a) {
  try {
    await db.doc('config/main').set({ anav: a }, { merge: true });
  } catch (e) {
    err(e);
  }
} 

function navOff(i) {
  const a = navSel().slice();
  if (a.length <= 2) return toast('Deja al menos 2 secciones en el menú');
  a.splice(i, 1);
  S.cfg.anav = a;
  renderNow(true);
  setNav(a);
}

function navOn(k) {
  const a = navSel().slice();
  if (a.length >= 4) return toast('Máximo 4. Quita una primero');
  a.push(k);
  S.cfg.anav = a;
  renderNow(true);
  setNav(a);
}

function navTog(k) {
  const i = navSel().indexOf(k);
  i >= 0 ? navOff(i) : navOn(k);
}

function navReset() {
  S.cfg.anav = NAVDEF.slice();
  renderNow(true);
  setNav(NAVDEF.slice());
}

/* Arrastrar y soltar en la vista previa del menú */
function navDrag(e) {
  if (e.button > 0) return;
  const el = e.currentTarget,
    items = [...el.parentNode.querySelectorAll('.nvi')],
    from = items.indexOf(el),
    w = el.getBoundingClientRect().width,
    x0 = e.clientX;
  let cur = from;
  e.preventDefault();
  try {
    el.setPointerCapture(e.pointerId);
  } catch (_) {}
  el.classList.add('drag');
  const mv = ev => {
      const dx = ev.clientX - x0;
      el.style.transform = 'translateX(' + dx + 'px)';
      cur = Math.max(0, Math.min(items.length - 1, from + Math.round(dx / w)));
      items.forEach((o, k) => {
        if (o === el) return;
        o.style.transform =
          from < cur && k > from && k <= cur
            ? 'translateX(' + -w + 'px)'
            : from > cur && k < from && k >= cur
              ? 'translateX(' + w + 'px)'
              : '';
      });
    },
    up = () => {
      el.removeEventListener('pointermove', mv);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      if (cur != from) {
        const a = navSel().slice(),
          [k] = a.splice(from, 1);
        a.splice(cur, 0, k);
        S.cfg.anav = a;
        renderNow(true);
        setNav(a);
      } else {
        items.forEach(o => (o.style.transform = ''));
        el.classList.remove('drag');
      }
    };
  el.addEventListener('pointermove', mv);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
}

function navCard() {
  const a = navSel();
  return `<div class="card"><h3>Menú de abajo</h3><small>Arrastra los botones para cambiar el orden. Toca una sección de abajo para ponerla o quitarla (de 2 a 4).</small>
 <div class="nvp">${a.map(k => `<div class="nvi" role="button" aria-label="${NAVALL[k][1]}: arrastra para mover" onpointerdown="navDrag(event)"><span>${NAVALL[k][0]}</span>${NAVALL[k][1]}</div>`).join('')}<div class="nvi nvm"><span>⋯</span>Más</div></div>
 <div class="form">${Object.keys(NAVALL)
   .map(
     k =>
       `<button class="${a.includes(k) ? '' : 'alt'}" onclick="navTog('${k}')">${a.includes(k) ? '✓ ' : ''}${NAVALL[k][1]}</button>`
   )
   .join('')}</div>
 <div class="form"><button class="gh" onclick="navReset()">Restablecer</button></div></div>`;
}

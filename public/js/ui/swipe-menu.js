/* Deslizar para abrir/cerrar el menú. */

(() => {
  let x0 = 0,
    y0 = 0,
    ok = false;
  const dr = () => document.getElementById('drawer');
  const blocked = e => {
    for (let n = e; n && n !== document.body; n = n.parentElement) {
      if (
        /^(INPUT|SELECT|TEXTAREA)$/.test(n.tagName) ||
        (n.classList && n.classList.contains('nvp'))
      )
        return true;
      const o = getComputedStyle(n).overflowX;
      if ((o == 'auto' || o == 'scroll') && n.scrollWidth > n.clientWidth + 2) return true;
    }
    return false;
  };
  addEventListener(
    'touchstart',
    e => {
      ok = false;
      if (e.touches.length != 1) return;
      const m = document.getElementById('modal');
      if (m && m.style.display === 'flex') return;
      if (!(S.me && document.querySelector('.hb'))) return;
      const t = e.touches[0];
      x0 = t.clientX;
      y0 = t.clientY;
      ok = dr().classList.contains('open') || !blocked(e.target);
    },
    { passive: true }
  );
  addEventListener(
    'touchend',
    e => {
      if (!ok) return;
      ok = false;
      const t = e.changedTouches[0],
        dx = t.clientX - x0,
        dy = t.clientY - y0;
      if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
      const o = dr().classList.contains('open');
      if (!o && dx < 0) menu(1);
      else if (o && dx > 0) menu(0);
    },
    { passive: true }
  );
  addEventListener(
    'touchcancel',
    () => {
      ok = false;
    },
    { passive: true }
  );
})();

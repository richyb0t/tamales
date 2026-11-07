/* Modo claro/oscuro manual: botón luna/sol junto al menú. Sin elegir nada, la app sigue al teléfono. */

(() => {
  const K = 'tm_theme',
    R = document.documentElement,
    Q = matchMedia('(prefers-color-scheme: dark)');
  const get = () => {
    try {
      const v = localStorage.getItem(K);
      return v === 'light' || v === 'dark' ? v : null;
    } catch (e) {
      return null;
    }
  };
  const eff = () => get() || (Q.matches ? 'dark' : 'light');
  const apply = m => {
    R.dataset.theme = m;
    R.style.colorScheme = m;
    document
      .querySelectorAll('meta[name=theme-color]')
      .forEach(x => (x.content = m === 'dark' ? '#181E30' : '#E7EAF3'));
  };
  const SUN =
      'M12 16a4 4 0 100-8 4 4 0 000 8zM12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4',
    MOON = 'M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z';
  const sync = () => {
    const d = eff() === 'dark',
      h = document.querySelector('.top .hb');
    if (!h) return;
    let b = document.querySelector('.top .thb');
    if (!b) {
      h.insertAdjacentHTML(
        'beforebegin',
        '<button type="button" class="thb"><svg viewBox="0 0 24 24" aria-hidden="true"><path></path></svg></button>'
      );
      b = document.querySelector('.top .thb');
    }
    b.setAttribute('aria-label', d ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
    b.firstChild.firstChild.setAttribute('d', d ? SUN : MOON);
  };
  document.addEventListener('click', e => {
    if (!e.target.closest('.thb')) return;
    const m = eff() === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(K, m);
    } catch (x) {}
    apply(m);
    sync();
  });
  const s = get();
  if (s) apply(s);
  const rn = renderNow;
  window.renderNow = function () {
    const r = rn.apply(this, arguments);
    sync();
    return r;
  };
  sync();
})();

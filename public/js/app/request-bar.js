/* Barra flotante «Enviar solicitud». */

/* La barra flotante "Enviar solicitud" solo aparece mientras el botón de la tarjeta todavía no se ve (más abajo) */
(() => {
  const vis = () => {
    const i = $('#rdi'),
      b = $('#rdb');
    if (!i || !b) return;
    b.style.display = i.getBoundingClientRect().top > innerHeight - 76 ? '' : 'none';
  };
  addEventListener('scroll', vis, { passive: true });
  addEventListener('resize', vis);
  const rn = renderNow;
  renderNow = function (f) {
    const x = rn.call(this, f);
    requestAnimationFrame(vis);
    return x;
  };
})();

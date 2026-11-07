/* Animación de entrada del modal: solo al abrirlo, no cuando su contenido se vuelve a pintar. */

(() => {
  const m = document.getElementById('modal');
  if (!m || !window.MutationObserver) return;
  let on = false,
    t = 0;
  new MutationObserver(() => {
    const v = m.style.display === 'flex';
    if (v && !on) {
      m.classList.add('ent');
      clearTimeout(t);
      t = setTimeout(() => m.classList.remove('ent'), 450);
    }
    if (!v) m.classList.remove('ent');
    on = v;
  }).observe(m, { attributes: true, attributeFilter: ['style'] });
})();

/* Aplica el tema guardado antes de pintar para evitar el parpadeo (se carga sin defer). */

try {
  var m = localStorage.getItem('tm_theme');
  if (m === 'light' || m === 'dark') {
    var r = document.documentElement;
    r.dataset.theme = m;
    r.style.colorScheme = m;
  }
} catch (e) {}

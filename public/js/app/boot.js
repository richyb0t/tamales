/* Arranque: espera a Firebase, abre la sesión y programa los refrescos periódicos. */

(async () => {
  for (let i = 0; i < 150 && !window.FB; i++) await new Promise(r => setTimeout(r, 100));
  if (!window.FB) {
    $('#app').innerHTML =
      '<p class="mut" style="padding:24px">No se pudo cargar Firebase. Revisa tu conexión.</p>';
    return;
  }
  db = FB.db;
  FB.onAuth(onUser);
  setInterval(() => {
    if (day() !== D) location.reload();
  }, 60000);
  setInterval(() => {
    if (S.me && ((S.rq || []).length || S.sales.some(x => x.exp))) render();
  }, 30000);
})();

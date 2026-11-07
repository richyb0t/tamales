/* Ojito para mostrar/ocultar el PIN en todos los campos de contraseña. */

/* Ojito para mostrar/ocultar el PIN en todos los campos de contraseña */
(() => {
  const E =
      '<svg viewBox="0 0 24 24"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    X =
      '<svg viewBox="0 0 24 24"><path d="M17.9 17.9A10.9 10.9 0 0 1 12 19C5 19 1 12 1 12a18 18 0 0 1 5.1-5.9M9.9 5.1A10 10 0 0 1 12 5c7 0 11 7 11 7a18 18 0 0 1-2.2 3.2M14.1 14.1a3 3 0 1 1-4.2-4.2M1 1l22 22"/></svg>';
  const wrap = i => {
    i.dataset.pw = 1;
    const f = document.activeElement === i,
      w = document.createElement('span'),
      b = document.createElement('button');
    w.className = 'pw';
    i.parentNode.insertBefore(w, i);
    w.appendChild(i);
    b.type = 'button';
    b.className = 'eye';
    b.tabIndex = -1;
    b.setAttribute('aria-label', 'Mostrar PIN');
    b.innerHTML = E;
    b.onpointerdown = e => e.preventDefault();
    b.onclick = () => {
      const v = i.type == 'password';
      i.type = v ? 'text' : 'password';
      b.innerHTML = v ? X : E;
      b.setAttribute('aria-label', v ? 'Ocultar PIN' : 'Mostrar PIN');
    };
    w.appendChild(b);
    if (f) i.focus();
  };
  const scan = () => document.querySelectorAll('input[type=password]:not([data-pw])').forEach(wrap);
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  scan();
})();

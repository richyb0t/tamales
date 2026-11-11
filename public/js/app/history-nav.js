/* Botón «atrás» del celular: regresa a la pantalla anterior, cierra menú/diálogo y no sale de la app. */

(() => {
  let nid = 0,
    nuid = null,
    skip = 0,
    exitT = 0;
  const curKey = () => {
    const m = S.me;
    return !m
      ? ''
      : m.role == 'admin'
        ? 'a:' + (S.tab || 'res')
        : m.role == 'vend'
          ? 'v:' + (S.vt || 'v')
          : m.role == 'rep'
            ? 'e:' + (S.rt || 'e')
            : 'e';
  };
  const isOpen = o =>
    o == 'm'
      ? $('#modal').style.display == 'flex'
      : o == 'd'
        ? $('#drawer').classList.contains('open')
        : false;
  const pushView = k => {
    if (!nid || k === curKey()) return;
    const st = history.state || {};
    /* si encima hay un menú/diálogo que ya se cerró, su entrada se reemplaza en vez de apilar otra */
    if (st.o && !isOpen(st.o)) history.replaceState({ k, s: nid }, '');
    else {
      /* guarda dónde estaba la pantalla actual para regresar ahí con el botón Atrás */
      history.replaceState({ ...st, y: scrollY }, '');
      history.pushState({ k, s: nid }, '');
    }
  };
  const sT = setTab,
    sV = setVt,
    sR = setRt;
  setTab = t => {
    pushView('a:' + t);
    sT(t);
  };
  setVt = t => {
    pushView('v:' + t);
    sV(t);
  };
  setRt = t => {
    pushView('e:' + t);
    sR(t);
  };
  const applyView = k => {
    const m = S.me;
    if (!m) return;
    const p = k.split(':'),
      v = p[1];
    if (p[0] == 'a' && m.role == 'admin') sT(v);
    else if (p[0] == 'v' && m.role == 'vend') sV(v);
    else if (p[0] == 'e' && m.role == 'rep') {
      S.rt = v;
      renderNow(true);
    }
    else return;
  };
  /* al iniciar sesión se arma el historial: [tope] + [pantalla inicial] */
  const rn = renderNow;
  renderNow = function (f) {
    if (S.me && S.me.id !== nuid) {
      nuid = S.me.id;
      nid = Date.now();
      history.replaceState({ g: 1, s: nid }, '');
      history.pushState({ k: curKey(), s: nid }, '');
    } else if (!S.fu && nuid) {
      nuid = null;
      nid = 0;
    }
    return rn.call(this, f);
  };
  /* menú lateral y diálogos: cada uno ocupa una entrada del historial mientras está abierto */
  const watch = (el, o, attr) => {
    let was = false;
    new MutationObserver(() => {
      const v = isOpen(o);
      if (v && !was) {
        was = true;
        if (nid) {
          history.replaceState({ ...(history.state || {}), y: scrollY }, '');
          history.pushState({ o, s: nid }, '');
        }
      } else if (!v && was) {
        was = false;
        if ((history.state || {}).o == o) {
          skip++;
          history.back();
        }
      }
    }).observe(el, { attributes: true, attributeFilter: [attr] });
  };
  watch($('#modal'), 'm', 'style');
  watch($('#drawer'), 'd', 'class');
  addEventListener('popstate', e => {
    if (skip) {
      skip--;
      return;
    }
    const st = e.state || {};
    if (!nid) return;
    if (st.s !== nid) {
      history.back();
      return;
    }
    if (st.g) {
      if (exitT) {
        history.back();
        return;
      }
      toast('Presiona otra vez para salir');
      exitT = setTimeout(() => (exitT = 0), 2000);
      history.pushState({ k: curKey(), s: nid }, '');
      return;
    }
    const wantM = st.o == 'm',
      wantD = st.o == 'd' || st.o == 'm';
    if (isOpen('m') && !wantM) $('#modal').style.display = 'none';
    if (isOpen('d') && !wantD) menu(0);
    if (st.o && !isOpen(st.o)) {
      history.back();
      return;
    }
    if (st.k && st.k !== curKey()) applyView(st.k);
    /* al regresar, vuelve a la posición donde estaba esa pantalla */
    if (typeof st.y == 'number') requestAnimationFrame(() => scrollTo(0, st.y));
  });
})();

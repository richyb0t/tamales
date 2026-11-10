/* Guarda en el dispositivo la pantalla actual para recuperarla al recargar. */

(() => {
  const rn = renderNow;
  renderNow = function (f) {
    const x = rn.call(this, f);
    try {
      if (S.me) {
        const j = JSON.stringify({
          id: S.me.id,
          tab: S.tab,
          vt: S.vt,
          et: S.et,
          rt: S.rt,
          apt: S.apt,
          apb: S.apb,
          ib: S.ib,
          cart: S.cart,
          alHide: S.alHide,
        });
        if (j !== vSig) {
          vSig = j;
          localStorage.setItem('tm_v', j);
        }
      }
    } catch (e) {}
    return x;
  };
})();

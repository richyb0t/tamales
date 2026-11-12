/* Bitácora de anulaciones y cancelaciones. */

/* Bitácora de anulaciones y cancelaciones: la ve el administrador en "Ver movimientos" de cada sucursal */
const logD = o => {
  const d = { day: D, by: S.me.user, byName: S.me.name, ts: Date.now(), ...o };
  Object.keys(d).forEach(k => d[k] == null && delete d[k]);
  return d;
};

function logEv(o) {
  if (!S.me) return;
  try {
    Promise.resolve(db.collection('logs').add(logD(o), true)).catch(e => console.warn('logs', e));
  } catch (e) {
    console.warn('logs', e);
  }
}

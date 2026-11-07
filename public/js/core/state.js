/* Estado global de la app (S) y referencia a la base de datos (db). */

let db = null,
  pend = false,
  S = {
    users: [],
    pre: [],
    cfg: {},
    loads: {},
    sales: [],
    tr: [],
    claims: [],
    clOk: false,
    cfgOk: false,
    cart: {},
    me: null,
    tab: 'res',
    ib: 0,
    tf: 0,
    tt: 1,
    qty: 1,
    ru: false,
  };

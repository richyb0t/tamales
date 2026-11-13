/* Sesión y suscripciones en tiempo real a Firestore; recuperación de la pantalla al recargar. */

let pu = null,
  subs = [],
  subKey = '';

function stopSubs() {
  subs.forEach(f => f());
  subs = [];
  subKey = '';
}

function onUser(u) {
  S.au = true;
  S.fu = u;
  if (u) profOff();
  if (pu) {
    pu();
    pu = null;
  }
  stopSubs();
  stopClaims();
  S.me = null;
  S.pf = false;
  S.cart = {};
  S.vt = 'v';
  S.rt = 'e';
  S.q = '';
  S.alHide = true;
  if (u) vRest = false;
  restoreView(u);
  if (u) {
    S.alHide = true;
    S.lgHide = true;
  }
  if (!u) {
    S.lp = null;
    S.lr = null;
    S.lm = false;
    /* Si este teléfono fue de repartidor, apaga el push al quedar en la pantalla de entrada. */
    if (typeof clearPushTag === 'function') clearPushTag(true);
    profSub();
    FB.initExists()
      .then(x => {
        S.setup = !x;
        renderNow(true);
      })
      .catch(() => {
        S.setup = false;
        renderNow(true);
      });
    return;
  }
  pu = db.doc('users/' + u.uid).onSnapshot(d => {
    const x = d.data();
    const ROLES = ['admin', 'sup', 'vend', 'enc', 'rep'];
    if (!d.exists() || x.active === false || !ROLES.includes(x.role)) {
      S.me = null;
      S.pf = true;
      stopSubs();
      stopClaims();
      if (typeof clearPushTag === 'function') clearPushTag(true);
    } else {
      S.me = { id: u.uid, ...x };
      if (S.me.role == 'vend') {
        S.me.placed = x.brDay === day() && x.branch != null;
        if (!S.me.placed) S.me.branch = null;
      } else S.me.branch = null;
      try {
        _lastDay = day();
      } catch (e) {}
      startSubs();
    }
    renderNow(true);
  }, err);
}

function startSubs() {
  const m = S.me,
    M = m.role == 'vend',
    rd = !M || vendReady(),
    b = m.branch,
    k = m.role + '|' + (M ? (rd ? b : 'pick') : '');
  if (k == subKey) return;
  stopSubs();
  subKey = k;
  S.loads = {};
  S.loadBy = {};
  S.loadTs = {};
  S.sales = [];
  S.tr = [];
  S.cuts = [];
  subCuts();
  subs.push(() => {
    if (cutUn) {
      cutUn();
      cutUn = null;
    }
  });
  S.csales = null;
  subCSales();
  subs.push(() => {
    if (csUn) {
      csUn();
      csUn = null;
    }
  });
  const L = (c, f, v) => {
    let q = db.collection(c).where('day', '==', D);
    return v != null ? q.where(f, '==', v) : q;
  };
  subs.push(
    db.doc('config/main').onSnapshot(d => {
      S.cfg = d.data() || {};
      if (Array.isArray(S.cfg.flavors) && S.cfg.flavors.length) F = S.cfg.flavors.slice();
      S.cfgOk = true;
      render();
    }, err)
  );
  if (m.role != 'enc' && m.role != 'rep') subClaims();
  if (m.role != 'vend' || rd) subDv();
  if (m.role == 'rep') {
    render();
    if (typeof initFcm === 'function') initFcm();
    if (typeof initOnesignal === 'function') initOnesignal();
    return;
  } /* el repartidor solo necesita configuración y repartos */
  /* Si este teléfono fue de repartidor, quita la etiqueta al entrar otro rol. */
  if (typeof clearPushTag === 'function') clearPushTag();
  if (!rd) {
    render();
    return;
  } /* vendedor sin sucursal hoy: solo necesita la lista de sucursales y quién está en cada una */
  if (m.role == 'admin' || m.role == 'sup') {
    S.pr = null;
    S.psig = '';
    subs.push(
      db.collection('users').onSnapshot(q => {
        S.users = q.docs.map(d => ({ id: d.id, ...d.data() }));
        syncProf();
        render();
      }, err)
    );
    subs.push(
      db.collection('profiles').onSnapshot(
        q => {
          S.pr = {};
          q.docs.forEach(d => (S.pr[d.id] = d.data()));
          syncProf();
        },
        e => console.warn('profiles', e)
      )
    );
  }
  S.lg = [];
  if (m.role == 'admin')
    subs.push(
      L('logs').onSnapshot(
        q => {
          S.lg = q.docs.map(d => ({ _id: d.id, ...d.data() }));
          render();
        },
        e => console.warn('logs', e)
      )
    );
  subs.push(
    L('loads', 'branch', M ? b : null).onSnapshot(q => {
      S.loads = {};
      S.loadBy = {};
      S.loadTs = {};
      q.docs.forEach(d => {
        const x = d.data();
        S.loads[x.branch] = x.q || {};
        S.loadBy[x.branch] = x.byName || x.by || '';
        S.loadTs[x.branch] = x.ts || 0;
      });
      render();
    }, err)
  );
  subs.push(
    L('sales', 'branch', M ? b : null).onSnapshot(q => {
      S.sales = q.docs.map(d => ({ _id: d.id, ...d.data() }));
      render();
    }, err)
  );
  if (M) {
    let A = [],
      B = [];
    const mg = () => {
      const o = {};
      [...A, ...B].forEach(t => (o[t._id] = t));
      S.tr = Object.values(o);
      render();
    };
    subs.push(
      L('transfers', 'from', b).onSnapshot(q => {
        A = q.docs.map(d => ({ _id: d.id, ...d.data() }));
        mg();
      }, err)
    );
    subs.push(
      L('transfers', 'to', b).onSnapshot(q => {
        B = q.docs.map(d => ({ _id: d.id, ...d.data() }));
        mg();
      }, err)
    );
  } else
    subs.push(
      L('transfers').onSnapshot(q => {
        S.tr = q.docs.map(d => ({ _id: d.id, ...d.data() }));
        render();
      }, err)
    );
  S.pre = [];
  let _preSig = '';
  subs.push(
    (M
      ? db.collection('pre').where('branch', '==', b).where('status', '==', 'pendiente')
      : db.collection('pre').where('status', '==', 'pendiente')
    ).onSnapshot(q => {
      const next = q.docs.map(d => ({ _id: d.id, ...d.data() }));
      const sig = JSON.stringify(next.map(p => p._id + '|' + (p.ts || 0)));
      if (sig === _preSig) return;
      _preSig = sig;
      S.pre = next;
      render();
    }, err)
  );
  S.rq = [];
  S.stock = {};
  S.rqPrev = null;
  S.alAfter = Date.now() + 8000;
  S.alSeen = null;
  subReqs(m, M, b);
  if (M) subs.push(() => stockOff());
}

/* Repartos del día (administrador, pedidos y repartidor) */
function subDv() {
  S.dv = [];
  const m = S.me;
  if (m && m.role == 'vend' && m.branch != null) {
    /* El vendedor ve los repartos que salen de su sucursal y también aquellos
       donde su sucursal es una parada secundaria. Se unen por _id. */
    const part = { main: [], extra: [] };
    const merge = () => {
      const by = new Map();
      part.main.concat(part.extra).forEach(d => by.set(d._id, d));
      S.dv = [...by.values()];
      render();
    };
    subs.push(
      db
        .collection('deliveries')
        .where('day', '==', D)
        .where('branch', '==', m.branch)
        .onSnapshot(
          qq => {
            part.main = qq.docs.map(d => ({ _id: d.id, ...d.data() }));
            merge();
          },
          err
        )
    );
    subs.push(
      db
        .collection('deliveries')
        .where('day', '==', D)
        .where('branches', 'array-contains', m.branch)
        .onSnapshot(
          qq => {
            part.extra = qq.docs.map(d => ({ _id: d.id, ...d.data() }));
            merge();
          },
          e => console.warn('deliveries sucursales', e)
        )
    );
  } else {
    subs.push(
      db.collection('deliveries').where('day', '==', D).onSnapshot(
        qq => {
          S.dv = qq.docs.map(d => ({ _id: d.id, ...d.data() }));
          if (S.me && S.me.role == 'rep' && typeof notifyNewDv === 'function') notifyNewDv();
          render();
        },
        err
      )
    );
  }
  /* Repartos de AYER sin cumplir: siguen pendientes o en ruta y su día ya pasó.
     Solo se muestra el día anterior para no acumular historial. */
  if (m && (m.role == 'admin' || m.role == 'sup' || m.role == 'enc')) {
    S.dvOld = [];
    subs.push(
      db.collection('deliveries').where('day', '==', tmr(-1)).onSnapshot(
        qq => {
          S.dvOld = qq.docs
            .map(d => ({ _id: d.id, ...d.data() }))
            .filter(d => d.status == 'pendiente' || d.status == 'en_ruta');
          render();
        },
        err
      )
    );
  }
}

let vRest = false,
  vSig = '';

function restoreView(u) {
  if (!u || vRest) return;
  vRest = true;
  try {
    const x = JSON.parse(localStorage.getItem('tm_v') || 'null');
    if (!x || x.id !== u.uid) return;
    if (['res', 'inv', 'tr', 'ct', 'aj', 'us', 'ap', 'rp', 'dv'].includes(x.tab)) S.tab = x.tab;
    if (['v', 'h', 'r', 'm'].includes(x.vt)) S.vt = x.vt;
    if (['d', 'a', 'r'].includes(x.et)) S.et = x.et;
    if (['e', 'c', 't'].includes(x.rt)) S.rt = x.rt;
    if (['h', 'o', 's'].includes(x.apt)) S.apt = x.apt;
    if (Number.isInteger(x.apb)) S.apb = x.apb;
    if (Number.isInteger(x.ib)) S.ib = x.ib;
  if (x.cart && typeof x.cart === 'object') S.cart = x.cart;
  if (typeof x.alHide === 'boolean') S.alHide = x.alHide;
  if (typeof x.dvOldHide === 'boolean') S.dvOldHide = x.dvOldHide;
    if (S.vt == 'r') stockOn();
  } catch (e) {}
}
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
  S.q = '';
  S.alHide = false;
  restoreView(u);
  if (!u) {
    S.lp = null;
    S.lr = null;
    S.lm = false;
    profSub();
    FB.initExists()
      .then(x => {
        S.setup = !x;
        render(true);
      })
      .catch(() => {
        S.setup = false;
        render(true);
      });
    return;
  }
  pu = db.doc('users/' + u.uid).onSnapshot(d => {
    const x = d.data();
    if (!d.exists() || x.active === false) {
      S.me = null;
      S.pf = true;
      stopSubs();
      stopClaims();
    } else {
      S.me = { id: u.uid, ...x };
      if (S.me.role == 'vend') {
        S.me.placed = x.brDay === day() && x.branch != null;
        if (!S.me.placed) S.me.branch = null;
      } else S.me.branch = null;
      startSubs();
    }
    render(true);
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
      S.cfgOk = true;
      render();
    }, err)
  );
  if (m.role != 'enc') subClaims();
  if (!rd) {
    render();
    return;
  } /* vendedor sin sucursal hoy: solo necesita la lista de sucursales y quién está en cada una */
  if (m.role == 'admin') {
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
      q.docs.forEach(d => {
        const x = d.data();
        S.loads[x.branch] = x.q || {};
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
  subs.push(
    (M
      ? db.collection('pre').where('branch', '==', b).where('status', '==', 'pendiente')
      : db.collection('pre').where('status', '==', 'pendiente')
    ).onSnapshot(q => {
      S.pre = q.docs.map(d => ({ _id: d.id, ...d.data() }));
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

let vRest = false,
  vSig = '';

function restoreView(u) {
  if (!u || vRest) return;
  vRest = true;
  try {
    const x = JSON.parse(localStorage.getItem('tm_v') || 'null');
    if (!x || x.id !== u.uid) return;
    if (['res', 'inv', 'tr', 'ct', 'aj', 'us', 'ap', 'rp'].includes(x.tab)) S.tab = x.tab;
    if (['v', 'h', 'r', 'm'].includes(x.vt)) S.vt = x.vt;
    if (['d', 'a'].includes(x.et)) S.et = x.et;
    if (['h', 'o', 's'].includes(x.apt)) S.apt = x.apt;
    if (Number.isInteger(x.apb)) S.apb = x.apb;
    if (Number.isInteger(x.ib)) S.ib = x.ib;
    if (S.vt == 'r') stockOn();
  } catch (e) {}
}

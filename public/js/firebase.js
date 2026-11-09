/* Firebase (módulo ES): inicializa la app y expone window.FB con auth, Firestore y funciones. */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  reauthenticateWithCredential,
  EmailAuthProvider,
  updatePassword,
  updateEmail,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  writeBatch,
  runTransaction,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import {
  getFunctions,
  httpsCallable,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-functions.js';
const cfg = {
  apiKey: 'AIzaSyCipjbj_Sy2t5hZYR6a-ctGzP8tUodmpz0',
  authDomain: 'tamalescastro-ca1bf.firebaseapp.com',
  projectId: 'tamalescastro-ca1bf',
  storageBucket: 'tamalescastro-ca1bf.firebasestorage.app',
  messagingSenderId: '122126152237',
  appId: '1:122126152237:web:1e5d68e0ee2793aa42fea4',
};
const app = initializeApp(cfg),
  auth = getAuth(app);
const fs = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
/* Sin internet las escrituras quedan en el celular y se suben solas: no esperamos la confirmación del servidor, pero sí vemos errores de permisos */
let np = 0;
const pb = () => window.dispatchEvent(new CustomEvent('wp', { detail: np }));
const W = p => {
  np++;
  pb();
  let d = 0;
  const r = Promise.race([p, new Promise(x => setTimeout(x, 1500))]);
  r.then(
    () => (d = 1),
    () => (d = 1)
  );
  p.then(
    () => {
      np--;
      pb();
    },
    e => {
      np--;
      pb();
      d = 1;
      window.dispatchEvent(new CustomEvent('werr', { detail: e }));
    }
  );
  return r;
};
const C = (p, w = []) => ({
  where: (f, o, v) => C(p, [...w, where(f, o, v)]),
  onSnapshot: (n, e) =>
    onSnapshot(w.length ? query(collection(fs, p), ...w) : collection(fs, p), n, e),
  add: d => W(addDoc(collection(fs, p), d)),
  get: () => getDocs(w.length ? query(collection(fs, p), ...w) : collection(fs, p)),
});
const db = {
  collection: p => C(p),
  doc: p => ({
    set: (d, o) => W(o ? setDoc(doc(fs, p), d, o) : setDoc(doc(fs, p), d)),
    update: d => W(updateDoc(doc(fs, p), d)),
    delete: () => W(deleteDoc(doc(fs, p))),
    get: () => getDoc(doc(fs, p)),
    onSnapshot: (n, e) => onSnapshot(doc(fs, p), n, e),
  }),
  batch: () => {
    const b = writeBatch(fs),
      o = {
        set: (p, d) => (b.set(doc(fs, p), d), o),
        delete: p => (b.delete(doc(fs, p)), o),
        update: (p, d) => (b.update(doc(fs, p), d), o),
        add: (c, d) => (b.set(doc(collection(fs, c)), d), o),
        commit: () => W(b.commit()),
      };
    return o;
  },
  /* Toma atómica: solo pasa de «pendiente» a «en_ruta» si nadie más la tomó */
  takeDelivery: (id, user, name) => {
    const ref = doc(fs, 'deliveries/' + id);
    return runTransaction(fs, async tx => {
      const snap = await tx.get(ref);
      const d = snap.exists() ? snap.data() : null;
      if (!d || d.status != 'pendiente' || d.drv) {
        const e = new Error('taken');
        e.code = 'taken';
        throw e;
      }
      tx.update(ref, {
        status: 'en_ruta',
        drv: user,
        drvName: name,
        tsTake: Date.now(),
      });
    });
  },
};
let sa;
window.FB = {
  db,
  call: (n, d) => httpsCallable(getFunctions(app), n)(d).then(r => r.data),
  login: (e, p) => signInWithEmailAndPassword(auth, e, p),
  async changePin(o, n) {
    const u = auth.currentUser;
    await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, o));
    await updatePassword(u, n);
  },
  async verifyPin(pin) {
    const u = auth.currentUser;
    await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, pin));
    return true;
  },
  async changeUser(o, n) {
    const u = auth.currentUser;
    const nu = n.trim().toLowerCase().replace(/[^a-z0-9_.]/g, '');
    if (!nu) throw { code: 'invalid-user' };
    await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, o));
    await updateEmail(u, mail(nu));
    await setDoc(doc(fs, 'users/' + u.uid), { user: nu }, { merge: true });
    await setDoc(doc(fs, 'profiles/' + u.uid), { user: nu }, { merge: true });
    return nu;
  },
  logout: () => signOut(auth),
  onAuth: f => onAuthStateChanged(auth, f),
  initExists: async () => (await getDoc(doc(fs, 'config/init'))).exists(),
  async bootstrap(e, p, prof) {
    const c = await createUserWithEmailAndPassword(auth, e, p),
      b = writeBatch(fs);
    b.set(doc(fs, 'users/' + c.user.uid), prof);
    b.set(doc(fs, 'config/init'), { at: Date.now() });
    await b.commit();
  },
  async newUser(e, p, prof) {
    sa = sa || initializeApp(cfg, 'sec');
    const sx = getAuth(sa);
    try {
      let c;
      try {
        c = await createUserWithEmailAndPassword(sx, e, p);
      } catch (x) {
        if (x.code != 'auth/email-already-in-use') throw x;
        try {
          c = await signInWithEmailAndPassword(sx, e, p);
        } catch (y) {
          throw { code: 'old-user' };
        }
      }
      await setDoc(doc(fs, 'users/' + c.user.uid), prof);
    } finally {
      await signOut(sx);
    }
  },
};

const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { setGlobalOptions } = require('firebase-functions/v2');

initializeApp();

// Safeguards: limit concurrency to avoid runaway invocations.
setGlobalOptions({ maxInstances: 1 });

exports.sendDeliveryNotification = onDocumentCreated(
  { document: 'deliveries/{deliveryId}', region: 'us-central1' },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const d = snap.data();
    if (!d || d.status !== 'pendiente') return;

    const db = getFirestore();
    const cfgSnap = await db.doc('config/notifications').get();
    if (!cfgSnap.exists || cfgSnap.data().enabled !== true) return;

    const usersSnap = await db.collection('users').where('role', '==', 'rep').get();
    const tokens = [];
    usersSnap.forEach(u => {
      const t = u.data().fcmToken;
      if (t) tokens.push(t);
    });
    if (!tokens.length) return;

    const title = d.large ? 'Nuevo pedido grande' : 'Nuevo reparto';
    const body = (d.client || 'Cliente') + (d.addr ? ' · ' + d.addr : '') + ' · $' + Number(d.total || 0).toFixed(2);

    try {
      await getMessaging().sendEachForMulticast({
        tokens,
        notification: { title, body },
        data: { deliveryId: event.params.deliveryId, large: String(!!d.large) },
      });
    } catch (e) {
      console.error('FCM send error', e);
    }
  }
);

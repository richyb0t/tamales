const fs = require('fs');
const p = 'public/js/features/deliveries.js';
let s = fs.readFileSync(p, 'utf8');
const old1 = "    (typeof Notification !== 'undefined' && Notification.permission !== 'granted'\r\n      ? `<div class=\"card\"><button class=\"go\" style=\"width:100%\" onclick=\"enableNotif()\">🔔 Activar notificaciones</button><small>Para recibir pedidos grandes aunque la app esté en segundo plano.</small></div>`\r\n      : '') +";
const new1 = "    (typeof Notification !== 'undefined' && Notification.permission !== 'granted'\r\n      ? `<div class=\"card\"><button class=\"go\" style=\"width:100%\" onclick=\"enableNotif()\">🔔 Activar notificaciones</button><small>Para recibir pedidos grandes aunque la app esté en segundo plano.</small></div>`\r\n      : Notification.permission === 'denied'\r\n      ? `<div class=\"card\"><small class=\"bad\">Notificaciones bloqueadas. Actívalas en la configuración del navegador.</small></div>`\r\n      : '') +";
if (!s.includes(old1)) { console.log('NOT FOUND'); process.exit(1); }
s = s.replace(old1, new1);
fs.writeFileSync(p, s);
console.log('ok');

# Push real con Cloudflare Worker + OneSignal

La app crea el reparto → llama a este Worker → el Worker llama a OneSignal → el celular
del repartidor recibe el push **aunque la app esté cerrada**.

La REST key de OneSignal se guarda como secreto del Worker, nunca en el navegador.
La petición se autoriza con el token de Firebase del usuario que crea el reparto.

## 1. Crear cuenta y entrar a Cloudflare

1. Crea una cuenta gratis en https://dash.cloudflare.com (no pide tarjeta).
2. En la terminal, desde la carpeta `worker/`:

```bash
cd worker
npx wrangler login
```

Se abre el navegador; autoriza el acceso.

## 2. Guardar los secretos

```bash
npx wrangler secret put ONESIGNAL_APP_ID
npx wrangler secret put ONESIGNAL_REST_KEY
```

- `ONESIGNAL_APP_ID`: `48fb9d48-43ac-485c-b399-a08b9557a0f7`
- `ONESIGNAL_REST_KEY`: la que está en **Ajustes → OneSignal** de la app
  (o en el dashboard de OneSignal → Settings → Keys & IDs).

No hace falta `APP_SECRET`: el Worker valida el token de Firebase.

## 3. Desplegar

```bash
npx wrangler deploy
```

Copia la URL que imprime, por ejemplo:

```
https://tamales-push.tu-usuario.workers.dev
```

## 4. Conectar la app

Edita `public/js/core/constants.js`:

```js
const PUSH_URL = 'https://tamales-push.tu-usuario.workers.dev';
```

Y despliega:

```bash
firebase deploy --only hosting
```

## 5. Probar

1. En el celular del repartidor: abre la app, inicia sesión y toca
   **🔔 Activar notificaciones** → Permitir.
2. En el dashboard de OneSignal → Audience → Subscriptions, debe aparecer
   una suscripción con la etiqueta `role = rep`.
3. Desde la PC (admin o encargado) crea un reparto.
4. El celular debe recibir el push aunque la app esté cerrada.

Prueba manual con curl (el token se obtiene en la consola del navegador con
`await S.fu.getIdToken()`):

```bash
curl -X POST "https://tamales-push.tu-usuario.workers.dev" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN_DE_FIREBASE" \
  -d '{"title":"Prueba","body":"Hola desde el Worker"}'
```

## Notas

- El plan gratis de Cloudflare Workers incluye ~100,000 peticiones/día.
- El plan gratis de OneSignal cubre un equipo pequeño (revisa el límite actual
  de suscriptores web push).
- Si el dispositivo que crea el reparto está sin internet, no se dispara el aviso.
- En iPhone, la PWA debe estar instalada en la pantalla de inicio (iOS 16.4+).
- Cuando confirmes que funciona, puedes borrar la REST key de `config/onesignal`
  en Firestore: ya no se necesita en el cliente.

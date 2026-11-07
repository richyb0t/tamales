# Tamales · Control de sucursales

PWA (Firebase Hosting + Firestore + Auth). Ventas, inventario, apartados, traspasos y cortes de caja por sucursal.

## Estructura

```
.firebaserc  firebase.json  firestore.rules
public/
  index.html            solo marcado + carga de CSS/JS
  manifest.json  sw.js  service worker (v7)
  icons/                íconos PWA
  css/                  tokens → base → controls → surfaces → shell → overlays → login → sales → admin → orders → motion → responsive
  js/
    boot/               tema guardado (se carga sin defer, evita parpadeo)
    core/               constantes, utilidades, estado, render, sesión
    domain/             reglas de inventario
    features/           un archivo por funcionalidad (ventas, apartados, cortes, traspasos, usuarios…)
    reports/            reportes y gráficas
    ui/                 navegación, pantallas por rol, capa visual, tema
    app/                eventos globales, botón atrás, boot
    firebase.js         módulo ES que expone window.FB
```

**Orden de carga.** Los scripts son clásicos con `defer` y comparten ámbito global (los `onclick` del HTML
generado llaman a esas funciones). El orden en `index.html` importa: los archivos de `app/` envuelven
`renderNow`, `setTab` y `setVt` en el mismo orden que tenía el archivo original, y `firebase.js` va al final.
Las hojas CSS también van en orden de cascada.

## Comandos

```
npm install
npm run lint           # ESLint (los globales compartidos se calculan solos)
npm run format         # Prettier
firebase deploy
```

Al cambiar archivos de `public/`, sube `CACHE_VERSION` en `sw.js` y agrega los archivos nuevos a `PRECACHE`.

## Pendiente (fuera de este alcance)

- Las Cloud Functions `deleteUser` y `resetPin` que usa la app no venían en el proyecto.
- Siguiente paso natural: pasar a módulos ES y delegación de eventos en lugar de `onclick` en texto.

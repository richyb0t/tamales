# Análisis profesional del programa "Tamales"

## 1. Resumen ejecutivo

Aplicación PWA (vanilla JS + Firebase Hosting/Firestore) para control de sucursales de una taquería: inventario diario, ventas, apartados, traspasos, cortes de caja, pedidos a domicilio (repartos), solicitudes entre sucursales, reportes y administración de usuarios. Roles: admin, vendedor, pedidos (enc), repartidor.

El código es funcional y la mayoría de las reglas de negocio están bien resueltas (reservas de inventario, transacciones atómicas de repartos, bloqueo de precios, etc.). Sin embargo, como tester profesional identifiqué **fallas reales** en concurrencia, integridad de datos, reglas de seguridad y UX, además de **oportunidades de mejora**.

---

## 2. Arquitectura

- **Frontend**: HTML + CSS + JS vanilla (sin framework). Scripts globales no-módulo, cargados por `index.html`.
- **Backend**: Firebase Firestore + Auth + Hosting. Reglas en `firestore.rules`.
- **Estado**: objeto global `S` en `state.js`, suscripciones realtime en `session.js`.
- **PWA**: Service Worker (`sw.js`) con caché versionado (`CACHE_VERSION`).
- **Roles**: admin, vend, enc, rep. Vendedor elige sucursal diaria (`branch-claim.js`).

---

## 3. Fallas encontradas (bugs / riesgos)

### 🔴 Críticas

1. **`render(true)` es asíncrono (setTimeout 16ms) — scroll y foco se pierden.**
   - `core/render.js:6-15`. Cualquier código que llame `render(true)` y luego manipule el DOM (scroll, focus) falla porque el pintado aún no ocurrió. Ya se corrigió parcialmente en entregas usando `renderNow(true)`, pero otras funciones (`dvSave`, `dvGeocode`, `dvToggle` en otros módulos) aún usan `render(true)` + manipulación inmediata. Riesgo: foco perdido, scroll no aplicado.
   - **Impacto**: UX inconsistente.

2. **Inventario puede quedar negativo (tamales).**
   - `domain/inventory.js:83-86`: `left()` para tamales no aplica `Math.max(0, …)` (solo champurrado lo hace). Si se vende más de lo cargado, `left` queda negativo. Reportes y alertas se vuelven inconsistentes.
   - **Impacto**: datos de disponibilidad incorrectos.

3. **Apartados caducados no liberan inventario en `left()`.**
   - `used()` excluye apartados con `exp < Date.now()` (línea 34), pero `resv()` (línea 72-75) cuenta todos los apartados pendientes sin considerar `exp`. Resultado: un apartado vencido sigue restando del inventario disponible. Inconsistencia entre `used` y `resv`.
   - **Impacto**: disponibilidad subestimada.

4. **`dvResv()` cuenta entregados y en-camino para siempre (hasta cambio de día).**
   - `domain/inventory.js:78-81`: filtra solo `cancelado/fallido`. Los entregados siguen reservando. Correcto para no revender, pero si un pedido se marca fallido, se libera. Bien. Sin embargo, si un pedido se **elimina** (cancelado por Pedidos), se borra el doc → libera. Bien. Pero un pedido `fallido` libera stock aunque el repartidor ya lo sacó de la sucursal (stock físico ya se fue). Esto puede causar sobreventa. Considerar: fallido no debería devolver stock automáticamente (el tamal se perdió).

5. **Reglas de Firestore: `config/{doc}` write solo admin.** Correcto. Pero `profiles` read es `true` (público). Expone nombres/usuarios/roles a cualquiera con la API key. Riesgo de privacidad bajo (datos mínimos), pero conviene restringir a `ok()`.

6. **`W()` (firebase.js) oculta errores de permiso por hasta 1.5s y solo los reporta si `d==1`.**
   - `firebase.js:52-73`. Si una escritura falla antes de 1.5s, `d` puede ser 0 y el error no se despacha (`werr`). El usuario no ve el error. Además, `np` (contador de pendientes) puede desincronizarse si la promesa rechaza. Riesgo: operaciones fallidas silenciosas.

7. **`onUser` no valida que el perfil exista antes de `startSubs`.**
   - `session.js:47-64`: si `d.exists()` es false, setea `S.me=null` y `S.pf=true`. Pero `pu` (listener) queda activo. Edge case menor.

8. **`restoreView` lee localStorage pero `vSig` puede desincronizarse.**
   - `view-restore.js:1-27`. Si `renderNow` se llama sin `S.me` (logout), no guarda. Al re-login, `vRest` ya es true (nunca se resetea), así que la vista restaurada del usuario anterior puede aplicarse al nuevo usuario. **Bug real**: `vRest` es global y no se resetea en logout. Si el usuario A cierra sesión y el usuario B entra en el mismo navegador, B hereda la vista de A.
   - **Impacto**: UX incorrecta, posible confusión.

9. **`_lastDay` y `D` no se reinician al cambiar de usuario.**
   - `branch-claim.js:171`. Si un vendedor cierra sesión y otro entra el mismo día, `_lastDay` ya es today, no se re-evalúa. Menor.

10. **`day()` usa `new Date()` local.** Si el dispositivo tiene fecha incorrecta, todo el sistema falla. Aceptable para app local.

### 🟠 Altas

11. **Race condition en `deliveries` take.** `takeDelivery` usa transacción, correcto. Pero `dvRelease` (soltar) hace `update` directo sin transacción; dos repartidores podrían soltar a la vez. Menor.

12. **`dvCancel` ahora delete.** Si un repartidor ya tomó (`en_ruta`), el delete está bloqueado por reglas (solo pendiente). Pero el UI oculta el botón. Bien. Sin embargo, si el admin elimina un pendiente que un repartidor está por tomar, la transacción de `takeDelivery` fallará con 'taken' o doc not found. Manejado.

13. **`closeBr` guards son síncronos con datos de `S` (hoy).** No verifica datos históricos (ventas pasadas). Cerrar una sucursal con ventas pasadas es OK (índice se conserva). Bien.

14. **`deleteBrForever` ajusta índices de `closed`.** Pero no ajusta `branchLocs` correctamente si `oldLocs` es más corto que `oldBranches` (usa `oldLocs[idx] ?? null`). Bien. Pero ventas/reservas históricas referencian el índice viejo → después del delete, el índice apunta a otra sucursal. **Riesgo de integridad histórica**. Mitigación: solo permitir delete de sucursales sin ventas (verificar `S.sales` solo es hoy). No se verifica historial. Riesgo real.

15. **`vend(request.resource.data.branch)` en rules requiere `claims/<branch>.uid == auth.uid`.** Si un vendedor no ha reclamado sucursal hoy, `vend()` es false. Correcto. Pero `prof().branch` puede estar desactualizado (vendedor cambió de sucursal ayer). La claim es la fuente de verdad. Bien.

16. **`stock/{id}` write: `vend(request.resource.data.branch)`** — un vendedor puede escribir stock de su sucursal. Pero `id == string(branch)`. Bien. Sin embargo, cualquier vendedor de esa sucursal puede sobrescribir. Aceptable.

17. **`reqs` update por vendedor de origen (`from`) permite cancelar pendiente.** Correcto.

18. **`sales` delete por vendedor requiere log `del_<id>`.** El cliente debe crear el log en el mismo batch. Si no, delete falla. Bien. Pero el admin puede borrar sin log. Bien.

19. **`used()` excluye `s.dv` (deliveries).** Correcto para no doble contar. Pero `net()` (línea 40-43) no excluye `dv`. Inconsistencia: `net` incluye deliveries en el neto de ventas. Si se usa en reportes de ventas, puede inflar. Revisar uso de `net()`.

20. **`chUsed` (champurrado usado) no excluye `dv`.** Línea 55-61: filtra `s.branch == b && s.f >= 100`, no excluye `dv`. Pero deliveries crean sales con `f: +k.slice(1)` que puede ser >=100 (champurrado). Esos sales tienen `dv: id`. `chUsed` los cuenta, pero `dvResv` también cuenta deliveries en `left()` para champurrado? `left()` para f>=100 usa `chLeft` which uses `chUsed` (includes dv sales) and `chLoad`/`txc`. `dvResv` no se resta para champurrado (left() f>=100 branch). So champurrado from deliveries is counted once via chUsed (sales with dv). That seems okay, but only if the delivery sale was created (delivered). For pending/en_ruta deliveries, no sale exists yet, so champurrado not reserved. **Bug**: pending delivery champurrado is not reserved in inventory! `dvResv` is only used in the tamales branch of `left()` (f<100). For champurrado (f>=100), `left()` ignores `dvResv`. So a pending delivery with champurrado doesn't reserve champurrado. Riesgo de sobreventa de champurrado.

21. **`paNow` (apartados en carga) solo para tamales (f<100).** Champurrado apartados se manejan vía `chUsed`. OK.

22. **`loadEmpty` / `encBlk` lógica compleja.** Posibles edge cases donde `enc` no puede vender aunque haya stock. Revisar.

### 🟡 Medias

23. **`S.pre` solo incluye pendientes.** Al entregar un apartado, el doc se actualiza a 'entregado' y sale de la suscripción. `preN()` cuenta pendientes. Bien. Pero `S.pre` para vendedor filtra por branch. Bien.

24. **`pin()` (solicitudes pendientes para la sucursal) se calcula en `requests.js`.** Correcto.

25. **`histN()` y otros contadores.** No revisado a fondo.

26. **`render()` throttling 15s para non-force.** Puede hacer que cambios remotos tarden en reflejarse si no son force. La mayoría de suscripciones llaman `render()` (non-force). Con throttling, un cambio remoto podría tardar hasta 15s en pintarse. Aceptable pero puede confundir.

27. **`S.dt` se resetea en force.** `renderNow(true)` setea `S.dt=0`. Bien.

28. **`restoreView` guarda en localStorage en cada `renderNow`.** Si `S.me` es null (logout), no guarda. Bien. Pero `vRest` nunca se resetea, así que al re-login no restaura (correcto, evita heredar). Wait, `vRest` se setea true en el primer `restoreView` call. En `onUser`, se llama `restoreView(u)` para el nuevo usuario. Si `vRest` ya true (de sesión anterior en el mismo tab), retorna sin restaurar. Pero `vRest` persiste en memoria del tab. Tras logout+login en el mismo tab, `vRest` sigue true → no restaura. Eso es un bug: el nuevo usuario no recupera su vista guardada. Menor.

29. **`profSub` timeout 3s.** Si Firestore tarda más, `S.prE=true` y se muestra loginForm. OK.

30. **`FB.newUser` reusa email si ya existe.** Si el email existe pero el password es diferente, lanza 'old-user'. Bien.

31. **`FB.bootstrap` crea admin + config/init en un batch.** Si falla a mitad, puede quedar inconsistente. Menor.

32. **`db.batch().commit()` usa `W()`.** Bien.

33. **`takeDelivery` transaction no verifica `day`.** Si un delivery de ayer sigue 'pendiente', podría ser tomado hoy. Pero deliveries se filtran por day en subDv. Menor.

34. **`dvWhere` (GPS) usa `enableHighAccuracy: true`.** Puede tardar/bloquearse en interiores. Timeout 12s. OK.

35. **`dvRouteMap` embeds dos mapas de 190px.** En móvil, mucho scroll. Aceptable.

36. **`dvForm` step 4 (Guardar) muestra el mapa con `mq` (dirección).** Bien.

37. **`dvGeocode` busca "Guadalajara, Jalisco, México".** Restringe a GDL. Bien. Pero si el usuario escribe una dirección de otra ciudad, la geocodificación la força a GDL (puede dar resultados incorrectos). Aceptable por requisito.

38. **`dvGeocode` usa ArcGIS primary + Nominatim fallback.** Bien. Pero no valida que el resultado esté en GDL. Podría devolver un resultado de otra ciudad si la dirección es ambigua. Menor.

39. **`closeBr` permite cerrar si `BI().length <= 1` → toast "Debe quedar al menos una sucursal".** Bien. Pero si hay 1 abierta y se cierra, quedan 0 abiertas → `BI()` vacío → crash en `brs().map` etc. Guard previene. Bien.

40. **`addBranch` agrega "Sucursal N" donde N = brs().length+1.** Si se han borrado sucursales, N puede colisionar con nombres existentes. Menor.

41. **`saveAj` guarda `branchLocs` con `+($("#blat"+i)?.value || 0) || null`.** Si el input está disabled (lock), el valor sigue en el DOM y se guarda. Bien. Pero si el usuario desbloquea, edita y guarda, funciona.

42. **`plUnlock` usa `ask` (confirm).** Bien.

43. **`plLock` se llama en `saveAj`.** Bien.

44. **`S.pl` inicial es undefined → `lk = true`.** Bloqueado por defecto. Bien.

45. **`claimOf` y `vendReady`:** no revisado a fondo. Riesgo de que un vendedor quede sin sucursal si el claim expira. Aceptable.

46. **`history.js` anulaciones:** `anular` y `anularR`. Verifican lock. Bien.

47. **`cash-cut.js`:** corte de caja. `noCut(day)` bloquea ventas tras corte. Bien. Pero `enc` (Pedidos) no hace corte. Bien.

48. **`requests.js`:** solicitudes entre sucursales. `deliverReq` crea sales `q<id>_<n>` y actualiza req a 'entregado'. Verifica `getAfter(...).data.type == 'vendido'`. Bien. Pero si la venta ya existía (re-entrega), falla. Bien.

49. **`transfers.js`:** traspasos. `trIn` crea transfer. `trUp` actualiza. Guard de lock. Bien.

50. **`alerts.js`:** `lowList` usa `left()` que puede ser negativo → `l <= T` (T=3) → negativo <= 3 → alerta. Correcto (agotado).

51. **`dashboard.js`:** muestra totales. Bien.

52. **`nav-settings.js`:** personalización de nav. Bien.

53. **`voice-fill.js`:** reconocimiento de voz. Puede fallar en navegadores sin soporte. Bien.

54. **`sw.js`:** caché versionado. Cada cambio bump. Bien. Pero `PRECACHE` lista puede estar desactualizada (faltan archivos nuevos). No crítico.

55. **`firebase.json`:** `Permissions-Policy` ahora permite geolocation self. Good.

56. **`firestore.rules`:** `match /config/{doc}` write adm. Good.

57. **`brs()` default `[1..5]` si no config.** Si config/main no existe, brs() devuelve 5 sucursales default. Pero `S.cfg` starts `{}`. `cfgOk` becomes true on snapshot. Si no hay doc, `d.data()` is undefined → `S.cfg = {}`. brs() returns defaults. Bien. Pero `isOpen` checks `S.cfg.closed` (undefined → []). Good.

58. **`BI()` con defaults:** 5 sucursales. Fine.

59. **`price(f)` returns 0 if no price.** `noPrice` detects. Good.

60. **`nm(f)` for champurrado:** `f >= 100 ? 'Champurrado ' + CH[f-100][0].toLowerCase() + ' ' + CH[f-100][1] : F[f]`. Good.

### 🟢 Bajas / UX

61. **Sin validación de PIN en cliente.** PIN de 6 dígitos no se valida en `login()` (solo trim). Firebase Auth password min 6. OK.

62. **`mail(u)` genera email `u@tamalescastro.com`.** Si dos usuarios tienen mismo nombre normalizado, colisión. `newUser` maneja `email-already-in-use`. OK.

63. **`pickRole`/`pick` usan `history.pushState`.** Back button works. Good.

64. **`backProf`/`backRole` usan `ld` counter.** Puede desincronizarse. Menor.

65. **`noAccess()` para usuarios inactivos.** Bien.

66. **`S.alHide` no persiste.** Al recargar, alerta reaparece. Menor.

67. **`S.dvRoute`/`S.dvLoc` no persisten.** Al recargar, se pierde. Aceptable.

68. **`S.dvn` (nuevo reparto form state) no persiste.** Al recargar, se pierde. Aceptable.

69. **`S.cart` no persiste.** Al recargar, carrito se pierde. Podría ser un problema.

70. **`S.vt`/`S.tab`/etc. persisten vía view-restore.** Bien.

71. **Accesibilidad:** muchos botones sin `aria-label`. Algunos inputs tienen. Mejorable.

72. **`#toast` y modal:** modal no tiene focus trap. Menor.

73. **`window.scrollTo` con `behavior: 'smooth'`** puede ser janky en algunos navegadores. Aceptable.

74. **`navigator.vibrate`** puede no existir. Guarded. Good.

75. **`geolocation` permission** re-habilitado. Good.

---

## 4. Seguridad

- **API key expuesta** (normal en Firebase client). La seguridad está en las reglas. OK.
- **`profiles` read público.** Recomendado restringir.
- **`config/init` read público.** Necesario para bootstrap. OK.
- **`users/{uid}` read: auth.uid == uid || adm.** OK.
- **`sales` create: vend with validSale.** OK. Pero `validSale` verifica `by == prof().user`. OK.
- **`sales` update: solo apartado→vendido por el mismo vendedor.** OK.
- **`sales` delete: admin o vend con log.** OK.
- **`loads` write: admin only.** OK. Vendedor no puede modificar carga directamente. OK.
- **`transfers` create: vend from.** OK.
- **`transfers` delete: vend from + log.** OK.
- **`deliveries` create: admin o enc propio.** OK.
- **`deliveries` update: rep/admin/enc/vend (out).** OK.
- **`deliveries` delete: admin o enc pendiente.** OK.
- **`reqs` create: vend from o enc (from null).** OK.
- **`claims` create/update: claimOk.** OK.
- **`cuts` create: admin o vend propio.** OK.
- **`stock` write: admin o vend de su sucursal.** OK.
- **`logs` create: admin o enc/vend propio.** OK.

**Hallazgo de seguridad**: `profiles` read público expone nombres/usuarios. Bajo riesgo pero recomendado restringir.

**Hallazgo**: `deliveries` read permite `vend(resource.data.branch)`. Un vendedor que no reclamó sucursal hoy no puede leer. Bien. Pero un vendedor que reclamó la sucursal puede leer todos los deliveries de esa sucursal (incluyendo los de otros vendedores). Aceptable.

**Hallazgo**: `sales` read permite `vend(resource.data.branch)` y `enc`. Un vendedor puede leer todas las ventas de su sucursal. OK.

---

## 5. Concurrencia / integridad de datos

- **Repartos**: toma atómica vía transacción. ✅
- **Apartados**: update solo si status 'pendiente'. ✅ (previene doble entrega)
- **Ventas**: delete requiere log. ✅
- **Traspasos**: delete requiere log. ✅
- **Cortes**: uno por día por vendedor. ✅
- **Claims**: un vendedor por sucursal por día. ✅
- **Inventario**: `left()` calculado en cliente a partir de suscripciones. Si dos vendedores venden simultáneamente, la suscripción actualiza y recalcula. Hay una ventana de race (vender sin stock) pero `encBlk` y `loadDone` mitigan. Aceptable para uso local.
- **`dvResv` no reserva champurrado** (bug). Ver punto 20.
- **`resv` vs `used` inconsistencia en apartados vencidos.** Ver punto 3.

---

## 6. UX / Accesibilidad

- **Formulario de reparto por pasos**: bien implementado.
- **Mini-mapa con dirección exacta**: bien.
- **12h**: bien.
- **Bottom nav**: bien.
- **Falta focus management** en modal y toast.
- **Inputs sin labels en algunos lugares** (ej. `ni()` sí genera aria-label). Bien.
- **`nav()` badge**: muestra número. Bien.
- **Stock alert hideable** para admin y enc. Bien.
- **Vendedor ve repartos en Apartados Hoy**: bien, card mínima.
- **Número de repartos en Pedidos**: bien.
- **Scroll al cambiar paso**: corregido.

---

## 7. Performance

- **Suscripciones realtime** a muchas colecciones. Para una taquería pequeña, OK.
- **`render()` throttling** 15s para non-force. Puede retrasar actualizaciones remotas. Considerar reducir a 2-3s o usar force en suscripciones importantes.
- **`renderNow` re-renderiza todo `#app`**. Para listas grandes (historial, reportes) puede ser lento. Aceptable.
- **Service Worker precache** puede estar desactualizado. Verificar `PRECACHE` incluye todos los archivos.
- **Imágenes/iconos** no optimizados. Menor.

---

## 8. Nuevas funcionalidades sugeridas

### Alta prioridad
1. **Notificaciones push** (deferido por el usuario). Opciones: Firebase FCM + Cloud Function (Blaze) o ntfy (gratis). El repartidor se beneficiaría mucho.
2. **Reporte de champurrado en repartos** — actualmente no se reserva. Arreglar `dvResv` para champurrado.
3. **Historial de repartos por repartidor** — ya existe "Terminados hoy", pero no histórico por fecha.
4. **Reabrir apartados vencidos automáticamente** o liberar su stock.
5. **Validación de stock en tiempo real al vender** — mostrar "sin stock" antes de agregar al carrito (ya lo hace parcialmente).

### Media prioridad
6. **Exportar reportes a PDF/Excel** (ya hay export.js). Mejorar.
7. **Búsqueda de cliente** en repartos/apartados.
8. **Reimpresión de ticket** para ventas pasadas.
9. **Multi-sucursal en reportes** (ya existe filtro por sucursal en admin).
10. **Auditoría de cambios de precio** (audit-log.js existe, verificar uso).
11. **Modo offline robusto**: ya usa persistentLocalCache. Pero las escrituras offline pueden fallar por reglas (claims, etc.). Documentar.
12. **Backup automático** de Firestore (requiere Blaze + scheduled function).
13. **Roles granulares**: e.g., "solo lectura" para auditor.

### Baja prioridad
14. **Dark mode toggle** (ya existe theme-toggle).
15. **Idioma** (solo español).
16. **Sonido al entrar pedido** (sin notificación push).
17. **Geofencing** para repartidor (verificar que esté en la sucursal).
18. **Foto del producto** en el carrito.
19. **Código de barras** para sabores.
20. **Descuentos/promociones**.

---

## 9. Recomendaciones priorizadas (top 5)

1. **Arreglar `dvResv` para champurrado** (bug de sobreventa). ~1h.
2. **Corregir `resv` para excluir apartados vencidos** (consistencia con `used`). ~30min.
3. **Restringir `profiles` read a `ok()`** (seguridad). ~5min + deploy rules.
4. **Resetear `vRest` en logout** para que la vista se restaure correctamente al re-login. ~5min.
5. **Agregar `Math.max(0, …)` a `left()` para tamales** (evitar negativos). ~5min.

---

## 10. Conclusión

El sistema es sólido para una taquería pequeña. Las principales mejoras deben enfocarse en **integridad de inventario** (champurrado en repartos, apartados vencidos) y **seguridad** (profiles). Las notificaciones push son la funcionalidad de mayor valor para el rol repartidor. El código está bien organizado por módulos, aunque `adminView()` y `inventory.js` son hubs muy grandes que podrían dividirse.

---

*Análisis realizado sobre el estado del repositorio al commit `44196c6` (cache v43).*

---

## Correcciones aplicadas (commit `4e767a3`, cache v44)

1. `left()` para tamales ahora usa `Math.max(0, …)` (evita negativos).
2. `resv()` excluye apartados vencidos (`exp < Date.now()`), liberando stock.
3. `dvResv()` ahora reserva champurrado (nueva rama en `left()` para f>=100) y ya no excluye `fallido` (el tamal perdido no se revende).
4. `chUsed()` y `net()` excluyen ventas de deliveries (`!s.dv`) para evitar doble conteo.
5. `W()` (firebase.js) ahora despacha `werr` siempre que una escritura falle (antes se ocultaba si fallaba antes de 1.5s).
6. `vRest` se resetea en `logout()` (evita heredar vista entre usuarios).
7. `_lastDay` se resetea al iniciar sesión (re-evalúa cambio de día).
8. `vSig` se resetea en `logout()`.

### Pendientes (funcionalidades sugeridas, no implementadas aún)
- Historial de repartos por repartidor por fecha.
- Validación de stock en tiempo real al agregar al carrito (parcialmente existente).
- Reabrir/cancelar apartados vencidos automáticamente (ahora solo liberan stock).
- Notificaciones push.
- Restringir `profiles` read (rompería la pantalla de login; requiere rediseño).

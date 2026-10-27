const V='tamales-v3',A=['/','/index.html','/manifest.json','/icon-192.png','/icon-512.png','/icon-maskable-192.png','/icon-maskable-512.png'];
const ext=h=>/(^|\.)gstatic\.com$/.test(h)||h==='fonts.googleapis.com';
/* Instalación tolerante: si un recurso falla, el resto se guarda igual y el SW sí se instala */
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>Promise.all(A.map(u=>c.add(u).catch(()=>{})))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const r=e.request,u=new URL(r.url);
 if(r.method!=='GET'||!(u.origin===location.origin||ext(u.hostname)))return;
 /* La app (HTML): red primero, así una versión nueva se ve al abrir; con mala señal (3 s) o sin red, la copia guardada */
 if(r.mode==='navigate'){const net=fetch(r).then(x=>{if(x.ok){const y=x.clone();caches.open(V).then(c=>c.put('/',y))}return x});e.waitUntil(net.catch(()=>{}));
  e.respondWith(Promise.race([net,new Promise((_,j)=>setTimeout(j,3000))]).catch(async()=>(await caches.match('/'))||(await caches.match('/index.html'))||Response.error()));return}
 /* Resto (íconos, fuentes, SDK de Firebase): caché primero y se actualiza en segundo plano */
 e.respondWith(caches.open(V).then(async c=>{const h=await c.match(r);
  const n=fetch(r).then(x=>{if(x&&(x.ok||x.type==='opaque'))c.put(r,x.clone());return x});
  e.waitUntil(n.catch(()=>{}));return h||n.catch(()=>Response.error())}))});

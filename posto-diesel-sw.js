// Service Worker do Posto Diesel - ACF
// Cache dedicado, nao interfere com AgroOp/Chuvas/Estoque
//
// IMPORTANTE: sempre que atualizar o app, aumente o numero da versao abaixo
// (ex: v1 -> v2 -> v3). Isso forca todos os celulares a baixarem a versao nova.
var CACHE_NAME = "posto-diesel-v11";
var APP_URL = "posto-diesel-fazenda.html";
var MANIFEST_URL = "posto-diesel-manifest.json";

// Arquivos essenciais para o app funcionar offline
var ASSETS = [
  APP_URL,
  MANIFEST_URL,
  "https://unpkg.com/react@18/umd/react.production.min.js",
  "https://unpkg.com/react-dom@18/umd/react-dom.production.min.js",
  "https://unpkg.com/@babel/standalone/babel.min.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"
];

// Recebe ordem do app para ativar a versao nova imediatamente
self.addEventListener("message", function(e){
  if(e.data && e.data.action === "skipWaiting"){
    self.skipWaiting();
  }
});

// Instalacao: guarda os arquivos no cache
self.addEventListener("install", function(e){
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      // Cacheia cada asset individualmente para nao falhar tudo se um falhar
      return Promise.all(ASSETS.map(function(url){
        return cache.add(url).catch(function(err){
          console.log("SW: falha ao cachear", url, err);
        });
      }));
    })
  );
});

// Ativacao: limpa caches antigos deste app
self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        if(k.indexOf("posto-diesel-")===0 && k!==CACHE_NAME){
          return caches.delete(k);
        }
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

// Fetch: estrategia network-first para o HTML (sempre pega a versao mais nova quando online),
// cache-first para bibliotecas (react, babel, firebase - nao mudam)
self.addEventListener("fetch", function(e){
  var url = e.request.url;

  // NUNCA cachear chamadas ao Firestore (dados em tempo real)
  if(url.indexOf("firestore.googleapis.com")!==-1 ||
     url.indexOf("firebase")!==-1 && url.indexOf("firebasejs")===-1 ||
     url.indexOf("google.com")!==-1 && url.indexOf("gstatic")===-1){
    return; // deixa passar direto para a rede
  }

  // HTML do app: network-first (online pega novo, offline usa cache)
  if(url.indexOf(APP_URL)!==-1){
    e.respondWith(
      fetch(e.request).then(function(resp){
        var copy = resp.clone();
        caches.open(CACHE_NAME).then(function(cache){ cache.put(e.request, copy); });
        return resp;
      }).catch(function(){
        return caches.match(e.request).then(function(cached){
          return cached || caches.match(APP_URL);
        });
      })
    );
    return;
  }

  // Bibliotecas e demais assets: cache-first
  e.respondWith(
    caches.match(e.request).then(function(cached){
      if(cached) return cached;
      return fetch(e.request).then(function(resp){
        var copy = resp.clone();
        caches.open(CACHE_NAME).then(function(cache){ cache.put(e.request, copy); });
        return resp;
      }).catch(function(){ return cached; });
    })
  );
});

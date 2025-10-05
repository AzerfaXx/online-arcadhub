// On incrémente la version du cache pour forcer la mise à jour
const CACHE_NAME = "arcadehub-cache-v1.4"; // Version incrémentée

// Liste des ressources à mettre en cache, maintenant mieux organisée
const ASSETS_TO_CACHE = [
  // Fichiers de base de l'application (App Shell)
  "index.html",
  "style.css",
  "script.js",
  "manifest.json",
  "icons/icon-192.png",
  "icons/icon-512.png",

  // Pages des jeux
  "snake.html",
  "pong.html",
  "tetris.html",
  "space-invaders.html",
  "2048.html",
  "demineur.html",
  "solitaire.html",
  "morpion.html",
  "glow-breaker.html",
  "synth-jumper.html",
  "gem-crush.html",
  "reflex.html",

  // Images des jeux pour la page d'accueil
  "images/snake.png",
  "images/pong.png",
  "images/tetris.png",
  "images/space.png",
  "images/2048.png",
  "images/demineur.png",
  "images/solitaire.png",
  "images/morpion.png",
  "images/glow-breaker.png",
  "images/synth-jumper.png",
  "images/gem-crush.png",
  "images/reflex.png",

  // Sons
  "sounds/ambiance.mp3",
  "sounds/click.mp3",
  "sounds/coin.mp3",
  "sounds/died-space.mp3",
  "sounds/game-over.mp3",
  "sounds/laser-space.mp3",
  "sounds/line-tetris.mp3",
  "sounds/score-pong.mp3",
  "sounds/win.mp3",
  "sounds/eat.mp3",
  "sounds/hit.mp3",
  "sounds/switch.mp3",
  "sounds/clip.mp3",
  "sounds/hit-bullet.mp3",
  "sounds/swoosh.mp3",
  "sounds/flag.mp3",
  "sounds/reveal.mp3",
  "sounds/explosion.mp3",
  "sounds/shuffle.mp3",
  "sounds/card-flip.mp3",
  "sounds/card-deal.mp3",
  "sounds/place-piece.mp3",
  "sounds/jump.mp3",
  "sounds/platform-break.mp3",
  "sounds/fall.mp3",
  "sounds/bonus-create.mp3",
  "sounds/bomb-explode.mp3",
];

// Étape d'installation : mise en cache des ressources
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("Mise en cache des ressources initiales");
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
          console.error("Échec de la mise en cache de certains fichiers : ", err);
      });
    })
  );
  self.skipWaiting();
});

// Étape d'activation : nettoyage des anciens caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("Suppression de l'ancien cache :", key);
            return caches.delete(key);
          }
        })
      )
    )
  );
  return self.clients.claim();
});

// Étape de fetch : intercepter les requêtes réseau
self.addEventListener("fetch", (event) => {
    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(event.request).then((networkResponse) => {
            // --- CORRECTION APPLIQUÉE ICI ---
            // On ne met en cache que les réponses valides (status 200)
            // pour éviter l'erreur "Partial response (206)" avec les fichiers audio.
            if (networkResponse && networkResponse.status === 200) {
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });
            }
            return networkResponse;
        }).catch(error => {
            console.error('Échec du fetch et aucune ressource en cache:', error);
            // Optionnel : retourner une page de fallback
            // return caches.match('offline.html');
        });
      })
    );
});
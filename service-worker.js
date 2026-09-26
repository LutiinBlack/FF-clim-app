/* ==================================================================
   FF CLIM — Service worker (mise en cache pour le mode PWA)
   ==================================================================
   Un "service worker" est un script qui tourne en arrière-plan dans
   le navigateur, séparément de la page elle-même, et qui peut
   intercepter chaque requête réseau de l'application (chaque fetch()
   ou chargement de fichier). On l'utilise ici pour deux choses :
     1. Faire fonctionner l'application hors-ligne (en gardant une
        copie des fichiers dans un cache local du navigateur).
     2. Servir les nouvelles versions de l'application dès qu'elles
        sont disponibles, sans attendre que l'utilisateur désinstalle
        et réinstalle l'application.

   CACHE_NAME : à incrémenter (v4 → v5 → ...) à chaque fois qu'on
   change la liste des fichiers ci-dessous, ou qu'on veut forcer tous
   les appareils à retélécharger une version fraîche des fichiers mis
   en cache. Changer ce nom fait automatiquement supprimer l'ancien
   cache (voir l'événement "activate" plus bas).
   ================================================================== */
const CACHE_NAME = "ffclim-rapports-v6";

// Fichiers "cœur" de l'application : ceux-ci sont toujours redemandés
// au réseau en priorité (stratégie "network-first" plus bas), pour
// être sûr que toute mise à jour de l'appli soit vue au plus vite.
// Si le réseau est indisponible, on retombe sur la version en cache.
const CORE_ASSETS = [
  "./index.html",
  "./manifest.json",
  "./css/styles.css",
  "./js/config.js",
  "./js/assets.js",
  "./js/utils.js",
  "./js/icons.js",
  "./js/categories.js",
  "./js/navigation.js",
  "./js/auth.js",
  "./js/reports.js",
  "./js/cerfa.js",
  "./js/admin.js",
  "./js/history.js",
  "./js/pwa.js",
  "./js/main.js",
];

// Fichiers statiques qui changent rarement : mis en cache et servis
// directement depuis le cache (stratégie "cache-first" plus bas),
// pour que l'application se charge instantanément hors-ligne.
const STATIC_ASSETS = [
  "./icon-192.png",
  "./icon-512.png",
  "./icon-192-maskable.png",
  "./icon-512-maskable.png",
  "./apple-touch-icon.png",
  "./assets/logo.jpg",
  "./assets/cerfa-15497-04.pdf",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([...CORE_ASSETS, ...STATIC_ASSETS]))
  );
  self.skipWaiting(); // active ce nouveau service worker sans attendre la fermeture de tous les onglets
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    // Supprime tous les caches d'une version précédente (dont le nom
    // ne correspond plus à CACHE_NAME) pour ne pas accumuler de
    // fichiers obsolètes dans le stockage du navigateur.
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim(); // prend le contrôle des onglets déjà ouverts sans attendre un rechargement
});

// Stratégie de mise en cache :
// - fichiers "cœur" (la page de l'appli + le manifeste + tout le CSS/JS
//   maison) : network-first, pour que toute mise à jour qu'on publie
//   soit récupérée dès le prochain chargement ; la copie en cache ne
//   sert que de secours si le réseau est coupé.
// - fichiers statiques (icônes, logo, modèle CERFA) et tout le reste
//   (scripts des CDN, polices Google Fonts) : cache-first, car ces
//   fichiers changent rarement, pour garder l'appli rapide et
//   utilisable hors-ligne.
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Ne jamais mettre en cache les appels à Supabase (authentification,
  // base de données, stockage) ni aucune requête qui n'est pas un
  // simple GET (POST, PUT...) — ces données doivent TOUJOURS être
  // fraîches, récupérées directement depuis le réseau. C'est ce qui
  // évite, par exemple, qu'un téléphone affiche une liste
  // d'utilisateurs ou de permissions périmée après une modification
  // faite depuis un autre appareil.
  if (req.url.includes("supabase.co") || req.method !== "GET") {
    event.respondWith(fetch(req));
    return;
  }

  const isCore = CORE_ASSETS.some((a) => req.url.endsWith(a.replace("./", "")));

  if (isCore) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        return res;
      });
    })
  );
});

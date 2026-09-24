/* ==================================================================
   FF CLIM — PWA : service worker & installation
   ==================================================================
   Ce fichier fait de FF CLIM une "Progressive Web App" (PWA) : une
   application web qui peut être "installée" sur un téléphone ou un
   ordinateur (icône sur l'écran d'accueil, ouverture en plein écran
   sans barre d'adresse), et qui continue à fonctionner même sans
   connexion réseau grâce à un "service worker" (voir service-worker.js
   à la racine du projet, qui met en cache les fichiers de l'appli).

   Ce module gère deux choses indépendantes :
     1. Enregistrer le service worker, et prévenir l'utilisateur
        quand une nouvelle version de l'appli a été installée en
        arrière-plan (bandeau "Nouvelle version disponible").
     2. Le bouton "Installer l'appli" (Android/Chrome), qui déclenche
        la fenêtre d'installation native du navigateur.
   ================================================================== */

/**
 * Affiche, en haut de l'écran, un bandeau invitant à recharger la
 * page pour appliquer une mise à jour de l'application qui vient
 * d'être installée en arrière-plan par le service worker.
 */
function showUpdateBanner() {
  if (document.getElementById('updateBanner')) return; // déjà affiché, on ne le duplique pas
  const bar = document.createElement('div');
  bar.id = 'updateBanner';
  bar.className = 'update-banner';
  bar.innerHTML = `<span>Nouvelle version disponible</span><button id="updateReloadBtn">Recharger</button>`;
  document.body.appendChild(bar);
  document.getElementById('updateReloadBtn').addEventListener('click', () => window.location.reload());
}

if ('serviceWorker' in navigator) {
  // "controllerchange" se déclenche quand un NOUVEAU service worker
  // prend le contrôle de la page. Si un service worker contrôlait
  // déjà la page avant (hadController === true), cela signifie qu'une
  // mise à jour vient d'être installée : on prévient l'utilisateur.
  // (Si c'est le tout premier chargement, hadController est false et
  // on ne montre rien — ce n'est pas une "mise à jour".)
  let hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) showUpdateBanner();
    hadController = true;
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').then((reg) => {
      reg.update(); // vérifie immédiatement s'il existe une version plus récente
      // Revérifie aussi à chaque fois que l'utilisateur revient sur l'onglet
      // (utile si l'appli reste ouverte plusieurs jours sans être fermée).
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update();
      });
    }).catch(() => {});
  });
}

/* ---------------- Installation de l'application (Android/Chrome) ----------------
   Par défaut, les navigateurs compatibles déclenchent un mini-menu
   d'installation automatique. En interceptant l'événement
   "beforeinstallprompt" et en appelant preventDefault(), on empêche
   ce menu automatique et on garde l'événement de côté
   (deferredInstallPrompt) pour le déclencher nous-mêmes, plus tard,
   quand l'utilisateur clique sur notre propre bouton "⬇ Installer
   l'appli" (plus cohérent visuellement avec le reste de l'appli). */
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  document.getElementById('installBtn').style.display = 'inline-flex';
});
document.getElementById('installBtn').addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  document.getElementById('installBtn').style.display = 'none';
});

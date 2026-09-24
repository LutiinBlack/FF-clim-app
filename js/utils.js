/* ==================================================================
   FF CLIM — Fonctions utilitaires partagées
   ==================================================================
   Petites fonctions génériques, sans lien avec une catégorie de
   rapport en particulier, utilisées par plusieurs modules
   (js/reports.js ET js/cerfa.js). Regroupées ici pour éviter de les
   dupliquer, et pour qu'on sache où les trouver.

   Doit être chargé avant js/reports.js et js/cerfa.js.
   ================================================================== */

/**
 * Déclenche le téléchargement d'un fichier binaire (ici, toujours un
 * PDF) dans le navigateur, à partir d'un Blob ou d'un tableau
 * d'octets (Uint8Array). Fonctionne en créant un lien <a> invisible,
 * en simulant un clic dessus, puis en le retirant de la page.
 */
function downloadBytes(bytes, filename) {
  const blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  // On libère l'URL temporaire un peu après le clic, le temps que le
  // téléchargement démarre réellement.
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

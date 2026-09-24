/* ==================================================================
   FF CLIM — Chargement des ressources binaires (logo, modèle CERFA)
   ==================================================================
   Historique : dans la toute première version de l'application, le
   logo et le PDF CERFA vierge étaient encodés en "base64" et collés
   directement dans le JavaScript, sous forme de deux immenses chaînes
   de texte (LOGO_B64, CERFA_PDF_B64 — plus de 200 000 caractères à
   elles deux). Cela fonctionnait, mais rendait le code illisible et
   très lourd à charger/modifier.

   Désormais, ces deux fichiers sont de vrais fichiers binaires,
   rangés dans le dossier assets/ :
     - assets/logo.jpg
     - assets/cerfa-15497-04.pdf
   Ce fichier les télécharge une seule fois au démarrage de
   l'application (avec fetch), et les garde en mémoire pour que les
   autres modules (js/reports.js, js/cerfa.js) puissent les réutiliser
   à chaque génération de PDF sans re-télécharger à chaque fois.

   Pourquoi deux formats différents (Data URL vs Uint8Array) ?
   -------------------------------------------------------------
   - jsPDF (utilisé pour les 4 rapports génériques) sait insérer une
     image dans un PDF à partir d'une "Data URL" (une chaîne du type
     "data:image/jpeg;base64,...."). On convertit donc le logo une
     fois pour toutes en Data URL avec un FileReader.
   - pdf-lib (utilisé pour le CERFA) sait charger un PDF directement
     à partir d'octets bruts (un Uint8Array), donc on garde le CERFA
     tel quel, sans conversion.
   ================================================================== */

// Ces deux variables restent "null" tant que le chargement n'est pas
// terminé. Le reste du code doit toujours attendre la promesse
// "assetsReady" ci-dessous avant de les utiliser.
let LOGO_DATA_URL = null;
let CERFA_TEMPLATE_BYTES = null;

/**
 * Convertit un Blob en Data URL (chaîne texte "data:...;base64,...").
 * Le FileReader est une API native du navigateur ; ici on l'enveloppe
 * dans une Promise pour pouvoir utiliser await avec.
 */
function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Télécharge le logo et le modèle CERFA une seule fois, au chargement
 * de la page. Les deux fichiers sont récupérés en parallèle (Promise.all)
 * pour ne pas attendre l'un après l'autre.
 */
async function preloadAssets() {
  try {
    const [logoResponse, cerfaResponse] = await Promise.all([
      fetch('assets/logo.jpg'),
      fetch('assets/cerfa-15497-04.pdf'),
    ]);

    const logoBlob = await logoResponse.blob();
    LOGO_DATA_URL = await blobToDataURL(logoBlob);

    const cerfaArrayBuffer = await cerfaResponse.arrayBuffer();
    CERFA_TEMPLATE_BYTES = new Uint8Array(cerfaArrayBuffer);
  } catch (err) {
    // En cas d'échec (pas de réseau au tout premier lancement, par
    // exemple), on log l'erreur mais on ne bloque pas le reste de
    // l'application : seule la génération de PDF sera impactée.
    console.error("Échec du chargement des ressources (logo / CERFA) :", err);
  }
}

// On démarre le téléchargement tout de suite, dès que ce fichier est
// exécuté (pas besoin d'attendre que l'utilisateur clique sur quoi
// que ce soit). "assetsReady" est la promesse que les autres modules
// devront "attendre" (await assetsReady) avant de générer un PDF.
const assetsReady = preloadAssets();

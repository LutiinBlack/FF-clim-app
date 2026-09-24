/* ==================================================================
   FF CLIM — Navigation entre écrans
   ==================================================================
   L'application est une "single-page app" : une seule page HTML,
   dans laquelle plusieurs <div class="screen"> se cachent/s'affichent
   selon l'écran voulu (accueil, un rapport, l'admin, l'historique...).
   showScreen(key) est LA fonction centrale qui gère ce basculement,
   ainsi que l'apparence de la barre du haut et de la barre du bas
   pour chaque écran.

   Dépend de : REPORT_MODULES (rempli par js/reports.js) et
   generateCerfaPDF (défini dans js/cerfa.js), loadAdminUsers
   (js/admin.js), loadHistory (js/history.js). Ces fonctions ne sont
   utilisées qu'à l'intérieur de showScreen(), donc l'ordre de
   chargement des fichiers n'a pas d'importance ici : au moment où
   showScreen() sera réellement appelée (clic utilisateur), tous les
   fichiers auront déjà fini de se charger.
   ================================================================== */

// Libellés affichés dans la barre du haut selon l'écran actif.
const CATEGORY_LABELS = {
  diagnostic: 'Diagnostic', travaux: 'Travaux', depannage: 'Dépannage',
  maintenance: 'Maintenance', cerfa: 'CERFA fluides', home: 'FF CLIM',
};

// Mémorise quel écran est actuellement affiché (utile pour savoir sur
// quel rapport agissent les onglets "Rédiger/Aperçu", par exemple).
let currentScreen = 'home';

/**
 * Affiche l'écran "key" (ex. 'home', 'diagnostic', 'cerfa', 'admin',
 * 'history') et cache tous les autres. Met aussi à jour la barre du
 * haut (titre, bouton retour, onglets) et la barre du bas (bouton de
 * téléchargement) en fonction de l'écran choisi.
 */
function showScreen(key) {
  currentScreen = key;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + key).classList.add('active');

  const backBtn = document.getElementById('backBtn');
  const brandText = document.getElementById('brandText');
  const topTabs = document.getElementById('topTabs');
  const bottombar = document.getElementById('bottombar');

  if (key === 'home') {
    backBtn.style.display = 'none';
    brandText.innerHTML = 'FF CLIM<small>Rapports &amp; documents</small>';
    topTabs.style.display = 'none';
    bottombar.classList.remove('visible');
    document.body.classList.remove('has-bottombar');
  } else if (key === 'admin') {
    backBtn.style.display = 'flex';
    brandText.innerHTML = 'Administration<small>FF CLIM</small>';
    topTabs.style.display = 'none';
    bottombar.classList.remove('visible');
    document.body.classList.remove('has-bottombar');
    window.scrollTo(0, 0);
    loadAdminUsers();
  } else if (key === 'history') {
    backBtn.style.display = 'flex';
    brandText.innerHTML = 'Historique<small>FF CLIM</small>';
    topTabs.style.display = 'none';
    bottombar.classList.remove('visible');
    document.body.classList.remove('has-bottombar');
    window.scrollTo(0, 0);
    loadHistory();
  } else {
    // Écrans de rapport (les 4 catégories génériques + CERFA).
    backBtn.style.display = 'flex';
    brandText.innerHTML = CATEGORY_LABELS[key] + '<small>FF CLIM</small>';
    bottombar.classList.add('visible');
    document.body.classList.add('has-bottombar');

    if (REPORT_MODULES[key]) {
      // Catégories génériques : onglets "Rédiger / Aperçu" (utiles sur mobile).
      topTabs.style.display = 'flex';
      setLocalTab(key, 'form');
    } else {
      // CERFA : pas d'onglet, un seul long formulaire à accordéons.
      topTabs.style.display = 'none';
    }
    window.scrollTo(0, 0);
  }

  // Le bouton "Télécharger le PDF" de la barre du bas est unique et
  // partagé par tous les écrans : on redéfinit son action à chaque
  // changement d'écran pour qu'il génère le bon rapport.
  const downloadBtn = document.getElementById('downloadBtn');
  downloadBtn.onclick = () => {
    if (REPORT_MODULES[key]) REPORT_MODULES[key].generatePDF();
    else if (key === 'cerfa') generateCerfaPDF();
  };
}

document.getElementById('backBtn').addEventListener('click', () => showScreen('home'));

/**
 * Bascule, à l'intérieur d'un écran de rapport générique, entre le
 * panneau "Rédiger" (formulaire) et le panneau "Aperçu" (rendu façon
 * PDF). Sur grand écran les deux panneaux sont visibles en permanence
 * (voir la media query 980px dans css/styles.css), donc ces onglets
 * ne servent qu'en dessous de cette largeur.
 */
function setLocalTab(key, which) {
  const container = document.getElementById('screen-' + key);
  const formPanel = container.querySelector('.form-panel');
  const previewPanel = container.querySelector('.preview-panel');
  const tabFormBtn = document.getElementById('tabFormBtn');
  const tabPreviewBtn = document.getElementById('tabPreviewBtn');
  if (which === 'form') {
    formPanel.style.display = 'block'; previewPanel.style.display = 'none';
    tabFormBtn.classList.add('active'); tabPreviewBtn.classList.remove('active');
  } else {
    formPanel.style.display = 'none'; previewPanel.style.display = 'block';
    tabPreviewBtn.classList.add('active'); tabFormBtn.classList.remove('active');
    if (REPORT_MODULES[key]) REPORT_MODULES[key].updatePreview();
  }
}
document.getElementById('tabFormBtn').addEventListener('click', () => setLocalTab(currentScreen, 'form'));
document.getElementById('tabPreviewBtn').addEventListener('click', () => setLocalTab(currentScreen, 'preview'));

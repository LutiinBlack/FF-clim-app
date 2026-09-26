/* ==================================================================
   FF CLIM — Navigation entre écrans
   ==================================================================
   L'application est une "single-page app" : une seule page HTML,
   dans laquelle plusieurs <div class="screen"> se cachent/s'affichent
   selon l'écran voulu. showScreen(key) est LA fonction centrale qui
   gère ce basculement, ainsi que l'apparence de la barre du haut et
   de la barre du bas pour chaque écran.

   Depuis l'ajout du sous-menu "Rédiger un rapport", la navigation a
   deux niveaux (Accueil → sous-menu → écran final), donc le bouton
   retour (←) ne renvoie plus systématiquement à l'accueil : il suit
   la correspondance SCREEN_PARENT ci-dessous.

   Dépend de : REPORT_MODULES (rempli par js/reports.js) et
   generateCerfaPDF (défini dans js/cerfa.js), loadAdminUsers
   (js/admin.js), loadHistory (js/history.js), renderReportsMenu
   (js/categories.js). Ces fonctions ne sont utilisées qu'à
   l'intérieur de showScreen(), donc l'ordre de chargement des
   fichiers n'a pas d'importance ici.
   ================================================================== */

// Libellés affichés dans la barre du haut selon l'écran actif.
const CATEGORY_LABELS = {
  diagnostic: 'Diagnostic', travaux: 'Travaux', depannage: 'Dépannage',
  maintenance: 'Maintenance', cerfa: 'CERFA fluides', home: 'FF CLIM',
};

// À quel écran revient-on en appuyant sur le bouton retour (←), pour
// chaque écran ? Cela crée un vrai "fil d'Ariane" : depuis un rapport
// (ex. "diagnostic"), on revient au sous-menu "Rédiger un rapport"
// plutôt que directement à l'accueil.
const SCREEN_PARENT = {
  diagnostic: 'reports-menu', travaux: 'reports-menu', depannage: 'reports-menu',
  maintenance: 'reports-menu', cerfa: 'reports-menu',
  'reports-menu': 'home', history: 'home', planning: 'home', album: 'home', tutos: 'home', admin: 'home',
};

// Mémorise quel écran est actuellement affiché.
let currentScreen = 'home';

/**
 * Affiche l'écran "key" et cache tous les autres. Met aussi à jour
 * la barre du haut (titre, bouton retour, onglets) et la barre du
 * bas (bouton de téléchargement) en fonction de l'écran choisi.
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
  } else if (key === 'reports-menu') {
    backBtn.style.display = 'flex';
    brandText.innerHTML = 'Rédiger un rapport<small>FF CLIM</small>';
    topTabs.style.display = 'none';
    bottombar.classList.remove('visible');
    document.body.classList.remove('has-bottombar');
    window.scrollTo(0, 0);
    renderReportsMenu();
  } else if (key === 'planning' || key === 'album' || key === 'tutos') {
    // Les 3 sections encore à venir partagent le même comportement :
    // seul le libellé affiché change.
    const labels = { planning: 'Planning', album: 'Album photo', tutos: 'Tutos' };
    backBtn.style.display = 'flex';
    brandText.innerHTML = labels[key] + '<small>FF CLIM</small>';
    topTabs.style.display = 'none';
    bottombar.classList.remove('visible');
    document.body.classList.remove('has-bottombar');
    window.scrollTo(0, 0);
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
      topTabs.style.display = 'flex';
      setLocalTab(key, 'form');
    } else {
      topTabs.style.display = 'none';
    }
    window.scrollTo(0, 0);
  }

  const downloadBtn = document.getElementById('downloadBtn');
  downloadBtn.onclick = () => {
    if (REPORT_MODULES[key]) REPORT_MODULES[key].generatePDF();
    else if (key === 'cerfa') generateCerfaPDF();
  };
}

document.getElementById('backBtn').addEventListener('click', () => showScreen(SCREEN_PARENT[currentScreen] || 'home'));

/**
 * Bascule, à l'intérieur d'un écran de rapport générique, entre le
 * panneau "Rédiger" (formulaire) et le panneau "Aperçu" (rendu façon
 * PDF).
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
/* ==================================================================
   FF CLIM — Catégories de rapport & menus de l'application
   ==================================================================
   Deux niveaux de menu :
   - renderHomeGrid()   : la page d'accueil (Rédiger un rapport,
     Historique, Planning, Album photo, Tutos, Administration).
   - renderReportsMenu(): le sous-menu "Rédiger un rapport", qui
     liste les 5 catégories de rapport (Diagnostic, Travaux,
     Dépannage, Maintenance, CERFA), filtrées selon les droits de
     l'utilisateur connecté (voir categoryAllowed() dans js/auth.js).

   Dépend de : js/icons.js (ICONS), js/auth.js (categoryAllowed,
   currentProfile), js/navigation.js (showScreen, appelé au clic).
   ================================================================== */
const REPORT_CATEGORIES = [
  { key: 'diagnostic',  label: 'Diagnostic',  icon: 'search', desc: "Constat et recherche de panne" },
  { key: 'travaux',     label: 'Travaux',     icon: 'wrench', desc: "Travaux réalisés sur site" },
  { key: 'depannage',   label: 'Dépannage',   icon: 'bolt',   desc: "Intervention de dépannage" },
  { key: 'maintenance', label: 'Maintenance', icon: 'tools',  desc: "Entretien et maintenance" },
];

/**
 * (Re)construit la page d'accueil : le message de bienvenue
 * personnalisé, puis la grille des 6 entrées de menu principal.
 * "Rédiger un rapport", "Historique", "Planning", "Album photo" et
 * "Tutos" sont visibles pour tout utilisateur connecté ;
 * "Administration" est réservée aux comptes admin.
 * Appelée à chaque connexion (voir onLoggedIn() dans js/auth.js).
 */
function renderHomeGrid() {
  const greetEl = document.getElementById('homeGreeting');
  if (greetEl && currentProfile) {
    const displayName = currentProfile.full_name || (currentProfile.email ? currentProfile.email.split('@')[0] : '');
    greetEl.textContent = 'Bonjour' + (displayName ? ' ' + displayName : '') + ' 👋';
  }

  const grid = document.getElementById('catGrid');
  let html = '';

  html += `<button class="cat-card" data-key="reports-menu">
    <div class="cat-icon">${ICONS.doc}</div>
    <div class="cat-label">Rédiger un rapport</div>
    <div class="cat-desc">Diagnostic, Travaux, Dépannage, Maintenance, CERFA</div>
  </button>`;

  if (currentProfile) {
    html += `<button class="cat-card" data-key="history">
      <div class="cat-icon">${ICONS.clock}</div>
      <div class="cat-label">Historique</div>
      <div class="cat-desc">Tous les rapports générés</div>
    </button>`;

    html += `<button class="cat-card" data-key="planning">
      <div class="cat-icon">${ICONS.calendar}</div>
      <div class="cat-label">Planning</div>
      <div class="cat-desc">Vos interventions à venir</div>
    </button>`;

    html += `<button class="cat-card" data-key="album">
      <div class="cat-icon">${ICONS.image}</div>
      <div class="cat-label">Album photo</div>
      <div class="cat-desc">Photos des interventions</div>
    </button>`;

    html += `<button class="cat-card" data-key="tutos">
      <div class="cat-icon">${ICONS.book}</div>
      <div class="cat-label">Tutos</div>
      <div class="cat-desc">Guides et procédures</div>
    </button>`;
  }

  if (currentProfile && currentProfile.role === 'admin') {
    html += `<button class="cat-card admin" data-key="admin">
      <div class="cat-icon">${ICONS.tools}</div>
      <div class="cat-label">Administration</div>
      <div class="cat-desc">Gérer les utilisateurs et leurs droits</div>
    </button>`;
  }

  grid.innerHTML = html;
  grid.querySelectorAll('.cat-card').forEach(btn => {
    btn.addEventListener('click', () => showScreen(btn.dataset.key));
  });
}

/**
 * (Re)construit le sous-menu "Rédiger un rapport" : une carte par
 * catégorie de rapport à laquelle l'utilisateur a droit (les 4
 * catégories génériques + le CERFA). Si aucune catégorie n'est
 * autorisée, affiche un message plutôt qu'une grille vide.
 * Appelée à chaque ouverture de cet écran (voir showScreen() dans
 * js/navigation.js).
 */
function renderReportsMenu() {
  const container = document.getElementById('screen-reports-menu');
  let cardsHtml = '';

  REPORT_CATEGORIES.forEach(c => {
    if (!categoryAllowed(c.key)) return;
    cardsHtml += `<button class="cat-card" data-key="${c.key}">
      <div class="cat-icon">${ICONS[c.icon]}</div>
      <div class="cat-label">${c.label}</div>
      <div class="cat-desc">${c.desc}</div>
    </button>`;
  });

  if (categoryAllowed('cerfa')) {
    cardsHtml += `<button class="cat-card cerfa" data-key="cerfa">
      <div class="cat-icon">${ICONS.doc}</div>
      <div class="cat-label">CERFA fluides</div>
      <div class="cat-desc">Fiche d'intervention officielle (F-Gas)</div>
    </button>`;
  }

  if (!cardsHtml) {
    cardsHtml = `<p style="grid-column:1/-1; color:var(--ink-soft); font-size:13px;">Aucune catégorie ne vous a encore été attribuée. Contactez un administrateur.</p>`;
  }

  container.innerHTML = `
    <div class="home-wrap">
      <div class="cat-grid">${cardsHtml}</div>
    </div>
  `;
  container.querySelectorAll('.cat-card').forEach(btn => {
    btn.addEventListener('click', () => showScreen(btn.dataset.key));
  });
}
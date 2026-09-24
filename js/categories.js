/* ==================================================================
   FF CLIM — Catégories de rapport & grille de la page d'accueil
   ==================================================================
   Ce fichier définit la liste des 4 catégories de rapport "génériques"
   (Diagnostic, Travaux, Dépannage, Maintenance — celles qui partagent
   toutes la même structure de formulaire, voir js/reports.js) et
   construit la grille de cartes affichée sur la page d'accueil, en
   ne montrant que les catégories auxquelles l'utilisateur connecté a
   droit (voir categoryAllowed() dans js/auth.js).

   Note : la carte "CERFA" (formulaire officiel, structure différente)
   et les cartes "Historique"/"Administration" ne sont pas dans
   REPORT_CATEGORIES : elles sont ajoutées séparément dans
   renderHomeGrid() ci-dessous, car elles suivent des règles d'accès
   différentes (CERFA reste une "categoryAllowed", mais Historique est
   ouvert à tous les connectés, et Administration réservé aux admins).

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
 * (Re)construit entièrement la page d'accueil : le message de
 * bienvenue personnalisé, puis la grille de cartes-catégories,
 * filtrée selon les droits de l'utilisateur connecté.
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

  // Les 4 catégories de rapport génériques.
  REPORT_CATEGORIES.forEach(c => {
    if (!categoryAllowed(c.key)) return;
    html += `<button class="cat-card" data-key="${c.key}">
      <div class="cat-icon">${ICONS[c.icon]}</div>
      <div class="cat-label">${c.label}</div>
      <div class="cat-desc">${c.desc}</div>
    </button>`;
  });

  // Le CERFA a sa propre carte, mise en avant visuellement (fond bleu marine).
  if (categoryAllowed('cerfa')) {
    html += `<button class="cat-card cerfa" data-key="cerfa">
      <div class="cat-icon">${ICONS.doc}</div>
      <div class="cat-label">CERFA fluides</div>
      <div class="cat-desc">Fiche d'intervention officielle (F-Gas)</div>
    </button>`;
  }

  // L'historique est visible par tout utilisateur connecté (pas de permission dédiée).
  if (currentProfile) {
    html += `<button class="cat-card" data-key="history">
      <div class="cat-icon">${ICONS.clock}</div>
      <div class="cat-label">Historique</div>
      <div class="cat-desc">Tous les rapports générés</div>
    </button>`;
  }

  // L'administration est réservée aux comptes "admin".
  if (currentProfile && currentProfile.role === 'admin') {
    html += `<button class="cat-card admin" data-key="admin">
      <div class="cat-icon">${ICONS.tools}</div>
      <div class="cat-label">Administration</div>
      <div class="cat-desc">Gérer les utilisateurs et leurs droits</div>
    </button>`;
  }

  if (!html) {
    html = `<p style="grid-column:1/-1; color:var(--ink-soft); font-size:13px;">Aucune catégorie ne vous a encore été attribuée. Contactez un administrateur.</p>`;
  }

  grid.innerHTML = html;
  grid.querySelectorAll('.cat-card').forEach(btn => {
    btn.addEventListener('click', () => showScreen(btn.dataset.key));
  });
}

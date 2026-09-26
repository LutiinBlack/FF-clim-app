/* ==================================================================
   FF CLIM — Historique des rapports générés
   ==================================================================
   Deux écrans :
   - renderHistoryMenu() : un "dossier" par catégorie (Diagnostic,
     Travaux, Dépannage, Maintenance, CERFA fluide), affiché sur
     l'écran "history".
   - renderHistoryListScreen() / loadHistoryList() : la liste des
     rapports d'UNE catégorie (celle du dossier cliqué), avec des
     filtres par période et par intervenant, affichée sur l'écran
     "history-list".

   Dépend de : js/config.js (sb, currentUser, currentProfile),
   js/icons.js (ICONS), js/utils.js (downloadBytes). Appelé par
   js/reports.js et js/cerfa.js (logHistoryEntry, à chaque génération
   de PDF) et par js/navigation.js (renderHistoryMenu /
   renderHistoryListScreen, à l'ouverture des écrans correspondants).
   ================================================================== */

/**
 * Nettoie une chaîne pour en faire un nom de fichier valable dans
 * Supabase Storage : enlève les accents et remplace tout caractère
 * qui n'est pas une lettre/chiffre/point/tiret par un underscore.
 */
function slugify(str) {
  return (str || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_');
}

/**
 * Enregistre un PDF généré dans l'historique partagé : l'envoie dans
 * Supabase Storage (bucket "reports"), puis ajoute une ligne dans la
 * table "history" avec ses métadonnées (catégorie, client,
 * intervenant, auteur...). Volontairement "silencieuse" en cas
 * d'échec : on ne veut jamais bloquer l'utilisateur qui vient de
 * télécharger son PDF avec succès.
 */
async function logHistoryEntry(category, missionTitle, client, pdfBlob, filename, intervenant) {
  try {
    const safeFilename = slugify(filename);
    const path = `${category}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeFilename}`;
    const { error: upErr } = await sb.storage.from('reports').upload(path, pdfBlob, { contentType: 'application/pdf' });
    if (upErr) { console.warn('Échec upload historique', upErr); return; }
    await sb.from('history').insert({
      category,
      client: client || null,
      mission_title: missionTitle || null,
      intervenant: intervenant || null,
      created_by: currentUser.id,
      created_by_name: (currentProfile && (currentProfile.full_name || currentProfile.email)) || null,
      pdf_path: path,
    });
  } catch (e) { console.warn('Échec enregistrement historique', e); }
}

// Les 5 "dossiers" de l'historique, un par catégorie de rapport.
const HISTORY_CATEGORIES = [
  { key: 'diagnostic',  label: 'Diagnostic',  icon: 'search' },
  { key: 'travaux',     label: 'Travaux',     icon: 'wrench' },
  { key: 'depannage',   label: 'Dépannage',   icon: 'bolt' },
  { key: 'maintenance', label: 'Maintenance', icon: 'tools' },
  { key: 'cerfa',       label: 'CERFA fluide', icon: 'doc' },
];
const HISTORY_CATEGORY_LABELS = Object.fromEntries(HISTORY_CATEGORIES.map(c => [c.key, c.label]));

// Catégorie du dossier actuellement ouvert sur l'écran "history-list".
let currentHistoryCategory = null;

/**
 * (Re)construit le menu des dossiers de l'historique (un par
 * catégorie). Appelée à chaque ouverture de l'écran "history"
 * (voir js/navigation.js).
 */
function renderHistoryMenu() {
  const container = document.getElementById('screen-history');
  const cardsHtml = HISTORY_CATEGORIES.map(c => `
    <button class="cat-card" data-key="${c.key}">
      <div class="cat-icon">${ICONS[c.icon]}</div>
      <div class="cat-label">${c.label}</div>
      <div class="cat-desc">Rapports générés dans cette catégorie</div>
    </button>
  `).join('');
  container.innerHTML = `
    <div class="home-wrap">
      <div class="cat-grid">${cardsHtml}</div>
    </div>
  `;
  container.querySelectorAll('.cat-card').forEach(btn => {
    btn.addEventListener('click', () => openHistoryCategory(btn.dataset.key));
  });
}

/** Ouvre le dossier "catKey" : mémorise la catégorie puis change d'écran. */
function openHistoryCategory(catKey) {
  currentHistoryCategory = catKey;
  showScreen('history-list');
}

function historyListTemplate() {
  return `
    <div class="history-wrap">
      <div class="field">
        <label>Période</label>
        <select id="hist_period">
          <option value="">Toutes les dates</option>
          <option value="week">Cette semaine (7 derniers jours)</option>
          <option value="month">Ce mois-ci (30 derniers jours)</option>
          <option value="year">Cette année (12 derniers mois)</option>
        </select>
      </div>
      <div class="field">
        <label>Intervenant</label>
        <input type="text" id="hist_intervenant" placeholder="ex. Traoré Balla">
      </div>
      <div id="hist_list" style="margin-top:16px;"></div>
    </div>
  `;
}

/**
 * (Re)construit l'écran de liste (filtres + zone de résultats) et
 * câble les événements de filtrage. Appelée à chaque ouverture de
 * l'écran "history-list" (voir js/navigation.js).
 */
function renderHistoryListScreen() {
  document.getElementById('screen-history-list').innerHTML = historyListTemplate();
  document.getElementById('hist_period').addEventListener('change', loadHistoryList);
  // Un petit délai (350 ms) après la dernière frappe avant de relancer
  // la recherche, pour ne pas interroger la base à chaque lettre tapée.
  let histFilterTimer = null;
  document.getElementById('hist_intervenant').addEventListener('input', () => {
    clearTimeout(histFilterTimer);
    histFilterTimer = setTimeout(loadHistoryList, 350);
  });
  loadHistoryList();
}

/**
 * Convertit une valeur de filtre ('week'/'month'/'year'/'') en date
 * de départ pour la requête (ou null si "Toutes les dates"). Utilise
 * des fenêtres glissantes (les 7/30/365 derniers jours) plutôt que
 * des semaines/mois calendaires, pour rester simple.
 */
function historyPeriodStart(period) {
  const d = new Date();
  if (period === 'week') { d.setDate(d.getDate() - 7); return d; }
  if (period === 'month') { d.setDate(d.getDate() - 30); return d; }
  if (period === 'year') { d.setDate(d.getDate() - 365); return d; }
  return null;
}

/**
 * Recharge la liste d'historique pour la catégorie du dossier
 * ouvert (currentHistoryCategory), en appliquant les filtres de
 * période et d'intervenant actuellement saisis.
 */
async function loadHistoryList() {
  const listEl = document.getElementById('hist_list');
  listEl.innerHTML = '<p style="color:var(--ink-soft); font-size:13px;">Chargement...</p>';

  const period = document.getElementById('hist_period').value;
  const intervenant = document.getElementById('hist_intervenant').value.trim();

  let query = sb.from('history')
    .select('*')
    .eq('category', currentHistoryCategory)
    .order('created_at', { ascending: false })
    .limit(100);

  const startDate = historyPeriodStart(period);
  if (startDate) query = query.gte('created_at', startDate.toISOString());
  if (intervenant) query = query.ilike('intervenant', `%${intervenant}%`);

  const { data, error } = await query;
  if (error) { listEl.innerHTML = '<p style="color:var(--danger); font-size:13px;">Erreur de chargement.</p>'; return; }
  if (!data.length) { listEl.innerHTML = '<p style="color:var(--ink-soft); font-size:13px;">Aucun rapport ne correspond à ces filtres.</p>'; return; }

  listEl.innerHTML = data.map(h => {
    const d = new Date(h.created_at);
    const dateStr = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return `
      <div class="hist-row">
        <div class="hist-main">
          <span class="hist-badge">${HISTORY_CATEGORY_LABELS[h.category] || h.category}</span>
          <div class="hist-title">${h.mission_title || h.client || '(sans titre)'}</div>
          <div class="hist-meta">${h.client ? h.client + ' · ' : ''}${h.intervenant ? h.intervenant + ' · ' : ''}${dateStr} · par ${h.created_by_name || '—'}</div>
        </div>
        <button class="hist-dl-btn" data-path="${h.pdf_path}">⬇</button>
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('.hist-dl-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true; btn.textContent = '...';
      const { data: fileData, error: dlErr } = await sb.storage.from('reports').download(btn.dataset.path);
      btn.disabled = false; btn.textContent = '⬇';
      if (dlErr) { alert('Erreur de téléchargement : ' + dlErr.message); return; }
      const filename = btn.dataset.path.split('/').pop();
      downloadBytes(fileData, filename);
    });
  });
}
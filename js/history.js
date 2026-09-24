/* ==================================================================
   FF CLIM — Historique des rapports générés
   ==================================================================
   Chaque fois qu'un PDF (rapport générique ou CERFA) est généré, il
   est aussi envoyé vers Supabase Storage (le "coffre" de fichiers de
   Supabase) et une ligne est ajoutée dans la table "history" pour le
   retrouver plus tard. Cet écran liste ces entrées, avec un filtre
   par catégorie, et permet de re-télécharger n'importe quel PDF déjà
   généré (par soi-même ou par un collègue).

   Dépend de : js/config.js (sb, currentUser, currentProfile),
   js/cerfa.js / js/utils.js (downloadBytes). Appelé par
   js/reports.js et js/cerfa.js (logHistoryEntry, à chaque génération
   de PDF) et par js/navigation.js (loadHistory, à l'ouverture de
   l'écran Historique).
   ================================================================== */

/**
 * Nettoie une chaîne pour en faire un nom de fichier valable dans
 * Supabase Storage : enlève les accents (ex. "é" → "e") et remplace
 * tout caractère qui n'est pas une lettre/chiffre/point/tiret par un
 * underscore. Nécessaire car Supabase Storage refuse certains
 * caractères (notamment les accents) dans le CHEMIN de stockage —
 * mais le nom de fichier proposé à l'utilisateur au téléchargement,
 * lui, garde ses accents normalement (voir generatePDF/generateCerfaPDF).
 */
function slugify(str) {
  return (str || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // sépare puis retire les accents
    .replace(/[^a-zA-Z0-9._-]+/g, '_');
}

/**
 * Enregistre un PDF généré dans l'historique partagé : l'envoie dans
 * Supabase Storage (bucket "reports"), puis ajoute une ligne dans la
 * table "history" avec ses métadonnées (catégorie, client, auteur...).
 * Volontairement "silencieuse" en cas d'échec (juste un avertissement
 * dans la console) : on ne veut jamais bloquer l'utilisateur qui vient
 * de télécharger son PDF avec succès, même si l'enregistrement dans
 * l'historique partagé échoue (ex. pas de réseau à ce moment précis).
 */
async function logHistoryEntry(category, missionTitle, client, pdfBlob, filename) {
  try {
    const safeFilename = slugify(filename);
    const path = `${category}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeFilename}`;
    const { error: upErr } = await sb.storage.from('reports').upload(path, pdfBlob, { contentType: 'application/pdf' });
    if (upErr) { console.warn('Échec upload historique', upErr); return; }
    await sb.from('history').insert({
      category,
      client: client || null,
      mission_title: missionTitle || null,
      created_by: currentUser.id,
      created_by_name: (currentProfile && (currentProfile.full_name || currentProfile.email)) || null,
      pdf_path: path,
    });
  } catch (e) { console.warn('Échec enregistrement historique', e); }
}

const HISTORY_CATEGORY_LABELS = { diagnostic: 'Diagnostic', travaux: 'Travaux', depannage: 'Dépannage', maintenance: 'Maintenance', cerfa: 'CERFA' };

function historyScreenTemplate() {
  return `
    <div class="history-wrap">
      <div class="field">
        <label>Filtrer par catégorie</label>
        <select id="hist_filter">
          <option value="">Toutes les catégories</option>
          <option value="diagnostic">Diagnostic</option>
          <option value="travaux">Travaux</option>
          <option value="depannage">Dépannage</option>
          <option value="maintenance">Maintenance</option>
          <option value="cerfa">CERFA</option>
        </select>
      </div>
      <div id="hist_list" style="margin-top:16px;"></div>
    </div>
  `;
}
document.getElementById('screen-history').innerHTML = historyScreenTemplate();
document.getElementById('hist_filter').addEventListener('change', loadHistory);

/**
 * Recharge la liste d'historique depuis Supabase (les 100 rapports
 * les plus récents, éventuellement filtrés par catégorie) et
 * construit une ligne par rapport, avec un bouton de téléchargement
 * qui va chercher le fichier PDF correspondant dans Supabase Storage.
 */
async function loadHistory() {
  const listEl = document.getElementById('hist_list');
  listEl.innerHTML = '<p style="color:var(--ink-soft); font-size:13px;">Chargement...</p>';
  const filter = document.getElementById('hist_filter').value;
  let query = sb.from('history').select('*').order('created_at', { ascending: false }).limit(100);
  if (filter) query = query.eq('category', filter);
  const { data, error } = await query;
  if (error) { listEl.innerHTML = '<p style="color:var(--danger); font-size:13px;">Erreur de chargement.</p>'; return; }
  if (!data.length) { listEl.innerHTML = '<p style="color:var(--ink-soft); font-size:13px;">Aucun rapport dans l\'historique pour le moment.</p>'; return; }

  listEl.innerHTML = data.map(h => {
    const d = new Date(h.created_at);
    const dateStr = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return `
      <div class="hist-row">
        <div class="hist-main">
          <span class="hist-badge">${HISTORY_CATEGORY_LABELS[h.category] || h.category}</span>
          <div class="hist-title">${h.mission_title || h.client || '(sans titre)'}</div>
          <div class="hist-meta">${h.client ? h.client + ' · ' : ''}${dateStr} · par ${h.created_by_name || '—'}</div>
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

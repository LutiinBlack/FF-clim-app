/* ==================================================================
   FF CLIM — Panneau d'administration (gestion des utilisateurs)
   ==================================================================
   Réservé aux comptes ayant le rôle "admin" (voir showScreen('admin')
   dans js/navigation.js, qui n'affiche jamais cette carte aux autres
   utilisateurs — mais la vraie protection contre un accès non
   autorisé se fait côté Supabase, via les règles Row Level Security
   et l'Edge Function "admin-users").

   Créer, modifier ou supprimer un compte Supabase Auth ne peut PAS se
   faire depuis le navigateur avec la clé publique normale : ce sont
   des opérations "administrateur" qui nécessitent une clé secrète,
   qu'on ne doit jamais exposer côté client. C'est pourquoi ces 3
   actions passent par callAdminFunction(), qui appelle une Edge
   Function Supabase (du code serveur) nommée "admin-users" : c'est ce
   code serveur, et lui seul, qui détient la clé secrète et vérifie
   que l'appelant est bien un administrateur avant d'agir.

   Dépend de : js/config.js (sb, currentUser), js/navigation.js
   (appelée par showScreen('admin') → loadAdminUsers()).
   ================================================================== */

// Catégories pour lesquelles un administrateur peut cocher/décocher
// une permission par utilisateur (voir renderUserRow ci-dessous).
const ADMIN_CATEGORIES = [
  { key: 'diagnostic', label: 'Diagnostic' },
  { key: 'travaux', label: 'Travaux' },
  { key: 'depannage', label: 'Dépannage' },
  { key: 'maintenance', label: 'Maintenance' },
  { key: 'cerfa', label: 'CERFA' },
];

function adminScreenTemplate() {
  return `
    <div class="admin-wrap">
      <div class="card">
        <h2><span class="num">+</span>Ajouter un utilisateur</h2>
        <div class="field"><label>Nom complet</label><input type="text" id="adm_new_name" placeholder="ex. Jean Dupont"></div>
        <div class="grid2">
          <div class="field"><label>Email</label><input type="email" id="adm_new_email"></div>
          <div class="field"><label>Mot de passe</label><input type="text" id="adm_new_password" placeholder="min. 6 caractères"></div>
        </div>
        <button class="btn-primary" id="adm_create_btn" type="button" style="width:100%;">+ Créer le compte</button>
        <div class="status-msg" id="adm_create_status"></div>
      </div>

      <div class="card">
        <h2><span class="num">👥</span>Utilisateurs (<span id="adm_user_count">0</span>/10)</h2>
        <div id="adm_user_list"></div>
      </div>
    </div>
  `;
}

/**
 * Construit le HTML d'une ligne "utilisateur" dans la liste, avec :
 * son nom/email, le bouton "Admin" (rôle), les cases de permission
 * par catégorie, un panneau de modification repliable (nom/email/
 * mot de passe), et les boutons Modifier/Supprimer.
 * "profile" vient de la table Supabase "profiles" ; "permsMap" est
 * un objet {diagnostic: true, cerfa: false, ...} pour CET utilisateur.
 */
function renderUserRow(profile, permsMap) {
  const isSelf = profile.id === currentUser.id;
  const catChecks = ADMIN_CATEGORIES.map(c => `
    <label class="perm-chip">
      <input type="checkbox" data-user="${profile.id}" data-cat="${c.key}" ${permsMap[c.key] ? 'checked' : ''}>
      ${c.label}
    </label>
  `).join('');
  const safeName = (profile.full_name || '').replace(/"/g, '&quot;');
  const safeEmail = (profile.email || '').replace(/"/g, '&quot;');
  return `
    <div class="user-row" data-user-id="${profile.id}">
      <div class="user-row-head">
        <div>
          <div class="user-name">${profile.full_name || '(sans nom)'} ${isSelf ? '<span class="you-tag">vous</span>' : ''}</div>
          <div class="user-email">${profile.email || ''}</div>
        </div>
        <label class="admin-toggle">
          <input type="checkbox" class="adm_role_toggle" data-user="${profile.id}" ${profile.role === 'admin' ? 'checked' : ''} ${isSelf ? 'disabled' : ''}>
          Admin
        </label>
      </div>
      <div class="perm-chips">${catChecks}</div>

      <div class="edit-panel" id="edit_${profile.id}" style="display:none;">
        <div class="field"><label>Nom complet</label><input type="text" class="edit_name" data-user="${profile.id}" value="${safeName}"></div>
        <div class="field"><label>Email</label><input type="email" class="edit_email" data-user="${profile.id}" value="${safeEmail}"></div>
        <div class="field"><label>Nouveau mot de passe (laisser vide pour ne pas changer)</label><input type="text" class="edit_password" data-user="${profile.id}" placeholder="min. 6 caractères"></div>
        <div class="status-msg" id="edit_status_${profile.id}"></div>
        <button class="btn-primary edit_save_btn" data-user="${profile.id}" type="button" style="width:100%;">Enregistrer les modifications</button>
      </div>

      <div class="row-actions">
        <button class="edit-toggle-btn" data-user="${profile.id}" type="button">✎ Modifier</button>
        <button class="adm_delete_btn" data-user="${profile.id}" type="button" ${isSelf ? 'disabled' : ''}>✕ Supprimer</button>
      </div>
    </div>
  `;
}

/**
 * Recharge la liste des utilisateurs depuis Supabase et reconstruit
 * entièrement le panneau (compteur, lignes, et tous les écouteurs
 * d'événements associés). Appelée à chaque fois qu'on ouvre l'écran
 * Administration, et après chaque action qui change la liste
 * (création, suppression, modification).
 */
async function loadAdminUsers() {
  const listEl = document.getElementById('adm_user_list');
  listEl.innerHTML = '<p style="color:var(--ink-soft); font-size:13px;">Chargement...</p>';

  const { data: profiles, error } = await sb.from('profiles').select('*').order('created_at', { ascending: true });
  if (error) { listEl.innerHTML = '<p style="color:var(--danger); font-size:13px;">Erreur de chargement.</p>'; return; }

  const { data: perms } = await sb.from('permissions').select('*');
  const permsByUser = {};
  (perms || []).forEach(p => {
    if (!permsByUser[p.user_id]) permsByUser[p.user_id] = {};
    permsByUser[p.user_id][p.category] = p.allowed;
  });

  document.getElementById('adm_user_count').textContent = profiles.length;
  listEl.innerHTML = profiles.map(p => renderUserRow(p, permsByUser[p.id] || {})).join('');

  // Case à cocher de permission par catégorie : "upsert" (met à jour
  // si la ligne existe déjà, sinon la crée) dans la table "permissions".
  listEl.querySelectorAll('input[type=checkbox][data-cat]').forEach(cb => {
    cb.addEventListener('change', async () => {
      const userId = cb.dataset.user, cat = cb.dataset.cat, allowed = cb.checked;
      await sb.from('permissions').upsert({ user_id: userId, category: cat, allowed }, { onConflict: 'user_id,category' });
    });
  });

  // Bascule du rôle admin/utilisateur normal.
  listEl.querySelectorAll('.adm_role_toggle').forEach(cb => {
    cb.addEventListener('change', async () => {
      const userId = cb.dataset.user;
      const newRole = cb.checked ? 'admin' : 'user';
      const { error } = await sb.from('profiles').update({ role: newRole }).eq('id', userId);
      if (error) { alert("Impossible : " + error.message); cb.checked = !cb.checked; }
    });
  });

  // Suppression d'un compte (passe par l'Edge Function : opération sensible).
  listEl.querySelectorAll('.adm_delete_btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Supprimer définitivement ce compte ?')) return;
      btn.disabled = true;
      const result = await callAdminFunction({ action: 'delete', user_id: btn.dataset.user });
      if (result.error) { alert('Erreur : ' + result.error); btn.disabled = false; return; }
      loadAdminUsers();
    });
  });

  // Afficher/masquer le panneau "Modifier" de chaque utilisateur.
  listEl.querySelectorAll('.edit-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const panel = document.getElementById('edit_' + btn.dataset.user);
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });
  });

  // Enregistrer les modifications (nom / email / mot de passe) — passe
  // aussi par l'Edge Function, car changer l'email ou le mot de passe
  // d'un AUTRE utilisateur est une opération administrateur.
  listEl.querySelectorAll('.edit_save_btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const userId = btn.dataset.user;
      const nameEl = listEl.querySelector(`.edit_name[data-user="${userId}"]`);
      const emailEl = listEl.querySelector(`.edit_email[data-user="${userId}"]`);
      const passEl = listEl.querySelector(`.edit_password[data-user="${userId}"]`);
      const statusEl = document.getElementById('edit_status_' + userId);
      const name = nameEl.value.trim();
      const email = emailEl.value.trim();
      const password = passEl.value;
      if (password && password.length < 6) {
        statusEl.textContent = "Le mot de passe doit faire au moins 6 caractères.";
        return;
      }
      btn.disabled = true; statusEl.textContent = 'Enregistrement...';
      const payload = { action: 'update', user_id: userId, full_name: name, email };
      if (password) payload.password = password;
      const result = await callAdminFunction(payload);
      btn.disabled = false;
      if (result.error) { statusEl.textContent = 'Erreur : ' + result.error; return; }
      statusEl.textContent = 'Modifié ✓';
      loadAdminUsers();
    });
  });
}

/**
 * Appelle l'Edge Function Supabase "admin-users" avec le jeton
 * d'authentification de l'administrateur connecté (pour que la
 * fonction puisse vérifier ses droits côté serveur avant d'agir).
 * "payload.action" vaut 'create', 'update' ou 'delete'.
 */
async function callAdminFunction(payload) {
  const { data: sessionData } = await sb.auth.getSession();
  const token = sessionData.session.access_token;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  return res.json();
}

document.getElementById('screen-admin').innerHTML = adminScreenTemplate();
document.getElementById('adm_create_btn').addEventListener('click', async () => {
  const name = document.getElementById('adm_new_name').value.trim();
  const email = document.getElementById('adm_new_email').value.trim();
  const password = document.getElementById('adm_new_password').value;
  const statusEl = document.getElementById('adm_create_status');
  const btn = document.getElementById('adm_create_btn');
  statusEl.textContent = '';
  if (!email || !password || password.length < 6) {
    statusEl.textContent = "Email requis, mot de passe d'au moins 6 caractères.";
    return;
  }
  btn.disabled = true; statusEl.textContent = 'Création en cours...';
  const result = await callAdminFunction({ action: 'create', email, password, full_name: name });
  btn.disabled = false;
  if (result.error) { statusEl.textContent = 'Erreur : ' + result.error; return; }
  await sb.from('profiles').update({ email }).eq('id', result.user.id);
  document.getElementById('adm_new_name').value = '';
  document.getElementById('adm_new_email').value = '';
  document.getElementById('adm_new_password').value = '';
  statusEl.textContent = 'Utilisateur créé ✓';
  loadAdminUsers();
});

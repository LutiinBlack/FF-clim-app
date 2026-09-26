/* ==================================================================
   FF CLIM — Authentification, profil et permissions
   ==================================================================
   Ce module gère tout le cycle de vie de la connexion utilisateur :
   se connecter, se déconnecter, reprendre une session déjà ouverte
   au rechargement de la page, et savoir quelles catégories de
   rapport l'utilisateur connecté a le droit d'utiliser.

   Dépend de : js/config.js (variable "sb", currentUser, currentProfile,
   currentPermissions). Doit être chargé après config.js.
   Utilisé par : js/navigation.js (showScreen), js/categories.js
   (renderHomeGrid), js/main.js (boutons de connexion/déconnexion).
   ================================================================== */

/**
 * Va chercher, dans la base de données, le profil de l'utilisateur
 * connecté (nom, rôle admin/user...) ainsi que la liste de ses
 * permissions par catégorie de rapport. Remplit les variables
 * globales currentProfile et currentPermissions.
 * Retourne true si tout s'est bien passé, false sinon.
 */
async function loadProfileAndPermissions() {
  const { data: profile, error: pErr } = await sb
    .from('profiles')
    .select('*')
    .eq('id', currentUser.id)
    .single();
  if (pErr) { console.error(pErr); return false; }
  currentProfile = profile;

  const { data: perms } = await sb
    .from('permissions')
    .select('category, allowed')
    .eq('user_id', currentUser.id);
  currentPermissions = {};
  (perms || []).forEach(p => { currentPermissions[p.category] = p.allowed; });
  return true;
}

/**
 * Est-ce que l'utilisateur connecté peut accéder à la catégorie de
 * rapport "key" (ex. "diagnostic", "cerfa"...) ? Les administrateurs
 * ont toujours accès à tout ; les autres utilisateurs dépendent de
 * ce qui a été coché pour eux dans le panneau Administration.
 */
function categoryAllowed(key) {
  if (!currentProfile) return false;
  if (currentProfile.role === 'admin') return true;
  return !!currentPermissions[key];
}

/**
 * Appelée juste après une connexion réussie (ou une reprise de
 * session) : affiche le bouton de déconnexion, construit la grille
 * des catégories autorisées, et bascule sur l'écran d'accueil.
 */
function onLoggedIn() {
  document.getElementById('logoutBtn').style.display = 'flex';
  renderHomeGrid();
  showScreen('home');
}

/**
 * Gère le clic sur "Se connecter" : valide les champs, appelle
 * Supabase Auth, puis charge le profil avant d'entrer dans l'appli.
 */
async function doLogin() {
  const email = document.getElementById('login_email').value.trim();
  const password = document.getElementById('login_password').value;
  const errEl = document.getElementById('loginError');
  const btn = document.getElementById('loginBtn');
  errEl.textContent = '';

  if (!email || !password) {
    errEl.textContent = "Renseignez votre email et votre mot de passe.";
    return;
  }

  btn.disabled = true; btn.textContent = 'Connexion...';
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  btn.disabled = false; btn.textContent = 'Se connecter';

  if (error) { errEl.textContent = "Identifiants incorrects."; return; }

  currentUser = data.user;
  const ok = await loadProfileAndPermissions();
  if (!ok) { errEl.textContent = "Impossible de charger votre profil."; return; }
  onLoggedIn();
}

/**
 * Déconnecte l'utilisateur : ferme la session Supabase, réinitialise
 * l'état local, et renvoie sur l'écran de connexion.
 */
async function doLogout() {
  await sb.auth.signOut();
  currentUser = null; currentProfile = null; currentPermissions = {};
  document.getElementById('logoutBtn').style.display = 'none';
  document.getElementById('login_email').value = '';
  document.getElementById('login_password').value = '';
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-login').classList.add('active');
  currentScreen = 'login';

  // Remet aussi la barre du haut et la barre du bas dans leur état de
  // départ : sans ça, si on se déconnecte depuis un écran de rapport,
  // le bouton retour, les onglets Rédiger/Aperçu et le bouton
  // "Télécharger le PDF" restaient affichés par-dessus l'écran de connexion.
  document.getElementById('backBtn').style.display = 'none';
  document.getElementById('brandText').innerHTML = 'FF CLIM<small>Rapports &amp; documents</small>';
  document.getElementById('topTabs').style.display = 'none';
  document.getElementById('bottombar').classList.remove('visible');
  document.body.classList.remove('has-bottombar');
}

/**
 * Appelée au tout premier chargement de la page : si le navigateur a
 * déjà une session Supabase valide (l'utilisateur ne s'est pas
 * déconnecté la dernière fois), on le reconnecte automatiquement
 * sans lui redemander ses identifiants.
 */
async function checkExistingSession() {
  const { data } = await sb.auth.getSession();
  if (data.session) {
    currentUser = data.session.user;
    const ok = await loadProfileAndPermissions();
    if (ok) { onLoggedIn(); return; }
  }
}

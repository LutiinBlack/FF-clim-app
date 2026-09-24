/* ==================================================================
   FF CLIM — Point d'entrée (initialisation)
   ==================================================================
   Ce fichier doit être chargé EN DERNIER, une fois que tous les
   autres modules ont défini leurs fonctions et construit leurs
   écrans. Il ne fait que "brancher" les tout derniers événements
   globaux et démarrer l'application en tentant de reprendre une
   session existante.
   ================================================================== */

// Boutons de connexion / déconnexion de l'écran de login et de la barre du haut.
document.getElementById('loginBtn').addEventListener('click', doLogin);
document.getElementById('login_password').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
document.getElementById('logoutBtn').addEventListener('click', doLogout);

// Si une session Supabase valide existe déjà (l'utilisateur ne s'est
// pas déconnecté la dernière fois qu'il a utilisé l'appli), on le
// reconnecte automatiquement sans repasser par l'écran de connexion.
checkExistingSession();

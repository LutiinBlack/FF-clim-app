/* ==================================================================
   FF CLIM — Configuration & connexion à Supabase
   ==================================================================
   Ce fichier doit être chargé EN PREMIER (avant tous les autres
   fichiers js/*.js), car il crée deux choses que le reste du code
   utilise partout :
     - la constante "sb"  → le client Supabase, pour parler à la
       base de données, à l'authentification et au stockage de fichiers.
     - les variables d'état de session (currentUser, currentProfile,
       currentPermissions), remplies après connexion (voir js/auth.js).

   Qu'est-ce que Supabase ?
   ------------------------
   Supabase est un service en ligne qui fournit, prêts à l'emploi :
     - une base de données (PostgreSQL) où sont stockés les profils
       utilisateurs, leurs permissions, et l'historique des rapports ;
     - un système d'authentification (email + mot de passe) ;
     - un espace de stockage de fichiers (les PDF générés) ;
     - des "Edge Functions" : du code serveur qu'on peut appeler
       depuis l'application pour des opérations sensibles (créer un
       utilisateur, par exemple), qui ne doivent jamais être faites
       depuis le navigateur avec des droits d'administrateur.
   Cela permet à FF CLIM de rester une application 100% "statique"
   (aucun serveur à faire tourner soi-même) tout en ayant un vrai
   compte utilisateur multi-personnes.

   SUPABASE_ANON_KEY : est-ce dangereux de la laisser dans le code ?
   -------------------------------------------------------------
   Non : cette clé est prévue pour être publique (elle est visible par
   n'importe qui ouvrant les outils de développement du navigateur).
   La sécurité ne repose pas sur le secret de cette clé, mais sur les
   règles "Row Level Security" (RLS) configurées côté Supabase, qui
   déterminent qui a le droit de lire/modifier quoi dans la base.
   ================================================================== */

const SUPABASE_URL = "https://iqmbrppvuzvhblfmazlk.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_mrJxo9IBH29P8GZC0H47sQ_ftu5UAEM";

// Le script CDN Supabase (chargé dans index.html) expose un objet
// global "supabase" avec une méthode createClient(). "sb" est le
// client qu'on utilisera ensuite partout dans l'application
// (sb.auth.*, sb.from(...), sb.storage.*).
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// État de la session en cours, rempli par js/auth.js après connexion.
// - currentUser       : l'utilisateur Supabase Auth (id, email...)
// - currentProfile    : la ligne correspondante dans la table "profiles"
//                       (nom complet, rôle admin/user...)
// - currentPermissions: un objet { diagnostic: true, cerfa: false, ... }
//                       indiquant les catégories de rapport autorisées.
let currentUser = null;
let currentProfile = null;
let currentPermissions = {};

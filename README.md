# FF CLIM — Rapports d'intervention

Application web (PWA) permettant de rédiger des rapports d'intervention
(Diagnostic, Travaux, Dépannage, Maintenance) et une fiche officielle
CERFA n°15497*04 (fluides frigorigènes), puis de les télécharger en
PDF. Plusieurs utilisateurs peuvent se connecter, avec des droits
différents par catégorie, et un historique partagé de tous les
rapports générés.

Ce document explique comment le projet est organisé, comment chaque
fichier fonctionne, et comment reproduire une application similaire
de zéro — pour un usage personnel ou professionnel.

---

## 1. Vue d'ensemble de l'architecture

L'application est **100% statique** : aucun serveur à faire tourner
soi-même. Elle est composée uniquement de fichiers HTML/CSS/JS
"classiques", sans outil de build (pas de Webpack, Vite, npm run
build...). On peut donc l'héberger n'importe où qui sert des fichiers
statiques (GitHub Pages, Netlify, un simple serveur web...) : il
suffit de déposer les fichiers tels quels.

Toute la partie "backend" (comptes utilisateurs, base de données,
stockage des PDF) est déléguée à **Supabase**, un service en ligne
gratuit (jusqu'à un certain usage) qui fournit :

- **Auth** — connexion par email + mot de passe ;
- **Postgres** — une vraie base de données relationnelle, avec des
  règles de sécurité au niveau des lignes (Row Level Security, RLS) ;
- **Storage** — un espace de stockage de fichiers (les PDF générés) ;
- **Edge Functions** — du code serveur (JavaScript/TypeScript, exécuté
  par Supabase) pour les quelques opérations qui ne doivent JAMAIS
  être faites depuis le navigateur (créer/supprimer un compte
  utilisateur, par exemple).

```
Navigateur (index.html + css/ + js/)
        │
        │  fetch() / supabase-js
        ▼
Supabase (auth, base de données, stockage, edge functions)
```

---

## 2. Arborescence des fichiers

```
index.html                    ← squelette HTML (structure, quasi sans logique)
manifest.json                 ← déclaration PWA (nom, icônes, couleur...)
service-worker.js             ← mise en cache pour le mode hors-ligne / installable
icon-*.png, apple-touch-icon.png  ← icônes de l'application

css/
  styles.css                  ← tout le style visuel de l'application

js/
  config.js                   ← connexion à Supabase (URL, clé, client "sb")
  assets.js                   ← téléchargement du logo + du modèle CERFA
  utils.js                    ← petites fonctions partagées (téléchargement de PDF)
  icons.js                    ← icônes SVG utilisées sur la page d'accueil
  categories.js               ← liste des catégories de rapport + grille d'accueil
  navigation.js                ← bascule entre les différents écrans de l'appli
  auth.js                     ← connexion / déconnexion / permissions
  reports.js                  ← les 4 rapports génériques (formulaire + PDF jsPDF)
  cerfa.js                    ← le formulaire CERFA officiel (rempli via pdf-lib)
  admin.js                    ← panneau d'administration des utilisateurs
  history.js                  ← historique des rapports générés
  pwa.js                      ← service worker + bouton "Installer l'appli"
  main.js                     ← dernier branchement d'événements + démarrage

assets/
  logo.jpg                    ← logo FF CLIM (utilisé sur l'écran de connexion,
                                 la page d'accueil et en haut de chaque PDF)
  cerfa-15497-04.pdf          ← le formulaire CERFA officiel vierge (fillable)
```

### Pourquoi cette organisation, et pas "tout dans un seul fichier" ?

La toute première version de cette application tenait dans un seul
`index.html` de près de 1800 lignes (CSS, JavaScript et même le logo
et le PDF CERFA encodés en `base64` étaient tous mélangés dedans).
Ça fonctionnait, mais c'était devenu difficile à faire évoluer : pour
changer une seule fonctionnalité, il fallait naviguer dans un immense
fichier. Cette version sépare chaque responsabilité dans son propre
fichier, avec des commentaires expliquant son rôle — l'objectif est
qu'on puisse ouvrir n'importe quel fichier de `js/` et comprendre ce
qu'il fait sans avoir à lire tout le reste.

### Comment les fichiers JS communiquent-ils entre eux, sans "import" ?

Ce projet n'utilise **pas** de modules ES (`import`/`export`) ni de
"bundler". À la place, chaque fichier `js/*.js` est chargé par une
balise `<script>` classique dans `index.html`, **dans un ordre précis**
(voir le commentaire en bas de `index.html`). Une fonction ou variable
déclarée avec `const`, `let`, `function` au premier niveau d'un fichier
devient automatiquement accessible dans tous les fichiers chargés
après lui, comme s'ils partageaient tous le même espace de noms
global. C'est une approche volontairement simple (pas besoin de build
tool), mais elle impose de respecter l'ordre de chargement :

1. `config.js` — doit être en premier : tout le reste utilise `sb`.
2. `assets.js` — démarre le téléchargement du logo/CERFA en arrière-plan.
3. `utils.js` — fonctions partagées (`downloadBytes`).
4. `icons.js` — avant `categories.js`, qui utilise `ICONS`.
5. `categories.js` — avant `reports.js`, qui utilise `REPORT_CATEGORIES`.
6. `navigation.js` — avant `reports.js`, qui utilise `CATEGORY_LABELS`.
7. `auth.js` — connexion/déconnexion.
8. `reports.js`, `cerfa.js`, `admin.js`, `history.js` — les modules "métier".
9. `pwa.js` — installation + service worker.
10. `main.js` — toujours en dernier : démarre l'application.

---

## 3. Comment fonctionne chaque partie

### 3.1. Connexion (`js/auth.js`, `js/config.js`)

Il n'y a pas d'inscription "libre" : les comptes sont créés uniquement
par un administrateur, depuis le panneau Administration. Au chargement
de la page, `checkExistingSession()` (appelée depuis `main.js`) vérifie
si une session Supabase est déjà active dans le navigateur ; si oui,
l'utilisateur est reconnecté automatiquement sans repasser par l'écran
de connexion.

### 3.2. Permissions par catégorie

Chaque utilisateur a un `role` (`user` ou `admin`) dans la table
`profiles`, et une ligne par catégorie autorisée dans la table
`permissions`. Un administrateur a accès à tout, automatiquement
(`categoryAllowed()` dans `js/auth.js`). La page d'accueil
(`renderHomeGrid()` dans `js/categories.js`) ne construit que les
cartes que l'utilisateur connecté a le droit de voir.

### 3.3. Rapports génériques (`js/reports.js`)

Diagnostic, Travaux, Dépannage et Maintenance partagent exactement la
même structure de formulaire et le même gabarit de PDF (seul le
libellé change) — plutôt que de dupliquer le code 4 fois,
`initReportModule(key)` instancie un module indépendant par catégorie.
Chaque champ de saisie est sauvegardé automatiquement dans
`localStorage` (brouillon), et un aperçu "façon papier" se met à jour
en direct à chaque frappe. Le PDF final est généré avec
[jsPDF](https://github.com/parallax/jsPDF) + son extension
[jspdf-autotable](https://github.com/simonbengtsson/jsPDF-AutoTable)
pour le tableau d'en-tête.

### 3.4. CERFA (`js/cerfa.js`)

Contrairement aux rapports génériques, le CERFA remplit un **vrai
formulaire PDF administratif existant** (`assets/cerfa-15497-04.pdf`)
plutôt que d'en dessiner un depuis zéro. Cela se fait avec
[pdf-lib](https://pdf-lib.js.org/), qui sait ouvrir un PDF, trouver
ses champs de formulaire par leur nom interne (`Fiche_no`,
`Case_Assemblage`, des boutons radio, etc.) et les remplir. Ces noms de
champs ont été identifiés en inspectant le PDF source avec un outil
Python comme `pypdf` ou `pikepdf` (voir l'encart plus bas si vous
voulez faire la même chose avec un autre formulaire officiel).

### 3.5. Chargement des ressources binaires (`js/assets.js`)

Le logo et le modèle CERFA vierge sont de vrais fichiers dans
`assets/`, téléchargés une seule fois au démarrage de l'application
(`preloadAssets()`), puis gardés en mémoire :
- le logo est converti en "Data URL" (car jsPDF sait insérer une image
  à partir d'une chaîne de ce type) ;
- le CERFA est gardé tel quel en octets bruts (`Uint8Array`), car
  pdf-lib sait charger un PDF directement à partir de ça.

Les deux modules de génération de PDF (`js/reports.js`, `js/cerfa.js`)
attendent la promesse `assetsReady` avant de générer quoi que ce soit,
au cas où le téléchargement ne serait pas encore terminé.

### 3.6. Historique (`js/history.js`)

À chaque PDF généré, `logHistoryEntry()` l'envoie vers un bucket
Supabase Storage nommé `reports`, et ajoute une ligne dans la table
`history`. L'écran Historique liste ces entrées (avec un filtre par
catégorie) et permet de re-télécharger n'importe quel PDF déjà généré.
Un détail piégeux : Supabase Storage refuse certains caractères
accentués dans le **chemin** de stockage — d'où la fonction
`slugify()`, qui ne nettoie que le chemin interne, jamais le nom de
fichier proposé à l'utilisateur au téléchargement.

### 3.7. Administration (`js/admin.js`)

Créer, modifier l'email/mot de passe, ou supprimer un compte Supabase
sont des opérations qui nécessitent une **clé secrète** (jamais la clé
publique utilisée dans `config.js`). C'est pourquoi ces 3 actions
passent par un appel à une **Edge Function** Supabase nommée
`admin-users` (voir §5.5) : c'est ce code serveur, et lui seul, qui
détient la clé secrète et vérifie que l'appelant est bien administrateur
avant d'agir.

### 3.8. PWA (`js/pwa.js`, `service-worker.js`, `manifest.json`)

`manifest.json` (non fourni dans ce paquet — déjà présent dans votre
dépôt) décrit le nom, les icônes et la couleur de thème de
l'application pour qu'elle soit "installable". `service-worker.js` met
en cache les fichiers de l'application pour un fonctionnement
hors-ligne, avec deux stratégies différentes :
- **network-first** pour les fichiers "cœur" (`index.html`, tout le
  CSS/JS maison) : toujours essayer le réseau en premier, pour que les
  mises à jour soient vues immédiatement, avec le cache en secours si
  hors-ligne ;
- **cache-first** pour les fichiers statiques (icônes, logo, CERFA
  vierge) qui changent rarement.

Un point important : **les appels à Supabase ne sont jamais mis en
cache** (voir le `if (req.url.includes("supabase.co")...)` dans
`service-worker.js`) — sans cela, un téléphone pourrait continuer à
afficher des données périmées (utilisateurs, permissions...) après une
modification faite depuis un autre appareil.

**À chaque fois que vous modifiez un fichier CSS/JS**, pensez à
incrémenter `CACHE_NAME` dans `service-worker.js` (ex. `v4` → `v5`),
sinon les téléphones ayant déjà installé l'application continueront
à utiliser l'ancienne version mise en cache.

---

## 4. Déployer une modification (workflow Git → GitHub Pages)

1. Modifiez les fichiers dans votre copie locale du dépôt (VS Code).
2. Si vous avez touché à un fichier CSS ou JS, incrémentez
   `CACHE_NAME` dans `service-worker.js`.
3. Dans VS Code, ouvrez le panneau **Source Control**, écrivez un
   message de commit décrivant le changement, cliquez sur **Commit**
   puis **Push** (synchroniser les modifications).
4. GitHub Pages republie automatiquement le site à partir de la
   branche configurée, généralement en 1 à 2 minutes.
5. Sur votre téléphone, si l'application est déjà installée : elle
   détectera la mise à jour au prochain lancement et affichera un
   bandeau "Nouvelle version disponible" (voir `js/pwa.js`).

---

## 5. Reproduire une application similaire de zéro

Cette section explique comment recréer, étape par étape, le "backend"
Supabase qui fait fonctionner cette application — utile si vous
voulez construire un projet personnel similaire.

### 5.1. Créer le projet Supabase

1. Créez un compte sur [supabase.com](https://supabase.com) et un
   nouveau projet (gratuit pour un usage modéré).
2. Dans **Project Settings → API**, notez l'**URL du projet** et la
   clé **anon / public** : ce sont les valeurs de `SUPABASE_URL` et
   `SUPABASE_ANON_KEY` dans `js/config.js`. Cette clé publique est
   prévue pour être visible par tout le monde — la sécurité repose sur
   les règles RLS ci-dessous, pas sur son secret.

### 5.2. Schéma de base de données (SQL)

Dans **SQL Editor**, exécutez :

```sql
-- Un profil par utilisateur (en plus du compte Auth interne de Supabase),
-- pour stocker le nom affiché et le rôle (admin ou utilisateur normal).
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now()
);

-- Une ligne par (utilisateur, catégorie) autorisée.
create table permissions (
  user_id uuid not null references profiles(id) on delete cascade,
  category text not null,
  allowed boolean not null default false,
  primary key (user_id, category)
);

-- Historique de tous les PDF générés.
create table history (
  id bigint generated always as identity primary key,
  category text not null,
  client text,
  mission_title text,
  created_by uuid references profiles(id) on delete set null,
  created_by_name text,
  pdf_path text not null,
  created_at timestamptz not null default now()
);

-- Crée automatiquement une ligne "profiles" à chaque inscription
-- (déclenché par Supabase Auth, pas par le code de l'application).
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Fonction utilitaire : "l'utilisateur actuellement connecté est-il admin ?"
-- Utilisée dans les règles RLS ci-dessous (et depuis le client si besoin).
create function public.is_admin()
returns boolean as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable;
```

### 5.3. Sécurité au niveau des lignes (Row Level Security)

Sans RLS, n'importe quel utilisateur connecté pourrait lire ou modifier
les données de n'importe qui d'autre. On active RLS sur chaque table
et on définit précisément qui a le droit de faire quoi :

```sql
alter table profiles set row level security;
alter table permissions set row level security;
alter table history set row level security;

-- Tout utilisateur connecté peut LIRE tous les profils
-- (nécessaire pour afficher la liste dans le panneau Administration).
create policy "profiles: lecture pour les connectés"
  on profiles for select
  using (auth.role() = 'authenticated');

-- Seul un admin peut modifier un profil (ex. changer le rôle de qqn).
create policy "profiles: modification par les admins"
  on profiles for update
  using (public.is_admin());

-- Idem pour les permissions : lecture ouverte aux connectés,
-- écriture réservée aux admins.
create policy "permissions: lecture pour les connectés"
  on permissions for select
  using (auth.role() = 'authenticated');
create policy "permissions: écriture par les admins"
  on permissions for all
  using (public.is_admin())
  with check (public.is_admin());

-- L'historique est un journal partagé : tout connecté peut lire et
-- ajouter une ligne (mais pas modifier/supprimer les lignes des autres).
create policy "history: lecture pour les connectés"
  on history for select
  using (auth.role() = 'authenticated');
create policy "history: ajout pour les connectés"
  on history for insert
  with check (auth.role() = 'authenticated');
```

### 5.4. Stockage des PDF (Storage)

Dans **Storage**, créez un bucket nommé **`reports`**, en **privé**
(pas d'accès public direct), puis ajoutez ses policies :

```sql
create policy "reports: upload par les connectés"
  on storage.objects for insert
  with check (bucket_id = 'reports' and auth.role() = 'authenticated');

create policy "reports: lecture par les connectés"
  on storage.objects for select
  using (bucket_id = 'reports' and auth.role() = 'authenticated');
```

### 5.5. Edge Function `admin-users`

Créer/modifier/supprimer un compte Supabase Auth nécessite la clé
**service_role** (secrète, jamais exposée au navigateur). On écrit donc
une petite fonction serveur qui reçoit la demande, vérifie que
l'appelant est bien administrateur, puis exécute l'action avec cette
clé secrète. Avec la CLI Supabase :

```bash
supabase functions new admin-users
```

`supabase/functions/admin-users/index.ts` :

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");

  // Client "public" : sert uniquement à vérifier QUI appelle.
  const supabaseAuth = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user } } = await supabaseAuth.auth.getUser(token);
  if (!user) return new Response(JSON.stringify({ error: "Non authentifié" }), { status: 401 });

  const { data: profile } = await supabaseAuth
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    return new Response(JSON.stringify({ error: "Réservé aux administrateurs" }), { status: 403 });
  }

  // Client "admin" : utilise la clé secrète, jamais transmise au navigateur.
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const body = await req.json();

  if (body.action === "create") {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: body.email, password: body.password, email_confirm: true,
    });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    await supabaseAdmin.from("profiles").update({ full_name: body.full_name }).eq("id", data.user.id);
    return new Response(JSON.stringify({ user: data.user }));
  }

  if (body.action === "update") {
    const updates: Record<string, unknown> = {};
    if (body.email) updates.email = body.email;
    if (body.password) updates.password = body.password;
    if (Object.keys(updates).length) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(body.user_id, updates);
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    }
    await supabaseAdmin.from("profiles")
      .update({ full_name: body.full_name, email: body.email })
      .eq("id", body.user_id);
    return new Response(JSON.stringify({ ok: true }));
  }

  if (body.action === "delete") {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(body.user_id);
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    return new Response(JSON.stringify({ ok: true }));
  }

  return new Response(JSON.stringify({ error: "Action inconnue" }), { status: 400 });
});
```

Déployez-la avec :

```bash
supabase functions deploy admin-users
```

### 5.6. Créer le tout premier compte administrateur

Comme il n'y a pas d'inscription libre, créez le premier compte
manuellement : **Authentication → Users → Add user** dans le tableau
de bord Supabase, puis, dans **SQL Editor** :

```sql
update profiles set role = 'admin' where email = 'votre@email.com';
```

### 5.7. Créer un formulaire PDF officiel "remplissable" pour un autre document

Si vous voulez adapter ce système à un autre formulaire administratif :

1. Téléchargez la version PDF "remplissable" officielle du document
   (souvent disponible sur service-public.fr pour les CERFA).
2. Listez ses champs de formulaire avec un script Python :
   ```python
   from pypdf import PdfReader
   reader = PdfReader("mon_formulaire.pdf")
   for name, field in reader.get_fields().items():
       print(name, field.field_type)
   ```
3. Reprenez le modèle de `js/cerfa.js` : un `<input>`/`<select>` HTML
   par champ à saisir, puis `setText()`/`setCheck()`/`setRadio()` pour
   reporter chaque valeur dans le champ du PDF portant le même nom.

### 5.8. Déployer sur GitHub Pages

1. Poussez tous ces fichiers sur un dépôt GitHub.
2. Dans les paramètres du dépôt : **Settings → Pages**, choisissez la
   branche à publier (ex. `main`) et le dossier racine.
3. GitHub fournit une URL en `https://<utilisateur>.github.io/<dépôt>/`,
   automatiquement republiée à chaque `git push`.

---

## 6. Pour aller plus loin

Idées d'évolutions déjà envisagées pour ce projet (voir avec l'auteur
du projet pour l'état d'avancement réel) :

- **Planning** : chaque utilisateur voit son propre planning ;
  les administrateurs peuvent voir celui de tout le monde (avec un
  filtre, rien affiché par défaut) ; seuls les administrateurs créent
  des créneaux (client, adresse, catégorie, cause, technicien, heure,
  commentaires).
- **Historique organisé en dossiers par catégorie**, avec filtres par
  date et par intervenant.
- **Album photo** et **Tutos** : sections à définir.
- Dans **Administration**, garder "Utilisateurs" et "Planning" comme
  deux fonctions bien séparées (pas fusionnées dans un seul écran).

Pour ajouter une nouvelle section à l'application, le schéma général
est toujours le même :
1. Un nouveau fichier `js/<nom>.js` qui expose une fonction
   `xxxScreenTemplate()` (le HTML de l'écran) et éventuellement une
   fonction `loadXxx()` (pour charger des données à l'ouverture).
2. Ajouter `<script src="js/<nom>.js"></script>` dans `index.html`
   (avant `main.js`).
3. Ajouter une `<div class="screen" id="screen-<nom>"></div>` dans
   `index.html`.
4. Brancher l'accès depuis `js/navigation.js` (`showScreen()`) et,
   si besoin, une nouvelle carte sur la page d'accueil dans
   `js/categories.js`.
5. Ajouter le nouveau fichier JS à `CORE_ASSETS` dans
   `service-worker.js`, et incrémenter `CACHE_NAME`.

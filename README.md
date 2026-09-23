# FF CLIM — Rapports & documents (PWA)

Application web (Progressive Web App) pour rédiger des rapports d'intervention
et remplir le CERFA 15497*04, avec téléchargement en PDF. Tout tourne côté
client (aucun serveur/backend) : HTML, CSS et JavaScript vanilla dans un seul
fichier, plus quelques fichiers PWA.

## Structure du projet

```
├── index.html              → Toute l'application (HTML + CSS + JS inline)
├── manifest.json            → Métadonnées PWA (nom, icônes, couleurs)
├── service-worker.js        → Cache hors-ligne + mise à jour de l'appli
├── icon-192.png              → Icône d'app 192x192
├── icon-512.png               → Icône d'app 512x512
├── icon-192-maskable.png       → Variante "maskable" (Android)
├── icon-512-maskable.png
└── apple-touch-icon.png     → Icône pour l'écran d'accueil iOS
```

## Organisation du code dans index.html

- **`<style>`** : variables CSS (couleurs, ombres) en haut du fichier sous
  `:root`, puis styles par zone (barre du haut, écran d'accueil, cartes,
  formulaires, aperçu, formulaire CERFA).
- **`<body>`** : un `<div class="screen">` par écran (accueil + 4 catégories
  + CERFA), un seul étant visible à la fois via la classe `.active`
  (géré par `showScreen(key)` en JS).
- **`<script>`**, dans l'ordre :
  1. `ICONS` / `REPORT_CATEGORIES` — configuration des catégories de la
     page d'accueil (icône, libellé, description). **C'est ici qu'on ajoute
     ou modifie une catégorie.**
  2. `showScreen()` / navigation — bascule entre les écrans.
  3. `reportScreenTemplate(key)` + `initReportModule(key)` — le module de
     rapport générique (formulaire + aperçu + génération PDF), instancié
     une fois par catégorie (Diagnostic, Travaux, Dépannage, Maintenance).
     **C'est ici qu'on adapte les champs propres à chaque catégorie.**
  4. `cerfaScreenTemplate()` + `generateCerfaPDF()` — écran et logique du
     CERFA 15497*04 (remplissage du vrai PDF officiel via pdf-lib).
  5. Enregistrement du service worker + gestion du bouton d'installation.

## Bibliothèques utilisées (chargées via CDN, pas de `npm install` requis)

- [jsPDF](https://github.com/parallax/jsPDF) — génération des PDF "rapport"
- [jspdf-autotable](https://github.com/simonbengtsson/jsPDF-AutoTable) — tableau d'en-tête des rapports
- [pdf-lib](https://pdf-lib.js.org/) — remplissage du formulaire CERFA officiel

## Développement en local

Comme l'appli utilise un service worker, ouvrir `index.html` directement en
double-cliquant (`file://`) ne permet pas de tester le mode hors-ligne ni
l'installation. Le plus simple :

```bash
# Depuis ce dossier
python3 -m http.server 8000
# puis ouvrir http://localhost:8000 dans le navigateur
```

Ou avec l'extension **Live Server** de VS Code (clic droit sur `index.html`
→ "Open with Live Server").

## Déploiement

Le dossier complet (tel quel, avec `index.html` à la racine) se déploie sur
Netlify (glisser-déposer) ou GitHub Pages. Après toute modification,
pensez à changer `CACHE_NAME` dans `service-worker.js` (ex. passer de
`v2` à `v3`) si vous touchez aux fichiers statiques (icônes, manifest) —
`index.html` et `manifest.json` sont eux vérifiés sur le réseau à chaque
ouverture, donc pas besoin de bump de version pour ces deux-là.

## Le CERFA 15497*04

Le PDF officiel vierge est embarqué directement dans `index.html`, encodé
en base64 (constante `CERFA_PDF_B64`), pour rester dans un fichier unique
et fonctionner hors-ligne. Le remplissage se fait via les vrais noms de
champs du formulaire (`Operateur`, `Case_Assemblage`, `Bouton_Oui`, etc.) —
si le formulaire officiel venait à changer de version, il faudra ré-inspecter
ses champs (ex. avec `pypdf` : `PdfReader(...).get_fields()`) et adapter
les identifiants utilisés dans `generateCerfaPDF()`.

/* ==================================================================
   FF CLIM — CERFA 15497*04 (fiche fluides frigorigènes)
   ==================================================================
   Contrairement aux 4 catégories génériques (qui produisent un PDF
   "fait maison" avec jsPDF), le CERFA remplit un vrai formulaire PDF
   officiel et administratif, téléchargé depuis assets/cerfa-15497-04.pdf
   (voir js/assets.js). On utilise pour cela la librairie pdf-lib, qui
   sait ouvrir un PDF existant, trouver ses champs de formulaire par
   leur nom interne, et les remplir — un peu comme si on cochait des
   cases sur un vrai document administratif.

   Comment a-t-on trouvé les noms de champs (Fiche_no, Case_Assemblage,
   etc.) ? En inspectant le PDF source avec un outil comme pypdf ou
   pikepdf, qui liste tous les champs d'un formulaire PDF ainsi que
   leurs types (texte, case à cocher, bouton radio).

   Dépend de : js/assets.js (CERFA_TEMPLATE_BYTES, assetsReady),
   js/utils.js (downloadBytes), js/history.js (logHistoryEntry),
   la librairie CDN pdf-lib (PDFLib, chargée dans index.html).
   ================================================================== */

/**
 * Construit le HTML du formulaire CERFA : une intro, puis une série
 * de sections repliables (<details>/<summary>) correspondant aux
 * rubriques numérotées du formulaire officiel. Le numéro entre
 * crochets dans chaque titre de section (ex. [7], [10]) correspond
 * au numéro de la rubrique sur le vrai CERFA papier, pour qu'on s'y
 * retrouve facilement en comparant les deux.
 */
function cerfaScreenTemplate() {
  return `
  <div class="cerfa-wrap">

    <div class="clear-bar">
      <button class="clear-btn" id="cerfaClearBtn" type="button">🗑 Effacer tout le formulaire</button>
    </div>

    <div class="cerfa-intro">
      <b>Cerfa n°15497*04</b> — Fiche d'intervention pour les opérations sur fluides frigorigènes fluorés
      (assemblage, mise en service, maintenance, contrôle d'étanchéité, démantèlement...). Le formulaire
      officiel est rempli automatiquement à partir des informations saisies ci-dessous.
    </div>

    <details class="cerfa-section" open>
      <summary><span class="num">1</span>Fiche, opérateur, détenteur<span class="chev">▾</span></summary>
      <div class="cerfa-body">
        <div class="field"><label>Fiche N°</label><input type="text" id="cerfa_Fiche_no"></div>
        <div class="field"><label>Opérateur (nom, adresse, SIRET)</label><textarea id="cerfa_Operateur"></textarea></div>
        <div class="field"><label>N° d'attestation de capacité</label><input type="text" id="cerfa_Attestation_no"></div>
        <div class="field"><label>Détenteur (nom, adresse, SIRET)</label><textarea id="cerfa_Detenteur"></textarea></div>
      </div>
    </details>

    <details class="cerfa-section">
      <summary><span class="num">3</span>Équipement concerné<span class="chev">▾</span></summary>
      <div class="cerfa-body">
        <div class="field"><label>Identification de l'équipement</label><input type="text" id="cerfa_Equipement_ID"></div>
        <div class="grid2">
          <div class="field"><label>Dénomination du fluide (ex. R-410A)</label><input type="text" id="cerfa_Equipement_Fluide"></div>
          <div class="field"><label>Charge totale (kg)</label><input type="text" inputmode="decimal" id="cerfa_Equipement_Charge"></div>
        </div>
        <div class="field"><label>Tonnage équivalent CO2 (t.éq.CO2)</label><input type="text" inputmode="decimal" id="cerfa_Equipement_teqCO2"></div>
      </div>
    </details>

    <details class="cerfa-section">
      <summary><span class="num">4</span>Nature de l'intervention<span class="chev">▾</span></summary>
      <div class="cerfa-body">
        <div class="check-row"><input type="checkbox" id="cerfa_Case_Assemblage"><label for="cerfa_Case_Assemblage">Assemblage de l'équipement</label></div>
        <div class="check-row"><input type="checkbox" id="cerfa_Case_MiseService"><label for="cerfa_Case_MiseService">Mise en service de l'équipement</label></div>
        <div class="check-row"><input type="checkbox" id="cerfa_Case_Modif"><label for="cerfa_Case_Modif">Modification de l'équipement</label></div>
        <div class="check-row"><input type="checkbox" id="cerfa_Case_Maintenance"><label for="cerfa_Case_Maintenance">Maintenance de l'équipement</label></div>
        <div class="check-row"><input type="checkbox" id="cerfa_Case_CtrlPerio"><label for="cerfa_Case_CtrlPerio">Contrôle d'étanchéité périodique</label></div>
        <div class="check-row"><input type="checkbox" id="cerfa_Case_CtrlNonPerio"><label for="cerfa_Case_CtrlNonPerio">Contrôle d'étanchéité non périodique</label></div>
        <div class="check-row"><input type="checkbox" id="cerfa_Case_Demantel"><label for="cerfa_Case_Demantel">Démantèlement</label></div>
        <div class="check-row"><input type="checkbox" id="cerfa_Case_Autre"><label for="cerfa_Case_Autre">Autre (préciser)</label></div>
        <div class="field"><input type="text" id="cerfa_Autre" placeholder="Préciser si 'Autre' coché"></div>
      </div>
    </details>

    <details class="cerfa-section">
      <summary><span class="num">5</span>Contrôle d'étanchéité<span class="chev">▾</span></summary>
      <div class="cerfa-body">
        <div class="field"><label>Détecteur manuel de fuite — identification</label><input type="text" id="cerfa_Detecteur_ID"></div>
        <div class="field"><label>Contrôlé le</label><input type="date" id="cerfa_Controle_Date"></div>
        <div class="row-label">Présence d'un système permanent de détection de fuites</div>
        <div class="radio-line">
          <span class="opt"><input type="radio" name="cerfa_detection" id="cerfa_detection_oui" value="1"><label for="cerfa_detection_oui">Oui</label></span>
          <span class="opt"><input type="radio" name="cerfa_detection" id="cerfa_detection_non" value="2"><label for="cerfa_detection_non">Non</label></span>
        </div>
      </div>
    </details>

    <details class="cerfa-section">
      <summary><span class="num">7</span>Quantité de fluide dans l'équipement<span class="chev">▾</span></summary>
      <div class="cerfa-body">
        <div class="row-label">HCFC</div>
        <div class="radio-line">
          <span class="opt"><input type="radio" name="cerfa_hcfc" value="Case_HCFC_2"> 2 ≤ Q &lt; 30 kg</span>
          <span class="opt"><input type="radio" name="cerfa_hcfc" value="Case_HCFC_30"> 30 ≤ Q &lt; 300 kg</span>
          <span class="opt"><input type="radio" name="cerfa_hcfc" value="Case_HCFC_300"> Q ≥ 300 kg</span>
        </div>
        <div class="row-label">HFC / PFC</div>
        <div class="radio-line">
          <span class="opt"><input type="radio" name="cerfa_hfc" value="Case_HFC_5"> 5 ≤ teqCO2 &lt; 50 t</span>
          <span class="opt"><input type="radio" name="cerfa_hfc" value="Case_HFC_50"> 50 ≤ teqCO2 &lt; 500 t</span>
          <span class="opt"><input type="radio" name="cerfa_hfc" value="Case_HFC_500"> teqCO2 ≥ 500 t</span>
        </div>
        <div class="row-label">HFO</div>
        <div class="radio-line">
          <span class="opt"><input type="radio" name="cerfa_hfo" value="Case_HFO_1"> 1 ≤ Q &lt; 10 kg</span>
          <span class="opt"><input type="radio" name="cerfa_hfo" value="Case_HFO_10"> 10 ≤ Q &lt; 100 kg</span>
          <span class="opt"><input type="radio" name="cerfa_hfo" value="Case_HFO_100"> Q ≥ 100 kg</span>
        </div>
        <div class="row-label">[8] Équipement SANS système permanent de détection — fréquence</div>
        <div class="radio-line">
          <span class="opt"><input type="radio" name="cerfa_sans" value="Case_Sans_12m"> 12 mois</span>
          <span class="opt"><input type="radio" name="cerfa_sans" value="Case_Sans_6m"> 6 mois</span>
          <span class="opt"><input type="radio" name="cerfa_sans" value="Case_Sans_3m"> 3 mois</span>
        </div>
        <div class="row-label">[9] Équipement AVEC système permanent de détection — fréquence</div>
        <div class="radio-line">
          <span class="opt"><input type="radio" name="cerfa_avec" value="Case_Avec_24m"> 24 mois</span>
          <span class="opt"><input type="radio" name="cerfa_avec" value="Case_Avec_12m"> 12 mois</span>
          <span class="opt"><input type="radio" name="cerfa_avec" value="Case_Avec_6m"> 6 mois</span>
        </div>
      </div>
    </details>

    <details class="cerfa-section">
      <summary><span class="num">10</span>Fuites constatées<span class="chev">▾</span></summary>
      <div class="cerfa-body">
        <div class="radio-line">
          <span class="opt"><input type="radio" name="cerfa_fuite" value="oui"> Oui</span>
          <span class="opt"><input type="radio" name="cerfa_fuite" value="non"> Non</span>
        </div>
        ${[1, 2, 3].map(n => `
        <div class="fuite-row">
          <span>${n}</span>
          <input type="text" id="cerfa_Fuite_Loca_${n}" placeholder="Localisation de la fuite">
          <select id="cerfa_Fuite_Rep_${n}" style="font-size:12px;padding:6px;">
            <option value="">—</option>
            <option value="realisee">Réparation réalisée</option>
            <option value="afaire">Réparation à faire</option>
          </select>
        </div>`).join('')}
      </div>
    </details>

    <details class="cerfa-section">
      <summary><span class="num">11</span>Manipulation du fluide<span class="chev">▾</span></summary>
      <div class="cerfa-body">
        <div class="grid2">
          <div class="field"><label>Quantité chargée totale (A+B+C), kg</label><input type="text" inputmode="decimal" id="cerfa_11_Quantite"></div>
          <div class="field"><label>Quantité récupérée totale (D+E), kg</label><input type="text" inputmode="decimal" id="cerfa_11_QDE"></div>
        </div>
        <div class="grid2">
          <div class="field"><label>A — dont fluide vierge (kg)</label><input type="text" inputmode="decimal" id="cerfa_11_QA"></div>
          <div class="field"><label>D — dont destiné au traitement (kg)</label><input type="text" inputmode="decimal" id="cerfa_11_QD"></div>
        </div>
        <div class="grid2">
          <div class="field"><label>B — dont recyclé (kg)</label><input type="text" inputmode="decimal" id="cerfa_11_QB"></div>
          <div class="field"><label>E — dont conservé pour réutilisation (kg)</label><input type="text" inputmode="decimal" id="cerfa_11_QE"></div>
        </div>
        <div class="field"><label>C — dont régénéré (kg)</label><input type="text" inputmode="decimal" id="cerfa_11_QC"></div>
        <div class="field"><label>Dénomination du fluide chargé si changement</label><input type="text" id="cerfa_11_Denom"></div>
        <div class="field"><label>N° de BSFF (Trackdéchets), si connu</label><input type="text" id="cerfa_11_BSFF"></div>
        <div class="field"><label>Identification du ou des contenants</label><input type="text" id="cerfa_11_Contenant_ID"></div>
      </div>
    </details>

    <details class="cerfa-section">
      <summary><span class="num">12</span>Dénomination ADR/RID<span class="chev">▾</span></summary>
      <div class="cerfa-body">
        <div class="row-label">Rubrique 14 06 01* — CFC, HCFC, HFC, HFO non-inflammables</div>
        <div class="check-row"><input type="checkbox" id="cerfa_Case_12_UN1078"><label for="cerfa_Case_12_UN1078">UN 1078, Déchet Gaz frigorifique NSA</label></div>
        <div class="check-row"><input type="checkbox" id="cerfa_Case_12_Autre140601"><label for="cerfa_Case_12_Autre140601">Autres fluides non-inflammables</label></div>
        <div class="field"><input type="text" id="cerfa_Autre-FF-NON-inflammable" placeholder="Préciser si coché"></div>
        <div class="row-label">Rubrique 16 05 04* — HFC, HFO inflammables</div>
        <div class="check-row"><input type="checkbox" id="cerfa_Case_12_UN3161"><label for="cerfa_Case_12_UN3161">UN 3161, Déchet Gaz liquéfié inflammable NSA</label></div>
        <div class="check-row"><input type="checkbox" id="cerfa_Case_12_Autre160504"><label for="cerfa_Case_12_Autre160504">Autres fluides inflammables</label></div>
        <div class="field"><input type="text" id="cerfa_Autre-FF-inflammable" placeholder="Préciser si coché"></div>
      </div>
    </details>

    <details class="cerfa-section">
      <summary><span class="num">13</span>Installation de destination<span class="chev">▾</span></summary>
      <div class="cerfa-body">
        <div class="field"><label>Installation prévue de destination du fluide récupéré (nom, SIRET, adresse)</label><textarea id="cerfa_13_Instal"></textarea></div>
      </div>
    </details>

    <details class="cerfa-section">
      <summary><span class="num">14</span>Observations<span class="chev">▾</span></summary>
      <div class="cerfa-body">
        <div class="field"><textarea id="cerfa_14_Observations"></textarea></div>
      </div>
    </details>

    <details class="cerfa-section">
      <summary><span class="num">✓</span>Signatures<span class="chev">▾</span></summary>
      <div class="cerfa-body">
        <div class="row-label">Opérateur</div>
        <div class="field"><label>Nom du signataire</label><input type="text" id="cerfa_Sign_Operateur_Nom"></div>
        <div class="field"><label>Qualité du signataire</label><input type="text" id="cerfa_Sign_Operateur_Qualite"></div>
        <div class="field"><label>Date</label><input type="date" id="cerfa_Sign_Operateur_Date"></div>
        <div class="row-label">Détenteur</div>
        <div class="field"><label>Nom du signataire</label><input type="text" id="cerfa_Sign_Detenteur_Nom"></div>
        <div class="field"><label>Qualité du signataire</label><input type="text" id="cerfa_Sign_Detenteur_Qualite"></div>
        <div class="field"><label>Date</label><input type="date" id="cerfa_Sign_Detenteur_Date"></div>
      </div>
    </details>
  </div>
  `;
}
document.getElementById('screen-cerfa').innerHTML = cerfaScreenTemplate();

/* ---- brouillon du CERFA ----
   Contrairement aux rapports génériques (un brouillon par catégorie),
   il n'y a qu'un seul CERFA à la fois, donc une seule clé de
   brouillon fixe ('ffclim_draft_cerfa'). On sauvegarde 3 types de
   champs séparément : texte, cases à cocher, et boutons radio
   (regroupés par leur attribut "name"). */
function saveCerfaDraft() {
  const data = { text: {}, checks: {}, radios: {} };
  document.querySelectorAll('#screen-cerfa input[type=text], #screen-cerfa input[type=email], #screen-cerfa input[type=date], #screen-cerfa textarea, #screen-cerfa select').forEach(el => { data.text[el.id] = el.value; });
  document.querySelectorAll('#screen-cerfa input[type=checkbox]').forEach(el => { data.checks[el.id] = el.checked; });
  document.querySelectorAll('#screen-cerfa input[type=radio]').forEach(el => { if (el.checked) data.radios[el.name] = el.value; });
  try { localStorage.setItem('ffclim_draft_cerfa', JSON.stringify(data)); } catch (e) {}
}
function loadCerfaDraft() {
  let data = null;
  try { const raw = localStorage.getItem('ffclim_draft_cerfa'); if (raw) data = JSON.parse(raw); } catch (e) {}
  if (!data) return;
  Object.keys(data.text || {}).forEach(id => { const el = document.getElementById(id); if (el) el.value = data.text[id]; });
  Object.keys(data.checks || {}).forEach(id => { const el = document.getElementById(id); if (el) el.checked = data.checks[id]; });
  Object.keys(data.radios || {}).forEach(name => {
    const el = document.querySelector(`input[name="${name}"][value="${data.radios[name]}"]`);
    if (el) el.checked = true;
  });
}
function clearCerfaDraft() {
  try { localStorage.removeItem('ffclim_draft_cerfa'); } catch (e) {}
}
function resetCerfaForm() {
  document.querySelectorAll('#screen-cerfa input[type=text], #screen-cerfa input[type=email], #screen-cerfa input[type=date], #screen-cerfa textarea, #screen-cerfa select').forEach(el => { el.value = ''; });
  document.querySelectorAll('#screen-cerfa input[type=checkbox]').forEach(el => { el.checked = false; });
  document.querySelectorAll('#screen-cerfa input[type=radio]').forEach(el => { el.checked = false; });
  clearCerfaDraft();
}
document.getElementById('cerfaClearBtn').addEventListener('click', () => {
  if (!confirm('Effacer toute la saisie de ce formulaire ? Cette action est irréversible.')) return;
  resetCerfaForm();
});
document.getElementById('screen-cerfa').addEventListener('input', saveCerfaDraft);
document.getElementById('screen-cerfa').addEventListener('change', saveCerfaDraft);
loadCerfaDraft();

/**
 * Convertit une date HTML (<input type="date">, format AAAA-MM-JJ)
 * en un objet {j, m, a} — le CERFA officiel a 3 cases séparées
 * (jour / mois / année) pour chaque date, plutôt qu'un seul champ.
 */
function dateFR(id) {
  const v = document.getElementById(id).value; // AAAA-MM-JJ
  if (!v) return { j: '', m: '', a: '' };
  const [a, m, j] = v.split('-');
  return { j, m, a };
}

/**
 * Remplit le vrai formulaire PDF officiel (assets/cerfa-15497-04.pdf)
 * avec les valeurs saisies, puis déclenche le téléchargement.
 * Utilise pdf-lib : setText/setCheck/setRadio ci-dessous sont de
 * petits raccourcis autour de son API, avec un `try/catch` individuel
 * pour que l'échec d'UN champ (nom introuvable dans le PDF, par
 * exemple si Adobe a mis à jour le formulaire) n'empêche pas de
 * remplir tous les autres.
 */
async function generateCerfaPDF() {
  const btn = document.getElementById('downloadBtn');
  const statusMsg = document.getElementById('statusMsg');
  btn.disabled = true; statusMsg.textContent = 'Génération du PDF en cours...';
  try {
    // On attend que le modèle CERFA vierge soit téléchargé (voir js/assets.js).
    await assetsReady;

    const { PDFDocument } = PDFLib;
    // .slice() : on donne à pdf-lib une COPIE des octets du modèle,
    // pour pouvoir régénérer le PDF plusieurs fois de suite sans
    // recharger le fichier à chaque fois.
    const pdfDoc = await PDFDocument.load(CERFA_TEMPLATE_BYTES.slice());
    const form = pdfDoc.getForm();

    const g = (id) => document.getElementById(id);
    const v = (id) => (g(id) ? g(id).value.trim() : '');

    function setText(name, value) {
      try { form.getTextField(name).setText(value || ''); } catch (e) { console.warn('text field missing', name); }
    }
    function setCheck(name, checked) {
      try { const f = form.getCheckBox(name); if (checked) f.check(); else f.uncheck(); } catch (e) { console.warn('checkbox missing', name); }
    }
    function setRadio(name, value) {
      try { form.getRadioGroup(name).select(value); } catch (e) { console.warn('radio missing', name); }
    }

    // [Fiche / 1 / 2]
    setText('Fiche_no', v('cerfa_Fiche_no'));
    setText('Operateur', v('cerfa_Operateur'));
    setText('Attestation_no', v('cerfa_Attestation_no'));
    setText('Detenteur', v('cerfa_Detenteur'));

    // [3]
    setText('Equipement_ID', v('cerfa_Equipement_ID'));
    setText('Equipement_Fluide', v('cerfa_Equipement_Fluide'));
    setText('Equipement_Charge', v('cerfa_Equipement_Charge'));
    setText('Equipement_teqCO2', v('cerfa_Equipement_teqCO2'));

    // [4]
    setCheck('Case_Assemblage', g('cerfa_Case_Assemblage').checked);
    setCheck('Case_MiseService', g('cerfa_Case_MiseService').checked);
    setCheck('Case_Modif', g('cerfa_Case_Modif').checked);
    setCheck('Case_Maintenance', g('cerfa_Case_Maintenance').checked);
    setCheck('Case_CtrlPerio', g('cerfa_Case_CtrlPerio').checked);
    setCheck('Case_CtrlNonPerio', g('cerfa_Case_CtrlNonPerio').checked);
    setCheck('Case_Demantel', g('cerfa_Case_Demantel').checked);
    setCheck('Case_Autre', g('cerfa_Case_Autre').checked);
    setText('Autre', v('cerfa_Autre'));

    // [5]/[6]
    setText('Detecteur_ID', v('cerfa_Detecteur_ID'));
    const cd = dateFR('cerfa_Controle_Date');
    setText('Controle_Jour', cd.j); setText('Controle_Mois', cd.m); setText('Controle_Annee', cd.a);
    const detection = document.querySelector('input[name=cerfa_detection]:checked');
    if (detection) setRadio('Bouton_Oui', detection.value);

    // [7]
    ['Case_HCFC_2', 'Case_HCFC_30', 'Case_HCFC_300', 'Case_HFC_5', 'Case_HFC_50', 'Case_HFC_500', 'Case_HFO_1', 'Case_HFO_10', 'Case_HFO_100'].forEach(n => setCheck(n, false));
    const hcfc = document.querySelector('input[name=cerfa_hcfc]:checked'); if (hcfc) setCheck(hcfc.value, true);
    const hfc = document.querySelector('input[name=cerfa_hfc]:checked'); if (hfc) setCheck(hfc.value, true);
    const hfo = document.querySelector('input[name=cerfa_hfo]:checked'); if (hfo) setCheck(hfo.value, true);

    // [8]/[9]
    ['Case_Sans_12m', 'Case_Sans_6m', 'Case_Sans_3m', 'Case_Avec_24m', 'Case_Avec_12m', 'Case_Avec_6m'].forEach(n => setCheck(n, false));
    const sans = document.querySelector('input[name=cerfa_sans]:checked'); if (sans) setCheck(sans.value, true);
    const avec = document.querySelector('input[name=cerfa_avec]:checked'); if (avec) setCheck(avec.value, true);

    // [10]
    const fuite = document.querySelector('input[name=cerfa_fuite]:checked');
    setCheck('Case_Fuite_Oui', fuite && fuite.value === 'oui');
    setCheck('Case_Fuite_Non', fuite && fuite.value === 'non');
    [1, 2, 3].forEach(n => {
      setText('Fuite_Loca_' + n, v('cerfa_Fuite_Loca_' + n));
      const rep = v('cerfa_Fuite_Rep_' + n);
      setCheck('Case_Rep_Fuite' + n + '_realisee', rep === 'realisee');
      setCheck('Case_Rep_Fuite' + n + '_AFaire', rep === 'afaire');
    });

    // [11]
    setText('11_Quantite', v('cerfa_11_Quantite'));
    setText('11_QA', v('cerfa_11_QA'));
    setText('11_Denom', v('cerfa_11_Denom'));
    setText('11_QB', v('cerfa_11_QB'));
    setText('11_QC', v('cerfa_11_QC'));
    setText('11_QDE', v('cerfa_11_QDE'));
    setText('11_QD', v('cerfa_11_QD'));
    setText('11_BSFF', v('cerfa_11_BSFF'));
    setText('11_QE', v('cerfa_11_QE'));
    setText('11_Contenant_ID', v('cerfa_11_Contenant_ID'));

    // [12]
    setCheck('Case_12_UN1078', g('cerfa_Case_12_UN1078').checked);
    setCheck('Case_12_Autre140601', g('cerfa_Case_12_Autre140601').checked);
    setText('Autre-FF-NON-inflammable', v('cerfa_Autre-FF-NON-inflammable'));
    setCheck('Case_12_UN3161', g('cerfa_Case_12_UN3161').checked);
    setCheck('Case_12_Autre160504', g('cerfa_Case_12_Autre160504').checked);
    setText('Autre-FF-inflammable', v('cerfa_Autre-FF-inflammable'));

    // [13]/[14]
    setText('13_Instal', v('cerfa_13_Instal'));
    setText('14_Observations', v('cerfa_14_Observations'));

    // Signatures
    setText('Sign_Operateur_Nom', v('cerfa_Sign_Operateur_Nom'));
    setText('Sign_Operateur_Qualite', v('cerfa_Sign_Operateur_Qualite'));
    const opd = dateFR('cerfa_Sign_Operateur_Date');
    setText('Sign_Operateur_Date', (opd.j && opd.m && opd.a) ? `${opd.j}/${opd.m}/${opd.a}` : '');
    setText('Sign_Detenteur_Nom', v('cerfa_Sign_Detenteur_Nom'));
    setText('Sign_Detenteur_Qualite', v('cerfa_Sign_Detenteur_Qualite'));
    const detd = dateFR('cerfa_Sign_Detenteur_Date');
    setText('Sign_Detenteur_Date', (detd.j && detd.m && detd.a) ? `${detd.j}/${detd.m}/${detd.a}` : '');

    form.updateFieldAppearances();
    const outBytes = await pdfDoc.save();

    const ficheNo = (v('cerfa_Fiche_no') || 'sans_numero').replace(/[^a-z0-9]+/gi, '_');
    const filename = `CERFA_15497_${ficheNo}.pdf`;
    downloadBytes(outBytes, filename);
        logHistoryEntry('cerfa', 'CERFA 15497*04', v('cerfa_Detenteur') || v('cerfa_Operateur') || '', new Blob([outBytes], { type: 'application/pdf' }), filename, v('cerfa_Operateur'));
    if (confirm('PDF téléchargé ✓\n\nVoulez-vous vider le formulaire pour une nouvelle saisie ?')) {
      resetCerfaForm();
    }
    statusMsg.textContent = 'PDF téléchargé ✓';
    setTimeout(() => { statusMsg.textContent = ''; }, 3000);
  } catch (err) {
    console.error(err);
    document.getElementById('statusMsg').textContent = "Une erreur est survenue pendant la génération.";
  } finally {
    btn.disabled = false;
  }
}

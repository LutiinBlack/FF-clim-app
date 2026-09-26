/* ==================================================================
   FF CLIM — Module de rapport générique
   ==================================================================
   Les 4 catégories "génériques" (Diagnostic, Travaux, Dépannage,
   Maintenance) partagent exactement la même structure de formulaire
   et le même gabarit de PDF ; seul le libellé de catégorie change.
   Plutôt que de dupliquer le code 4 fois, ce fichier définit UNE
   fabrique (initReportModule) instanciée une fois par catégorie,
   chacune avec son propre état totalement indépendant (grâce aux
   identifiants suffixés "__<key>" dans le HTML généré).

   Ce module gère, pour chaque catégorie :
     - la construction du HTML du formulaire + de l'aperçu (template) ;
     - les lignes de "bullets" (synthèse des travaux) et les photos,
       ajoutées/supprimées dynamiquement ;
     - la sauvegarde automatique en brouillon (localStorage), pour ne
       rien perdre en cas de fermeture accidentelle de l'appli ;
     - la mise à jour en direct de l'aperçu à chaque frappe ;
     - la génération du PDF final avec jsPDF + jspdf-autotable.

   Dépend de : js/config.js, js/assets.js (LOGO_DATA_URL, assetsReady),
   js/navigation.js (CATEGORY_LABELS), js/history.js (logHistoryEntry),
   js/cerfa.js (downloadBytes). REPORT_MODULES est utilisé par
   js/navigation.js (showScreen) pour savoir quelle fonction appeler.
   ================================================================== */

// Registre : { diagnostic: {updatePreview, generatePDF}, travaux: {...}, ... }
// Rempli au fur et à mesure par initReportModule() plus bas.
const REPORT_MODULES = {};

// La librairie jsPDF (chargée depuis le CDN dans index.html) s'attache à
// window.jspdf plutôt qu'à window directement : on récupère ici le
// constructeur jsPDF pour pouvoir écrire simplement "new jsPDF(...)" plus bas.
const { jsPDF } = window.jspdf;

/**
 * Construit le HTML complet d'un écran de rapport générique (le
 * formulaire à gauche + l'aperçu "papier" à droite), pour la
 * catégorie "key". Tous les id contiennent "__${key}" pour que les 4
 * catégories ne se marchent jamais dessus dans le DOM.
 */
function reportScreenTemplate(key) {
  return `
    <div class="wrap">
      <div class="panel form-panel" id="formPanel__${key}">

        <div class="clear-bar">
          <button class="clear-btn" id="clearBtn__${key}" type="button">🗑 Effacer tout le formulaire</button>
        </div>

        <div class="card">
          <h2><span class="num">1</span>En-tête du rapport</h2>
          <div class="field">
            <label>Titre de la mission</label>
            <input type="text" id="f_titre__${key}" placeholder="ex. Diagnostic de panne - Climatisation RDC">
          </div>
          <div class="grid2">
            <div class="field">
              <label>Client</label>
              <input type="text" id="f_client__${key}" placeholder="ex. Mme Valérie">
            </div>
            <div class="field">
              <label>Date d'intervention</label>
              <input type="text" id="f_date__${key}" placeholder="ex. 14 septembre 2026">
            </div>
          </div>
          <div class="field">
            <label>Adresse</label>
            <input type="text" id="f_adresse__${key}" placeholder="ex. 35 Rue de la Gaîté - 75014 Paris">
          </div>
          <div class="grid2">
            <div class="field">
              <label>Intervenant</label>
              <input type="text" id="f_intervenant__${key}" placeholder="ex. Traoré Balla">
            </div>
            <div class="field">
              <label>Objet</label>
              <input type="text" id="f_objet__${key}" placeholder="ex. Vérification et ajout de fluide">
            </div>
          </div>
        </div>

        <div class="card">
          <h2><span class="num">2</span>Constats</h2>
          <div class="subgroup">
            <div class="subgroup-title">Section 1</div>
            <div class="field"><label>Titre de la section</label>
              <input type="text" id="s1_titre__${key}" placeholder="ex. Vérification du bon fonctionnement"></div>
            <div class="field"><label>Description du constat</label>
              <textarea id="s1_texte__${key}" placeholder="Décrivez ce qui a été observé..."></textarea></div>
            <div class="field"><label>Préconisation (optionnel)</label>
              <textarea id="s1_preco__${key}" placeholder="Laissez vide si non applicable"></textarea></div>
          </div>
          <div class="subgroup">
            <div class="subgroup-title">Section 2</div>
            <div class="field"><label>Titre de la section</label>
              <input type="text" id="s2_titre__${key}" placeholder="ex. Ajout du fluide et test des températures"></div>
            <div class="field"><label>Description du constat</label>
              <textarea id="s2_texte__${key}" placeholder="Décrivez l'intervention réalisée..."></textarea></div>
            <div class="field"><label>Préconisation (optionnel)</label>
              <textarea id="s2_preco__${key}" placeholder="Laissez vide si non applicable"></textarea></div>
          </div>
        </div>

        <div class="card">
          <h2><span class="num">3</span>Synthèse des travaux à prévoir</h2>
          <div id="bulletsList__${key}"></div>
          <button class="add-btn" id="addBulletBtn__${key}" type="button">+ Ajouter une ligne</button>
        </div>

        <div class="card">
          <h2><span class="num">4</span>Conclusion</h2>
          <div class="field"><textarea id="f_conclusion__${key}" placeholder="Synthèse générale et suite donnée..."></textarea></div>
        </div>

        <div class="card">
          <h2><span class="num">5</span>Photos de l'intervention</h2>
          <div id="photosList__${key}"></div>
          <button class="add-btn" id="addPhotoBtn__${key}" type="button">+ Ajouter une photo</button>
        </div>
      </div>

      <div class="panel preview-panel" id="previewPanel__${key}">
        <div class="preview-label">Aperçu complet du rapport</div>
        <div class="preview-scroll">
          <div class="paper">
            <img class="logo" src="assets/logo.jpg" alt="logo">
            <div class="overline">${CATEGORY_LABELS[key].toUpperCase()}</div>
            <h3>RAPPORT D'INTERVENTION</h3>
            <div class="sub" id="pv_sub__${key}">[Titre de la mission]</div>
            <table>
              <tr><td>Client</td><td id="pv_client__${key}">—</td></tr>
              <tr><td>Adresse</td><td id="pv_adresse__${key}">—</td></tr>
              <tr><td>Date d'intervention</td><td id="pv_date__${key}">—</td></tr>
              <tr><td>Intervenant</td><td id="pv_intervenant__${key}">—</td></tr>
              <tr><td>Objet</td><td id="pv_objet__${key}">—</td></tr>
            </table>
            <div class="sec-title" id="pv_s1t__${key}">1. —</div>
            <div class="sec-body" id="pv_s1b__${key}">—</div>
            <div class="sec-title" id="pv_s2t__${key}">2. —</div>
            <div class="sec-body" id="pv_s2b__${key}">—</div>
            <div class="sec-title">3. Synthèse des travaux à prévoir</div>
            <div class="sec-body" id="pv_bullets__${key}">—</div>
            <div class="conclusion" id="pv_conclusion__${key}"></div>
            <div class="foot"><span>FF CLIM - Installation, dépannage et maintenance climatisation</span><span>Page 1</span></div>
          </div>
          <div class="paper photos-page" id="pv_photos_page__${key}" style="display:none;">
            <h3>PHOTOS DE L'INTERVENTION</h3>
            <div id="pv_photos__${key}"></div>
            <div class="foot"><span>FF CLIM - Installation, dépannage et maintenance climatisation</span><span>Page 2</span></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Instancie un module de rapport complet pour la catégorie "key" :
 * injecte le HTML dans son écran, câble tous les événements (ajout
 * de ligne/photo, brouillon, aperçu en direct, génération du PDF),
 * et enregistre {updatePreview, generatePDF} dans REPORT_MODULES[key].
 */
function initReportModule(key) {
  document.getElementById('screen-' + key).innerHTML = reportScreenTemplate(key);
  // Petit raccourci : $('f_titre') retourne l'élément #f_titre__<key>.
  const $ = (id) => document.getElementById(id + '__' + key);
  const container = document.getElementById('screen-' + key);

  /* ---- lignes de "synthèse des travaux" (bullets) ---- */
  const bulletsList = $('bulletsList');
  function addBulletRow(value = '') {
    const row = document.createElement('div');
    row.className = 'bullet-row';
    row.innerHTML = `<input type="text" class="bullet-input" placeholder="ex. Remplacement du filtre" value="${value.replace(/"/g, '&quot;')}">
                      <button class="icon-btn remove" type="button" title="Supprimer">✕</button>`;
    row.querySelector('.remove').onclick = () => { row.remove(); updatePreview(); };
    row.querySelector('input').addEventListener('input', updatePreview);
    bulletsList.appendChild(row);
  }
  $('addBulletBtn').onclick = () => addBulletRow();
  addBulletRow(); addBulletRow(); // 2 lignes vides par défaut

  /* ---- photos ----
     Chaque photo est redessinée dans un <canvas> avant d'être
     transformée en Data URL : cela "aplati" l'image (retire les
     métadonnées EXIF, notamment l'orientation) et la recompresse en
     JPEG qualité 0.9, ce qui garde des fichiers PDF raisonnables même
     avec plusieurs photos haute résolution prises au téléphone. */
  const photosList = $('photosList');
  let photoSeq = 0;
  function addPhotoRow() {
    const id = key + '_photo_' + (photoSeq++);
    const row = document.createElement('div');
    row.className = 'photo-card';
    row.dataset.id = id;
    row.innerHTML = `
      <div class="photo-thumb empty" id="${id}_thumbwrap">Aucune<br>photo</div>
      <div class="photo-meta">
        <input type="file" accept="image/*" id="${id}_file">
        <input type="text" placeholder="Légende (ex. Chambre RDC - soufflage)" id="${id}_caption">
      </div>
      <button class="icon-btn remove" type="button" title="Supprimer">✕</button>
    `;
    row.querySelector('.remove').onclick = () => { row.remove(); updatePreview(); };
    const fileInput = row.querySelector(`#${id}_file`);
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
          row.dataset.dataUrl = dataUrl;
          row.dataset.w = canvas.width;
          row.dataset.h = canvas.height;
          const thumbWrap = document.getElementById(`${id}_thumbwrap`);
          thumbWrap.outerHTML = `<img class="photo-thumb" id="${id}_thumbwrap" src="${dataUrl}">`;
          updatePreview();
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
    row.querySelector(`#${id}_caption`).addEventListener('input', updatePreview);
    photosList.appendChild(row);
  }
  $('addPhotoBtn').onclick = () => addPhotoRow();
  addPhotoRow(); // 1 emplacement photo vide par défaut

  /* ---- brouillon (sauvegarde automatique dans localStorage) ----
     Le texte du formulaire est sauvegardé automatiquement à chaque
     frappe (voir updatePreview() plus bas, qui appelle saveDraft()),
     et rechargé au prochain lancement de l'application. Les photos
     ne sont PAS sauvegardées dans le brouillon (trop volumineuses
     pour localStorage) : seul le texte est conservé. */
  function draftKey() { return 'ffclim_draft_' + key; }
  function saveDraft() {
    const data = {
      f_titre: $('f_titre').value, f_client: $('f_client').value, f_adresse: $('f_adresse').value,
      f_date: $('f_date').value, f_intervenant: $('f_intervenant').value, f_objet: $('f_objet').value,
      s1_titre: $('s1_titre').value, s1_texte: $('s1_texte').value, s1_preco: $('s1_preco').value,
      s2_titre: $('s2_titre').value, s2_texte: $('s2_texte').value, s2_preco: $('s2_preco').value,
      f_conclusion: $('f_conclusion').value,
      bullets: [...container.querySelectorAll('.bullet-input')].map(i => i.value),
    };
    try { localStorage.setItem(draftKey(), JSON.stringify(data)); } catch (e) { /* stockage plein ou indisponible : tant pis, on continue sans brouillon */ }
  }
  function clearDraft() {
    try { localStorage.removeItem(draftKey()); } catch (e) {}
  }
  function loadDraft() {
    let data = null;
    try { const raw = localStorage.getItem(draftKey()); if (raw) data = JSON.parse(raw); } catch (e) {}
    if (!data) return;
    ['f_titre', 'f_client', 'f_adresse', 'f_date', 'f_intervenant', 'f_objet', 's1_titre', 's1_texte', 's1_preco', 's2_titre', 's2_texte', 's2_preco', 'f_conclusion'].forEach(id => {
      if (data[id] !== undefined) $(id).value = data[id];
    });
    if (Array.isArray(data.bullets) && data.bullets.length) {
      bulletsList.innerHTML = '';
      data.bullets.forEach(b => addBulletRow(b));
    }
  }
  loadDraft();

  /* ---- effacer tout le formulaire ---- */
  function resetForm() {
    ['f_titre', 'f_client', 'f_adresse', 'f_date', 'f_intervenant', 'f_objet', 's1_titre', 's1_texte', 's1_preco', 's2_titre', 's2_texte', 's2_preco', 'f_conclusion'].forEach(id => { $(id).value = ''; });
    bulletsList.innerHTML = '';
    addBulletRow(); addBulletRow();
    photosList.innerHTML = '';
    photoSeq = 0;
    addPhotoRow();
    clearDraft();
    updatePreview();
  }
  function clearAll() {
    if (!confirm('Effacer toute la saisie de ce formulaire ? Cette action est irréversible.')) return;
    resetForm();
  }
  $('clearBtn').addEventListener('click', clearAll);

  /* ---- aperçu en direct ----
     Recopie chaque champ du formulaire dans la zone d'aperçu "papier"
     à chaque frappe, pour montrer immédiatement à quoi ressemblera le
     PDF final. Sauvegarde aussi le brouillon à chaque appel. */
  function esc(s) { return (s || '').toString(); }
  function updatePreview() {
    $('pv_sub').textContent = esc($('f_titre').value) || '[Titre de la mission]';
    $('pv_client').textContent = esc($('f_client').value) || '—';
    $('pv_adresse').textContent = esc($('f_adresse').value) || '—';
    $('pv_date').textContent = esc($('f_date').value) || '—';
    $('pv_intervenant').textContent = esc($('f_intervenant').value) || '—';
    $('pv_objet').textContent = esc($('f_objet').value) || '—';
    $('pv_s1t').textContent = '1. ' + (esc($('s1_titre').value) || '—');
    $('pv_s1b').textContent = esc($('s1_texte').value) || '—';
    $('pv_s2t').textContent = '2. ' + (esc($('s2_titre').value) || '—');
    $('pv_s2b').textContent = esc($('s2_texte').value) || '—';

    const bulletVals = [...container.querySelectorAll('.bullet-input')].map(i => i.value.trim()).filter(Boolean);
    $('pv_bullets').textContent = bulletVals.length ? bulletVals.map(b => '• ' + b).join('\n') : '—';

    const conclusion = esc($('f_conclusion').value);
    $('pv_conclusion').textContent = conclusion ? ('Conclusion : ' + conclusion) : '';

    const pv_photos = $('pv_photos');
    const pv_photos_page = $('pv_photos_page');
    pv_photos.innerHTML = '';
    const cardsWithPhotos = [...container.querySelectorAll('.photo-card')].filter(c => c.dataset.dataUrl);
    if (cardsWithPhotos.length) {
      pv_photos_page.style.display = 'block';
      cardsWithPhotos.forEach(card => {
        const block = document.createElement('div');
        block.className = 'pv-photo-block';
        const caption = card.querySelector('input[type=text]').value.trim();
        block.innerHTML = `<img src="${card.dataset.dataUrl}"><div class="cap">${esc(caption)}</div>`;
        pv_photos.appendChild(block);
      });
    } else {
      pv_photos_page.style.display = 'none';
    }
    saveDraft();
  }
  ['f_titre', 'f_client', 'f_adresse', 'f_date', 'f_intervenant', 'f_objet', 's1_titre', 's1_texte', 's2_titre', 's2_texte', 'f_conclusion'].forEach(id => {
    $(id).addEventListener('input', updatePreview);
  });
  updatePreview();

  /* ---- génération du PDF (jsPDF + jspdf-autotable) ---- */
  function val(id) { return $(id).value.trim(); }

  // Écrit un bloc de texte avec retour à la ligne automatique, et
  // retourne la position Y à laquelle continuer à dessiner ensuite.
  function wrapAndDraw(doc, text, x, y, maxWidth, lineHeight, fontSize, color, bold = false) {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(fontSize);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(text, maxWidth);
    lines.forEach(line => { doc.text(line, x, y); y += lineHeight; });
    return y;
  }
  // Dessine le pied de page (ligne de séparation + mention + numéro de page).
  function drawFooter(doc, pageNum) {
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    doc.setDrawColor(204, 204, 204);
    doc.line(22, ph - 19, pw - 22, ph - 19);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(102, 102, 102);
    doc.text("FF CLIM - Installation, dépannage et maintenance climatisation", 22, ph - 15);
    doc.text("Page " + pageNum, pw - 22, ph - 15, { align: 'right' });
  }

  async function generatePDF() {
    const btn = document.getElementById('downloadBtn');
    const statusMsg = document.getElementById('statusMsg');
    btn.disabled = true; statusMsg.textContent = 'Génération du PDF en cours...';
    try {
      // On attend que le logo soit bien téléchargé (voir js/assets.js)
      // avant de pouvoir l'insérer dans le PDF.
      await assetsReady;

      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const pw = doc.internal.pageSize.getWidth();
      const ph = doc.internal.pageSize.getHeight();
      const marginX = 22;
      const contentW = pw - marginX * 2;
      let page = 1;

      const logoSize = 42;
      doc.addImage(LOGO_DATA_URL, 'JPEG', pw / 2 - logoSize / 2, 16.1, logoSize, logoSize);

      let y = 60;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(0, 174, 234);
      doc.text(CATEGORY_LABELS[key].toUpperCase(), pw / 2, y, { align: 'center' });
      y += 6;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(19); doc.setTextColor(26, 26, 26);
      doc.text("RAPPORT D'INTERVENTION", pw / 2, y, { align: 'center' });
      y += 8;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(35, 38, 126);
      const titreMission = val('f_titre') || "[Titre de la mission]";
      const titreLines = doc.splitTextToSize(titreMission, contentW);
      titreLines.forEach(l => { doc.text(l, pw / 2, y, { align: 'center' }); y += 5.5; });
      y += 4;

      const rows = [
        ["Client", val('f_client')],
        ["Adresse", val('f_adresse')],
        ["Date d'intervention", val('f_date')],
        ["Intervenant", val('f_intervenant')],
        ["Objet", val('f_objet')],
      ];
      doc.autoTable({
        startY: y, margin: { left: marginX, right: marginX }, body: rows, theme: 'grid',
        styles: { font: 'helvetica', fontSize: 9.5, cellPadding: 2.2, lineColor: [204, 204, 204], lineWidth: 0.15, textColor: [26, 26, 26] },
        columnStyles: { 0: { cellWidth: 42, fontStyle: 'bold', textColor: [31, 95, 168], fillColor: [234, 241, 251] }, 1: { cellWidth: contentW - 42 } },
      });
      y = doc.lastAutoTable.finalY + 8;

      function section(num, titre, texte, preco) {
        if (!titre && !texte && !preco) return;
        if (y > ph - 45) { drawFooter(doc, page); doc.addPage(); page++; y = 25; }
        doc.setFont('helvetica', 'bold'); doc.setFontSize(12.5); doc.setTextColor(31, 95, 168);
        doc.text(num + '. ' + (titre || ''), marginX, y);
        y += 7;
        if (texte) { y = wrapAndDraw(doc, texte, marginX, y, contentW, 5.1, 10, [26, 26, 26]); y += 2; }
        if (preco) { y = wrapAndDraw(doc, "Préconisation : " + preco, marginX, y, contentW, 5.1, 10, [26, 26, 26], true); y += 2; }
        y += 3;
      }
      section(1, val('s1_titre'), val('s1_texte'), val('s1_preco'));
      section(2, val('s2_titre'), val('s2_texte'), val('s2_preco'));

      const bulletVals = [...container.querySelectorAll('.bullet-input')].map(i => i.value.trim()).filter(Boolean);
      if (bulletVals.length) {
        if (y > ph - 45) { drawFooter(doc, page); doc.addPage(); page++; y = 25; }
        doc.setFont('helvetica', 'bold'); doc.setFontSize(12.5); doc.setTextColor(31, 95, 168);
        doc.text("3. Synthèse des travaux à prévoir", marginX, y);
        y += 7;
        bulletVals.forEach(b => {
          if (y > ph - 30) { drawFooter(doc, page); doc.addPage(); page++; y = 25; }
          doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(26, 26, 26);
          const lines = doc.splitTextToSize(b, contentW - 6);
          doc.text('•', marginX + 2, y);
          lines.forEach((l, i) => { doc.text(l, marginX + 7, y + i * 5.1); });
          y += lines.length * 5.1 + 1.5;
        });
        y += 3;
      }

      const conclusion = val('f_conclusion');
      if (conclusion) {
        if (y > ph - 40) { drawFooter(doc, page); doc.addPage(); page++; y = 25; }
        y = wrapAndDraw(doc, "Conclusion : " + conclusion, marginX, y, contentW, 5.1, 10, [26, 26, 26], true);
      }
      drawFooter(doc, page);

      const photoCards = [...container.querySelectorAll('.photo-card')].filter(c => c.dataset.dataUrl);
      if (photoCards.length) {
        doc.addPage(); page++;
        let py = 25;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(19); doc.setTextColor(26, 26, 26);
        doc.text("PHOTOS DE L'INTERVENTION", pw / 2, py, { align: 'center' });
        py += 14;
        const maxH = 88, maxW = contentW;
        photoCards.forEach(card => {
          const w = parseFloat(card.dataset.w), h = parseFloat(card.dataset.h);
          let imgW = maxH * (w / h), imgH = maxH;
          if (imgW > maxW) { imgW = maxW; imgH = maxW * (h / w); }
          const caption = card.querySelector('input[type=text]').value.trim();
          const captionLines = caption ? doc.splitTextToSize(caption, contentW) : [];
          const blockH = imgH + 5 + captionLines.length * 4.2 + 6;
          if (py + blockH > ph - 22) { drawFooter(doc, page); doc.addPage(); page++; py = 25; }
          const imgX = pw / 2 - imgW / 2;
          doc.addImage(card.dataset.dataUrl, 'JPEG', imgX, py, imgW, imgH);
          py += imgH + 4;
          if (caption) {
            doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(102, 102, 102);
            captionLines.forEach(l => { doc.text(l, pw / 2, py, { align: 'center' }); py += 4.2; });
          }
          py += 5;
        });
        drawFooter(doc, page);
      }

      const clientName = (val('f_client') || 'rapport').replace(/[^a-z0-9]+/gi, '_');
      const dateName = (val('f_date') || '').replace(/[^a-z0-9]+/gi, '-');
      const filename = `Rapport_${CATEGORY_LABELS[key]}_${clientName}${dateName ? '_' + dateName : ''}_FF_CLIM.pdf`;
      const pdfBlob = doc.output('blob');
      downloadBytes(pdfBlob, filename);
            logHistoryEntry(key, val('f_titre'), val('f_client'), pdfBlob, filename, val('f_intervenant'));
      if (confirm('PDF téléchargé ✓\n\nVoulez-vous vider le formulaire pour une nouvelle saisie ?')) {
        resetForm();
      }
      statusMsg.textContent = 'PDF téléchargé ✓';
      setTimeout(() => { statusMsg.textContent = ''; }, 3000);
    } catch (err) {
      console.error(err);
      document.getElementById('statusMsg').textContent = "Une erreur est survenue pendant la génération.";
    } finally {
      document.getElementById('downloadBtn').disabled = false;
    }
  }

  REPORT_MODULES[key] = { updatePreview, generatePDF };
}

// Instancie les 4 modules de rapport générique dès le chargement de la page.
REPORT_CATEGORIES.forEach(c => initReportModule(c.key));

(function () {
  'use strict';
  const S = window.AideVisio;
  const results = [];
  const logEl = document.getElementById('log');

  const ai = { key: true, calls: [] };
  S.ai = {
    hasKey: () => ai.key,
    extractFile: async (blob, mime) => { ai.calls.push({ mime, size: blob.size }); return 'TEXTE IA SIMULÉ (' + mime + ')'; }
  };

  const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const fx = (name, type) => new File([b64(window.__FIXTURES[name])], name, { type: type || '' });

  class Skip extends Error {}
  function check(cond, msg) { if (!cond) throw new Error(msg); }
  function has(text, needle) { check(text.indexOf(needle) >= 0, 'texte attendu absent : ' + JSON.stringify(needle) + '\n--- obtenu ---\n' + text); }
  function not(text, needle) { check(text.indexOf(needle) < 0, 'texte inattendu présent : ' + JSON.stringify(needle) + '\n--- obtenu ---\n' + text); }
  function eq(a, b, what) { check(a === b, (what || 'valeur') + ' : attendu ' + JSON.stringify(b) + ', obtenu ' + JSON.stringify(a)); }
  async function rejects(promise, code) {
    try { await promise; } catch (e) { eq(e.code, code, 'code erreur'); check(e.message && /[a-zé]/.test(e.message), 'message vide'); return e; }
    throw new Error('une erreur ' + code + ' était attendue');
  }

  const tests = [];
  const test = (name, fn) => tests.push({ name, fn });

  let docxText = '';
  test('DOCX : paragraphes, tabulation, saut, liste, tableau, zone de texte, révisions', async () => {
    const r = await S.docs.extract(fx('sample.docx'));
    eq(r.method, 'docx', 'method');
    const t = r.text;
    docxText = t;
    has(t, 'Responsable administratif et financier H/F');
    has(t, 'Entreprise :\tSociété Générale d\'Énergie');
    has(t, 'Vos missions\nPiloter la clôture mensuelle & le budget');
    has(t, '- Encadrer une équipe de 4 personnes');
    has(t, 'Texte conservé');
    not(t, 'supprimé'); not(t, 'PAGE');
    has(t, 'Contrat | CDI\nSalaire | 55 k€');
    eq(t.split('Zone de texte unique').length - 1, 1, 'zone de texte (sans doublon Fallback)');
    has(t, 'Profil recherché : 5 ans d’expérience');
    has(t, 'En-tête : Groupe Exemple — confidentiel');
  });
  test('DOCX : décompresseur JS de secours = résultat identique', async () => {
    S.docs.config.forceJsInflate = true;
    try {
      const r = await S.docs.extract(fx('sample.docx'));
      eq(r.text, docxText, 'texte via inflate JS');
    } finally { S.docs.config.forceJsInflate = false; }
  });
  test('DOCX tronqué (sans répertoire central) : repli en-têtes locaux', async () => {
    const r = await S.docs.extract(fx('sample-truncated.docx'));
    eq(r.method, 'docx', 'method');
    has(r.text, 'Responsable administratif et financier H/F');
  });
  test('DOCX sans extension : détection par signature', async () => {
    const r = await S.docs.extract(fx('sample.docx'), 'document');
    eq(r.method, 'docx', 'method');
  });

  test('ODT : titres, espaces, listes, tableau, notes, suivi des modifications', async () => {
    const r = await S.docs.extract(fx('sample.odt'));
    eq(r.method, 'odt', 'method');
    const t = r.text;
    has(t, 'Expérience professionnelle\nContrôleur de gestion\t2019 – 2023');
    has(t, 'Groupe Exemple\nParis');
    has(t, '- Reporting mensuel\n- Budget annuel');
    has(t, 'Langues | Anglais courant');
    has(t, 'Master CCA — IAE de Paris');
    has(t, 'Notes :\nNote de bas de page');
    not(t, 'texte effacé'); not(t, 'Illustration');
  });

  test('RTF : accents, \\u, tableaux, champs, groupes ignorés', async () => {
    const r = await S.docs.extract(fx('sample.rtf'));
    eq(r.method, 'rtf', 'method');
    const t = r.text;
    has(t, 'Préparation de l\'entretien');
    has(t, '- Question : présentez-vous ?');
    has(t, 'Réponse : je suis contrôleur de gestion');
    has(t, 'Prix : 50€\tnet\nsuite');
    has(t, 'Atout | Rigueur');
    has(t, 'lien visible');
    has(t, '{accolades} et \\ barre');
    has(t, 'Fin du pitch');
    not(t, 'HYPERLINK'); not(t, 'Arial'); not(t, 'Titre'); not(t, '89504e'); not(t, 'Test RTF');
  });

  test('HTML : texte propre (scripts, styles, nav, éléments cachés retirés)', async () => {
    const r = await S.docs.extract(fx('sample.html', 'text/html'));
    eq(r.method, 'html', 'method');
    const t = r.text;
    has(t, 'Contrôleur de gestion H/F');
    has(t, 'Nous recherchons un contrôleur & analyste.\nPoste basé à Paris.');
    has(t, '- Clôtures mensuelles\n- Reporting groupe');
    has(t, '3. Trois');
    has(t, 'Contrat | CDI\nLieu | Paris 8e');
    not(t, 'NE PAS VOIR'); not(t, 'caché'); not(t, 'Accueil'); not(t, 'color:red');
  });
  test('HTML Windows-1252 (meta charset)', async () => {
    const r = await S.docs.extract(fx('sample-cp1252.html'));
    has(r.text, 'Expérience réussie — très appréciée');
  });
  test('HTML UTF-8 étiqueté à tort utf-16 (meta ignorée)', async () => {
    const html = '<html><head><meta charset="utf-16"></head><body><p>Élève réussie, garçon motivé.</p></body></html>';
    const r = await S.docs.extract(new File([new TextEncoder().encode(html)], 'faux-utf16.html', { type: 'text/html' }));
    has(r.text, 'Élève réussie, garçon motivé.');
  });

  test('TXT Windows-1252 → repli automatique', async () => {
    const r = await S.docs.extract(fx('sample-cp1252.txt'));
    eq(r.method, 'text', 'method');
    has(r.text, 'Société générale — clôture des comptes à 50 € ; cœur de métier’s');
  });
  test('TXT UTF-16 avec BOM', async () => {
    const r = await S.docs.extract(fx('sample-utf16.txt'));
    has(r.text, 'Fiche UTF-16 : élève, garçon, Noël');
  });
  test('TXT UTF-8 : césures, lignes vides, classement prépa', async () => {
    const r = await S.docs.extract(fx('sample.txt', 'text/plain'));
    has(r.text, 'rigueur, gestion de projet.');
    not(r.text, '\n\n\n');
  });
  test('Markdown', async () => {
    const r = await S.docs.extract(fx('sample.md'));
    eq(r.method, 'text', 'method');
    has(r.text, '# Pitch\n\n- **Parcours**');
  });
  test('JSON questions/réponses → texte lisible', async () => {
    const r = await S.docs.extract(fx('sample.json', 'application/json'));
    has(r.text, '## Questions RH');
    has(r.text, 'Q : Pourquoi nous ?\nR : Parce que votre mission me parle.');
  });
  test('Ancien .doc (OLE) : extraction approximative + avertissement', async () => {
    const r = await S.docs.extract(fx('sample.doc'));
    eq(r.method, 'text', 'method');
    has(r.text, 'Lettre de motivation pour le poste de contrôleur de gestion');
    check(/\.doc/.test(r.warning || ''), 'avertissement .doc attendu');
  });

  test('Image avec clé → S.ai.extractFile', async () => {
    ai.key = true; ai.calls.length = 0;
    const r = await S.docs.extract(fx('sample.png', 'image/png'), 'capture annonce.png');
    eq(r.method, 'ai', 'method');
    eq(ai.calls.length, 1, 'appels IA');
    eq(ai.calls[0].mime, 'image/png', 'mime');
    has(r.text, 'TEXTE IA SIMULÉ');
    check(!!r.warning, 'avertissement attendu');
  });
  test('Image sans clé → erreur claire NEEDS_KEY', async () => {
    ai.key = false;
    try { await rejects(S.docs.extract(fx('sample.png')), 'NEEDS_KEY'); } finally { ai.key = true; }
  });

  let pdfjsOk = null;
  async function needPdfJs() {
    if (pdfjsOk === null) {
      try { const p = await S.docs.loadPdfJs(); pdfjsOk = true; window.__pdfjsVersion = p.version; }
      catch (e) { pdfjsOk = false; window.__pdfjsError = String(e && (e.cause || e)); }
    }
    if (!pdfjsOk) throw new Skip('CDN pdf.js injoignable : ' + window.__pdfjsError);
  }
  test('PDF texte via pdf.js : lignes reconstituées (transform y)', async () => {
    await needPdfJs();
    ai.calls.length = 0;
    const r = await S.docs.extract(fx('sample.pdf', 'application/pdf'));
    eq(r.method, 'pdfjs', 'method');
    check(/^Curriculum vitae\n\n?Contrôleur/.test(r.text), 'titre puis ligne suivante\n' + r.text);
    has(r.text, 'Contrôleur de gestion\nExpérience professionnelle : 2019 - 2023\n\nFormation Master CCA\ncamille@example.com');
    eq(ai.calls.length, 0, 'aucun appel IA');
  });
  test('PDF scanné (sans texte) + clé → repli IA', async () => {
    ai.key = true; ai.calls.length = 0;
    const r = await S.docs.extract(fx('sample-scan.pdf'));
    eq(r.method, 'ai', 'method');
    eq(ai.calls[0] && ai.calls[0].mime, 'application/pdf', 'mime envoyé à l\'IA');
  });
  test('PDF scanné sans clé → erreur claire', async () => {
    ai.key = false;
    try {
      const e = await rejects(S.docs.extract(fx('sample-scan.pdf')), pdfjsOk ? 'NO_TEXT' : 'PDF_FAILED');
      check(/copiez-collez|copiez le texte/i.test(e.message), 'message doit proposer le copier-coller');
    } finally { ai.key = true; }
  });
  test('pdf.js indisponible → repli IA, sinon erreur « copiez-collez »', async () => {
    const orig = S.docs.loadPdfJs;
    S.docs.loadPdfJs = () => Promise.reject(Object.assign(new Error('hors ligne'), { code: 'PDFJS_UNAVAILABLE' }));
    try {
      ai.key = true;
      const r = await S.docs.extract(fx('sample.pdf'));
      eq(r.method, 'ai', 'method');
      check(/IA/.test(r.warning || ''), 'avertissement attendu');
      ai.key = false;
      const e = await rejects(S.docs.extract(fx('sample.pdf')), 'PDF_FAILED');
      check(/copiez le texte|copiez-collez/i.test(e.message), 'message copier-coller');
    } finally { S.docs.loadPdfJs = orig; ai.key = true; }
  });

  test('pdf.js : repli sur le build UMD si l\'import ESM échoue', async () => {
    await needPdfJs();
    const cfg = S.docs.config, I = S.docs._internal;
    const saved = cfg.pdfjsVersion, savedLib = window.pdfjsLib, savedWorker = window.pdfjsWorker;
    cfg.pdfjsVersion = '0.0.0-introuvable';
    delete window.pdfjsLib;
    delete window.pdfjsWorker;
    I.resetPdfJs();
    try {
      const p = await S.docs.loadPdfJs();
      eq(p.version, cfg.pdfjsUmdVersion, 'version chargée');
      const r = await S.docs.extract(fx('sample.pdf'));
      eq(r.method, 'pdfjs', 'method');
      has(r.text, 'Contrôleur de gestion\nExpérience professionnelle');
    } finally {
      cfg.pdfjsVersion = saved;
      if (savedLib) window.pdfjsLib = savedLib;
      if (savedWorker) window.pdfjsWorker = savedWorker; else delete window.pdfjsWorker;
      I.resetPdfJs();
    }
  });

  test('Fichier > 20 Mo refusé', async () => {
    await rejects(S.docs.extract(new File([new Uint8Array(20 * 1024 * 1024 + 1)], 'gros.pdf')), 'TOO_BIG');
  });
  test('Fichier vide refusé', async () => {
    await rejects(S.docs.extract(new File([], 'vide.txt')), 'EMPTY');
  });
  test('Binaire inconnu refusé', async () => {
    const u8 = new Uint8Array(2048);
    for (let i = 0; i < u8.length; i++) u8[i] = (i * 7919) & 0xff;
    await rejects(S.docs.extract(new File([u8], 'donnees.bin')), 'UNSUPPORTED');
  });

  test('clean : espaces, ligatures, puces, contrôle, troncature à 60 000', () => {
    const c = S.docs.clean('  ﬁnance et­co  \r\n\r\n\r\n\r\n Budget\u0007\n• Reporting  \n');
    eq(c, 'finance etco\n\n- Budget\n- Reporting', 'clean');
    const long = ('Paragraphe de test assez long pour remplir. '.repeat(20) + '\n\n').repeat(120);
    const t = S.docs.clean(long);
    check(t.length <= 60000, 'longueur ' + t.length);
    check(/\[… texte tronqué : [\d\s ]+ caractères conservés sur [\d\s ]+\]$/.test(t), 'mention de troncature');
    eq(S.docs.clean(null), '', 'null');
  });
  test('fromText / accept', () => {
    const r = S.docs.fromText('  Bonjour\n\n\n\nmonde  ', 'collé');
    eq(r.method, 'paste', 'method');
    eq(r.text, 'Bonjour\n\nmonde', 'text');
    check(/\.pdf/.test(S.docs.accept) && /\.docx/.test(S.docs.accept) && /image\/\*/.test(S.docs.accept), 'accept');
  });
  test('inflate JS = DecompressionStream sur données dynamiques', async () => {
    if (typeof CompressionStream !== 'function') throw new Skip('CompressionStream absent');
    let s = '';
    for (let i = 0; i < 4000; i++) s += 'ligne ' + i + ' ' + (i % 13 ? 'contrôle de gestion ' : 'é€ ') + String.fromCharCode(65 + (i * 7) % 26);
    const src = new TextEncoder().encode(s);
    const comp = new Uint8Array(await new Response(new Blob([src]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
    const js = S.docs._internal.inflateRawJS(comp);
    eq(js.length, src.length, 'taille');
    check(js.every((b, i) => b === src[i]), 'contenu identique');
  });

  if (/[?&]noauto\b/.test(location.search)) return;
  (async () => {
    for (const t of tests) {
      const t0 = performance.now();
      const r = { name: t.name, status: 'ok', ms: 0 };
      try { await t.fn(); }
      catch (e) {
        if (e instanceof Skip) { r.status = 'skip'; r.info = e.message; }
        else { r.status = 'fail'; r.info = (e && e.stack) || String(e); }
      }
      r.ms = Math.round(performance.now() - t0);
      results.push(r);
      const div = document.createElement('div');
      div.className = r.status === 'ok' ? 'ok' : r.status === 'skip' ? 'skip' : 'ko';
      div.textContent = (r.status === 'ok' ? '✓ ' : r.status === 'skip' ? '○ ' : '✗ ') + r.name + ' (' + r.ms + ' ms)';
      logEl.appendChild(div);
      if (r.info) { const pre = document.createElement('pre'); pre.textContent = r.info; logEl.appendChild(pre); }
    }
    window.__docsResults = {
      done: true,
      protocol: location.protocol,
      pdfjs: window.__pdfjsVersion || null,
      passed: results.filter((r) => r.status === 'ok').length,
      failed: results.filter((r) => r.status === 'fail').length,
      skipped: results.filter((r) => r.status === 'skip').length,
      results
    };
  })();
})();

// Génère les fichiers d'exemple utilisés par tests/unit-docs.html (aucune dépendance).
// Usage : node tests/fixtures/make-fixtures.mjs
import { writeFileSync } from 'node:fs';
import { deflateRawSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const out = {};
const put = (name, data) => {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
  writeFileSync(join(DIR, name), buf);
  out[name] = buf;
};

// --- ZIP minimal (stored + deflate) ----------------------------------------
const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf) {
  let c = -1;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function zip(entries) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const { name, data, store } of entries) {
    const raw = Buffer.from(data, 'utf8');
    const comp = store ? raw : deflateRawSync(raw);
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = crc32(raw);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6);
    lh.writeUInt16LE(store ? 0 : 8, 8); lh.writeUInt32LE(0, 10); lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(raw.length, 22);
    lh.writeUInt16LE(nameBuf.length, 26); lh.writeUInt16LE(0, 28);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(store ? 0 : 8, 10); ch.writeUInt32LE(0, 12); ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(nameBuf.length, 28);
    ch.writeUInt32LE(offset, 42);
    locals.push(lh, nameBuf, comp);
    centrals.push(ch, nameBuf);
    offset += 30 + nameBuf.length + comp.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(offset, 16);
  return { full: Buffer.concat([...locals, cd, eocd]), localsOnly: Buffer.concat(locals) };
}

// --- DOCX --------------------------------------------------------------------
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" xmlns:v="urn:schemas-microsoft-com:vml"';
const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${W}><w:body>
<w:p><w:pPr><w:pStyle w:val="Titre1"/></w:pPr><w:r><w:t>Responsable administratif et financier H/F</w:t></w:r></w:p>
<w:p><w:r><w:t xml:space="preserve">Entreprise :</w:t></w:r><w:r><w:tab/><w:t>Société Générale d'Énergie</w:t></w:r></w:p>
<w:p><w:pPr><w:tabs><w:tab w:val="left" w:pos="720"/></w:tabs></w:pPr><w:r><w:t>Vos missions</w:t></w:r><w:r><w:br/><w:t>Piloter la clôture mensuelle &amp; le budget</w:t></w:r></w:p>
<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>Encadrer une équipe de 4 personnes</w:t></w:r></w:p>
<w:p><w:r><w:t xml:space="preserve">Texte </w:t></w:r><w:del w:id="1"><w:r><w:delText>supprimé</w:delText></w:r></w:del><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:t>conservé</w:t></w:r></w:p>
<w:tbl><w:tblPr/><w:tr><w:tc><w:p><w:r><w:t>Contrat</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>CDI</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>Salaire</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>55 k€</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
<w:p><w:r><mc:AlternateContent><mc:Choice Requires="wps"><w:drawing><wps:txbx><w:txbxContent><w:p><w:r><w:t>Zone de texte unique</w:t></w:r></w:p></w:txbxContent></wps:txbx></w:drawing></mc:Choice><mc:Fallback><w:pict><v:textbox><w:txbxContent><w:p><w:r><w:t>Zone de texte unique</w:t></w:r></w:p></w:txbxContent></v:textbox></w:pict></mc:Fallback></mc:AlternateContent></w:r><w:r><w:t>Profil recherché : 5 ans d’expérience, postuler avant le 30/11.</w:t></w:r></w:p>
<w:p/>
<w:sectPr><w:headerReference w:type="default" r:id="rId9" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/></w:sectPr>
</w:body></w:document>`;
const headerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ${W}><w:p><w:r><w:t>En-tête : Groupe Exemple — confidentiel</w:t></w:r></w:p></w:hdr>`;
const docx = zip([
  { name: '[Content_Types].xml', store: true, data: '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/></Types>' },
  { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
  { name: 'word/_rels/document.xml.rels', data: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/></Relationships>' },
  { name: 'word/document.xml', data: documentXml },
  { name: 'word/header1.xml', data: headerXml }
]);
put('sample.docx', docx.full);
put('sample-truncated.docx', docx.localsOnly); // sans répertoire central : repli sur les en-têtes locaux

// --- ODT ---------------------------------------------------------------------
const contentXml = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" office:version="1.3">
<office:automatic-styles><style:style style:name="P1" style:family="paragraph"/></office:automatic-styles>
<office:body><office:text>
<text:tracked-changes><text:changed-region text:id="c1"><text:deletion><text:p>texte effacé</text:p></text:deletion></text:changed-region></text:tracked-changes>
<text:sequence-decls><text:sequence-decl text:display-outline-level="0" text:name="Illustration"/></text:sequence-decls>
<text:p>Camille Exemple</text:p>
<text:p>camille@example.com · 06 12 34 56 78</text:p>
<text:h text:outline-level="1">Expérience professionnelle</text:h>
<text:p>Contrôleur de gestion<text:tab/>2019 – 2023</text:p>
<text:p>Groupe<text:s text:c="3"/>Exemple<text:line-break/>Paris</text:p>
<text:list><text:list-item><text:p>Reporting mensuel</text:p></text:list-item><text:list-item><text:p>Budget annuel<text:note text:note-class="footnote"><text:note-citation>1</text:note-citation><text:note-body><text:p>Note de bas de page</text:p></text:note-body></text:note></text:p></text:list-item></text:list>
<table:table table:name="T1"><table:table-column/><table:table-row><table:table-cell><text:p>Langues</text:p></table:table-cell><table:table-cell><text:p>Anglais courant</text:p></table:table-cell></table:table-row></table:table>
<text:h text:outline-level="1">Formation</text:h>
<text:p>Master CCA <text:span>— IAE de Paris</text:span></text:p>
</office:text></office:body></office:document-content>`;
put('sample.odt', zip([
  { name: 'mimetype', store: true, data: 'application/vnd.oasis.opendocument.text' },
  { name: 'META-INF/manifest.xml', data: '<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3"><manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/></manifest:manifest>' },
  { name: 'content.xml', data: contentXml }
]).full);

// --- RTF ---------------------------------------------------------------------
const BS = String.fromCharCode(92); // barre oblique inverse, insérée par substitution
put('sample.rtf', String.raw`{\rtf1\ansi\ansicpg1252\deff0{\fonttbl{\f0\fswiss Arial;}{\f1\fnil Symbol;}}{\colortbl;\red0\green0\blue0;}{\*\generator Test RTF;}{\info{\title Titre cach\'e9}{\author Moi}}
\pard\plain\f0\fs24 Pr\'e9paration de l'entretien\par
{\pntext\f1\'b7\tab}Question : pr\'e9sentez-vous ?\par
R\'e9ponse : je suis contr\u244?leur de gestion\par
Prix : 50${BS}u8364?\tab net\line suite\par
\trowd\cellx2000\cellx4000 Atout\cell Rigueur\cell\row
\pard {\*\bkmkstart x}{\field{\*\fldinst HYPERLINK "http://example.com"}{\fldrslt lien visible}}\par
\{accolades\} et \\ barre\par
{\pict\pngblip 89504e470d0a1a0a}Fin du pitch\par
}`);

// --- HTML --------------------------------------------------------------------
put('sample.html', `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Offre</title><style>.x{color:red}</style><script>var secret = "NE PAS VOIR";</script></head>
<body><nav>Accueil | Connexion</nav>
<main>
<h1>Contrôleur de gestion H/F</h1>
<p>Nous recherchons un <b>contrôleur</b> &amp; analyste.<br>Poste basé à Paris.</p>
<h2>Vos missions</h2>
<ul><li>Clôtures mensuelles</li><li>Reporting <i>groupe</i></li></ul>
<ol start="3"><li>Trois</li></ol>
<table><tr><th>Contrat</th><th>CDI</th></tr><tr><td>Lieu</td><td>Paris&nbsp;8e</td></tr></table>
<p style="display:none">caché</p><div hidden>caché aussi</div>
<p>Profil recherché : 5 ans d’expérience en contrôle de gestion, maîtrise d’Excel et de SAP, esprit d’analyse et de synthèse.</p>
<p>Rémunération : selon profil. Avantages : télétravail partiel, tickets restaurant. Pour postuler, envoyez votre candidature.</p>
</main><footer>© 2026 Exemple</footer></body></html>`);

// --- Encodages Windows -------------------------------------------------------
const CP1252 = { '€': 0x80, '’': 0x92, '“': 0x93, '”': 0x94, '–': 0x96, '—': 0x97, 'œ': 0x9c };
const cp1252 = (s) => Buffer.from([...s].map((c) => CP1252[c] ?? c.charCodeAt(0)));
put('sample-cp1252.txt', cp1252('Société générale — clôture des comptes à 50 € ; cœur de métier’s'));
put('sample-cp1252.html', Buffer.concat([
  Buffer.from('<html><head><meta http-equiv="Content-Type" content="text/html; charset=windows-1252"></head><body><p>'),
  cp1252('Expérience réussie — très appréciée'),
  Buffer.from('</p></body></html>')
]));
put('sample-utf16.txt', Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('Fiche UTF-16 : élève, garçon, Noël', 'utf16le')]));

// --- Texte / Markdown / JSON -------------------------------------------------
put('sample.txt', `Préparation entretien — DGEC\n\nQ : Présentez-vous en 1 minute ?\nR : Contrôleur de gestion depuis 5 ans…\n\nQ : Pourquoi ce poste ?\nR : Pour le pilotage budgétaire.\n\n\n\nPoints forts : rigueur, ges-\ntion de projet.\n`);
put('sample.md', `# Pitch\n\n- **Parcours** : 5 ans en contrôle de gestion\n- **Motivation** : service public\n\n## Questions à poser\n\n1. Quelle est la taille de l’équipe ?\n`);
put('sample.json', JSON.stringify({ 'Questions RH': [{ q: 'Pourquoi nous ?', a: 'Parce que votre mission me parle.' }, { q: 'Vos défauts ?', a: 'Perfectionniste.' }] }));

// --- PDF texte minimal (écrit à la main ; seuls les offsets xref sont calculés) ---
function pdf(objects) {
  let body = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
  const offsets = [];
  objects.forEach((o, i) => { offsets.push(Buffer.byteLength(body, 'latin1')); body += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = Buffer.byteLength(body, 'latin1');
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` + offsets.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
}
const stream = (s) => `<< /Length ${Buffer.byteLength(s, 'latin1')} >>\nstream\n${s}\nendstream`;
const content = [
  'BT /F1 16 Tf 72 770 Td (Curriculum vitae) Tj ET',
  'BT /F1 11 Tf 72 740 Td (Contr\\364leur de gestion) Tj 0 -14 Td (Exp\\351rience professionnelle : 2019 - 2023) Tj ET',
  'BT /F1 11 Tf 72 690 Td (Formation) Tj 150 0 Td (Master CCA) Tj ET',
  'BT /F1 11 Tf 72 676 Td (camille@example.com - 06 12 34 56 78) Tj ET'
].join('\n');
put('sample.pdf', pdf([
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  stream(content)
]));
put('sample-scan.pdf', pdf([
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R >>',
  stream('0.9 g 72 600 200 100 re f')
]));

// --- Image PNG 1×1 -----------------------------------------------------------
put('sample.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));

// --- Faux .doc (conteneur OLE + texte UTF-16) --------------------------------
const docText = 'Lettre de motivation pour le poste de contrôleur de gestion\rJe suis très motivé par cette opportunité au sein de votre direction financière.\r';
put('sample.doc', Buffer.concat([
  Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.alloc(504),
  Buffer.from(docText, 'utf16le'), Buffer.alloc(512)
]));

// --- Bundle pour exécution sans serveur (file://) ----------------------------
const bundle = Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.toString('base64')]));
writeFileSync(join(DIR, 'fixtures.js'), '// Généré par make-fixtures.mjs — ne pas modifier\nwindow.__FIXTURES = ' + JSON.stringify(bundle, null, 1) + ';\n');
console.log('Fixtures écrites :', Object.keys(out).join(', '));

(function (S) {
  'use strict';

  const MB = 1024 * 1024;
  const config = {
    maxBytes: 20 * MB,
    maxChars: 60000,
    timeoutMs: 15000,
    pdfTotalMs: 45000,
    cdn: 'https://cdn.jsdelivr.net/npm/',
    pdfjsVersion: '6.4.299',
    pdfjsUmdVersion: '3.11.174',
    forceJsInflate: false
  };

  const ACCEPT = [
    '.pdf', '.docx', '.docm', '.dotx', '.doc', '.odt', '.ott', '.ods', '.odp', '.fodt', '.rtf',
    '.txt', '.text', '.md', '.markdown', '.csv', '.tsv', '.json', '.xml', '.log',
    '.html', '.htm', '.xhtml',
    '.png', '.jpg', '.jpeg', '.webp', '.heic', '.heif', '.gif', '.bmp', '.avif',
    'application/pdf', 'text/*', 'image/*'
  ].join(',');

  function fail(code, message, cause) {
    const e = new Error(message);
    e.code = code;
    e.userMessage = message;
    if (cause) e.cause = cause;
    return e;
  }

  function withTimeout(promise, ms, code) {
    let timer;
    return Promise.race([
      promise,
      new Promise((_, reject) => { timer = setTimeout(() => reject(fail(code || 'TIMEOUT', 'Délai dépassé.')), ms); })
    ]).finally(() => clearTimeout(timer));
  }

  function extOf(name) {
    const m = /\.([a-z0-9]{1,8})$/i.exec(String(name || '').trim());
    return m ? m[1].toLowerCase() : '';
  }

  function mbStr(bytes) {
    return (bytes / MB).toFixed(1).replace('.', ',');
  }

  async function toBytes(blob) {
    if (blob instanceof Uint8Array) return blob;
    if (blob instanceof ArrayBuffer) return new Uint8Array(blob);
    if (blob && typeof blob.arrayBuffer === 'function') return new Uint8Array(await blob.arrayBuffer());
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(new Uint8Array(fr.result));
      fr.onerror = () => reject(fr.error || new Error('FileReader'));
      fr.readAsArrayBuffer(blob);
    });
  }

  function ascii(u8, start, len) {
    let s = '';
    for (let i = start; i < start + len && i < u8.length; i++) s += String.fromCharCode(u8[i]);
    return s;
  }

  const CP1252_HIGH = [0x20ac, 0x81, 0x201a, 0x192, 0x201e, 0x2026, 0x2020, 0x2021, 0x2c6, 0x2030, 0x160, 0x2039, 0x152, 0x8d, 0x17d, 0x8f,
    0x90, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x2dc, 0x2122, 0x161, 0x203a, 0x153, 0x9d, 0x17e, 0x178];
  const cp1252 = {
    decode(u8) {
      u8 = u8 || new Uint8Array(0);
      let s = '';
      for (let i = 0; i < u8.length; i += 8192) {
        const chunk = u8.subarray(i, i + 8192);
        const codes = new Uint16Array(chunk.length);
        for (let k = 0; k < chunk.length; k++) { const b = chunk[k]; codes[k] = b >= 0x80 && b < 0xa0 ? CP1252_HIGH[b - 0x80] : b; }
        s += String.fromCharCode.apply(null, codes);
      }
      return s;
    }
  };

  function decoder(label, fatal) {
    if (/^(windows-1252|cp1252|latin1|iso-8859-1|us-ascii|ascii)$/i.test(label)) return cp1252;
    try { return new TextDecoder(label, fatal ? { fatal: true } : undefined); }
    catch (e) { return new TextDecoder('utf-8'); }
  }

  function decodeText(u8, hintCharset) {
    if (u8[0] === 0xEF && u8[1] === 0xBB && u8[2] === 0xBF) return decoder('utf-8').decode(u8.subarray(3));
    if (u8[0] === 0xFF && u8[1] === 0xFE) return decoder('utf-16le').decode(u8.subarray(2));
    if (u8[0] === 0xFE && u8[1] === 0xFF) return decoder('utf-16be').decode(u8.subarray(2));
    const n = Math.min(u8.length, 4000);
    let zEven = 0, zOdd = 0;
    for (let i = 0; i < n; i++) if (u8[i] === 0) { if (i & 1) zOdd++; else zEven++; }
    if (n >= 8 && zOdd > n * 0.3 && zEven < n * 0.02) return decoder('utf-16le').decode(u8);
    if (n >= 8 && zEven > n * 0.3 && zOdd < n * 0.02) return decoder('utf-16be').decode(u8);
    if (hintCharset && !/^utf-?8$/i.test(hintCharset)) {
      try { return decoder(hintCharset).decode(u8); } catch (e) {  }
    }
    try { return decoder('utf-8', true).decode(u8); }
    catch (e) { return decoder('windows-1252').decode(u8); }
  }

  const NAMED_ENTITIES = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0', eacute: 'é', egrave: 'è', ecirc: 'ê',
    euml: 'ë', agrave: 'à', acirc: 'â', auml: 'ä', ccedil: 'ç', icirc: 'î', iuml: 'ï', ocirc: 'ô', ouml: 'ö',
    ugrave: 'ù', ucirc: 'û', uuml: 'ü', Eacute: 'É', Egrave: 'È', Ecirc: 'Ê', Agrave: 'À', Ccedil: 'Ç',
    oelig: 'œ', OElig: 'Œ', laquo: '«', raquo: '»', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”',
    ndash: '–', mdash: '—', hellip: '…', euro: '€', bull: '•', middot: '·', copy: '©', reg: '®', deg: '°'
  };

  function decodeEntities(s) {
    if (s.indexOf('&') < 0) return s;
    return s.replace(/&(#[xX][0-9a-fA-F]+|#\d+|[A-Za-z]+);/g, (m, e) => {
      if (e[0] === '#') {
        const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        try { return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : ''; } catch (err) { return ''; }
      }
      return Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, e) ? NAMED_ENTITIES[e] : m;
    });
  }

  const LIGATURES = { '\ufb00': 'ff', '\ufb01': 'fi', '\ufb02': 'fl', '\ufb03': 'ffi', '\ufb04': 'ffl', '\ufb05': 'st', '\ufb06': 'st' };

  function clean(text) {
    let t = text == null ? '' : String(text);
    t = t.replace(/\r\n?/g, '\n').replace(/[\f\v\u2028\u2029\u0085]/g, '\n');
    t = t.replace(/[\u00ad\u200b-\u200d\u2060\ufeff]/g, '');
    t = t.replace(/[\u0000-\u0008\u000e-\u001f\u007f]/g, '');
    t = t.replace(/[\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]/g, ' ');
    t = t.replace(/[\ufb00-\ufb06]/g, (c) => LIGATURES[c] || c);
    t = t.replace(/[\uf0a7\uf0b7\uf076\uf0d8\uf0fc\uf06e\uf0a8\uf0e0\uf02d]/g, '•');
    t = t.replace(/^[ \t]*[•●▪◦■□➢➤►▸‣⁃∙·][ \t]*/gm, '- ');
    t = t.replace(/([A-Za-zÀ-ÖØ-öø-ÿœŒ])-\n[ \t]*(?=[a-zà-öø-ÿœ])/g, '$1');
    t = t.split('\n').map((line) => {
      line = line.replace(/[ \t]+$/, '');
      const lead = /^[ \t]*/.exec(line)[0];
      const indent = lead ? ' '.repeat(Math.min(lead.replace(/\t/g, '  ').length, 8)) : '';
      return indent + line.slice(lead.length).replace(/[ \t]{2,}/g, (m) => (m.indexOf('\t') >= 0 ? '\t' : ' '));
    }).join('\n');
    t = t.replace(/\n{3,}/g, '\n\n').replace(/^\s*\n/, '').trim();
    return truncate(t, config.maxChars);
  }

  function truncate(t, max) {
    if (t.length <= max) return t;
    const total = t.length;
    const note = (kept) => '\n\n[… texte tronqué : ' + kept.toLocaleString('fr-FR') + ' caractères conservés sur ' + total.toLocaleString('fr-FR') + ']';
    const budget = max - note(max).length - 2;
    let cut = t.lastIndexOf('\n\n', budget);
    if (cut < budget - 3000) cut = t.lastIndexOf('\n', budget);
    if (cut < budget - 3000) cut = Math.max(t.lastIndexOf('. ', budget) + 1, 0);
    if (cut < budget - 3000) cut = budget;
    const kept = t.slice(0, cut).trimEnd();
    return kept + note(kept.length);
  }

  const LBASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
  const LEXT = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
  const DBASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
  const DEXT = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
  const CL_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

  function huffman(lengths, n) {
    const counts = new Uint16Array(16), offs = new Uint16Array(16), syms = new Uint16Array(n);
    for (let i = 0; i < n; i++) counts[lengths[i]]++;
    counts[0] = 0;
    for (let i = 1; i < 16; i++) offs[i] = offs[i - 1] + counts[i - 1];
    for (let i = 0; i < n; i++) if (lengths[i]) syms[offs[lengths[i]]++] = i;
    return { counts, syms };
  }

  let fixedTables = null;
  function getFixed() {
    if (!fixedTables) {
      const l = new Uint8Array(288);
      for (let i = 0; i < 288; i++) l[i] = i < 144 ? 8 : i < 256 ? 9 : i < 280 ? 7 : 8;
      fixedTables = [huffman(l, 288), huffman(new Uint8Array(30).fill(5), 30)];
    }
    return fixedTables;
  }

  function inflateRawJS(data, sizeHint) {
    let pos = 0, bitBuf = 0, bitCnt = 0;
    let out = new Uint8Array(Math.max(1024, sizeHint || data.length * 4));
    let len = 0;
    const bad = (m) => { throw new Error('inflate: ' + m); };
    const ensure = (n) => {
      if (len + n <= out.length) return;
      let size = out.length * 2;
      while (size < len + n) size *= 2;
      const o = new Uint8Array(size);
      o.set(out.subarray(0, len));
      out = o;
    };
    const bits = (n) => {
      while (bitCnt < n) {
        if (pos >= data.length) bad('fin de données inattendue');
        bitBuf |= data[pos++] << bitCnt;
        bitCnt += 8;
      }
      const v = bitBuf & ((1 << n) - 1);
      bitBuf >>>= n;
      bitCnt -= n;
      return v;
    };
    const decode = (h) => {
      let code = 0, first = 0, index = 0;
      for (let l = 1; l < 16; l++) {
        code |= bits(1);
        const count = h.counts[l];
        if (code - count < first) return h.syms[index + (code - first)];
        index += count;
        first = (first + count) << 1;
        code <<= 1;
      }
      return bad('code invalide');
    };
    let last;
    do {
      last = bits(1);
      const type = bits(2);
      if (type === 0) {
        bitBuf = 0; bitCnt = 0;
        if (pos + 4 > data.length) bad('bloc stocké tronqué');
        const n = data[pos] | (data[pos + 1] << 8);
        pos += 4;
        if (pos + n > data.length) bad('bloc stocké tronqué');
        ensure(n);
        out.set(data.subarray(pos, pos + n), len);
        len += n; pos += n;
      } else if (type === 1 || type === 2) {
        let lt, dt;
        if (type === 1) {
          [lt, dt] = getFixed();
        } else {
          const hlit = bits(5) + 257, hdist = bits(5) + 1, hclen = bits(4) + 4;
          const cl = new Uint8Array(19);
          for (let i = 0; i < hclen; i++) cl[CL_ORDER[i]] = bits(3);
          const ct = huffman(cl, 19);
          const lens = new Uint8Array(hlit + hdist);
          let i = 0;
          while (i < hlit + hdist) {
            const sym = decode(ct);
            if (sym < 16) { lens[i++] = sym; continue; }
            let rep, val = 0;
            if (sym === 16) { if (!i) bad('répétition initiale'); val = lens[i - 1]; rep = 3 + bits(2); }
            else if (sym === 17) rep = 3 + bits(3);
            else rep = 11 + bits(7);
            if (i + rep > hlit + hdist) bad('longueurs invalides');
            while (rep--) lens[i++] = val;
          }
          lt = huffman(lens.subarray(0, hlit), hlit);
          dt = huffman(lens.subarray(hlit), hdist);
        }
        for (;;) {
          const sym = decode(lt);
          if (sym < 256) { ensure(1); out[len++] = sym; continue; }
          if (sym === 256) break;
          const li = sym - 257;
          if (li >= 29) bad('longueur invalide');
          const n = LBASE[li] + bits(LEXT[li]);
          const ds = decode(dt);
          if (ds >= 30) bad('distance invalide');
          const dist = DBASE[ds] + bits(DEXT[ds]);
          if (dist > len) bad('distance trop grande');
          ensure(n);
          for (let k = 0; k < n; k++) { out[len] = out[len - dist]; len++; }
        }
      } else {
        bad('type de bloc invalide');
      }
    } while (!last);
    return out.subarray(0, len);
  }

  async function inflateRaw(raw, sizeHint) {
    if (!config.forceJsInflate && typeof DecompressionStream === 'function' && typeof Response === 'function') {
      try {
        const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        return new Uint8Array(await new Response(stream).arrayBuffer());
      } catch (e) {  }
    }
    return inflateRawJS(raw, sizeHint);
  }

  function readZip(u8) {
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    const u16 = (o) => dv.getUint16(o, true);
    const u32 = (o) => dv.getUint32(o, true);
    const u64 = (o) => u32(o) + u32(o + 4) * 0x100000000;
    const utf8 = decoder('utf-8');
    const entries = new Map();

    let eocd = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 22 - 65535); i--) {
      if (u8[i] === 0x50 && u8[i + 1] === 0x4b && u32(i) === 0x06054b50) { eocd = i; break; }
    }

    if (eocd >= 0) {
      let count = u16(eocd + 10);
      const cdSize = u32(eocd + 12);
      let cdOff = u32(eocd + 16);
      if ((count === 0xffff || cdOff === 0xffffffff) && eocd >= 20 && u32(eocd - 20) === 0x07064b50) {
        const z = u64(eocd - 12);
        if (z + 56 <= u8.length && u32(z) === 0x06064b50) { count = u64(z + 32); cdOff = u64(z + 48); }
      }
      let shift = 0;
      if (cdOff + 4 > u8.length || u32(cdOff) !== 0x02014b50) {
        const guess = eocd - cdSize;
        if (guess >= 0 && u32(guess) === 0x02014b50) { shift = guess - cdOff; cdOff = guess; }
      }
      let p = cdOff;
      for (let i = 0; i < count && p + 46 <= u8.length && u32(p) === 0x02014b50; i++) {
        const flags = u16(p + 8), method = u16(p + 10);
        let csize = u32(p + 20), usize = u32(p + 24);
        const nlen = u16(p + 28), xlen = u16(p + 30), clen = u16(p + 32);
        let lho = u32(p + 42);
        const name = utf8.decode(u8.subarray(p + 46, p + 46 + nlen));
        if (usize === 0xffffffff || csize === 0xffffffff || lho === 0xffffffff) {
          let x = p + 46 + nlen;
          const xend = x + xlen;
          while (x + 4 <= xend) {
            const id = u16(x), sz = u16(x + 2);
            if (id === 0x0001) {
              let q = x + 4;
              if (usize === 0xffffffff) { usize = u64(q); q += 8; }
              if (csize === 0xffffffff) { csize = u64(q); q += 8; }
              if (lho === 0xffffffff) { lho = u64(q); }
              break;
            }
            x += 4 + sz;
          }
        }
        entries.set(name, { name, flags, method, csize, usize, lho: lho + shift });
        p += 46 + nlen + xlen + clen;
      }
    }

    if (!entries.size) {
      let p = 0;
      while (p + 30 <= u8.length) {
        if (u32(p) !== 0x04034b50) {
          const next = indexOfSig(u8, p + 1, 0x50, 0x4b, 0x03, 0x04);
          if (next < 0) break;
          p = next; continue;
        }
        const flags = u16(p + 6), method = u16(p + 8);
        let csize = u32(p + 18);
        const usize = u32(p + 22);
        const nlen = u16(p + 26), xlen = u16(p + 28);
        const name = utf8.decode(u8.subarray(p + 30, p + 30 + nlen));
        const start = p + 30 + nlen + xlen;
        if ((flags & 8) && !csize) {
          const next = indexOfSig(u8, start, 0x50, 0x4b, 0x03, 0x04);
          const end = next < 0 ? u8.length : next;
          csize = end - start;
          if (end - start >= 16 && u32(end - 16) === 0x08074b50) csize -= 16;
          else if (end - start >= 12) csize -= 12;
        }
        entries.set(name, { name, flags, method, csize, usize, lho: p, trunc: true });
        p = start + Math.max(csize, 0);
      }
    }

    if (!entries.size) throw fail('CORRUPT', 'Archive illisible (fichier endommagé ou incomplet).');

    async function read(name) {
      const e = entries.get(name);
      if (!e) throw fail('CORRUPT', 'Élément manquant dans le document : ' + name);
      if (e.flags & 1) throw fail('ENCRYPTED', 'Document protégé par mot de passe : retirez la protection ou copiez-collez le texte.');
      const lh = e.lho;
      if (lh + 30 > u8.length || u32(lh) !== 0x04034b50) throw fail('CORRUPT', 'Document endommagé (en-tête ZIP invalide).');
      const start = lh + 30 + u16(lh + 26) + u16(lh + 28);
      const raw = u8.subarray(start, Math.min(u8.length, start + e.csize));
      if (e.method === 0) return raw;
      if (e.method === 8) return inflateRaw(raw, e.usize);
      throw fail('UNSUPPORTED', 'Méthode de compression non prise en charge (' + e.method + ').');
    }

    return {
      names: Array.from(entries.keys()),
      has: (name) => entries.has(name),
      read,
      text: async (name) => decodeText(await read(name))
    };
  }

  function indexOfSig(u8, from, a, b, c, d) {
    for (let i = from; i + 3 < u8.length; i++) {
      if (u8[i] === a && u8[i + 1] === b && u8[i + 2] === c && u8[i + 3] === d) return i;
    }
    return -1;
  }

  const XML_RE = /<(\/?)([A-Za-z_][\w.:-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[([\s\S]*?)\]\]>|<![^>]*>|([^<]+)/g;

  function walkXml(xml, onOpen, onClose, onText) {
    const re = new RegExp(XML_RE.source, 'g');
    let m;
    while ((m = re.exec(xml))) {
      if (m[2]) {
        if (m[1]) onClose(m[2]);
        else onOpen(m[2], m[3] || '', !!m[4]);
      } else if (m[5] != null) onText(m[5]);
      else if (m[6] != null) onText(decodeEntities(m[6]));
    }
  }

  function attr(attrs, name) {
    const re = new RegExp('(?:^|\\s)' + name.replace(/[.:-]/g, '\\$&') + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\')');
    const m = re.exec(attrs);
    return m ? decodeEntities(m[1] != null ? m[1] : m[2]) : null;
  }

  function nsPrefix(xml, uris, def) {
    const head = xml.slice(0, 6000);
    for (const uri of uris) {
      const m = new RegExp('xmlns:([\\w.-]+)\\s*=\\s*["\']' + uri.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '["\']').exec(head);
      if (m) return m[1];
    }
    return def;
  }

  function emitRow(cells, target) {
    const texts = cells.map((ls) => ls.map((s) => s.trim()).filter(Boolean));
    if (!texts.some((c) => c.length)) return;
    const isData = texts.length >= 2 && texts.every((c) => c.length <= 3 && c.join(' ').length <= 160);
    if (isData) {
      target.push(texts.map((c) => c.join(' / ')).join(' | ').replace(/(?:\s*\|\s*)+$/, ''));
    } else {
      for (const c of texts) if (c.length) { target.push(...c); target.push(''); }
    }
  }

  const top = (arr) => arr[arr.length - 1];

  function docxXmlToText(xml) {
    const W = nsPrefix(xml, ['http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'http://purl.oclc.org/ooxml/wordprocessingml/main'], 'w');
    const MC = nsPrefix(xml, ['http://schemas.openxmlformats.org/markup-compatibility/2006'], 'mc');
    const w = (s) => W + ':' + s;
    const P = w('p'), PPR = w('pPr'), R = w('r'), T = w('t'), TAB = w('tab'), BR = w('br'), CR = w('cr');
    const NUMPR = w('numPr'), ILVL = w('ilvl'), PSTYLE = w('pStyle'), NBH = w('noBreakHyphen');
    const TBL = w('tbl'), TR = w('tr'), TC = w('tc');
    const SKIP = new Set([w('delText'), w('instrText'), w('pPrChange'), w('rPrChange'), w('tblPrChange'), w('trPrChange'), w('tcPrChange'), MC + ':Fallback']);

    const containers = [[]];
    const paras = [], tables = [];
    let skip = 0, inT = 0, inRun = 0, inPPr = 0;

    walkXml(xml, (tag, attrs, self) => {
      if (skip) { if (!self && SKIP.has(tag)) skip++; return; }
      if (SKIP.has(tag)) { if (!self) skip++; return; }
      const cur = top(paras);
      switch (tag) {
        case P: if (self) top(containers).push(''); else paras.push({ t: '', list: false, lvl: 0, head: false }); break;
        case PPR: if (!self) inPPr++; break;
        case NUMPR: if (inPPr && cur) cur.list = true; break;
        case ILVL: if (inPPr && cur) cur.lvl = parseInt(attr(attrs, w('val')), 10) || 0; break;
        case PSTYLE: if (inPPr && cur && /^(heading|titre|title|subtitle|sous-?titre)/i.test(attr(attrs, w('val')) || '')) cur.head = true; break;
        case R: if (!self) inRun++; break;
        case T: if (!self) inT++; break;
        case TAB: if (inRun && cur) cur.t += '\t'; break;
        case BR: case CR: if (inRun && cur) cur.t += '\n'; break;
        case NBH: if (inRun && cur) cur.t += '-'; break;
        case TBL: if (!self) tables.push({ row: null }); break;
        case TR: if (!self && tables.length) top(tables).row = []; break;
        case TC: if (!self) containers.push([]); break;
        default: break;
      }
    }, (tag) => {
      if (skip) { if (SKIP.has(tag)) skip--; return; }
      switch (tag) {
        case P: {
          const p = paras.pop();
          if (!p) break;
          let line = p.t;
          if (p.list && line.trim()) line = '  '.repeat(Math.min(p.lvl, 4)) + '- ' + line.replace(/^\s+/, '');
          const c = top(containers);
          if (p.head && c.length && top(c) !== '') c.push('');
          c.push(line);
          break;
        }
        case PPR: inPPr = Math.max(0, inPPr - 1); break;
        case R: inRun = Math.max(0, inRun - 1); break;
        case T: inT = Math.max(0, inT - 1); break;
        case TC: {
          if (containers.length > 1) {
            const lines = containers.pop();
            const t = top(tables);
            if (t && t.row) t.row.push(lines); else top(containers).push(...lines);
          }
          break;
        }
        case TR: {
          const t = top(tables);
          if (t && t.row) { emitRow(t.row, top(containers)); t.row = null; }
          break;
        }
        case TBL: tables.pop(); top(containers).push(''); break;
        default: break;
      }
    }, (text) => {
      if (!skip && inT && paras.length) top(paras).t += text;
    });

    while (containers.length > 1) { const l = containers.pop(); top(containers).push(...l); }
    return containers[0].join('\n');
  }

  async function docxToText(zip) {
    let main = 'word/document.xml';
    if (zip.has('_rels/.rels')) {
      const rels = await zip.text('_rels/.rels');
      const rel = (rels.match(/<Relationship\b[^>]*>/g) || []).find((r) => /\/officeDocument"/.test(r));
      const target = rel && attr(rel, 'Target');
      if (target) main = target.replace(/^\.?\//, '');
    }
    if (!zip.has(main)) main = zip.names.find((n) => /^word\/document[^/]*\.xml$/i.test(n)) || '';
    if (!main) throw fail('CORRUPT', 'Document Word illisible (contenu principal introuvable).');
    const body = docxXmlToText(await zip.text(main));
    const dir = main.replace(/[^/]*$/, '');
    const seen = new Set(body.split('\n').map((s) => s.trim()).filter(Boolean));
    const extra = async (re) => {
      const out = [];
      for (const n of zip.names.filter((x) => x.startsWith(dir) && re.test(x.slice(dir.length))).sort()) {
        let t = '';
        try { t = docxXmlToText(await zip.text(n)); } catch (e) { continue; }
        for (const raw of t.split('\n')) {
          const s = raw.trim();
          if (!s || /^\d+$/.test(s) || seen.has(s)) continue;
          seen.add(s);
          out.push(s);
        }
      }
      return out;
    };
    const head = await extra(/^header\d*\.xml$/i);
    const foot = await extra(/^footer\d*\.xml$/i);
    const notes = await extra(/^(footnotes|endnotes)\.xml$/i);
    let text = (head.length ? head.join('\n') + '\n\n' : '') + body;
    if (foot.length) text += '\n\n' + foot.join('\n');
    if (notes.length) text += '\n\nNotes :\n' + notes.join('\n');
    return text;
  }

  function odfXmlToText(xml) {
    const SKIP = new Set(['text:tracked-changes', 'office:annotation', 'text:note-citation', 'svg:title', 'svg:desc',
      'office:automatic-styles', 'office:styles', 'office:master-styles', 'office:font-face-decls', 'office:meta',
      'office:settings', 'office:scripts', 'office:forms', 'text:sequence-decls', 'table:shapes']);
    const PARA = new Set(['text:p', 'text:h']);
    const CELL = new Set(['table:table-cell', 'table:covered-table-cell']);
    const containers = [[]];
    const paras = [], tables = [], notes = [];
    let skip = 0, listDepth = 0, pendingBullet = false;

    walkXml(xml, (tag, attrs, self) => {
      if (skip) { if (!self && SKIP.has(tag)) skip++; return; }
      if (SKIP.has(tag)) { if (!self) skip++; return; }
      const cur = top(paras);
      if (PARA.has(tag)) {
        const p = { t: '', head: tag === 'text:h', bullet: pendingBullet, lvl: Math.max(0, listDepth - 1) };
        pendingBullet = false;
        if (self) { top(containers).push(''); } else paras.push(p);
        return;
      }
      switch (tag) {
        case 'text:s': if (cur) cur.t += ' '.repeat(Math.min(parseInt(attr(attrs, 'text:c'), 10) || 1, 50)); break;
        case 'text:tab': if (cur) cur.t += '\t'; break;
        case 'text:line-break': if (cur) cur.t += '\n'; break;
        case 'text:list': if (!self) listDepth++; break;
        case 'text:list-item': if (!self) pendingBullet = true; break;
        case 'text:note-body': if (!self) containers.push([]); break;
        case 'table:table': if (!self) tables.push({ row: null }); break;
        case 'table:table-row': if (!self && tables.length) top(tables).row = []; break;
        default:
          if (CELL.has(tag)) { if (self) { const t = top(tables); if (t && t.row) t.row.push([]); } else containers.push([]); }
      }
    }, (tag) => {
      if (skip) { if (SKIP.has(tag)) skip--; return; }
      if (PARA.has(tag)) {
        const p = paras.pop();
        if (!p) return;
        let line = p.t;
        if (p.bullet && line.trim()) line = '  '.repeat(Math.min(p.lvl, 4)) + '- ' + line.replace(/^\s+/, '');
        const c = top(containers);
        if (p.head && c.length && top(c) !== '') c.push('');
        c.push(line);
        return;
      }
      switch (tag) {
        case 'text:list': listDepth = Math.max(0, listDepth - 1); break;
        case 'text:list-item': pendingBullet = false; break;
        case 'text:note-body': if (containers.length > 1) notes.push(...containers.pop()); break;
        case 'table:table-row': { const t = top(tables); if (t && t.row) { emitRow(t.row, top(containers)); t.row = null; } break; }
        case 'table:table': tables.pop(); top(containers).push(''); break;
        default:
          if (CELL.has(tag) && containers.length > 1) {
            const lines = containers.pop();
            const t = top(tables);
            if (t && t.row) t.row.push(lines); else top(containers).push(...lines);
          }
      }
    }, (text) => {
      if (!skip && paras.length) top(paras).t += text.replace(/[ \t\r\n]+/g, ' ');
    });

    while (containers.length > 1) { const l = containers.pop(); top(containers).push(...l); }
    let out = containers[0].join('\n');
    const n = notes.map((s) => s.trim()).filter(Boolean);
    if (n.length) out += '\n\nNotes :\n' + n.join('\n');
    return out;
  }

  const RTF_DEST = new Set(['fonttbl', 'colortbl', 'stylesheet', 'info', 'pict', 'object', 'objdata', 'themedata',
    'colorschememapping', 'datastore', 'latentstyles', 'listtable', 'listoverridetable', 'rsidtbl', 'generator',
    'xmlnstbl', 'mmathPr', 'fldinst', 'filetbl', 'revtbl', 'nonshppict', 'shpinst', 'userprops', 'docvar', 'xe', 'tc',
    'annotation', 'atnid', 'atnauthor', 'atndate', 'template', 'pgdsctbl', 'protusertbl', 'wgrffmtfilter', 'listpicture',
    'ftnsep', 'ftnsepc', 'aftnsep', 'aftnsepc', 'fontemb', 'fontfile', 'falt', 'panose', 'bkmkstart', 'bkmkend',
    'blipuid', 'passwordhash', 'title', 'subject', 'author', 'operator', 'keywords', 'comment', 'doccomm', 'company']);
  const RTF_CHARS = { emdash: '—', endash: '–', bullet: '•', lquote: '‘', rquote: '’', ldblquote: '“', rdblquote: '”',
    emspace: ' ', enspace: ' ', qmspace: ' ', zwj: '', zwnj: '', zwbo: '', zwnbo: '' };

  function rtfToText(src) {
    const out = [];
    let bytes = [];
    let st = { skip: false, uc: 1 };
    const stack = [];
    let ucSkip = 0;
    let codepage = 'windows-1252';
    const n = src.length;
    let i = 0;
    const emit = (s) => { if (!st.skip) out.push(s); };
    const flush = () => {
      if (!bytes.length) return;
      if (!st.skip) out.push(decoder(codepage).decode(Uint8Array.from(bytes)));
      bytes = [];
    };
    const isAlpha = (c) => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');
    const isDigit = (c) => c >= '0' && c <= '9';

    while (i < n) {
      const c = src[i];
      if (c === '{') { flush(); stack.push(st); st = { skip: st.skip, uc: st.uc }; ucSkip = 0; i++; continue; }
      if (c === '}') { flush(); st = stack.pop() || st; ucSkip = 0; i++; continue; }
      if (c === '\\') {
        const nx = src[i + 1];
        if (nx === "'") {
          const hex = src.substr(i + 2, 2);
          i += 4;
          if (ucSkip > 0) { ucSkip--; continue; }
          const v = parseInt(hex, 16);
          if (!isNaN(v)) bytes.push(v);
          continue;
        }
        flush();
        if (nx && isAlpha(nx)) {
          let j = i + 1;
          while (j < n && isAlpha(src[j])) j++;
          const word = src.slice(i + 1, j);
          let param = null;
          if (src[j] === '-' || isDigit(src[j] || '')) {
            let k = j + 1;
            while (k < n && isDigit(src[k])) k++;
            param = parseInt(src.slice(j, k), 10);
            j = k;
          }
          if (src[j] === ' ') j++;
          i = j;
          if (word === 'bin') { i += Math.max(0, param || 0); continue; }
          if (st.skip) continue;
          if (ucSkip > 0) { ucSkip--; continue; }
          switch (word) {
            case 'par': case 'line': case 'sect': case 'page': case 'row': case 'nestrow': emit('\n'); break;
            case 'tab': emit('\t'); break;
            case 'cell': case 'nestcell': emit(' | '); break;
            case 'u': {
              const code = param < 0 ? param + 65536 : param;
              if (code > 0) emit(String.fromCharCode(code));
              ucSkip = st.uc;
              break;
            }
            case 'uc': st.uc = Math.max(0, param || 0); break;
            case 'ansicpg': if (param >= 1250 && param <= 1258) codepage = 'windows-' + param; else if (param === 65001) codepage = 'utf-8'; break;
            case 'listtext': case 'pntext': emit('- '); st.skip = true; break;
            default:
              if (RTF_DEST.has(word)) st.skip = true;
              else if (Object.prototype.hasOwnProperty.call(RTF_CHARS, word)) emit(RTF_CHARS[word]);
          }
          continue;
        }
        i += 2;
        if (st.skip && nx !== '*') continue;
        switch (nx) {
          case '\\': case '{': case '}': if (ucSkip > 0) ucSkip--; else emit(nx); break;
          case '~': emit('\u00a0'); break;
          case '_': emit('-'); break;
          case '*': st.skip = true; break;
          case '\n': case '\r': emit('\n'); break;
          default: break;
        }
        continue;
      }
      if (c === '\r' || c === '\n') { i++; continue; }
      flush();
      if (ucSkip > 0) { ucSkip--; i++; continue; }
      emit(c);
      i++;
    }
    flush();
    return out.join('').replace(/[ \t]*\|[ \t]*\n/g, '\n').replace(/[ \t]*\|[ \t]*$/g, '');
  }

  const HTML_BLOCK = new Set(['address', 'article', 'aside', 'blockquote', 'dd', 'details', 'dialog', 'div', 'dl', 'dt',
    'fieldset', 'figcaption', 'figure', 'footer', 'form', 'header', 'hr', 'main', 'nav', 'ol', 'p', 'pre', 'section',
    'summary', 'ul', 'caption', 'center', 'body', 'html', 'tbody', 'thead', 'tfoot', 'table']);

  function htmlToText(html) {
    if (typeof DOMParser === 'undefined') return htmlToTextRegex(html);
    let doc;
    try { doc = new DOMParser().parseFromString(html, 'text/html'); } catch (e) { return htmlToTextRegex(html); }
    doc.querySelectorAll('script,style,noscript,template,svg,canvas,iframe,object,embed,head,nav,button,select,[hidden],[aria-hidden="true"]').forEach((el) => el.remove());
    doc.querySelectorAll('[style]').forEach((el) => {
      if (/display\s*:\s*none|visibility\s*:\s*hidden/i.test(el.getAttribute('style') || '')) el.remove();
    });
    let root = doc.body || doc.documentElement;
    const main = doc.querySelector('main,[role="main"]') || (doc.querySelectorAll('article').length === 1 ? doc.querySelector('article') : null);
    if (main && (main.textContent || '').trim().length >= 300) root = main;
    return nodeToText(root);
  }

  function nodeToText(root) {
    let out = '';
    const trailingNl = () => { let k = 0; for (let i = out.length - 1; i >= 0 && k < 2; i--) { const c = out[i]; if (c === '\n') k++; else if (c !== ' ' && c !== '\t') break; } return k; };
    const nl = (n) => { if (!out) return; const have = trailingNl(); if (have < n) out = out.replace(/[ \t]+$/, '') + '\n'.repeat(n - have); };
    const walk = (node, pre) => {
      if (node.nodeType === 3) {
        let s = node.nodeValue || '';
        if (!pre) {
          s = s.replace(/[ \t\r\n\f]+/g, ' ');
          if (!out || /[\n ]$/.test(out)) s = s.replace(/^ /, '');
        }
        out += s;
        return;
      }
      if (node.nodeType !== 1) return;
      const tag = node.nodeName.toLowerCase();
      if (tag === 'br') { out += '\n'; return; }
      if (tag === 'hr') { nl(2); return; }
      if (tag === 'img') { const alt = (node.getAttribute('alt') || '').trim(); if (alt.length > 2) out += ' ' + alt + ' '; return; }
      if (tag === 'tr') { rowToText(node); return; }
      if (/^h[1-6]$/.test(tag)) { nl(2); kids(node, pre); nl(1); return; }
      if (tag === 'li') {
        nl(1);
        let depth = 0;
        for (let p = node.parentElement; p && p !== root; p = p.parentElement) if (/^(ul|ol)$/i.test(p.nodeName)) depth++;
        let bullet = '- ';
        const parent = node.parentElement;
        if (parent && parent.nodeName.toLowerCase() === 'ol') {
          const idx = Array.prototype.indexOf.call(parent.children, node);
          bullet = (parseInt(parent.getAttribute('start'), 10) || 1) + idx + '. ';
        }
        out += '  '.repeat(Math.max(0, Math.min(depth - 1, 4))) + bullet;
        kids(node, pre);
        nl(1);
        return;
      }
      if (tag === 'td' || tag === 'th') { kids(node, pre); out += ' '; return; }
      const block = HTML_BLOCK.has(tag);
      const gap = tag === 'p' || tag === 'table' || tag === 'section' || tag === 'article' ? 2 : 1;
      if (block) nl(gap);
      kids(node, pre || tag === 'pre' || tag === 'textarea');
      if (block) nl(gap);
    };
    const kids = (node, pre) => { for (let ch = node.firstChild; ch; ch = ch.nextSibling) walk(ch, pre); };
    const rowToText = (tr) => {
      const cells = Array.prototype.filter.call(tr.children, (c) => /^(td|th)$/i.test(c.nodeName))
        .map((c) => nodeToText(c).split('\n').map((s) => s.trim()).filter(Boolean));
      const target = [];
      emitRow(cells, target);
      if (target.length) { nl(1); out += target.join('\n'); nl(1); }
    };
    walk(root, false);
    return out;
  }

  function htmlToTextRegex(html) {
    return decodeEntities(String(html)
      .replace(/<(script|style|noscript|template|svg|head)\b[\s\S]*?<\/\1\s*>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<li\b[^>]*>/gi, '\n- ')
      .replace(/<\/(td|th)\s*>/gi, ' | ')
      .replace(/<\/(p|div|li|tr|h[1-6]|ul|ol|table|section|article|header|footer|blockquote|pre)\s*>/gi, '\n')
      .replace(/<(p|div|h[1-6]|tr|table|section|article)\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/[ \t]+/g, ' '))
      .replace(/[ \t]*\|[ \t]*\n/g, '\n');
  }

  function htmlCharset(u8) {
    const head = ascii(u8, 0, 4096);
    const m = /<meta[^>]+charset\s*=\s*["']?\s*([\w-]+)/i.exec(head);
    return m ? m[1].toLowerCase() : null;
  }

  const EXTRA_PRINTABLE = new Set([0x2018, 0x2019, 0x201c, 0x201d, 0x2013, 0x2014, 0x2026, 0x20ac, 0x2022, 0x0152, 0x0153, 0x00ab, 0x00bb]);

  function oleHasUtf16(u8, word) {
    const pat = [];
    for (const ch of word) pat.push(ch.charCodeAt(0), 0);
    outer: for (let i = 0; i + pat.length <= u8.length; i++) {
      for (let k = 0; k < pat.length; k++) if (u8[i + k] !== pat[k]) continue outer;
      return true;
    }
    return false;
  }

  function oleDocText(u8) {
    const runs = [];
    const keep = (s, off) => {
      const letters = (s.match(/[A-Za-zÀ-ÿ]/g) || []).length;
      if (s.length >= 24 && letters / s.length >= 0.55 && / /.test(s)) runs.push({ off, s });
    };
    for (const align of [0, 1]) {
      let cur = '', start = align;
      for (let i = align; i + 1 < u8.length; i += 2) {
        const c = u8[i] | (u8[i + 1] << 8);
        const ok = c === 9 || c === 13 || c === 10 || (c >= 0x20 && c < 0x7f) || (c >= 0xa0 && c <= 0x17f) || EXTRA_PRINTABLE.has(c);
        if (ok) { if (!cur) start = i; cur += String.fromCharCode(c); }
        else { if (cur) keep(cur, start); cur = ''; }
      }
      if (cur) keep(cur, start);
    }
    const cp = decoder('windows-1252');
    let s0 = -1;
    for (let i = 0; i <= u8.length; i++) {
      const b = i < u8.length ? u8[i] : 0;
      const ok = b === 9 || b === 13 || b === 10 || (b >= 0x20 && b < 0x7f) || b >= 0x80;
      if (ok) { if (s0 < 0) s0 = i; }
      else if (s0 >= 0) { keep(cp.decode(u8.subarray(s0, i)), s0); s0 = -1; }
    }
    runs.sort((a, b) => a.off - b.off);
    return runs.map((r) => r.s).join('\n').replace(/\r/g, '\n');
  }

  function jsonToText(raw) {
    let data;
    try { data = JSON.parse(raw); } catch (e) { return { text: raw }; }
    const qa = (arr) => arr.filter((x) => x && (x.q || x.question)).map((x) => 'Q : ' + (x.q || x.question) + '\nR : ' + (x.a || x.answer || x.reponse || '')).join('\n\n');
    if (Array.isArray(data) && data.some((x) => x && (x.q || x.question))) return { text: qa(data) };
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const vals = Object.keys(data);
      if (vals.length && vals.every((k) => Array.isArray(data[k]) && data[k].some((x) => x && (x.q || x.question)))) {
        return { text: vals.map((k) => '## ' + k + '\n\n' + qa(data[k])).join('\n\n') };
      }
    }
    return { text: JSON.stringify(data, null, 2) };
  }

  let pdfjsPromise = null;
  let pdfjsAttempts = 0;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (typeof document === 'undefined') { reject(new Error('no document')); return; }
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.crossOrigin = 'anonymous';
      s.onload = () => resolve();
      s.onerror = () => { s.remove(); reject(new Error('Chargement impossible : ' + src)); };
      (document.head || document.documentElement).appendChild(s);
    });
  }

  async function loadPdfJsInner() {
    const g = typeof window !== 'undefined' ? window : self;
    const attempt = pdfjsAttempts++;
    const bust = attempt ? '?r=' + attempt : '';
    const errors = [];
    const existing = g.pdfjsLib;
    if (existing && typeof existing.getDocument === 'function' && existing.version) {
      const base = config.cdn + 'pdfjs-dist@' + existing.version + '/';
      if (!existing.GlobalWorkerOptions.workerSrc) {
        existing.GlobalWorkerOptions.workerSrc = base + (parseInt(existing.version, 10) >= 4 ? 'legacy/build/pdf.worker.min.mjs' : 'legacy/build/pdf.worker.min.js');
      }
      return { lib: existing, base, version: existing.version };
    }
    const deadline = Date.now() + config.timeoutMs;
    try {
      const base = config.cdn + 'pdfjs-dist@' + config.pdfjsVersion + '/';
      const mod = await withTimeout(import( base + 'legacy/build/pdf.min.mjs' + bust), Math.round(config.timeoutMs * 0.65), 'PDFJS_TIMEOUT');
      const lib = mod && typeof mod.getDocument === 'function' ? mod : mod && mod.default;
      if (!lib || typeof lib.getDocument !== 'function') throw new Error('pdf.js ESM invalide');
      lib.GlobalWorkerOptions.workerSrc = base + 'legacy/build/pdf.worker.min.mjs';
      return { lib, base, version: lib.version || config.pdfjsVersion };
    } catch (e) { errors.push(e); }
    try {
      const base = config.cdn + 'pdfjs-dist@' + config.pdfjsUmdVersion + '/';
      await withTimeout(loadScript(base + 'legacy/build/pdf.min.js' + bust), Math.max(1000, deadline - Date.now()), 'PDFJS_TIMEOUT');
      const lib = g.pdfjsLib || g['pdfjs-dist/build/pdf'];
      if (!lib || typeof lib.getDocument !== 'function') throw new Error('pdf.js UMD invalide');
      lib.GlobalWorkerOptions.workerSrc = base + 'legacy/build/pdf.worker.min.js';
      return { lib, base, version: lib.version || config.pdfjsUmdVersion };
    } catch (e) { errors.push(e); }
    throw fail('PDFJS_UNAVAILABLE', 'Lecteur PDF indisponible (réseau ?).', errors[0]);
  }

  function loadPdfJs() {
    if (!pdfjsPromise) {
      pdfjsPromise = withTimeout(loadPdfJsInner(), config.timeoutMs + 1500, 'PDFJS_TIMEOUT')
        .catch((e) => { pdfjsPromise = null; throw e; });
    }
    return pdfjsPromise;
  }

  function pdfItemsToText(items) {
    const lines = [];
    let cur = '', lastY = null, lastH = 0, lastEnd = null, ended = false;
    const push = () => { lines.push(cur); cur = ''; };
    for (const it of items) {
      if (!it || typeof it.str !== 'string') continue;
      const tr = it.transform || [1, 0, 0, 1, 0, 0];
      const x = tr[4], y = tr[5];
      const fs = Math.hypot(tr[2], tr[3]) || Math.abs(tr[0]) || it.height || 10;
      const s = it.str;
      if (!s && !it.hasEOL) continue;
      if (lastY !== null && s) {
        const h = Math.max(fs, lastH);
        if (Math.abs(y - lastY) > h * 0.5) {
          if (!ended) push();
          if (lastY - y > h * 1.85 || y - lastY > h * 3) lines.push('');
        } else if (!ended && cur && lastEnd !== null) {
          const gap = x - lastEnd;
          if ((gap > fs * 0.18 || gap < -fs * 2) && !/\s$/.test(cur) && !/^\s/.test(s)) cur += ' ';
        }
      }
      if (s) {
        cur += s;
        lastEnd = x + (it.width || 0);
        lastY = y;
        lastH = fs;
        ended = false;
      }
      if (it.hasEOL) { if (!ended) push(); ended = true; }
    }
    if (!ended || cur) push();
    return lines.join('\n');
  }

  async function pdfToText(blob) {
    const { lib, base } = await ((S.docs && S.docs.loadPdfJs) || loadPdfJs)();
    const data = await toBytes(blob);
    const task = lib.getDocument({
      data: data.slice(),
      isEvalSupported: false,
      disableFontFace: true,
      useSystemFonts: false,
      enableXfa: false,
      stopAtErrors: false,
      verbosity: 0,
      cMapUrl: base + 'cmaps/',
      cMapPacked: true,
      standardFontDataUrl: base + 'standard_fonts/',
      wasmUrl: base + 'wasm/'
    });
    let doc;
    try {
      doc = await withTimeout(task.promise, config.timeoutMs, 'PDF_TIMEOUT');
    } catch (e) {
      try { task.destroy(); } catch (err) {  }
      if (e && e.name === 'PasswordException') throw fail('ENCRYPTED', 'PDF protégé par mot de passe : ouvrez-le, copiez le texte et collez-le ici.');
      throw e;
    }
    const pages = [];
    const deadline = Date.now() + config.pdfTotalMs;
    let partial = false;
    try {
      for (let p = 1; p <= doc.numPages; p++) {
        if (Date.now() > deadline) { partial = true; break; }
        const page = await withTimeout(doc.getPage(p), config.timeoutMs, 'PDF_TIMEOUT');
        const tc = await withTimeout(page.getTextContent(), config.timeoutMs, 'PDF_TIMEOUT');
        pages.push(pdfItemsToText(tc.items || []));
        try { page.cleanup(); } catch (err) {  }
      }
    } finally {
      try { task.destroy(); } catch (err) {  }
    }
    return { text: pages.join('\n\n'), numPages: doc.numPages, pagesRead: pages.length, partial };
  }

  function aiReady() {
    const ai = S.ai;
    if (!ai || typeof ai.extractFile !== 'function') return false;
    try { return typeof ai.hasKey !== 'function' || !!ai.hasKey(); } catch (e) { return false; }
  }

  async function viaAI(blob, mime) {
    const r = await S.ai.extractFile(blob, mime);
    return typeof r === 'string' ? r : (r && r.text) || '';
  }

  const AI_IMAGE = /^image\/(png|jpeg|webp|heic|heif)$/;

  async function prepareImage(blob, mime) {
    if (AI_IMAGE.test(mime) && blob.size <= 4 * MB) return { blob, mime };
    if (typeof createImageBitmap === 'function') {
      try {
        const bmp = await createImageBitmap(blob);
        const scale = Math.min(1, Math.sqrt(6e6 / Math.max(1, bmp.width * bmp.height)));
        const w = Math.max(1, Math.round(bmp.width * scale)), h = Math.max(1, Math.round(bmp.height * scale));
        let canvas;
        if (typeof OffscreenCanvas === 'function') canvas = new OffscreenCanvas(w, h);
        else { canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h; }
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(bmp, 0, 0, w, h);
        if (bmp.close) bmp.close();
        const out = canvas.convertToBlob
          ? await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 })
          : await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.9));
        if (out && out.size) return { blob: out, mime: 'image/jpeg' };
      } catch (e) {  }
    }
    if (AI_IMAGE.test(mime)) return { blob, mime };
    throw fail('UNSUPPORTED', 'Format d\'image non pris en charge : faites plutôt une capture en PNG ou JPEG.');
  }

  const EXT_KIND = {
    pdf: 'pdf', docx: 'zip', docm: 'zip', dotx: 'zip', dotm: 'zip', odt: 'zip', ott: 'zip', ods: 'zip', odp: 'zip',
    fodt: 'fodt', rtf: 'rtf', html: 'html', htm: 'html', xhtml: 'html', doc: 'ole', dot: 'ole',
    png: 'image', jpg: 'image', jpeg: 'image', webp: 'image', heic: 'image', heif: 'image', gif: 'image', bmp: 'image',
    avif: 'image', tif: 'image', tiff: 'image',
    txt: 'text', text: 'text', md: 'text', markdown: 'text', csv: 'text', tsv: 'text', json: 'json', xml: 'text',
    log: 'text', yaml: 'text', yml: 'text', srt: 'text', vtt: 'text', ini: 'text'
  };
  const EXT_MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', heic: 'image/heic',
    heif: 'image/heif', gif: 'image/gif', bmp: 'image/bmp', avif: 'image/avif', tif: 'image/tiff', tiff: 'image/tiff' };

  function sniff(u8, ext, mime) {
    const a4 = ascii(u8, 0, 4);
    if (a4 === '%PDF' || (ext === 'pdf' && ascii(u8, 0, 1024).indexOf('%PDF-') >= 0)) return { kind: 'pdf', mime: 'application/pdf' };
    if (u8[0] === 0x50 && u8[1] === 0x4b && (u8[2] === 3 || u8[2] === 5 || u8[2] === 7)) return { kind: 'zip' };
    if (ascii(u8, 0, 5) === '{\\rtf') return { kind: 'rtf' };
    if (u8[0] === 0xd0 && u8[1] === 0xcf && u8[2] === 0x11 && u8[3] === 0xe0) return { kind: 'ole' };
    if (u8[0] === 0x89 && ascii(u8, 1, 3) === 'PNG') return { kind: 'image', mime: 'image/png' };
    if (u8[0] === 0xff && u8[1] === 0xd8 && u8[2] === 0xff) return { kind: 'image', mime: 'image/jpeg' };
    if (a4 === 'GIF8') return { kind: 'image', mime: 'image/gif' };
    if (a4 === 'RIFF' && ascii(u8, 8, 4) === 'WEBP') return { kind: 'image', mime: 'image/webp' };
    if (ascii(u8, 4, 4) === 'ftyp') {
      const brand = ascii(u8, 8, 4);
      if (/^(heic|heix|hevc|hevx|heim|heis|mif1|msf1)$/.test(brand)) return { kind: 'image', mime: brand === 'mif1' || brand === 'msf1' ? 'image/heif' : 'image/heic' };
      if (/^avi[fs]$/.test(brand)) return { kind: 'image', mime: 'image/avif' };
    }
    if (ext === 'bmp' && ascii(u8, 0, 2) === 'BM') return { kind: 'image', mime: 'image/bmp' };
    if (ext === 'tif' || ext === 'tiff') return { kind: 'image', mime: 'image/tiff' };
    const byExt = EXT_KIND[ext];
    if (byExt && byExt !== 'zip' && byExt !== 'ole' && byExt !== 'pdf' && byExt !== 'image') {
      if (byExt === 'text' && looksBinary(u8)) return { kind: 'binary' };
      return { kind: byExt };
    }
    if (/^image\//.test(mime || '')) return { kind: 'image', mime };
    if (looksBinary(u8)) return { kind: 'binary' };
    const head = decodeText(u8.subarray(0, 2048)).replace(/^\s+/, '').slice(0, 600).toLowerCase();
    if (/^<(!doctype html|html|head|body|meta|div|p|table|section|article)\b/.test(head) || (/^<\?xml/.test(head) && /<html\b/.test(head))) return { kind: 'html' };
    if (/^[[{]/.test(head) && (ext === 'json' || /json/.test(mime || ''))) return { kind: 'json' };
    return { kind: 'text' };
  }

  function looksBinary(u8) {
    const n = Math.min(u8.length, 4096) & ~1;
    if (!n) return false;
    if ((u8[0] === 0xff && u8[1] === 0xfe) || (u8[0] === 0xfe && u8[1] === 0xff)) return false;
    let ctl = 0, zeros = 0;
    for (let i = 0; i < n; i++) {
      const b = u8[i];
      if (b === 0) zeros++;
      else if (b < 9 || (b > 13 && b < 32)) ctl++;
    }
    if (zeros > n * 0.3) {
      const t = decodeText(u8.subarray(0, n));
      return (t.match(/[\u0000-\u0008\u000e-\u001f\ufffd]/g) || []).length > t.length * 0.1;
    }
    return zeros > 0 || ctl > n * 0.1;
  }

  async function extractZip(u8, name, ext) {
    const zip = readZip(u8);
    const names = zip.names;
    if (names.indexOf('EncryptedPackage') >= 0) throw fail('ENCRYPTED', 'Document protégé par mot de passe : retirez la protection ou copiez-collez le texte.');
    const isOdf = zip.has('content.xml') && (!zip.has('mimetype') || /opendocument/.test(await zip.text('mimetype')));
    if (isOdf) return { text: odfXmlToText(await zip.text('content.xml')), method: 'odt' };
    if (zip.has('word/document.xml') || names.some((n) => /^word\/document[^/]*\.xml$/i.test(n))) {
      return { text: await docxToText(zip), method: 'docx' };
    }
    if (names.some((n) => n.startsWith('ppt/'))) throw fail('UNSUPPORTED', 'Présentation PowerPoint : exportez-la en PDF, ou copiez-collez le texte.');
    if (names.some((n) => n.startsWith('xl/'))) throw fail('UNSUPPORTED', 'Classeur Excel : exportez-le en PDF ou CSV, ou copiez-collez le texte.');
    if (ext === 'pages' || names.some((n) => /^Index\/Document\.iwa$/.test(n))) throw fail('UNSUPPORTED', 'Document Pages : exportez-le en PDF ou Word, ou copiez-collez le texte.');
    throw fail('UNSUPPORTED', 'Archive ZIP : décompressez-la puis déposez les documents un par un.');
  }

  async function extractPdf(blob, name) {
    let res = null, pdfErr = null;
    try {
      res = await pdfToText(blob);
    } catch (e) {
      if (e && e.code === 'ENCRYPTED') throw e;
      pdfErr = e;
    }
    const meaningful = res ? res.text.replace(/\s+/g, '').length : 0;
    if (res && meaningful >= Math.min(60, 20 * Math.max(1, res.pagesRead))) {
      const out = { text: res.text, method: 'pdfjs' };
      if (res.partial) out.warning = 'PDF lu partiellement (' + res.pagesRead + ' pages sur ' + res.numPages + ').';
      return out;
    }
    if (aiReady()) {
      try {
        const text = await viaAI(blob, 'application/pdf');
        if (text && text.trim()) {
          return { text, method: 'ai', warning: res ? 'PDF scanné : texte lu par l\'IA, vérifiez-le.' : 'Texte du PDF lu par l\'IA (lecteur PDF indisponible) : vérifiez-le.' };
        }
      } catch (e) {
        if (res && meaningful) return { text: res.text, method: 'pdfjs', warning: 'Peu de texte trouvé dans ce PDF (scanné ?).' };
        throw fail('PDF_FAILED', 'Impossible de lire « ' + name + ' » (' + (e && e.message ? e.message : 'erreur IA') + '). Ouvrez le PDF, copiez le texte et collez-le ici.', e);
      }
    }
    if (res && meaningful) return { text: res.text, method: 'pdfjs', warning: 'Peu de texte trouvé dans ce PDF (scanné ?).' };
    if (res) throw fail('NO_TEXT', 'Ce PDF semble scanné (image sans texte). Ajoutez une clé Gemini dans Réglages pour le lire, ou copiez-collez le texte.');
    const why = pdfErr && /PDFJS/.test(pdfErr.code || '') ? 'lecteur PDF indisponible : connexion absente ou filtrée ?' : 'PDF illisible';
    throw fail('PDF_FAILED', 'Impossible de lire « ' + name + ' » (' + why + '). Ouvrez le PDF, copiez le texte et collez-le ici' + (aiReady() ? '.' : ', ou ajoutez une clé Gemini dans Réglages.'), pdfErr);
  }

  async function extractImage(blob, mime) {
    if (!aiReady()) throw fail('NEEDS_KEY', 'Pour lire une image, ajoutez une clé Gemini dans Réglages — ou copiez-collez le texte.');
    const img = await prepareImage(blob, mime);
    let text;
    try { text = await viaAI(img.blob, img.mime); }
    catch (e) { throw fail('AI_FAILED', 'Lecture de l\'image par l\'IA impossible (' + (e && e.message ? e.message : 'erreur') + '). Réessayez ou copiez-collez le texte.', e); }
    return { text, method: 'ai', warning: 'Texte lu par l\'IA depuis une image : vérifiez-le.' };
  }

  async function extract(file, name) {
    if (typeof file === 'string') return fromText(file, name);
    if (!file) throw fail('EMPTY', 'Aucun fichier reçu.');
    name = String(name || file.name || 'document');
    const size = file.size != null ? file.size : file.byteLength || 0;
    if (size > config.maxBytes) {
      throw fail('TOO_BIG', '« ' + name + ' » est trop volumineux (' + mbStr(size) + ' Mo, maximum 20 Mo). Copiez-collez plutôt le texte utile.');
    }
    if (!size) throw fail('EMPTY', '« ' + name + ' » est vide.');
    const ext = extOf(name);
    const mime = (file.type || '').toLowerCase();
    let u8;
    try { u8 = await toBytes(file); }
    catch (e) { throw fail('READ_FAILED', 'Lecture de « ' + name + ' » impossible (fichier déplacé ou inaccessible ?).', e); }
    const type = sniff(u8, ext, mime);
    let res;
    try {
      switch (type.kind) {
        case 'pdf': res = await extractPdf(file instanceof Blob ? file : new Blob([u8], { type: 'application/pdf' }), name); break;
        case 'zip': res = await extractZip(u8, name, ext); break;
        case 'fodt': res = { text: odfXmlToText(decodeText(u8)), method: 'odt' }; break;
        case 'rtf': res = { text: rtfToText(decoder('windows-1252').decode(u8)), method: 'rtf' }; break;
        case 'html': res = { text: htmlToText(decodeText(u8, htmlCharset(u8))), method: 'html' }; break;
        case 'json': { const j = jsonToText(decodeText(u8)); res = { text: j.text, method: 'text', warning: j.warning }; break; }
        case 'text': res = { text: decodeText(u8), method: 'text' }; break;
        case 'image': {
          const imgMime = type.mime || EXT_MIME[ext] || mime || 'image/png';
          res = await extractImage(file instanceof Blob ? new Blob([file], { type: imgMime }) : new Blob([u8], { type: imgMime }), imgMime);
          break;
        }
        case 'ole': {
          if (oleHasUtf16(u8, 'EncryptedPackage')) throw fail('ENCRYPTED', 'Document protégé par mot de passe : retirez la protection ou copiez-collez le texte.');
          if (/^(xls|xlt|ppt|pps|pot|msg)$/.test(ext)) throw fail('UNSUPPORTED', 'Ancien format Office non pris en charge : exportez en PDF ou copiez-collez le texte.');
          const t = oleDocText(u8);
          if (t.replace(/\s+/g, '').length < 40) throw fail('UNSUPPORTED', 'Ancien format Word (.doc) illisible : enregistrez-le en .docx ou PDF, ou copiez-collez le texte.');
          res = { text: t, method: 'text', warning: 'Ancien format Word (.doc) : extraction approximative, vérifiez le texte (ou enregistrez-le en .docx).' };
          break;
        }
        default:
          throw fail('UNSUPPORTED', 'Format de « ' + name + ' » non reconnu. Formats acceptés : PDF, Word, ODT, RTF, HTML, TXT, Markdown, images — ou collez le texte.');
      }
    } catch (e) {
      if (e && e.code) throw e;
      throw fail('CORRUPT', 'Impossible de lire « ' + name + ' » (fichier endommagé ?). Copiez-collez le texte à la place.', e);
    }
    return finalize(res, name);
  }

  function finalize(res, name) {
    const raw = String((res && res.text) || '');
    const text = clean(raw);
    if (!text) throw fail('NO_TEXT', 'Aucun texte trouvé dans « ' + name + ' ». Copiez-collez le texte à la place.');
    const warnings = [];
    if (res.warning) warnings.push(res.warning);
    if (/\[… texte tronqué/.test(text.slice(-120)) && text.length < raw.length) warnings.push('Texte très long : tronqué à ' + config.maxChars.toLocaleString('fr-FR') + ' caractères.');
    const out = { text, method: res.method };
    if (warnings.length) out.warning = warnings.join(' ');
    return out;
  }

  function fromText(text, name) {
    const t = clean(text);
    return { text: t, method: 'paste' };
  }

  S.docs = {
    accept: ACCEPT,
    extract,
    fromText,
    clean,
    config,
    loadPdfJs,
    _internal: {
      readZip, inflateRaw, inflateRawJS, docxXmlToText, odfXmlToText, rtfToText, htmlToText, decodeText,
      pdfItemsToText, oleDocText, sniff, jsonToText,
      resetPdfJs: () => { pdfjsPromise = null; }
    }
  };
})(window.AideVisio = window.AideVisio || {});

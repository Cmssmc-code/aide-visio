(function (S) {
  'use strict';

  const U = S.util = S.util || {};
  const G = typeof globalThis !== 'undefined' ? globalThis : window;

  let uidSeq = 0;
  U.uid = function () {
    let rnd = '';
    try {
      const a = new Uint32Array(2);
      G.crypto.getRandomValues(a);
      rnd = a[0].toString(36) + a[1].toString(36);
    } catch (e) {
      rnd = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    }
    uidSeq = (uidSeq + 1) % 1296;
    return Date.now().toString(36).slice(-7) + uidSeq.toString(36).padStart(2, '0') + rnd.slice(0, 6);
  };

  const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  U.esc = function (str) {
    return (str == null ? '' : String(str)).replace(/[&<>"']/g, (c) => ESC_MAP[c]);
  };

  U.clamp = (n, min, max) => Math.min(max, Math.max(min, n));

  U.fmtTime = function (ms) {
    const total = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
    return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
  };

  U.fmtBytes = function (n) {
    n = Number(n) || 0;
    const units = ['octets', 'Ko', 'Mo', 'Go'];
    let i = 0;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    const v = i === 0 ? String(Math.round(n)) : n.toFixed(n < 10 ? 1 : 0).replace('.', ',');
    return v + ' ' + units[i];
  };

  U.slug = function (str, max) {
    const s = U.norm(str).replace(/ /g, '-');
    return (s || 'aidevisio').slice(0, max || 60).replace(/-+$/, '');
  };

  U.clone = function (obj) {
    if (obj == null) return obj;
    return JSON.parse(JSON.stringify(obj));
  };

  U.sleep = function (ms, signal) {
    return new Promise((resolve, reject) => {
      if (signal && signal.aborted) { reject(abortError()); return; }
      const id = setTimeout(() => { if (signal) signal.removeEventListener('abort', onAbort); resolve(); }, Math.max(0, ms || 0));
      function onAbort() { clearTimeout(id); reject(abortError()); }
      if (signal) signal.addEventListener('abort', onAbort, { once: true });
    });
  };

  function abortError() {
    try { return new DOMException('Opération annulée', 'AbortError'); } catch (e) {
      const err = new Error('Opération annulée'); err.name = 'AbortError'; return err;
    }
  }

  U.debounce = function (fn, ms) {
    let timer = null, lastArgs = null, lastThis = null;
    function run() {
      timer = null;
      const args = lastArgs, self = lastThis;
      lastArgs = lastThis = null;
      return fn.apply(self, args || []);
    }
    function debounced() {
      lastArgs = arguments; lastThis = this;
      if (timer) clearTimeout(timer);
      timer = setTimeout(run, ms || 0);
    }
    debounced.flush = function () {
      if (!timer) return undefined;
      clearTimeout(timer);
      return run();
    };
    debounced.cancel = function () {
      if (timer) clearTimeout(timer);
      timer = null; lastArgs = lastThis = null;
    };
    debounced.pending = () => !!timer;
    return debounced;
  };

  U.emitter = function () {
    const map = new Map();
    const api = {
      on(evt, fn) {
        if (typeof fn !== 'function') return () => {};
        if (!map.has(evt)) map.set(evt, new Set());
        map.get(evt).add(fn);
        return () => api.off(evt, fn);
      },
      once(evt, fn) {
        const off = api.on(evt, function (data) { off(); fn(data); });
        return off;
      },
      off(evt, fn) {
        const set = map.get(evt);
        if (!set) return;
        if (fn) set.delete(fn); else set.clear();
        if (!set.size) map.delete(evt);
      },
      emit(evt, data) {
        const set = map.get(evt);
        if (!set) return 0;
        let n = 0;
        for (const fn of Array.from(set)) {
          try { fn(data); n++; } catch (e) { try { console.error('[Aide Visio] écouteur "' + evt + '" :', e); } catch (_) {} }
        }
        return n;
      },
      has(evt) { return !!(map.get(evt) && map.get(evt).size); }
    };
    return api;
  };

  S.bus = S.bus || U.emitter();

  U.toast = function (msg, kind) {
    const text = String(msg == null ? '' : msg);
    const payload = { msg: text, text, kind: kind || 'info' };
    const n = S.bus.emit('toast', payload);
    if (!n) { try { (payload.kind === 'err' ? console.error : console.info)('[Aide Visio]', payload.msg); } catch (e) {} }
  };

  U.download = function (blobOrText, filename, mime) {
    const blob = blobOrText instanceof Blob ? blobOrText : new Blob([String(blobOrText)], { type: mime || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename || 'aidevisio.txt'; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };

  U.copy = async function (text) {
    text = String(text == null ? '' : text);
    try {
      if (navigator.clipboard && G.isSecureContext !== false) { await navigator.clipboard.writeText(text); return true; }
    } catch (e) {  }
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return !!ok;
    } catch (e) { return false; }
  };

  const PH_RE = /\u0001(\d+)\u0002/g;

  function emphasis(s) {
    return s
      .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^\w])__(?=\S)([\s\S]*?\S)__(?!\w)/g, '$1<strong>$2</strong>')
      .replace(/(^|[^*\w])\*(?=[^\s*])([^*\n]*?[^\s*])\*(?![*\w])/g, '$1<em>$2</em>')
      .replace(/(^|[^\w])_(?=[^\s_])([^_\n]*?[^\s_])_(?!\w)/g, '$1<em>$2</em>')
      .replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<del>$1</del>');
  }

  function anchor(url, innerHtml) {
    return '<a href="' + U.esc(url) + '" target="_blank" rel="noopener noreferrer">' + innerHtml + '</a>';
  }

  function inline(raw) {
    const slots = [];
    const put = (html) => '\u0001' + (slots.push(html) - 1) + '\u0002';
    let s = String(raw);
    s = s.replace(/`([^`\n]+)`/g, (m, code) => put('<code>' + U.esc(code) + '</code>'));
    s = s.replace(/\[([^\]\n]{1,400})\]\((https?:\/\/[^\s)]+)\)/gi, (m, text, url) => put(anchor(url, emphasis(U.esc(text)))));
    s = s.replace(/\bhttps?:\/\/[^\s<>"'`\u0001\u0002]+/gi, (url) => {
      let tail = '';
      while (/[.,;:!?»)\]]$/.test(url)) {
        if (url.endsWith(')') && (url.split('(').length > url.split(')').length - 1)) break;
        tail = url.slice(-1) + tail;
        url = url.slice(0, -1);
      }
      return put(anchor(url, U.esc(url))) + tail;
    });
    s = emphasis(U.esc(s));
    for (let i = 0; i < 4 && s.indexOf('\u0001') !== -1; i++) s = s.replace(PH_RE, (m, n) => slots[+n] || '');
    return s;
  }

  function warnClass(text) {
    return /⚠/.test(text) ? ' class="warn"' : '';
  }

  U.md = function (str) {
    if (str == null) return '';
    const lines = String(str).replace(/\r\n?/g, '\n').replace(/[\u0001\u0002]/g, '').split('\n');
    const out = [];
    let para = [];
    let quote = [];
    const lists = [];
    let blankInList = false;

    const flushPara = () => {
      if (!para.length) return;
      out.push('<p' + warnClass(para.join(' ')) + '>' + para.map(inline).join('<br>') + '</p>');
      para = [];
    };
    const flushQuote = () => {
      if (!quote.length) return;
      out.push('<blockquote>' + U.md(quote.join('\n')) + '</blockquote>');
      quote = [];
    };
    const closeLists = () => {
      while (lists.length) out.push('</li></' + lists.pop().tag + '>');
      blankInList = false;
    };
    const openList = (tag, indent, num) => {
      const start = tag === 'ol' && num && Number(num) !== 1 ? ' start="' + Number(num) + '"' : '';
      out.push('<' + tag + start + '>');
      lists.push({ tag, indent });
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      const fence = /^(```|~~~)/.exec(trimmed);
      if (fence) {
        flushPara(); flushQuote(); closeLists();
        const buf = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith(fence[1])) buf.push(lines[i++]);
        out.push('<pre><code>' + U.esc(buf.join('\n')) + '</code></pre>');
        continue;
      }

      if (!trimmed) {
        flushPara(); flushQuote();
        if (lists.length) blankInList = true;
        continue;
      }

      const q = /^\s{0,3}>\s?(.*)$/.exec(line);
      if (q) { flushPara(); closeLists(); quote.push(q[1]); continue; }
      flushQuote();

      const h = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
      if (h) {
        flushPara(); closeLists();
        const n = Math.min(h[1].length, 4);
        out.push('<h' + n + '>' + inline(h[2]) + '</h' + n + '>');
        continue;
      }

      if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) { flushPara(); closeLists(); out.push('<hr>'); continue; }

      const li = /^(\s*)(?:([-*+•‣◦])|(\d{1,3})[.)])\s+(.*)$/.exec(line);
      if (li) {
        flushPara();
        const indent = li[1].replace(/\t/g, '    ').length;
        const tag = li[3] ? 'ol' : 'ul';
        let top = lists[lists.length - 1];
        while (top && indent < top.indent - 1) { out.push('</li></' + top.tag + '>'); lists.pop(); top = lists[lists.length - 1]; }
        if (!top) openList(tag, indent, li[3]);
        else if (indent >= top.indent + 2) openList(tag, indent, li[3]);
        else if (top.tag === tag) out.push('</li>');
        else { out.push('</li></' + top.tag + '>'); lists.pop(); openList(tag, indent, li[3]); }
        out.push('<li' + warnClass(li[4]) + '>' + inline(li[4]));
        blankInList = false;
        continue;
      }

      if (lists.length && /^\s+\S/.test(line) && (!blankInList || /^\s{2,}\S/.test(line))) {
        out.push('<br>' + inline(trimmed));
        blankInList = false;
        continue;
      }

      closeLists();
      para.push(trimmed);
    }
    flushPara(); flushQuote(); closeLists();
    return out.join('');
  };

  U.norm = function (str) {
    if (str == null) return '';
    return String(str).toLowerCase()
      .replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/ß/g, 'ss')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  };

  const STOP = new Set((
    'a au aux avec ce ces cet cette ca c d de des du dans en et ou l la le les un une uns unes sur sous par pour sans chez ' +
    'entre vers depuis pendant comme que qu qui quoi dont ne n pas plus moins si mais or ni car puis ensuite enfin donc ' +
    'se s sa son ses leur leurs mon ma mes ton ta tes notre nos votre vos je j tu t il elle on nous vous ils elles me m te ' +
    'moi toi lui y eux soi cela ceci celui celle ceux celles ci la ici ' +
    'est es sont suis etes sommes etait etais etaient ete etre sera serait seriez serais serez seront ' +
    'ai as avez avons ont avait avais aviez avaient aurait auriez aurais eu avoir ' +
    'fait faire faites font ferait feriez ferais faisiez ' +
    'pouvez pourriez pourrais peux peut pouvons pourrait pourrions puis ' +
    'voulez voudriez voudrais veux veut voulons voudrions voulais ' +
    'aimerais aimerions aimerait souhaiterais souhaiterions ' +
    'dois doit devez devriez devrais devons devrions devrait devraient va vais allez allons vont aller ' +
    'dire dites dit dis disiez ' +
    'pourquoi comment quel quelle quels quelles lequel laquelle lesquels lesquelles combien quand ' +
    'euh heu hum hmm mmh bah ben bon alors voila hein ok okay oui non bien tres tout tous toute toutes aussi encore ' +
    'deja peu beaucoup vraiment juste certes meme autre autres quelque quelques chose choses ' +
    'merci accord bonjour bonsoir madame monsieur maintenant aujourd hui petit petite rapidement brievement ' +
    'simplement exactement precisement concretement globalement mots minutes plutot'
  ).split(/\s+/));

  const FILLER_PHRASES = [
    'est ce que', 'est ce qu', 'qu est ce que', 'qu est ce qui', 'qu est ce', 'du coup', 'en fait', 'c est a dire',
    'tout d abord', 'd abord', 'pour commencer', 'pour debuter', 'pour finir', 'pour terminer', 'pour conclure',
    'dans un premier temps', 'un petit peu', 'un peu', 'j aimerais savoir', 'je voudrais savoir', 'je voulais savoir',
    'j aimerais bien', 'on va dire', 'si vous voulez', 'si tu veux', 'vous voyez', 'vous savez', 'tu vois', 'tu sais',
    'je dirais', 'n est ce pas', 'tres bien', 'en quelques mots', 'en deux mots', 'en trois mots'
  ];
  const FILLER_RE = new RegExp('(^| )(?:' + FILLER_PHRASES.join('|') + ')(?= |$)', 'g');
  const NUMBERS = { deux: '2', trois: '3', quatre: '4', cinq: '5', six: '6', sept: '7', huit: '8', neuf: '9', dix: '10', quinze: '15', vingt: '20', trente: '30' };

  function contentWords(str) {
    let n = U.norm(str);
    if (!n) return [];
    n = n.replace(FILLER_RE, ' ').replace(FILLER_RE, ' ');
    return n.split(' ').filter((w) => w && (/^\d+$/.test(w) || (w.length >= 2 && !STOP.has(w))));
  }

  U.tokens = function (str) {
    return contentWords(str).map((w) => NUMBERS[w] || w);
  };

  const SUFFIXES = ['issements', 'issement', 'ations', 'ateurs', 'atrices', 'ements', 'ation', 'ateur', 'atrice', 'ement',
    'ments', 'ment', 'ances', 'ance', 'ences', 'ence', 'ites', 'ite', 'ives', 'ive', 'ifs', 'iers', 'ieres', 'iere', 'ier',
    'euses', 'euse', 'eux', 'iez', 'ions', 'ion', 'ons', 'ez', 'er', 'ir', 'ent', 'ait', 'ees', 'ee', 'es', 'e'];
  function stem(t) {
    if (t.length <= 4 || /^\d+$/.test(t)) return t;
    if (/[sx]$/.test(t) && !/ss$/.test(t)) t = t.slice(0, -1);
    for (const suf of SUFFIXES) {
      if (t.endsWith(suf) && t.length - suf.length >= 4) return t.slice(0, -suf.length);
    }
    return t;
  }

  const CANON = [
    ['motiv', 'motiv'], ['attir', 'motiv'], ['=plait', 'motiv'], ['=plaire', 'motiv'], ['=plairait', 'motiv'], ['interess', 'motiv'], ['=envie', 'motiv'], ['passionn', 'motiv'],
    ['salair', 'salair'], ['salari', 'salair'], ['remuner', 'salair'], ['pretent', 'salair'], ['packag', 'salair'], ['=gagner', 'salair'], ['=gagnez', 'salair'], ['=gagniez', 'salair'],
    ['faibl', 'faibl'], ['defaut', 'faibl'],
    ['qualit', 'qualit'], ['atout', 'qualit'], ['=fort', 'qualit'], ['=forts', 'qualit'], ['=force', 'qualit'], ['=forces', 'qualit'],
    ['dispon', 'dispo'], ['preavis', 'dispo'], ['demarr', 'dispo'], ['commenc', 'dispo'],
    ['quitt', 'depart'], ['=depart', 'depart'], ['=departs', 'depart'], ['=partir', 'depart'], ['=parti', 'depart'], ['=partez', 'depart'],
    ['equip', 'equip'], ['collabor', 'equip'], ['collegu', 'equip'],
    ['manag', 'manag'], ['encadr', 'manag'],
    ['conflit', 'conflit'], ['desaccord', 'conflit'], ['tension', 'conflit'],
    ['difficil', 'difficil'], ['difficult', 'difficil'], ['compliqu', 'difficil'],
    ['echec', 'echec'], ['erreur', 'echec'], ['=rate', 'echec'], ['=ratee', 'echec'],
    ['stress', 'stress'], ['pression', 'stress'],
    ['=avenir', 'aveni'], ['futur', 'aveni'], ['evolu', 'aveni'], ['=projection', 'aveni'], ['=projetez', 'aveni'],
    ['recrut', 'recrut'], ['embauch', 'recrut'], ['=choisir', 'recrut'], ['=retenir', 'recrut'], ['engag', 'recrut'],
    ['present', 'present'], ['parcour', 'present'], ['=cv', 'present'],
    ['=parlez', 'parl'], ['=parler', 'parl'], ['=parle', 'parl'], ['=parliez', 'parl'], ['racont', 'parl'], ['decri', 'parl'], ['decriv', 'parl'],
    ['reussi', 'reussit'], ['=fier', 'reussit'], ['=fiere', 'reussit'], ['fierte', 'reussit'], ['=succes', 'reussit'],
    ['entrepris', 'entrepris'], ['societe', 'entrepris'], ['=boite', 'entrepris'], ['=groupe', 'entrepris'],
    ['mensuel', 'mois'], ['logiciel', 'outil'], ['outil', 'outil'],
    ['=poste', 'post'], ['=postes', 'post'], ['emploi', 'post'], ['=job', 'post'],
    ['connai', 'connai'], ['=savez', 'connai'], ['=savoir', 'connai'],
    ['experien', 'experi'], ['travail', 'travail'], ['profession', 'pro'], ['carrier', 'carrier'],
    ['situation', 'situ'], ['exempl', 'exempl'], ['illustr', 'exempl'], ['question', 'question'],
    ['teletrav', 'teletrav'], ['mobil', 'mobil'], ['demenag', 'mobil'], ['deplac', 'mobil']
  ];
  const WEAK = new Set(['post', 'entrepris', 'experi', 'travail', 'situ', 'exempl', 'question', 'pro', 'carrier', 'metier', 'meti',
    'actuel', 'actuell', 'dernier', 'dern', 'ans', 'annee', 'an', 'temps', 'personne', 'gens', 'cas', 'type', 'genre', 'cadre']);
  const WEAKER = new Set(['voyez', 'voy', 'imagin', 'pens', 'pensez', 'envisag', 'souhait', 'attend', 'visez', 'vis', 'cherch',
    'recherch', 'trouv', 'aim', 'aimez', 'consider', 'estim', 'grand', 'grande', 'princip', 'principal', 'plu', 'mieux',
    'meilleur', 'sentez', 'sent', 'dir', 'diri', 'diriez', 'point', 'parl', 'organis', 'utilis', 'maitris']);

  function canon(w) {
    if (/^\d+$/.test(w)) return w;
    for (const [p, c] of CANON) {
      if (p[0] === '=' ? w === p.slice(1) : w.startsWith(p)) return c;
    }
    return stem(w);
  }
  function weight(t) {
    if (WEAKER.has(t)) return 0.3;
    if (WEAK.has(t)) return 0.45;
    if (/^\d+$/.test(t) || t.length <= 3) return 0.7;
    return 1;
  }

  function lev(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      let best = i;
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (cur[j] < best) best = cur[j];
      }
      if (best > max) return max + 1;
      prev = cur;
    }
    return prev[b.length];
  }

  function tokenMatch(t, u) {
    if (t === u) return 1;
    const m = Math.min(t.length, u.length);
    if (m >= 4 && (t.startsWith(u) || u.startsWith(t))) return 0.8;
    if (m >= 5 && lev(t, u, m >= 8 ? 2 : 1) <= (m >= 8 ? 2 : 1)) return 0.75;
    return 0;
  }

  function bigrams(s) {
    const g = new Map();
    const str = ' ' + s + ' ';
    for (let i = 0; i < str.length - 1; i++) {
      const k = str.substr(i, 2);
      if (k !== '  ') g.set(k, (g.get(k) || 0) + 1);
    }
    g.total = Math.max(0, str.length - 1);
    return g;
  }
  function gramInter(a, b) {
    let n = 0;
    for (const [k, v] of a) { const w = b.get(k); if (w) n += Math.min(v, w); }
    return n;
  }
  const dice = (a, b) => (a.total + b.total ? (2 * gramInter(a, b)) / (a.total + b.total) : 0);
  const containGrams = (small, big) => (small.total ? gramInter(small, big) / small.total : 0);

  const analysisCache = new Map();
  function analyze(str) {
    const key = String(str == null ? '' : str);
    let r = analysisCache.get(key);
    if (r) return r;
    const full = U.norm(key);
    let n = full;
    n = n.replace(/\b(?:dans|d ici|sous) (?:\d+|deux|trois|quatre|cinq|dix|quelques) (?:ans|annees)\b/g, ' avenir ')
      .replace(/\b(?:parlez|racontez|presentez|decrivez|parle|raconte) (?:moi|nous) (?:un peu )?(?:de vous|qui vous etes|votre parcours)\b/g, ' presentez ')
      .replace(/\bqui etes vous\b/g, ' presentez ')
      .replace(/\b(?:je vais|on va|nous allons|je voudrais|je vais d abord) (?:vous )?(?:presenter|expliquer|parler|decrire|raconter|detailler)\b/g, ' ')
      .replace(/\bje vous (?:presente|explique|parle|decris|raconte|detaille)\b/g, ' ');
    const raw = contentWords(n).map((w) => NUMBERS[w] || w);
    const set = [];
    for (const w of raw) { const c = canon(w); if (!set.includes(c)) set.push(c); }
    const weights = set.map(weight);
    r = {
      canon: set,
      weights,
      w: weights.reduce((x, y) => x + y, 0),
      strong: set.filter((t, i) => weights[i] === 1),
      gRaw: bigrams(raw.join(' ')),
      gCanon: bigrams(set.join(' ')),
      full,
      gFull: bigrams(full)
    };
    if (analysisCache.size > 800) analysisCache.clear();
    analysisCache.set(key, r);
    return r;
  }

  function softInter(A, B) {
    let s = 0;
    for (let i = 0; i < A.canon.length; i++) {
      let best = 0;
      for (const u of B.canon) { const m = tokenMatch(A.canon[i], u); if (m > best) best = m; if (best === 1) break; }
      s += A.weights[i] * best;
    }
    return s;
  }
  function strongJaccard(a, b) {
    if (!a.length || !b.length) return 0;
    let inter = 0;
    for (const t of a) { let best = 0; for (const u of b) best = Math.max(best, tokenMatch(t, u)); inter += best; }
    let inter2 = 0;
    for (const t of b) { let best = 0; for (const u of a) best = Math.max(best, tokenMatch(t, u)); inter2 += best; }
    const i = (inter + inter2) / 2;
    return i / (a.length + b.length - i);
  }

  U.similarity = function (a, b) {
    const A = analyze(a), B = analyze(b);
    if (!A.full || !B.full) return 0;
    if (A.full === B.full) return 1;
    const surface = dice(A.gFull, B.gFull);
    if (!A.canon.length || !B.canon.length) {
      return Math.round(0.5 * surface * 1000) / 1000;
    }
    const ab = softInter(A, B), ba = softInter(B, A);
    const inter = (ab + ba) / 2;
    const J = inter / (A.w + B.w - inter);
    const D = Math.max(dice(A.gRaw, B.gRaw), dice(A.gCanon, B.gCanon));
    let s = 0.75 * J + 0.25 * D;

    const small = A.w <= B.w ? A : B, big = small === A ? B : A;
    const C = (small === A ? ab : ba) / small.w;
    const conf = Math.min(1, small.w / 2.4);
    s = Math.max(s, conf * (0.75 * C + 0.25 * containGrams(small.gCanon, big.gCanon)) * 0.95);

    if (A.strong.length && B.strong.length) s = Math.max(s, 0.85 * strongJaccard(A.strong, B.strong));
    else s = Math.min(s, Math.max(0.5, surface + 0.1));

    return Math.round(U.clamp(s, 0, 1) * 1000) / 1000;
  };
})(window.AideVisio = window.AideVisio || {});

(function (S) {
  'use strict';

  const U = () => S.util || {};
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = (s) => (U().esc ? U().esc(String(s == null ? '' : s))
    : String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const settings = () => { try { return (S.store && S.store.settings && S.store.settings()) || {}; } catch (e) { return {}; } };
  const errMsg = (e) => (e && (e.userMessage || e.message)) || String(e || 'Erreur inconnue');
  const isAbort = (e) => !!e && (e.name === 'AbortError' || e.code === 20 || /abort/i.test(e.message || ''));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  const F = 'fill="currentColor" stroke="none"';
  const ICONS = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    mic: '<rect x="9" y="2.75" width="6" height="11.5" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.75 21h6.5"/>',
    'mic-slash': '<path d="M15 9.5V5.75a3 3 0 0 0-5.6-1.5M9 9v2.25a3 3 0 0 0 5 2.2M5.5 11a6.5 6.5 0 0 0 10.9 4.8M18.5 11c0 .8-.15 1.6-.4 2.3M12 17.5V21M8.75 21h6.5M3.5 3.5l17 17"/>',
    waveform: '<path d="M4 10v4M8 7v10M12 3.5v17M16 6.5v11M20 9.5v5"/>',
    sparkles: '<path d="M10 3.5l1.6 4.9 4.9 1.6-4.9 1.6L10 16.5l-1.6-4.9L3.5 10l4.9-1.6z"/><path d="M18 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/><path d="M18.5 3v3M17 4.5h3"/>',
    doc: '<path d="M14 3H7.5A2.5 2.5 0 0 0 5 5.5v13A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V8z"/><path d="M14 3v3.5A1.5 1.5 0 0 0 15.5 8H19M9 13h6M9 16.5h4"/>',
    upload: '<path d="M12 15V3.5M7.5 8 12 3.5 16.5 8"/><path d="M4.5 14.5v3A2.5 2.5 0 0 0 7 20h10a2.5 2.5 0 0 0 2.5-2.5v-3"/>',
    play: `<path ${F} d="M7 4.9v14.2c0 .9 1 1.5 1.8 1l11.7-7.1c.8-.5.8-1.6 0-2.1L8.8 3.9C8 3.4 7 4 7 4.9z"/>`,
    pause: `<rect ${F} x="6" y="4.5" width="4.2" height="15" rx="1.3"/><rect ${F} x="13.8" y="4.5" width="4.2" height="15" rx="1.3"/>`,
    stop: `<rect ${F} x="5.5" y="5.5" width="13" height="13" rx="3"/>`,
    gear: '<path d="M12.22 2.75h-.44a1.9 1.9 0 0 0-1.9 1.9v.17a1.9 1.9 0 0 1-.95 1.64l-.41.24a1.9 1.9 0 0 1-1.9 0l-.14-.08a1.9 1.9 0 0 0-2.6.7l-.22.37a1.9 1.9 0 0 0 .7 2.6l.14.09a1.9 1.9 0 0 1 .95 1.63v.48a1.9 1.9 0 0 1-.95 1.65l-.14.08a1.9 1.9 0 0 0-.7 2.6l.22.37a1.9 1.9 0 0 0 2.6.7l.14-.08a1.9 1.9 0 0 1 1.9 0l.41.24a1.9 1.9 0 0 1 .95 1.64v.17a1.9 1.9 0 0 0 1.9 1.9h.44a1.9 1.9 0 0 0 1.9-1.9v-.17a1.9 1.9 0 0 1 .95-1.64l.41-.24a1.9 1.9 0 0 1 1.9 0l.14.08a1.9 1.9 0 0 0 2.6-.7l.22-.37a1.9 1.9 0 0 0-.7-2.6l-.14-.08a1.9 1.9 0 0 1-.95-1.65v-.48a1.9 1.9 0 0 1 .95-1.63l.14-.09a1.9 1.9 0 0 0 .7-2.6l-.22-.37a1.9 1.9 0 0 0-2.6-.7l-.14.08a1.9 1.9 0 0 1-1.9 0l-.41-.24a1.9 1.9 0 0 1-.95-1.64v-.17a1.9 1.9 0 0 0-1.9-1.9z"/><circle cx="12" cy="12" r="3"/>',
    'chevron-left': '<path d="M14.5 5.5 8 12l6.5 6.5"/>',
    'chevron-right': '<path d="M9.5 5.5 16 12l-6.5 6.5"/>',
    'chevron-down': '<path d="M5.5 9.5 12 16l6.5-6.5"/>',
    trash: '<path d="M4 6.5h16M9.5 6.5V4.75c0-.7.55-1.25 1.25-1.25h2.5c.7 0 1.25.55 1.25 1.25V6.5M6 6.5l.9 12.1A2.5 2.5 0 0 0 9.4 21h5.2a2.5 2.5 0 0 0 2.5-2.4L18 6.5M10 10.5v6M14 10.5v6"/>',
    export: '<path d="M12 14.5V3.5M8 7.5l4-4 4 4"/><path d="M8.5 10.5H7A2.5 2.5 0 0 0 4.5 13v5.5A2.5 2.5 0 0 0 7 21h10a2.5 2.5 0 0 0 2.5-2.5V13a2.5 2.5 0 0 0-2.5-2.5h-1.5"/>',
    import: '<path d="M12 3.5v11M8 10.5l4 4 4-4"/><path d="M8.5 7.5H7A2.5 2.5 0 0 0 4.5 10v8.5A2.5 2.5 0 0 0 7 21h10a2.5 2.5 0 0 0 2.5-2.5V10A2.5 2.5 0 0 0 17 7.5h-1.5"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    warning: '<path d="M10.3 4.2 2.6 17.6a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z"/><path d="M12 9.5v4M12 17h.01"/>',
    xmark: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    pip: `<rect x="2.5" y="4.5" width="19" height="15" rx="3"/><rect ${F} x="11.5" y="10.5" width="7" height="6" rx="1.5"/>`,
    keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6.5 10h.01M10 10h.01M14 10h.01M17.5 10h.01M8 14h8"/>',
    clock: '<circle cx="12" cy="12" r="8.75"/><path d="M12 7.5V12l3 2"/>',
    person: '<circle cx="12" cy="8" r="3.75"/><path d="M4.75 20a7.25 7.25 0 0 1 14.5 0"/>',
    person2: '<circle cx="9" cy="8.25" r="3.25"/><path d="M3 19.5a6 6 0 0 1 12 0M15.5 5.2a3.25 3.25 0 0 1 0 6.1M17.5 13.9a6 6 0 0 1 3.5 5.6"/>',
    bolt: '<path d="M13 2.75 4.75 13.5H11l-1 7.75 8.25-10.75H12z"/>',
    refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4v4.5H15"/>',
    copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M15.5 8.5V6a2.5 2.5 0 0 0-2.5-2.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5"/>',
    download: '<path d="M12 3.5v12M7.5 11 12 15.5 16.5 11M5 20.5h14"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    'eye-slash': '<path d="M9.9 5.75A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.6 3.4M6.6 6.9C4 8.6 2.5 12 2.5 12S6 18.5 12 18.5c1.9 0 3.5-.6 4.9-1.5M9.9 9.9a3 3 0 0 0 4.2 4.2M3.5 3.5l17 17"/>',
    info: '<circle cx="12" cy="12" r="8.75"/><path d="M12 11v5.5M12 7.75h.01"/>',
    graduation: '<path d="M2.5 9 12 4.5 21.5 9 12 13.5z"/><path d="M6.5 11v4.75c0 1.5 2.5 3 5.5 3s5.5-1.5 5.5-3V11M21.5 9v5"/>',
    list: '<path d="M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01"/>',
    phone: '<path d="M5.2 3.5h2.7c.5 0 .9.3 1 .8l.9 3.6c.1.4 0 .8-.3 1.1L7.8 10.7a12.5 12.5 0 0 0 5.5 5.5l1.7-1.7c.3-.3.7-.4 1.1-.3l3.6.9c.5.1.8.5.8 1v2.7c0 .9-.7 1.7-1.7 1.7C10.3 20.5 3.5 13.7 3.5 5.2c0-1 .8-1.7 1.7-1.7z"/>',
    video: '<rect x="2.5" y="6" width="13" height="12" rx="3"/><path d="M15.5 10.5 21.5 7v10l-6-3.5"/>',
    speaker: '<path d="M3.5 9.75v4.5c0 .55.45 1 1 1H7.5l4.5 4V4.75l-4.5 4H4.5c-.55 0-1 .45-1 1z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
    shield: '<path d="M12 3 19.5 6v5.5c0 4.6-3.2 8.4-7.5 9.5-4.3-1.1-7.5-4.9-7.5-9.5V6z"/><path d="M8.75 12.25l2.25 2.25 4.25-4.5"/>',
    'wifi-off': '<path d="M3.5 3.5l17 17M8.6 16.1a4.8 4.8 0 0 1 6.8 0M5.2 12.6a9.6 9.6 0 0 1 4.4-2.4M2.3 9.1A14.4 14.4 0 0 1 6.5 6.6M10.9 5.3c3.9-.3 7.8 1 10.8 3.8M16.6 10.8c.8.5 1.6 1.1 2.2 1.8M12 19.75h.01"/>',
    home: '<path d="M3.5 10.5 12 3.75l8.5 6.75"/><path d="M5.5 9v9.5A1.5 1.5 0 0 0 7 20h3.25v-5.5h3.5V20H17a1.5 1.5 0 0 0 1.5-1.5V9"/>',
    edit: '<path d="M4 20h4.2L19.1 9.1a2.6 2.6 0 0 0-3.7-3.7L4.5 16.3 4 20z"/><path d="M13.75 7.25l3 3"/>',
    search: '<circle cx="10.75" cy="10.75" r="6.75"/><path d="m20 20-4.5-4.5"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    building: '<path d="M4.5 21V5.5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2V21M15.5 9.5H18a2 2 0 0 1 2 2V21M3 21h18M8.5 7.5h3M8.5 11h3M8.5 14.5h3"/>',
    send: '<path d="M12 19V5.5M6.5 11 12 5.5 17.5 11"/>',
    ellipsis: '<path d="M6 12h.01M12 12h.01M18 12h.01" stroke-width="2.6"/>',
    key: '<circle cx="8" cy="15" r="4.5"/><path d="M11.2 11.8 20 3M17 6l2.5 2.5M14.5 8.5l2 2"/>',
    chat: '<path d="M20.5 11.5c0 4.1-3.8 7.5-8.5 7.5-1.2 0-2.3-.2-3.3-.6L3.5 20l1.4-3.9c-.9-1.3-1.4-2.9-1.4-4.6C3.5 7.4 7.3 4 12 4s8.5 3.4 8.5 7.5z"/>',
    lightbulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3z"/>',
    clipboard: '<rect x="5" y="4.5" width="14" height="16.5" rx="2.5"/><path d="M9 4.5V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v.5a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1zM9 11h6M9 14.5h6M9 18h3.5"/>',
    lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
    globe: '<circle cx="12" cy="12" r="8.75"/><path d="M3.25 12h17.5M12 3.25c2.3 2.4 3.5 5.3 3.5 8.75s-1.2 6.35-3.5 8.75c-2.3-2.4-3.5-5.3-3.5-8.75S9.7 5.65 12 3.25z"/>',
    star: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>',
    'text-size': '<path d="M3 18 8 6l5 12M4.6 14h6.8M14.5 18l3.25-8L21 18M15.5 15.5h4.5"/>',
    'arrow-down': '<path d="M12 4.5v15M6 13.5l6 6 6-6"/>',
    quote: '<path d="M9.5 7H6.5a2 2 0 0 0-2 2v2.5a2 2 0 0 0 2 2h3V15a3 3 0 0 1-3 3M19.5 7h-3a2 2 0 0 0-2 2v2.5a2 2 0 0 0 2 2h3V15a3 3 0 0 1-3 3"/>',
    target: '<circle cx="12" cy="12" r="8.75"/><circle cx="12" cy="12" r="4.75"/><circle cx="12" cy="12" r=".9" fill="currentColor"/>'
  };
  function icon(name, cls) {
    const body = ICONS[name] || ICONS.info;
    return `<svg class="ico${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
  }

  function h(html) {
    const t = document.createElement('template');
    t.innerHTML = String(html == null ? '' : html).trim();
    if (t.content.childNodes.length === 1 && t.content.firstElementChild) return t.content.firstElementChild;
    const wrap = document.createElement('div');
    wrap.appendChild(t.content);
    return wrap;
  }

  function topSheetLayer() {
    const layers = $$('.sheet-layer:not(.out)');
    return layers[layers.length - 1] || null;
  }

  function sheet(opts) {
    const o = opts || {};
    const actions = o.actions || [];
    const dismissible = o.dismissible !== false;
    const prevFocus = document.activeElement;
    const layer = h(`<div class="sheet-layer">
      <div class="sheet-backdrop"></div>
      <section class="sheet ${o.wide ? 'sheet-wide' : ''} ${esc(o.className || '')}" role="dialog" aria-modal="true"${o.title ? ` aria-label="${esc(o.title)}"` : ''}>
        <div class="sheet-grabber" aria-hidden="true"></div>
        ${o.title ? `<header class="sheet-head"><h2 class="sheet-title">${esc(o.title)}</h2>${dismissible ? `<button type="button" class="icon-btn sheet-x" aria-label="Fermer">${icon('xmark')}</button>` : ''}</header>` : ''}
        <div class="sheet-body"></div>
        ${actions.length ? '<footer class="sheet-actions"></footer>' : ''}
      </section>
    </div>`);
    const el = $('.sheet', layer);
    const bodyEl = $('.sheet-body', el);
    if (o.body instanceof Node) bodyEl.appendChild(o.body);
    else bodyEl.innerHTML = o.body || '';
    let closed = false;
    function close(reason) {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', onKey, true);
      layer.classList.add('out');
      layer.classList.remove('in');
      setTimeout(() => layer.remove(), 260);
      if (prevFocus && prevFocus.focus && document.contains(prevFocus)) { try { prevFocus.focus({ preventScroll: true }); } catch (e) {  } }
      if (o.onClose) { try { o.onClose(reason); } catch (e) { console.warn(e); } }
    }
    const foot = $('.sheet-actions', el);
    actions.forEach((a) => {
      const b = h(`<button type="button" class="btn btn-${esc(a.kind || 'ghost')}">${a.icon ? icon(a.icon) : ''}<span>${esc(a.label)}</span></button>`);
      b.addEventListener('click', async () => {
        let r;
        if (a.onClick) {
          b.disabled = true;
          try { r = await a.onClick({ el, close, button: b }); } catch (e) { toast(errMsg(e), 'err'); r = false; } finally { b.disabled = false; }
        }
        if (a.close !== false && r !== false) close('action');
      });
      foot.appendChild(b);
    });
    $('.sheet-backdrop', layer).addEventListener('click', () => { if (dismissible) close('backdrop'); });
    const x = $('.sheet-x', el);
    if (x) x.addEventListener('click', () => close('x'));
    function onKey(e) {
      if (topSheetLayer() !== layer) return;
      if (e.key === 'Escape' && dismissible) { e.preventDefault(); e.stopPropagation(); close('esc'); return; }
      if (e.key === 'Enter' && !e.shiftKey && e.target && e.target.matches && e.target.matches('.sheet input:not([type=checkbox]):not([type=radio]):not([type=file])')) {
        const p = foot && $('.btn-primary, .btn-danger', foot);
        if (p) { e.preventDefault(); p.click(); }
        return;
      }
      if (e.key === 'Tab') {
        const f = $$('button:not([disabled]), [href], input:not([disabled]):not([type=hidden]), select, textarea, [tabindex]:not([tabindex="-1"])', el).filter((n) => n.offsetParent !== null);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(layer);
    requestAnimationFrame(() => requestAnimationFrame(() => layer.classList.add('in')));
    setTimeout(() => {
      if (closed) return;
      const f = $('[autofocus]', el) || $('input:not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea', el) || (foot && $('.btn-primary', foot)) || x;
      if (f) { try { f.focus({ preventScroll: true }); } catch (e) {  } }
    }, 80);
    return { el, close };
  }

  function confirmSheet(o) {
    o = o || {};
    return new Promise((resolve) => {
      let done = false;
      const finish = (v) => { if (!done) { done = true; resolve(v); } };
      sheet({
        title: o.title || 'Confirmer',
        body: o.text ? `<p class="sheet-text">${esc(o.text)}</p>` : '',
        className: 'sheet-confirm',
        actions: [
          { label: o.cancelLabel || 'Annuler', kind: 'ghost', onClick: () => finish(false) },
          { label: o.okLabel || 'Confirmer', kind: o.danger ? 'danger' : 'primary', onClick: () => finish(true) }
        ],
        onClose: () => finish(false)
      });
    });
  }

  const TOAST_ICON = { ok: 'check', warn: 'warning', err: 'warning', info: 'info' };
  function toast(msg, kind, opts) {
    if (msg && typeof msg === 'object') { opts = msg; kind = msg.kind || kind; msg = msg.msg || msg.message || msg.text || ''; }
    msg = String(msg == null ? '' : msg);
    if (!msg) return;
    kind = TOAST_ICON[kind] ? kind : 'info';
    opts = opts || {};
    const host = document.getElementById('toasts');
    if (!host) { console.log('[toast]', kind, msg); return; }
    const same = $$('.toast:not(.out)', host).find((n) => n.dataset.msg === msg);
    if (same) { same.classList.remove('bump'); void same.offsetWidth; same.classList.add('bump'); return; }
    const el = h(`<div class="toast toast-${kind}" role="${kind === 'err' ? 'alert' : 'status'}"><span class="toast-ic">${icon(TOAST_ICON[kind])}</span><span class="toast-msg">${esc(msg)}</span></div>`);
    el.dataset.msg = msg;
    let timer;
    const close = () => { clearTimeout(timer); el.classList.add('out'); setTimeout(() => el.remove(), 260); };
    if (opts.action && opts.action.label) {
      const b = h(`<button type="button" class="toast-act">${esc(opts.action.label)}</button>`);
      b.addEventListener('click', (e) => { e.stopPropagation(); close(); try { opts.action.onClick && opts.action.onClick(); } catch (er) { console.warn(er); } });
      el.appendChild(b);
    }
    el.addEventListener('click', close);
    host.appendChild(el);
    const visible = $$('.toast:not(.out)', host);
    if (visible.length > 3) visible.slice(0, visible.length - 3).forEach((n) => n.remove());
    timer = setTimeout(close, opts.duration || (kind === 'err' ? 7000 : kind === 'warn' ? 5200 : 3400));
    return { close };
  }

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 4000);
  }
  async function wipeDevice() {
    if (typeof S.store.clearAll === 'function') await S.store.clearAll();
    [window.localStorage, window.sessionStorage].forEach((stg) => {
      try { Object.keys(stg).filter((k) => /^aidevisio/i.test(k)).forEach((k) => stg.removeItem(k)); } catch (e) {  }
    });
    try { sessionStorage.clear(); } catch (e) {  }
    toast('Vos données ont été effacées de ce PC.', 'ok');
    setTimeout(() => { location.hash = '#/'; location.reload(); }, 900);
  }
  function cleanupSheet() {
    return sheet({
      title: 'Effacer vos données de ce PC',
      body: '<p>Supprime de ce navigateur vos oraux blancs, les sujets importés, les réglages et vos clés IA.</p>',
      actions: [
        { label: 'Annuler', kind: 'ghost' },
        { label: 'Tout effacer', kind: 'danger', onClick: () => wipeDevice() }
      ]
    });
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
      document.body.appendChild(ta); ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (er) { ok = false; }
      ta.remove();
      return ok;
    }
  }
  function pickFiles(o) {
    o = o || {};
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      if (o.accept) input.accept = o.accept;
      input.multiple = !!o.multiple;
      input.style.display = 'none';
      input.addEventListener('change', () => { resolve(Array.from(input.files || [])); input.remove(); });
      input.addEventListener('cancel', () => { resolve([]); input.remove(); });
      document.body.appendChild(input);
      input.click();
    });
  }
  function hydrateIcons(root) { $$('[data-icon]', root).forEach((n) => { if (!n.firstChild) n.innerHTML = icon(n.dataset.icon); }); }

  S.ui = Object.assign(S.ui || {}, {
    icon, h, sheet, confirm: confirmSheet, toast, download, copy, pickFiles, esc, hydrateIcons
  });

  const darkMQ = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function resolvedTheme() {
    const t = settings().theme;
    if (t === 'light' || t === 'dark') return t;
    return darkMQ && darkMQ.matches ? 'dark' : 'light';
  }
  function applyTheme() {
    const t = resolvedTheme();
    const scale = clamp(Number(settings().fontScale) || 1, 0.7, 2);
    document.documentElement.dataset.theme = t;
    document.documentElement.style.setProperty('--font-scale', String(scale));
    $$('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', t === 'dark' ? '#0b0c11' : '#f4f5f9'));
  }
  if (darkMQ && darkMQ.addEventListener) darkMQ.addEventListener('change', applyTheme);

  function updateNet() {
    const off = navigator.onLine === false;
    document.body.classList.toggle('is-offline', off);
    const p = document.getElementById('netpill');
    if (p) p.hidden = !off;
  }

  let installEvt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvt = e;
    $$('.install-btn').forEach((b) => { b.hidden = false; });
  });
  window.addEventListener('appinstalled', () => {
    installEvt = null;
    $$('.install-btn').forEach((b) => { b.hidden = true; });
    toast('Aide Visio est installé sur cet appareil.', 'ok');
  });
  async function installApp() {
    if (!installEvt) {
      sheet({
        title: 'Installer Aide Visio',
        body: `<div class="stack"><p class="sheet-text">Dans Chrome ou Edge sur PC : menu ${icon('ellipsis', 'ico-inline')} puis <b>Installer Aide Visio</b> (ou l’icône d’installation dans la barre d’adresse).</p><p class="sheet-text">Sur Android : menu ⋮ puis <b>Ajouter à l’écran d’accueil</b>.</p><p class="sheet-text muted">Sans installation, Aide Visio fonctionne aussi dans un simple onglet, ou en fichier unique <b>aidevisio.html</b>.</p></div>`,
        actions: [{ label: 'OK', kind: 'primary' }]
      });
      return;
    }
    installEvt.prompt();
    try { await installEvt.userChoice; } catch (e) {  }
    installEvt = null;
    $$('.install-btn').forEach((b) => { b.hidden = true; });
  }

  let swReloadAsked = false;
  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
    if (location.protocol !== 'https:' && !local) return;
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => {
      const offer = (w) => { if (w && navigator.serviceWorker.controller) showUpdateBanner(w); };
      if (reg.waiting) offer(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        if (w) w.addEventListener('statechange', () => { if (w.state === 'installed') offer(w); });
      });
      setInterval(() => { reg.update().catch(() => {}); }, 30 * 60 * 1000);
    }).catch((e) => console.warn('[aidevisio] service worker', e));
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!swReloadAsked) return;
      swReloadAsked = false;
      location.reload();
    });
  }
  function showUpdateBanner(worker) {
    const b = document.getElementById('update-banner');
    if (!b) return;
    b.innerHTML = `<span class="update-ic">${icon('sparkles')}</span><span class="update-text"><b>Nouvelle version disponible</b><span class="small muted">Recharger pour en profiter.</span></span><button type="button" class="btn btn-primary btn-sm">Recharger</button><button type="button" class="icon-btn icon-btn-sm" aria-label="Plus tard">${icon('xmark')}</button>`;
    b.hidden = false;
    requestAnimationFrame(() => b.classList.add('in'));
    $('.btn-primary', b).addEventListener('click', async () => {
      swReloadAsked = true;
      try { worker.postMessage({ type: 'SKIP_WAITING' }); worker.postMessage('SKIP_WAITING'); } catch (e) {  }
      setTimeout(() => { if (swReloadAsked) location.reload(); }, 2500);
    });
    $('.icon-btn', b).addEventListener('click', () => { b.classList.remove('in'); setTimeout(() => { b.hidden = true; }, 250); });
  }

  const routes = {};
  let current = null;
  let routeSeq = 0;
  let booted = false;

  function normHash(hash) {
    let x = String(hash == null ? '' : hash).trim();
    x = x.replace(/^#/, '').replace(/^\/+/, '');
    return '#/' + x;
  }
  function parseHash(hash) {
    const raw = String(hash == null ? location.hash : hash).replace(/^#\/?/, '');
    const qi = raw.indexOf('?');
    const path = qi >= 0 ? raw.slice(0, qi) : raw;
    const query = qi >= 0 ? raw.slice(qi + 1) : '';
    const parts = path.split('/').filter(Boolean).map((p) => { try { return decodeURIComponent(p); } catch (e) { return p; } });
    const name = parts.shift() || '';
    const params = parts.slice();
    params.id = parts[0];
    params.sessionId = parts[1];
    params.query = {};
    try { new URLSearchParams(query).forEach((v, k) => { params.query[k] = v; }); } catch (e) {  }
    return { name, params };
  }

  S.app = Object.assign(S.app || {}, {
    version: '2.0',
    register(name, def) {
      routes[String(name || '').replace(/^#?\/?/, '')] = def;
      if (booted && current && current.name === name) route(true);
    },
    go(hash) {
      const target = normHash(hash);
      if (location.hash === target || (target === '#/' && (location.hash === '' || location.hash === '#'))) route(true);
      else location.hash = target;
    },
    params() { return current ? current.params : parseHash().params; },
    current() { return current ? { name: current.name, params: current.params } : parseHash(); },
    refresh() { return route(true); },
    wipeDevice,
    cleanupSheet,
    install: installApp,
    canInstall() { return !!installEvt; },
    unlockVault,
    showUpdate(worker) { showUpdateBanner(worker || { postMessage() {} }); }
  });

  // Lien d'installation des clés : #/cles?d=<base64url JSON>. Le fragment ne quitte jamais le PC ;
  // les clés sont rangées comme si on les avait collées dans Réglages, puis le lien est effacé de l'adresse.
  async function unlockVault(code) {
    const v = S.vault;
    if (!v || !window.crypto || !crypto.subtle) throw new Error('Coffre des clés indisponible sur ce navigateur.');
    const b = (x) => Uint8Array.from(atob(x), (c) => c.charCodeAt(0));
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(code || '').trim().toLowerCase()), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: b(v.salt), iterations: v.iter }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    let plain;
    try { plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b(v.iv) }, key, b(v.data)); }
    catch (e) { const er = new Error('Code incorrect.'); er.code = 'BAD_CODE'; throw er; }
    const data = JSON.parse(new TextDecoder().decode(plain));
    const patch = { rememberKeys: true, provider: 'auto' };
    ['geminiKey', 'openaiKey', 'groqKey', 'claudeKey'].forEach((k) => { if (typeof data[k] === 'string' && data[k]) patch[k] = data[k]; });
    S.store.setSettings(patch);
    try { localStorage.setItem('aidevisio.vaultCode', String(code).trim().toLowerCase()); } catch (e) {  }
    return Object.keys(patch).length - 2;
  }

  function absorbKeyLink() {
    const c = /^#\/cles\?code=([A-Za-z0-9-]+)/.exec(location.hash || '');
    if (c) {
      history.replaceState(null, '', location.pathname + location.search + '#/');
      unlockVault(c[1]).then(() => { toast('Clés IA installées sur cet appareil.', 'ok'); route(true); })
        .catch((e) => toast(e.code === 'BAD_CODE' ? 'Code des clés incorrect : rien n’a été changé.' : errMsg(e), 'warn'));
      return;
    }
    const m = /^#\/cles\?d=([A-Za-z0-9_-]+)/.exec(location.hash || '');
    if (!m) {
      // Coffre déjà ouvert sur cet appareil mais clés absentes (effacées ou coffre renouvelé) : on rouvre en silence.
      const st = settings();
      let saved = '';
      try { saved = localStorage.getItem('aidevisio.vaultCode') || ''; } catch (e) {  }
      if (saved && !st.geminiKey && !st.openaiKey && !st.groqKey) unlockVault(saved).catch(() => {});
      return;
    }
    history.replaceState(null, '', location.pathname + location.search + '#/settings');
    try {
      const b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
      const bin = atob(b64 + '==='.slice((b64.length + 3) % 4));
      const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
      const patch = { rememberKeys: true, provider: 'auto' };
      ['geminiKey', 'openaiKey', 'groqKey', 'claudeKey'].forEach((k) => { if (typeof data[k] === 'string' && data[k].trim()) patch[k] = data[k].trim(); });
      S.store.setSettings(patch);
      toast('Clés IA installées.', 'ok');
    } catch (e) {
      console.error('[aidevisio] lien des clés', e);
      toast('Lien des clés illisible : rien n’a été changé.', 'warn');
    }
  }

  async function route(force) {
    const target = parseHash();
    const hash = location.hash || '#/';
    const seq = ++routeSeq;
    if (current && !force && current.hash === hash) return;
    if (current && current.def && current.def.canLeave && current.hash !== hash) {
      let ok = true;
      try { ok = await current.def.canLeave(target); } catch (e) { ok = true; }
      if (!ok) { history.replaceState(null, '', current.hash); return; }
      if (seq !== routeSeq) return;
    }
    if (current && current.def && current.def.leave) { try { await current.def.leave(); } catch (e) { console.warn(e); } }
    if (seq !== routeSeq) return;
    const view = document.getElementById('view');
    if (!view) return;
    const def = routes[target.name];
    current = { name: target.name, params: target.params, def, hash };
    document.body.dataset.route = target.name || 'home';
    updateTabbar(target.name);
    const root = document.createElement('div');
    root.className = 'route';
    root.dataset.route = target.name || 'home';
    view.replaceChildren(root);
    window.scrollTo(0, 0);
    if (!def) {
      root.innerHTML = emptyScreen(['settings', 'diag'].includes(target.name)
        ? { title: 'Écran indisponible', text: 'Cet écran n’a pas pu être chargé. Rechargez la page ; si le problème persiste, réinstallez Aide Visio.', icon: 'warning' }
        : { title: 'Page introuvable', text: 'Ce lien ne correspond à aucun écran de Aide Visio.', icon: 'info' });
      return;
    }
    try {
      await def.render(root, target.params);
    } catch (e) {
      console.error('[aidevisio] écran', target.name, e);
      if (seq === routeSeq) root.innerHTML = emptyScreen({ title: 'Oups, cet écran a rencontré un problème', text: errMsg(e), icon: 'warning' });
    }
    if (seq === routeSeq) hydrateIcons(root);
  }

  function emptyScreen(o) {
    return `<div class="screen"><div class="empty empty-page card">
      <div class="empty-ic">${icon(o.icon || 'info')}</div>
      <h1 class="h2">${esc(o.title)}</h1>
      <p class="muted">${esc(o.text || '')}</p>
      <div class="row center"><button type="button" class="btn btn-primary" data-go="#/">${icon('home')}<span>Accueil</span></button></div>
    </div></div>`;
  }

  const EXAM_ROUTES = ['', 'oral', 'eleve', 'appel', 'sujet'];
  function tabFor(name) {
    if (EXAM_ROUTES.includes(name)) return 'home';
    if (name === 'diag') return 'settings';
    return name;
  }
  function updateTabbar(name) {
    const tab = tabFor(name);
    $$('#tabbar [data-tab]').forEach((a) => {
      const on = a.dataset.tab === tab;
      a.classList.toggle('on', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }

  let lastErrToast = 0;
  function reportError(msg) {
    const now = Date.now();
    if (now - lastErrToast < 6000) return;
    lastErrToast = now;
    toast('Erreur inattendue : ' + msg, 'err');
  }
  window.addEventListener('error', (e) => {
    if (!e || !e.message || /ResizeObserver/.test(e.message)) return;
    if (e.filename && !/\/js\/|aidevisio|index\.html|\/$/i.test(e.filename) && e.filename !== location.href) return;
    console.error('[aidevisio]', e.error || e.message);
    reportError(e.message);
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r = e && e.reason;
    if (isAbort(r)) return;
    console.error('[aidevisio] promesse rejetée', r);
    reportError(errMsg(r));
  });

  function showStorageWarning() {
    const b = document.createElement('div');
    b.className = 'banner storage-banner card';
    b.setAttribute('role', 'alert');
    b.innerHTML = `<span class="tile tile-orange">${icon('warning')}</span><div class="grow"><b>Stockage bloqué sur ce navigateur</b><small>Vos oraux blancs et vos réglages ne seront pas conservés après fermeture. Exportez les bilans à garder.</small></div>`;
    const view = document.getElementById('view');
    if (view && view.parentNode) view.parentNode.insertBefore(b, view);
  }

  async function boot() {
    applyTheme();
    hydrateIcons(document);
    updateNet();
    window.addEventListener('online', updateNet);
    window.addEventListener('offline', updateNet);
    if (S.bus && S.bus.on) {
      S.bus.on('toast', (dta) => {
        if (typeof dta === 'string') toast(dta, 'info');
        else if (dta) toast(dta.msg || dta.message || dta.text || '', dta.kind || 'info', dta);
      });
      S.bus.on('settings:changed', () => { applyTheme(); });
      S.bus.on('ai:keyerror', (x) => {
        if (/^#\/(settings|diag)/.test(location.hash)) return;
        const name = x && x.provider === 'claude' ? 'Claude' : 'Gemini';
        toast(`Clé ${name} refusée : vérifiez-la dans les Réglages.`, 'err', { action: { label: 'Réglages', onClick: () => S.app.go('#/settings') }, duration: 9000 });
      });
    }
    document.addEventListener('click', (e) => {
      const a = e.target.closest && e.target.closest('[data-go]');
      if (!a || e.defaultPrevented || e.button > 0 || e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      S.app.go(a.dataset.go);
    });
    try {
      if (!S.store || !S.store.init) throw new Error('module de stockage absent');
      await S.store.init();
    } catch (e) {
      console.error('[aidevisio] stockage', e);
      const view = document.getElementById('view');
      if (view) view.innerHTML = `<div class="screen"><div class="empty empty-page card"><div class="empty-ic">${icon('warning')}</div><h1 class="h2">Démarrage impossible</h1><p class="muted">Le stockage local est inaccessible (${esc(errMsg(e))}). Fermez la navigation privée ou autorisez le stockage pour ce site, puis rechargez.</p><div class="row center"><button type="button" class="btn btn-primary" onclick="location.reload()">Recharger</button></div></div></div>`;
      return;
    }
    applyTheme();
    if (S.store.backend === 'memory') showStorageWarning();
    absorbKeyLink();
    booted = true;
    window.addEventListener('hashchange', () => route(false));
    await route(true);
    registerSW();
    try {
      if (window.launchQueue && typeof window.launchQueue.setConsumer === 'function') {
        window.launchQueue.setConsumer((p) => {
          let u = null;
          try { u = p && p.targetURL ? new URL(p.targetURL) : null; } catch (e) { u = null; }
          if (u && u.hash && u.hash !== location.hash) S.app.go(u.hash);
        });
      }
    } catch (e) {  }
    try { if (navigator.storage && navigator.storage.persisted) navigator.storage.persisted().then((p) => { if (!p && navigator.storage.persist) navigator.storage.persist().catch(() => {}); }).catch(() => {}); } catch (e) {  }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else setTimeout(boot, 0);
})(window.AideVisio = window.AideVisio || {});

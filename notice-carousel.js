(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const DEFAULT_NOTICE_CONFIG = {
    notice: {
      kicker: '',
      title: '',
      copy: '',
      nextLabel: '',
      replayLabel: '',
      emptyMediaLabel: '',
      imagePlaceholder: '',
      videoPlaceholder: '',
      buttonALabel: '',
      buttonBLabel: ''
    },
    items: []
  };
  const noticeState = { config: DEFAULT_NOTICE_CONFIG, index: 0, timer: null, revealed: false };

  function noticeScalar(value) {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) return raw.slice(1, -1).replace(/\\([\\"'])/g, '$1');
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    if (raw === 'null' || raw === '~') return null;
    if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
    if (raw.startsWith('[') || raw.startsWith('{')) {
      try { return JSON.parse(raw); } catch (_) { return raw; }
    }
    return raw;
  }

  function stripYamlComment(line) {
    let quote = null;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if ((char === '"' || char === "'") && line[i - 1] !== '\\') quote = quote === char ? null : (quote || char);
      if (char === '#' && !quote && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i);
    }
    return line;
  }

  function parseNoticeYaml(text) {
    const root = {};
    const stack = [{ indent: -1, value: root }];
    const lines = String(text || '').split(/\r?\n/).map(stripYamlComment).filter(line => line.trim());
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const indent = line.match(/^\s*/)[0].length;
      const content = line.trim();
      while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
      const parent = stack[stack.length - 1].value;
      if (content.startsWith('- ')) {
        if (!Array.isArray(parent)) continue;
        const itemText = content.slice(2).trim();
        if (!itemText) { const item = {}; parent.push(item); stack.push({ indent, value: item }); continue; }
        const separator = itemText.indexOf(':');
        if (separator > 0) {
          const item = {};
          parent.push(item);
          const key = itemText.slice(0, separator).trim();
          const valueText = itemText.slice(separator + 1).trim();
          if (valueText) item[key] = noticeScalar(valueText);
          else item[key] = {};
          stack.push({ indent, value: item });
          if (!valueText) stack.push({ indent: indent + 1, value: item[key] });
        } else parent.push(noticeScalar(itemText));
        continue;
      }
      const separator = content.indexOf(':');
      if (separator <= 0 || !parent || typeof parent !== 'object' || Array.isArray(parent)) continue;
      const key = content.slice(0, separator).trim();
      const valueText = content.slice(separator + 1).trim();
      if (valueText) { parent[key] = noticeScalar(valueText); continue; }
      const next = lines[index + 1];
      const nextIsList = next && next.match(/^\s*/)[0].length > indent && next.trim().startsWith('- ');
      parent[key] = nextIsList ? [] : {};
      stack.push({ indent, value: parent[key] });
    }
    return root;
  }

  function noticeConfigSource() {
    if (window.NOTICE_CONFIG && typeof window.NOTICE_CONFIG === 'object') return window.NOTICE_CONFIG;
    if (typeof window.NOTICE_CONFIG_YAML === 'string' && window.NOTICE_CONFIG_YAML.trim()) return parseNoticeYaml(window.NOTICE_CONFIG_YAML);
    const yamlNode = $('noticeConfigYaml');
    if (yamlNode?.textContent.trim()) return parseNoticeYaml(yamlNode.textContent);
    const jsonNode = $('noticeConfigJson');
    if (jsonNode?.textContent.trim()) {
      try { return JSON.parse(jsonNode.textContent); } catch (_) { return DEFAULT_NOTICE_CONFIG; }
    }
    return DEFAULT_NOTICE_CONFIG;
  }

  function normalizeNoticeItem(item, index) {
    const media = item?.media || {};
    const mediaSrc = typeof media === 'string' ? media : (media.src || item?.mediaUrl || '');
    const inferredType = typeof media === 'object' && media.type ? media.type : (/\.(mp4|webm|mov)(\?|$)/i.test(mediaSrc) ? 'video' : 'image');
    return {
      id: String(item?.id || `notice-${index + 1}`),
      title: item?.title || '',
      copy: item?.copy || '',
      media: {
        type: String(inferredType).toLowerCase() === 'video' ? 'video' : 'image',
        src: String(mediaSrc || '').trim(),
        alt: String(typeof media === 'object' ? (media.alt || item?.title || '') : (item?.title || '')),
        poster: String(typeof media === 'object' ? (media.poster || '') : '')
      },
      buttonA: item?.buttonA || item?.buttons?.[0] || null,
      buttonB: item?.buttonB || item?.buttons?.[1] || null
    };
  }

  function normalizeNoticeConfig(config) {
    const source = config && typeof config === 'object' ? config : DEFAULT_NOTICE_CONFIG;
    const notice = { ...DEFAULT_NOTICE_CONFIG.notice, ...(source.notice || {}) };
    const rawItems = Array.isArray(source.items) ? source.items : (Array.isArray(source.systems) ? source.systems : []);
    return { notice, items: rawItems.map(normalizeNoticeItem) };
  }

  function clearNoticeTimer() {
    if (noticeState.timer) { clearTimeout(noticeState.timer); noticeState.timer = null; }
  }

  function configureNoticeLink(anchor, action, fallbackLabel, fallbackClass) {
    if (!anchor) return;
    const label = String(action?.label || fallbackLabel || '');
    const href = String(action?.href || '').trim();
    anchor.textContent = label;
    anchor.className = `btn ${fallbackClass}`;
    anchor.hidden = !href;
    anchor.href = href || '#';
    anchor.target = action?.target || '_self';
    anchor.rel = anchor.target === '_blank' ? 'noopener noreferrer' : '';
    if (action?.ariaLabel) anchor.setAttribute('aria-label', action.ariaLabel);
  }

  function renderNoticeItem() {
    const config = noticeState.config;
    const items = config.items;
    const item = items[noticeState.index];
    const media = $('noticeMedia');
    const actions = $('noticeActions');
    const nav = $('noticeCarouselNav');
    clearNoticeTimer();
    noticeState.revealed = false;

    $('noticeKicker').textContent = config.notice.kicker;
    $('noticePanelTitle').textContent = item?.title || config.notice.title;
    $('noticeCopy').textContent = item?.copy || config.notice.copy;
    $('noticeNextBtn').textContent = config.notice.nextLabel;
    configureNoticeLink($('noticeButtonA'), item?.buttonA, config.notice.buttonALabel, 'primary');
    configureNoticeLink($('noticeButtonB'), item?.buttonB, config.notice.buttonBLabel, 'secondary');
    actions.classList.remove('is-visible');
    media.classList.add('hidden');
    media.classList.remove('is-revealed');
    media.replaceChildren();
    const placeholder = document.createElement('div');
    placeholder.className = 'notice-media-placeholder';
    placeholder.textContent = config.notice.emptyMediaLabel;
    media.appendChild(placeholder);

    const hasMultiple = items.length > 1;
    nav.classList.toggle('hidden', !hasMultiple);
    $('noticePrevItemBtn').disabled = !hasMultiple || noticeState.index === 0;
    $('noticeNextItemBtn').disabled = !hasMultiple || noticeState.index === items.length - 1;
    $('noticeCarouselStatus').textContent = hasMultiple ? `${noticeState.index + 1} of ${items.length}` : '';
  }

  function revealNoticeMedia() {
    const item = noticeState.config.items[noticeState.index];
    const media = $('noticeMedia');
    const actions = $('noticeActions');
    if (!item || !media) return;
    clearNoticeTimer();
    noticeState.revealed = true;
    $('noticeNextBtn').textContent = 'CLOSE';
    media.replaceChildren();
    const src = item.media.src;
    const usableSrc = src && !src.includes('PLACEHOLDER');
    if (!usableSrc) {
      const placeholder = document.createElement('div');
      placeholder.className = 'notice-media-placeholder';
      placeholder.textContent = item.media.type === 'video' ? noticeState.config.notice.videoPlaceholder : noticeState.config.notice.imagePlaceholder;
      media.appendChild(placeholder);
    } else if (item.media.type === 'video') {
      const video = document.createElement('video');
      video.src = src;
      video.controls = true;
      video.playsInline = true;
      video.preload = 'metadata';
      if (item.media.poster) video.poster = item.media.poster;
      media.appendChild(video);
    } else {
      const image = document.createElement('img');
      image.src = src;
      image.alt = item.media.alt;
      image.loading = 'lazy';
      media.appendChild(image);
    }
    media.classList.remove('hidden');
    requestAnimationFrame(() => media.classList.add('is-revealed'));
    const delay = item.media.type === 'video' ? 5000 : 2000;
    noticeState.timer = setTimeout(() => actions.classList.add('is-visible'), delay);
  }

  function moveNoticeItem(delta) {
    const nextIndex = noticeState.index + delta;
    if (nextIndex < 0 || nextIndex >= noticeState.config.items.length) return;
    noticeState.index = nextIndex;
    renderNoticeItem();
  }

  function collapseNoticeMedia() {
    if (!noticeState.revealed) return;
    renderNoticeItem();
  }

  function setNoticeConfig(config) {
    noticeState.config = normalizeNoticeConfig(config);
    noticeState.index = 0;
    renderNoticeItem();
  }

  function initializeNoticeCarousel() {
    setNoticeConfig(noticeConfigSource());
    window.setNoticeConfig = setNoticeConfig;
    window.setNoticeConfigYaml = yamlText => setNoticeConfig(parseNoticeYaml(yamlText));
  }


  async function loadExternalNoticeConfig() {
    if (window.NOTICE_CONFIG || window.NOTICE_CONFIG_YAML) return;
    try {
      const response = await fetch('notice-config.json', { cache: 'no-store' });
      if (response.ok) {
        setNoticeConfig(await response.json());
        return;
      }
    } catch (_) {}
    try {
      const response = await fetch('notice-config.yml', { cache: 'no-store' });
      if (response.ok) setNoticeConfig(parseNoticeYaml(await response.text()));
    } catch (_) {}
  }

  function initializeNoticeCarousel() {
    setNoticeConfig(noticeConfigSource());
    window.setNoticeConfig = setNoticeConfig;
    window.setNoticeConfigYaml = yamlText => setNoticeConfig(parseNoticeYaml(yamlText));
    loadExternalNoticeConfig();
  }

  window.noticeCarousel = {
    initialize: initializeNoticeCarousel,
    reveal: revealNoticeMedia,
    previous: () => moveNoticeItem(-1),
    next: () => moveNoticeItem(1),
    collapse: collapseNoticeMedia,
    toggle: () => (noticeState.revealed ? collapseNoticeMedia() : revealNoticeMedia()),
    setConfig: setNoticeConfig
  };
})();

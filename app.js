(() => {
  'use strict';
  const $ = id => document.getElementById(id);

  const customSelectInstances = new Set();
  const customSelectByElement = new WeakMap();

  function syncCustomSelect(select) {
    const widget = customSelectByElement.get(select);
    if (!widget) return;
    const selectedOption = select.options[select.selectedIndex];
    widget.triggerLabel.textContent = selectedOption?.textContent || select.getAttribute('aria-label') || 'Select an option';
    widget.trigger.disabled = select.disabled;
    widget.trigger.setAttribute('aria-expanded', String(widget.wrapper.classList.contains('is-open')));
    widget.menu.innerHTML = '';
    [...select.options].forEach((option, index) => {
      const optionButton = document.createElement('button');
      optionButton.type = 'button';
      optionButton.className = 'select-option';
      optionButton.id = `${widget.menu.id}-${index}`;
      optionButton.dataset.value = option.value;
      optionButton.dataset.index = String(index);
      optionButton.setAttribute('role', 'option');
      optionButton.setAttribute('aria-selected', String(option.selected));
      optionButton.disabled = option.disabled;
      optionButton.textContent = option.textContent;
      optionButton.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        if (!option.disabled) {
          select.value = option.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          syncCustomSelect(select);
          closeCustomSelect(widget, true);
        }
      });
      widget.menu.appendChild(optionButton);
    });
  }

  function focusCustomOption(widget, index) {
    const optionButtons = [...widget.menu.querySelectorAll('.select-option:not(:disabled)')];
    if (!optionButtons.length) return;
    const currentPosition = Math.max(0, optionButtons.findIndex(button => Number(button.dataset.index) === index));
    const optionButton = optionButtons[currentPosition];
    optionButtons.forEach(button => button.classList.toggle('is-highlighted', button === optionButton));
    widget.highlightedIndex = Number(optionButton.dataset.index);
    optionButton.focus({ preventScroll: true });
    optionButton.scrollIntoView({ block: 'nearest' });
  }

  function positionCustomSelect(widget) {
    if (!widget.wrapper.classList.contains('is-open')) return;
    const rect = widget.trigger.getBoundingClientRect();
    const gutter = 8;
    const gap = 6;
    const maxHeight = Math.min(280, Math.floor(window.innerHeight * 0.42));
    const spaceBelow = window.innerHeight - rect.bottom - gutter;
    const spaceAbove = rect.top - gutter;
    const openAbove = spaceBelow < Math.min(maxHeight, 180) && spaceAbove > spaceBelow;
    const availableHeight = Math.max(120, Math.min(maxHeight, openAbove ? spaceAbove - gap : spaceBelow - gap));
    const left = Math.max(gutter, Math.min(rect.left, window.innerWidth - rect.width - gutter));
    widget.menu.style.left = `${left}px`;
    widget.menu.style.right = 'auto';
    widget.menu.style.width = `${rect.width}px`;
    widget.menu.style.maxHeight = `${availableHeight}px`;
    widget.menu.style.top = openAbove ? 'auto' : `${rect.bottom + gap}px`;
    widget.menu.style.bottom = openAbove ? `${window.innerHeight - rect.top + gap}px` : 'auto';
  }

  function closeCustomSelect(widget, restoreFocus = false) {
    if (!widget.wrapper.classList.contains('is-open')) return;
    widget.wrapper.classList.remove('is-open');
    widget.trigger.setAttribute('aria-expanded', 'false');
    widget.menu.classList.remove('is-open');
    widget.menu.hidden = true;
    if (restoreFocus) widget.trigger.focus();
  }

  function openCustomSelect(widget) {
    if (widget.select.disabled) return;
    customSelectInstances.forEach(other => { if (other !== widget) closeCustomSelect(other); });
    widget.wrapper.classList.add('is-open');
    widget.menu.hidden = false;
    widget.menu.classList.add('is-open');
    widget.trigger.setAttribute('aria-expanded', 'true');
    positionCustomSelect(widget);
    requestAnimationFrame(() => focusCustomOption(widget, widget.select.selectedIndex));
  }

  function enhanceSelect(select) {
    if (!select || customSelectByElement.has(select)) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'custom-select';
    if (select.classList.contains('fs-select')) wrapper.classList.add('custom-select-dark');
    select.parentNode.insertBefore(wrapper, select);
    wrapper.appendChild(select);
    select.classList.add('select-source');

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = `select-trigger ${select.className.replace(/\bselect-source\b/g, '').trim()}`;
    trigger.setAttribute('role', 'combobox');
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', `${select.id}Options`);
    trigger.setAttribute('aria-label', select.getAttribute('aria-label') || 'Select an option');
    const triggerLabel = document.createElement('span');
    triggerLabel.className = 'select-trigger-label';
    trigger.appendChild(triggerLabel);

    const menu = document.createElement('div');
    menu.id = `${select.id}Options`;
    menu.className = 'select-menu';
    if (select.classList.contains('fs-select')) menu.classList.add('select-menu-dark');
    menu.setAttribute('role', 'listbox');
    menu.hidden = true;

    wrapper.insertBefore(trigger, select);
    document.body.appendChild(menu);
    const widget = { select, wrapper, trigger, triggerLabel, menu, highlightedIndex: select.selectedIndex };
    customSelectInstances.add(widget);
    customSelectByElement.set(select, widget);

    trigger.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      if (wrapper.classList.contains('is-open')) closeCustomSelect(widget, true);
      else openCustomSelect(widget);
    });
    trigger.addEventListener('keydown', event => {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' ', 'Escape'].includes(event.key)) event.preventDefault();
      if (event.key === 'Escape') closeCustomSelect(widget, true);
      else if (event.key === 'ArrowDown') {
        if (!wrapper.classList.contains('is-open')) openCustomSelect(widget);
        else focusCustomOption(widget, widget.highlightedIndex + 1);
      } else if (event.key === 'ArrowUp') {
        if (!wrapper.classList.contains('is-open')) openCustomSelect(widget);
        else focusCustomOption(widget, widget.highlightedIndex - 1);
      } else if (event.key === 'Enter' || event.key === ' ') {
        if (wrapper.classList.contains('is-open')) closeCustomSelect(widget, true);
        else openCustomSelect(widget);
      }
    });
    menu.addEventListener('keydown', event => {
      const optionButtons = [...menu.querySelectorAll('.select-option:not(:disabled)')];
      if (event.key === 'Escape') {
        event.preventDefault();
        closeCustomSelect(widget, true);
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const direction = event.key === 'ArrowDown' ? 1 : -1;
        const current = optionButtons.findIndex(button => Number(button.dataset.index) === widget.highlightedIndex);
        const next = (current + direction + optionButtons.length) % optionButtons.length;
        focusCustomOption(widget, Number(optionButtons[next].dataset.index));
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        focusCustomOption(widget, Number(optionButtons[event.key === 'Home' ? 0 : optionButtons.length - 1].dataset.index));
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.target.click();
      }
    });
    select.addEventListener('change', () => syncCustomSelect(select));
    new MutationObserver(() => syncCustomSelect(select)).observe(select, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'label'] });
    syncCustomSelect(select);
  }

  function setupCustomSelects() {
    document.querySelectorAll('select').forEach(enhanceSelect);
    if (setupCustomSelects.bound) return;
    setupCustomSelects.bound = true;
    document.addEventListener('click', event => {
      customSelectInstances.forEach(widget => {
        if (!widget.wrapper.contains(event.target) && !widget.menu.contains(event.target)) closeCustomSelect(widget);
      });
    });
    const repositionOpenMenus = () => customSelectInstances.forEach(positionCustomSelect);
    window.addEventListener('resize', repositionOpenMenus);
    window.addEventListener('scroll', repositionOpenMenus, true);
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') customSelectInstances.forEach(widget => closeCustomSelect(widget));
    });
  }

  const API_BASE_URL = 'https://sudoku-api.miriqbalhub.workers.dev/'.replace(/\/+$/,'');
  const state = {
    puzzle: null,
    givens: Array(81).fill(0),
    solution: Array(81).fill(0),
    values: Array(81).fill(0),
    notes: Array.from({length:81},()=>new Set()),
    selected: -1,
    notesMode: false,
    revealPencilMarks: false,
    mistakes: 0,
    wrong: new Set(),
    conflicts: new Set(),
    startedAt: null,
    timer: null,
    elapsed: 0,
    finished: false,
    currentPuzzleCode: null,
    currentPuzzleRecord: null,
    status: 'Not Started',
    solutionShown: false,
    preSolutionValues: null,
    preSolutionNotes: null,
    /* FIX 2 State */
    fsActive: false,
    fsZoom: 1.0,
    fsGridIndex: 'all',
    fsPanX: 0,
    fsPanY: 0,
    fsDragging: false,
    fsDragStart: { x: 0, y: 0 },
    fsPanStart: { x: 0, y: 0 },
    fsPointers: new Map(),
    fsPinchStartDistance: 0,
    fsPinchStartZoom: 1
  };

  let deferredInstallPrompt = null;

  function setInstallButtonVisible(visible) {
    const button = $('installAppBtn');
    if (!button) return;
    button.classList.toggle('hidden', !visible);
  }

  function setupPwa() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(() => {
          // The app remains fully usable if service-worker registration is unavailable.
        });
      }, { once: true });
    }

    window.addEventListener('beforeinstallprompt', event => {
      event.preventDefault();
      deferredInstallPrompt = event;
      setInstallButtonVisible(true);
    });

    window.addEventListener('appinstalled', () => {
      deferredInstallPrompt = null;
      setInstallButtonVisible(false);
      toast('Lovdoku was installed successfully.');
    });

    $('installAppBtn')?.addEventListener('click', async () => {
      if (!deferredInstallPrompt) {
        toast('Use your browser menu to install Lovdoku.');
        return;
      }
      setInstallButtonVisible(false);
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
    });
  }

  const STORAGE_KEYS = {
    progress: 'lovdoku.progress.v1',
    recentPuzzles: 'lovdoku.recent-puzzles.v1',
    likedPuzzles: 'lovdoku.liked-puzzles.v1',
    puzzleCache: 'lovdoku.puzzle-cache.v1',
    librarySnapshot: 'lovdoku.library-snapshot.v1',
    fontSettings: 'lovdoku.font-settings.v1',
    solutionWarnings: 'lovdoku.solution-warnings.v1',
    storageMaintenance: 'lovdoku.storage-maintenance.v1'
  };
  const RECENT_CACHE_LIMIT = 5;
  const LIBRARY_BATCH_LIMIT = 20;
  const LIBRARY_PAGE_SIZE = 5;
  const LIBRARY_CACHE_TTL_MS = 15 * 60 * 1000;
  const PUZZLE_CACHE_LIMIT = 50;
  const PROGRESS_WRITE_INTERVAL_MS = 15 * 1000;
  const PROGRESS_RETENTION_MS = 12 * 60 * 60 * 1000;
  const PROGRESS_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
  const MAX_LIKED_PUZZLES = 25;
  let progressCleanupTimer = null;
  let libraryItems = [];
  let libraryOffset = 0;
  let libraryVisibleCount = LIBRARY_PAGE_SIZE;
  let libraryHasMore = false;
  let libraryLoading = false;
  let libraryRequestId = 0;
  let showingLiked = false;
  const removedPuzzleCodes = new Set();

  const defaultFontSettings = {
    family: "'Plus Jakarta Sans', sans-serif",
    sizePct: 70,
    weight: '700',
    entryColor: '#1d4ed8',
    notesPct: 20
  };
  let fontSettings = {...defaultFontSettings};

  function loadFontSettings() {
    const saved = readStorage(STORAGE_KEYS.fontSettings, null);
    fontSettings = {...defaultFontSettings};
    if (saved && typeof saved === 'object') {
      fontSettings.family = saved.family || defaultFontSettings.family;
      fontSettings.weight = String(saved.weight || defaultFontSettings.weight);
      fontSettings.entryColor = /^#[0-9a-f]{6}$/i.test(saved.entryColor || '') ? saved.entryColor : defaultFontSettings.entryColor;
    }
    applyFontSettings();
  }

  function saveFontSettings() {
    writeStorage(STORAGE_KEYS.fontSettings, {...fontSettings, sizeDefaultVersion: 2});
    applyFontSettings();
  }

  function applyFontSettings() {
    document.documentElement.style.setProperty('--board-font-family', fontSettings.family);
    document.documentElement.style.setProperty('--board-font-weight', fontSettings.weight);
    document.documentElement.style.setProperty('--cell-font-pct', fontSettings.sizePct);
    document.documentElement.style.setProperty('--entry', fontSettings.entryColor);
    document.documentElement.style.setProperty('--notes-font-scale', String(fontSettings.notesPct / 100));
    
    if ($('fontFamilySelect')) $('fontFamilySelect').value = fontSettings.family;
    if ($('fontWeightSelect')) $('fontWeightSelect').value = fontSettings.weight;
    if ($('entryColorSelect')) $('entryColorSelect').value = fontSettings.entryColor;
    syncCustomSelect($('fontFamilySelect'));
    syncCustomSelect($('fontWeightSelect'));
    syncCustomSelect($('entryColorSelect'));

    updateCellFontSizePx();
    updateFontPreviewCell();
  }

  function updateCellFontSizePx() {
    const board = $('board');
    if (!board) return;
    const firstCell = board.querySelector('.cell:not(.blank)');
    let cellHeight = 0;
    if (firstCell && firstCell.clientHeight > 0) {
      cellHeight = firstCell.clientHeight;
    } else if (board.clientWidth > 0) {
      cellHeight = board.clientWidth / 9;
    }
    
    if (cellHeight > 0) {
      const cellWidth = firstCell?.getBoundingClientRect().width || cellHeight;
      document.documentElement.style.setProperty('--cell-size-px', `${cellHeight}px`);
      const requestedPx = cellHeight * (fontSettings.sizePct / 100);
      const computedPx = Math.max(8, Math.min(requestedPx, cellHeight * 0.8, cellWidth * 0.82));
      document.documentElement.style.setProperty('--cell-font-size-px', `${computedPx}px`);
    }
  }

  function updateFontPreviewCell() {
    const cell = $('fontPreviewCell');
    const notes = $('fontPreviewNotes');
    if (cell) {
      cell.style.fontFamily = fontSettings.family;
      cell.style.fontWeight = fontSettings.weight;
      cell.style.color = fontSettings.entryColor;
      const px = 64 * (fontSettings.sizePct / 100);
      cell.style.fontSize = `${px}px`;
    }
    if (notes) {
      notes.style.fontFamily = fontSettings.family;
      notes.style.fontWeight = fontSettings.weight;
      notes.style.color = fontSettings.entryColor;
      notes.style.setProperty('--preview-notes-size', `${64 * (fontSettings.notesPct / 100)}px`);
    }
  }

  function resetBoardAppearance() {
    document.documentElement.style.removeProperty('--given');
    document.documentElement.style.removeProperty('--entry');
    applyFontSettings();
  }

  function applyPuzzleAppearance(puzzle) {
    const colors = puzzle?.colors || {};
    const settings = puzzle?.settings || {};
    if (colors.gridLine) document.documentElement.style.setProperty('--thick-line-color', colors.gridLine);
    if (colors.puzzleNumbers) document.documentElement.style.setProperty('--given', colors.puzzleNumbers);
    if (settings.lineColor) document.documentElement.style.setProperty('--thick-line-color', settings.lineColor);
    document.documentElement.style.setProperty('--thin-line-color', '#cbd5e1');
    if (settings.puzzleNumberColor) document.documentElement.style.setProperty('--given', settings.puzzleNumberColor);
    if (Number.isFinite(Number(settings.thinLineWidth))) document.documentElement.style.setProperty('--thin-line-width', `${Number(settings.thinLineWidth)}px`);
    if (Number.isFinite(Number(settings.thickLineWidth))) document.documentElement.style.setProperty('--thick-line-width', `${Number(settings.thickLineWidth)}px`);
    if (settings.thickLineColor) document.documentElement.style.setProperty('--thick-line-color', settings.thickLineColor);
  }

  const IDB_NAME='lovdoku';
  const IDB_VERSION=3;
  const IDB_STORE='kv';
  const IDB_PUZZLE_STORE='puzzles';
  let idbDatabase=null;
  let storageBackend='localStorage';
  const storageMemory=Object.create(null);
  const storageSerialized=Object.create(null);

  function localStorageRead(key){try{const raw=localStorage.getItem(key);return raw===null?undefined:JSON.parse(raw)}catch(_){return undefined}}
  function localStorageWrite(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch(_){return false}}
  function openStorageDatabase(){
    return new Promise((resolve,reject)=>{
      if(typeof indexedDB==='undefined'){reject(new Error('IndexedDB is unavailable.'));return}
      const request=indexedDB.open(IDB_NAME,IDB_VERSION);
      request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(IDB_STORE))db.createObjectStore(IDB_STORE,{keyPath:'key'});if(!db.objectStoreNames.contains(IDB_PUZZLE_STORE))db.createObjectStore(IDB_PUZZLE_STORE,{keyPath:'code'})};
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error||new Error('IndexedDB could not be opened.'));
      request.onblocked=()=>reject(new Error('IndexedDB is blocked.'));
    });
  }
  function idbReadAll(db,storeName=IDB_STORE){
    return new Promise((resolve,reject)=>{
      const request=db.transaction(storeName,'readonly').objectStore(storeName).getAll();
      request.onsuccess=()=>resolve(request.result||[]);
      request.onerror=()=>reject(request.error||new Error('IndexedDB read failed.'));
    });
  }
  function idbUpdatePuzzleRows(entries=[],deletedCodes=[]){
    if(!idbDatabase)return Promise.reject(new Error('IndexedDB is unavailable.'));
    return new Promise((resolve,reject)=>{
      const transaction=idbDatabase.transaction(IDB_PUZZLE_STORE,'readwrite');
      const store=transaction.objectStore(IDB_PUZZLE_STORE);
      deletedCodes.forEach(code=>store.delete(code));
      entries.forEach(entry=>store.put({code:entry.code,value:entry.value}));
      transaction.oncomplete=()=>resolve(true);
      transaction.onerror=()=>reject(transaction.error||new Error('Puzzle cache update failed.'));
      transaction.onabort=()=>reject(transaction.error||new Error('Puzzle cache update aborted.'));
    });
  }
  function idbDeleteKey(key){
    if(!idbDatabase)return Promise.reject(new Error('IndexedDB is unavailable.'));
    return new Promise((resolve,reject)=>{
      const transaction=idbDatabase.transaction(IDB_STORE,'readwrite');
      transaction.objectStore(IDB_STORE).delete(key);
      transaction.oncomplete=()=>resolve(true);
      transaction.onerror=()=>reject(transaction.error||new Error('IndexedDB key deletion failed.'));
      transaction.onabort=()=>reject(transaction.error||new Error('IndexedDB key deletion aborted.'));
    });
  }
  function idbReplaceAll(kvRows=[],puzzleRows=[]){
    return new Promise((resolve,reject)=>{
      const request=indexedDB.deleteDatabase(IDB_NAME);
      request.onerror=()=>reject(request.error||new Error('IndexedDB compaction failed.'));
      request.onblocked=()=>reject(new Error('IndexedDB compaction was blocked.'));
      request.onsuccess=()=>{
        const openRequest=indexedDB.open(IDB_NAME,IDB_VERSION);
        openRequest.onupgradeneeded=()=>{const db=openRequest.result;if(!db.objectStoreNames.contains(IDB_STORE))db.createObjectStore(IDB_STORE,{keyPath:'key'});if(!db.objectStoreNames.contains(IDB_PUZZLE_STORE))db.createObjectStore(IDB_PUZZLE_STORE,{keyPath:'code'})};
        openRequest.onerror=()=>reject(openRequest.error||new Error('IndexedDB recreation failed.'));
        openRequest.onsuccess=()=>{
          const db=openRequest.result;
          const transaction=db.transaction([IDB_STORE,IDB_PUZZLE_STORE],'readwrite');
          const kvStore=transaction.objectStore(IDB_STORE),puzzleStore=transaction.objectStore(IDB_PUZZLE_STORE);
          kvRows.forEach(row=>kvStore.put(row));
          puzzleRows.forEach(row=>puzzleStore.put(row));
          transaction.oncomplete=()=>{idbDatabase=db;resolve(true)};
          transaction.onerror=()=>{try{db.close()}catch(_){};reject(transaction.error||new Error('IndexedDB compaction write failed.'))};
          transaction.onabort=()=>{try{db.close()}catch(_){};reject(transaction.error||new Error('IndexedDB compaction write aborted.'))};
        };
      };
    });
  }
  function idbWrite(key,value){
    if(!idbDatabase)return Promise.reject(new Error('IndexedDB is unavailable.'));
    return new Promise((resolve,reject)=>{
      const transaction=idbDatabase.transaction(IDB_STORE,'readwrite');
      transaction.objectStore(IDB_STORE).put({key,value});
      transaction.oncomplete=()=>resolve(true);
      transaction.onerror=()=>reject(transaction.error||new Error('IndexedDB write failed.'));
      transaction.onabort=()=>reject(transaction.error||new Error('IndexedDB write aborted.'));
    });
  }
  async function initStorage(){
    const keys=Object.values(STORAGE_KEYS);
    try{
      const db=await openStorageDatabase();
      const rows=await idbReadAll(db,IDB_STORE);
      const puzzleRows=await idbReadAll(db,IDB_PUZZLE_STORE);
      idbDatabase=db;
      storageBackend='indexedDB';
      rows.forEach(row=>{if(row&&typeof row.key==='string'){storageMemory[row.key]=row.value;storageSerialized[row.key]=JSON.stringify(row.value)}});
      for(const key of keys){
        if(Object.prototype.hasOwnProperty.call(storageMemory,key)){try{localStorage.removeItem(key)}catch(_){};continue}
        const legacy=localStorageRead(key);
        if(legacy===undefined)continue;
        storageMemory[key]=legacy;
        storageSerialized[key]=JSON.stringify(legacy);
        try{await idbWrite(key,legacy);try{localStorage.removeItem(key)}catch(_){}}catch(_){storageBackend='localStorage';break}
      }
      const existingCache=readStorage(STORAGE_KEYS.puzzleCache,{})||{};
      puzzleRows.forEach(row=>{if(row&&typeof row.code==='string'&&row.value)existingCache[row.code]=row.value});
      const prunedCache=prunePuzzleCache(existingCache);
      storageMemory[STORAGE_KEYS.puzzleCache]=prunedCache;
      storageSerialized[STORAGE_KEYS.puzzleCache]=JSON.stringify(prunedCache);
      try{
        const entries=Object.entries(prunedCache).map(([code,value])=>({code,value}));
        const removedCodes=Object.keys(existingCache).filter(code=>!prunedCache[code]);
        await idbUpdatePuzzleRows(entries,removedCodes);
        await idbDeleteKey(STORAGE_KEYS.puzzleCache);
      }catch(_){}
      try{localStorage.removeItem(STORAGE_KEYS.puzzleCache)}catch(_){}
      if(storageMemory[STORAGE_KEYS.storageMaintenance]!=='idb-v3-compacted'&&idbDatabase){
        const kvRows=Object.entries(storageMemory).filter(([key,value])=>key!==STORAGE_KEYS.puzzleCache&&key!==STORAGE_KEYS.storageMaintenance&&value!==undefined).map(([key,value])=>({key,value}));
        kvRows.push({key:STORAGE_KEYS.storageMaintenance,value:'idb-v3-compacted'});
        const puzzleRows=Object.entries(prunedCache).map(([code,value])=>({code,value}));
        try{
          idbDatabase.close();
          idbDatabase=null;
          await idbReplaceAll(kvRows,puzzleRows);
          storageBackend='indexedDB';
          storageMemory[STORAGE_KEYS.storageMaintenance]='idb-v3-compacted';
          storageSerialized[STORAGE_KEYS.storageMaintenance]=JSON.stringify('idb-v3-compacted');
        }catch(_){
          try{idbDatabase=await openStorageDatabase();storageBackend='indexedDB'}catch(__){storageBackend='localStorage';kvRows.forEach(row=>localStorageWrite(row.key,row.value));puzzleRows.forEach(row=>localStorageWrite(`${STORAGE_KEYS.puzzleCache}.${row.code}`,row.value))}
        }
      }
      const existingRecent=readStorage(STORAGE_KEYS.recentPuzzles,null);
      const compactRecent=compactRecentItems(existingRecent);
      if(Array.isArray(existingRecent)&&JSON.stringify(existingRecent)!==JSON.stringify(compactRecent))writeStorage(STORAGE_KEYS.recentPuzzles,compactRecent);
    }catch(_){
      storageBackend='localStorage';
      keys.forEach(key=>{const legacy=localStorageRead(key);if(legacy!==undefined)storageMemory[key]=legacy});
    }
  }
  function readStorage(key,fallback){return Object.prototype.hasOwnProperty.call(storageMemory,key)?storageMemory[key]:fallback}
  function writeStorage(key,value){
    const serialized=JSON.stringify(value);
    storageMemory[key]=value;
    if(storageSerialized[key]===serialized)return true;
    storageSerialized[key]=serialized;
    if(storageBackend==='indexedDB'){
      idbWrite(key,value).catch(()=>{storageBackend='localStorage';localStorageWrite(key,value)});
      return true;
    }
    return localStorageWrite(key,value);
  }
  function getProgressStore(){const value=readStorage(STORAGE_KEYS.progress,{});return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}
  function getProgress(code){const normalized=normalizeCode(code);const store=getProgressStore();const progress=store[normalized]||null;if(progressExpired(normalized,progress)){delete store[normalized];writeStorage(STORAGE_KEYS.progress,store);return null}return progress}
  function getSolutionWarningStore(){const value=readStorage(STORAGE_KEYS.solutionWarnings,{});return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}
  function solutionWarningAcknowledged(code){return Boolean(code&&getSolutionWarningStore()[code])}
  function acknowledgeSolutionWarning(code){if(!code)return;const store=getSolutionWarningStore();store[code]=true;writeStorage(STORAGE_KEYS.solutionWarnings,store)}
  function puzzleCodeOf(record){return normalizeCode(record?.puzzle_number||record?.puzzleNumber||record?.code)}
  function getLikedPuzzleStore(){const value=readStorage(STORAGE_KEYS.likedPuzzles,{});return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}
  function getLikedPuzzles(){return Object.values(getLikedPuzzleStore()).filter(record=>puzzleCodeOf(record))}
  function isLiked(code){return Boolean(getLikedPuzzleStore()[normalizeCode(code)])}
  function progressExpired(code,record,now=Date.now()){const updatedAt=Number(record?.updatedAt)||0;return Boolean(record&&!isLiked(code)&&(updatedAt<=0||now-updatedAt>=PROGRESS_RETENTION_MS))}
  function cleanupExpiredUnlikedProgress({now=Date.now()}={}){
    const store=getProgressStore();let changed=false;
    Object.entries(store).forEach(([code,record])=>{if(progressExpired(code,record,now)){delete store[code];changed=true}});
    if(changed)writeStorage(STORAGE_KEYS.progress,store);
    return changed;
  }
  function enforceLikedPuzzleLimit(){
    const store=getLikedPuzzleStore();
    const entries=Object.entries(store).filter(([code,record])=>validCode(normalizeCode(code))&&record&&typeof record==='object');
    entries.sort(([,a],[,b])=>Number(b?.likedAt||b?.updatedAt||0)-Number(a?.likedAt||a?.updatedAt||0));
    const trimmed=Object.fromEntries(entries.slice(0,MAX_LIKED_PUZZLES));
    if(JSON.stringify(trimmed)!==JSON.stringify(store))saveLikedPuzzleStore(trimmed);
    return trimmed;
  }
  function forgetPuzzleFromLocalStorage(code){
    const normalized=normalizeCode(code);if(!normalized)return;
    const liked=getLikedPuzzleStore();delete liked[normalized];saveLikedPuzzleStore(liked);
    const recent=readStorage(STORAGE_KEYS.recentPuzzles,[]);
    if(Array.isArray(recent))writeStorage(STORAGE_KEYS.recentPuzzles,recent.filter(record=>puzzleCodeOf(record)!==normalized));
    const cache=getPuzzleCache();delete cache[normalized];savePuzzleCache(cache,[],[normalized]);
    const progress=getProgressStore();delete progress[normalized];writeStorage(STORAGE_KEYS.progress,progress);
    removedPuzzleCodes.delete(normalized);
    libraryItems=showingLiked?getLikedPuzzles():libraryItems.filter(record=>puzzleCodeOf(record)!==normalized);
    renderLibrary();
    updateCurrentLikeButton();
    toast(`Removed ${normalized} from local storage.`);
  }
  function saveLikedPuzzleStore(value){return writeStorage(STORAGE_KEYS.likedPuzzles,value)}
  
  function updateCurrentLikeButton(){
    const button=$('currentLikeBtn');
    const code=state.currentPuzzleCode;
    if(!button) return;
    const info=button.querySelector('#likeInfoBtn');
    if (!code) {
      button.classList.remove('liked');
      button.textContent = '♡ Like ';
      if(info) button.appendChild(info);
      return;
    }
    const liked=isLiked(code);
    button.classList.toggle('liked',liked);
    button.textContent=liked?'♥ Liked ':'♡ Like ';
    if(info) button.appendChild(info);
    button.title=liked?'Remove from liked puzzles':'Add to liked puzzles';
    button.setAttribute('aria-label',button.title);
  }

  async function toggleLike(record){
    const code=puzzleCodeOf(record);
    if(!code)return;
    const liked=getLikedPuzzleStore();
    const wasLiked=Boolean(liked[code]);
    if(!wasLiked&&Object.keys(liked).length>=MAX_LIKED_PUZZLES){
      await showAppDialog({kicker:'Liked puzzles',title:'25-puzzle limit reached',message:'You can like up to 25 Sudoku puzzles. Remove a liked puzzle before adding another one.',confirmLabel:'Got it',showCancel:false});
      return;
    }
    if(wasLiked) delete liked[code];
    else liked[code]={...record,puzzle_number:code,likedAt:Date.now(),puzzle:state.puzzle?.raw||record.puzzle||getCachedPuzzlePayload(code)?.puzzle||null};
    if(!saveLikedPuzzleStore(liked))return;
    if(showingLiked) libraryItems=getLikedPuzzles();
    renderLibrary();
    updateCurrentLikeButton();
  }

  function compactRecentItems(items){return Array.isArray(items)?items.slice(0,RECENT_CACHE_LIMIT).map(({puzzle,...record})=>record):[]}
  function cacheRecentPuzzles(items){const recent=compactRecentItems(items);if(recent.length)writeStorage(STORAGE_KEYS.recentPuzzles,recent)}
  function getCachedRecentPuzzles(){
    const cached=readStorage(STORAGE_KEYS.recentPuzzles,[]);
    if(Array.isArray(cached)&&cached.length)return cached.slice(0,RECENT_CACHE_LIMIT);
    const fallback=Object.values(getPuzzleCache()).sort((a,b)=>Number(b?.updatedAt||0)-Number(a?.updatedAt||0)).map(entry=>entry?.record).filter(record=>puzzleCodeOf(record));
    return fallback.slice(0,RECENT_CACHE_LIMIT);
  }
  function getPuzzleCache(){const value=readStorage(STORAGE_KEYS.puzzleCache,{});return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}
  function prunePuzzleCache(cache){const entries=Object.entries(cache&&typeof cache==='object'&&!Array.isArray(cache)?cache:{});entries.sort(([,a],[,b])=>Number(b?.updatedAt||0)-Number(a?.updatedAt||0));return Object.fromEntries(entries.slice(0,PUZZLE_CACHE_LIMIT))}
  function savePuzzleCache(cache,changedCodes=[],removedCodes=[]){const pruned=prunePuzzleCache(cache);storageMemory[STORAGE_KEYS.puzzleCache]=pruned;const removed=new Set([...removedCodes,...Object.keys(cache||{}).filter(code=>!pruned[code])]);if(storageBackend==='indexedDB'&&idbDatabase?.objectStoreNames.contains(IDB_PUZZLE_STORE)){storageSerialized[STORAGE_KEYS.puzzleCache]=JSON.stringify(pruned);const entries=changedCodes.map(code=>({code,value:pruned[code]})).filter(entry=>entry.value);idbUpdatePuzzleRows(entries,[...removed]).catch(()=>{storageBackend='localStorage';localStorageWrite(STORAGE_KEYS.puzzleCache,pruned)});return true}return writeStorage(STORAGE_KEYS.puzzleCache,pruned)}
  function getCachedPuzzlePayload(code){return getPuzzleCache()[normalizeCode(code)]||null}
  function cachePuzzlePayload(code,puzzle,record){if(!code||!puzzle)return;const normalized=normalizeCode(code);const cache=getPuzzleCache();cache[normalized]={code:normalized,record:{...(record||{}),puzzle_number:normalized},puzzle,updatedAt:Date.now()};savePuzzleCache(cache,[normalized])}
  function currentDayKey(){return new Date().toISOString().slice(0,10)}
  function getFreshLibrarySnapshot(){const snapshot=readStorage(STORAGE_KEYS.librarySnapshot,null);if(!snapshot||snapshot.dayKey!==currentDayKey()||Date.now()-Number(snapshot.fetchedAt||0)>LIBRARY_CACHE_TTL_MS||!Array.isArray(snapshot.items)||!snapshot.items.length)return null;return snapshot}
  function cacheLibrarySnapshot(items,offset,hasMore,nextOffset){const compactItems=(items||[]).map(({puzzle,...record})=>record);writeStorage(STORAGE_KEYS.librarySnapshot,{dayKey:currentDayKey(),fetchedAt:Date.now(),items:compactItems,offset,hasMore,nextOffset})}
  function cacheBatchPuzzlePayloads(items){const cache=getPuzzleCache(),changed=[];(items||[]).forEach(item=>{const code=puzzleCodeOf(item);if(code&&item?.puzzle){cache[code]={code,record:{...item,puzzle_number:code},puzzle:item.puzzle,updatedAt:Date.now()};changed.push(code)}});if(changed.length)savePuzzleCache(cache,changed)}
  function getLoadedBatchRecords(){
    const snapshot=getFreshLibrarySnapshot();
    const candidates=[...(snapshot?.items||[]),...(Array.isArray(libraryItems)?libraryItems:[])];
    const seen=new Set();
    return candidates.map(record=>{
      const code=puzzleCodeOf(record);
      if(!code||seen.has(code))return null;
      seen.add(code);
      const cached=getCachedPuzzlePayload(code);
      return record?.puzzle||!cached?.puzzle?record:{...record,puzzle:cached.puzzle};
    }).filter(Boolean);
  }
  function matchesLibraryFilters(record){
    const difficulty=$('difficultyFilter').value;
    const gridType=$('gridTypeFilter').value;
    const gridCount=$('gridCountFilter').value;
    const constraint=$('constraintFilter').value.trim().toLowerCase();
    return (!difficulty||record.difficulty===difficulty)&&(!gridType||record.grid_type===gridType)&&(!gridCount||String(record.grid_count||1)===String(gridCount))&&(!constraint||String(record.constraint_type||'').toLowerCase().includes(constraint));
  }
  function applyFiltersLocalFirst(){
    const candidates=getLoadedBatchRecords();
    if(!candidates.length){fetchLibrary({reset:true});return}
    const hasFilter=Boolean($('difficultyFilter').value||$('gridTypeFilter').value||$('gridCountFilter').value||$('constraintFilter').value.trim());
    const matches=candidates.filter(matchesLibraryFilters);
    if(!matches.length&&hasFilter){fetchLibrary({reset:true});return}
    showingLiked=false;libraryItems=matches;libraryOffset=matches.length;libraryHasMore=false;libraryVisibleCount=LIBRARY_PAGE_SIZE;renderLibrary();$('libraryStatus').textContent=matches.length?`${Math.min(libraryVisibleCount,matches.length)} of ${matches.length} loaded puzzle${matches.length===1?'':'s'} match.`:'No puzzles match these filters.';updateLoadMoreButton();
  }
  function updateLoadMoreButton(){const button=$('loadMoreBtn');if(!button)return;const selectedStatus=$('statusFilter')?.value||'';const filteredCount=libraryItems.filter(record=>!selectedStatus||progressStatusFor(record.puzzle_number)===selectedStatus).length;const hasMatches=filteredCount>0;const canReveal=!showingLiked&&hasMatches&&filteredCount>libraryVisibleCount;const canFetch=!showingLiked&&hasMatches&&libraryHasMore;button.classList.toggle('hidden',!(canReveal||canFetch));button.disabled=libraryLoading}
  function renderCachedLibraryImmediately(){
    const snapshot=getFreshLibrarySnapshot();
    if(!snapshot)return false;
    libraryItems=snapshot.items;
    libraryOffset=Number(snapshot.offset||snapshot.items.length);
    libraryHasMore=Boolean(snapshot.hasMore);
    libraryVisibleCount=LIBRARY_PAGE_SIZE;
    renderLibrary();
    return true;
  }

  function isRecentRequest(reset){return Boolean(reset&&!$('difficultyFilter').value&&!$('gridTypeFilter').value&&!$('gridCountFilter').value&&!$('constraintFilter').value.trim())}
  function normalizeCode(value){return String(value||'').trim().toUpperCase()}
  function toast(message,duration=1500){const el=$('toast');if(!el)return;el.textContent=message;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),duration)}
  let appDialogResolver=null;
  function resolveAppDialog(confirmed){
    const resolver=appDialogResolver;if(!resolver)return;
    appDialogResolver=null;
    const modal=$('appDialog');
    modal?.classList.remove('open', 'in-fullscreen');modal?.setAttribute('aria-hidden','true');
    syncPopupScrollLock();
    resolver({confirmed});
  }
  function showAppDialog({kicker='Lovdoku',title='Please confirm',message='',confirmLabel='Continue',cancelLabel='Cancel',showCancel=true}={}){
    const modal=$('appDialog');
    if(!modal)return Promise.resolve({confirmed:window.confirm(message)});
    $('appDialogKicker').textContent=kicker;
    $('appDialogTitle').textContent=title;
    $('appDialogMessage').textContent=message;
    $('appDialogConfirm').textContent=confirmLabel;
    $('appDialogCancel').textContent=cancelLabel;
    $('appDialogCancel').classList.toggle('hidden',!showCancel);
    modal.classList.toggle('in-fullscreen', Boolean(state.fsActive));
    modal.classList.add('open');modal.setAttribute('aria-hidden','false');syncPopupScrollLock();
    setTimeout(()=>$('appDialogConfirm')?.focus(),0);
    return new Promise(resolve=>{appDialogResolver=resolve});
  }
  function validCode(code){return /^[A-Z]\d{4}$/.test(code)}

  function liveElapsed(){if(!state.startedAt||state.finished)return Math.max(0,state.elapsed);return Math.max(state.elapsed,Math.floor((Date.now()-state.startedAt)/1000));}
  function currentProgressRecord(){if(!state.currentPuzzleCode||!state.puzzle)return null;return {code:state.currentPuzzleCode,values:[...state.values],notes:state.notes.map(set=>[...set]),elapsed:liveElapsed(),mistakes:state.mistakes,status:state.status,updatedAt:Date.now()}}
  function hasPlayerEntries(){return Boolean(state.puzzle&&state.values.some((v,i)=>!state.givens[i]&&v));}
  function restoreProgress(progress){if(!progress)return;state.values=Array.from({length:state.puzzle.total},(_,i)=>state.givens[i]?state.givens[i]:num(progress.values?.[i]));state.notes=Array.from({length:state.puzzle.total},(_,i)=>new Set(Array.isArray(progress.notes?.[i])?progress.notes[i].map(num).filter(Boolean):[]));state.elapsed=hasPlayerEntries()?Math.max(0,Number(progress.elapsed)||0):0;state.mistakes=Math.max(0,Number(progress.mistakes)||0);state.status=['Not Started','In Progress','Solved'].includes(progress.status)?progress.status:(hasPlayerEntries()?'In Progress':'Not Started');if(!hasPlayerEntries()&&state.status!=='Solved')state.status='Not Started';state.finished=state.status==='Solved'}
  function syncStatusAfterChange(){state.finished=false;state.status=isSolved()?'Solved':'In Progress';if(state.status==='Solved')state.finished=true;persistProgress();renderLibrary()}
  let lastProgressWriteAt=0;
  function persistProgress({immediate=true}={}){if(!state.currentPuzzleCode||!state.puzzle)return;const now=Date.now();if(!immediate&&now-lastProgressWriteAt<PROGRESS_WRITE_INTERVAL_MS)return;lastProgressWriteAt=now;const progress=getProgressStore();progress[state.currentPuzzleCode]=currentProgressRecord();writeStorage(STORAGE_KEYS.progress,progress)}
  function setStatusFromState(){if(state.status==='Solved')setStatus('Solved','Puzzle complete — every required cell is correct.','ok');else if(state.status==='In Progress')setStatus('In Progress','Your progress is being saved automatically.','');else setStatus('Not Started','Select a cell and enter a number.','')}

  function apiReady(){return API_BASE_URL && !API_BASE_URL.includes('PASTE_YOUR_WORKER_URL_HERE')}
  async function apiFetch(path,options={}){if(!apiReady())throw new Error('The Sudoku library is not connected yet.');const response=await fetch(`${API_BASE_URL}${path}`,{...options,headers:{Accept:'application/json',...(options.headers||{})}});let data=null;try{data=await response.json()}catch(_){data=null}if(!response.ok){const message=data?.message||data?.error||'This request could not be completed.';const err=new Error(message);err.status=response.status;err.data=data;throw err}return data}

  function statusClass(status){return String(status).toLowerCase().replace(/\s+/g,'-')}
  function progressStatusFor(code){return getProgress(code)?.status||'Not Started'}
  function updateGridCountOptions(){
    const gridType=$('gridTypeFilter').value;
    const gridCount=$('gridCountFilter');
    const previous=gridCount.value;
    const options=gridType==='Single grid'?['1']:['1','2','3','4','5','6','7','8'];
    gridCount.innerHTML='<option value="">All grid counts</option>'+options.map(value=>`<option value="${value}">${value}</option>`).join('');
    gridCount.value=gridType==='Single grid'?'':(options.includes(previous)?previous:'');
    syncCustomSelect(gridCount);
  }

  function clearLibraryCards(){
    $('libraryList')?.querySelectorAll('.puzzle-card').forEach(card=>card.remove());
  }

  function renderLibrary(itemsOverride=null,append=false,ignoreStatus=false){
    const selectedStatus=ignoreStatus?'':$('statusFilter').value;
    const filtered=(itemsOverride??libraryItems).filter(record=>!selectedStatus||progressStatusFor(record.puzzle_number)===selectedStatus);
    const items=showingLiked?filtered:filtered.slice(0,libraryVisibleCount);
    const list=$('libraryList');
    const moreWrap=$('loadMoreBtn')?.closest('.library-more');
    if(!append) list.innerHTML='';
    if(!items.length&&!append){
      $('libraryEmpty')?.classList.remove('hidden');
      if(moreWrap) {
        list.appendChild(moreWrap);
        moreWrap.querySelector('#loadMoreBtn')?.classList.add('hidden');
      }
      return;
    }
    $('libraryEmpty').classList.add('hidden');
    items.forEach(record=>{
      const item=document.createElement('div');item.className='puzzle-card';
      const code=document.createElement('div');code.className='puzzle-code';code.textContent=record.puzzle_number;
      const main=document.createElement('div');const strong=document.createElement('strong');strong.textContent=record.difficulty||'Unrated';const small=document.createElement('small');small.textContent=`${record.grid_type||'Single grid'} · ${record.grid_count||1} grid${Number(record.grid_count)===1?'':'s'}`;main.append(strong,small);
      const meta=document.createElement('div');const ms=document.createElement('small');ms.textContent=record.constraint_type||'Classic Sudoku';meta.append(ms);
      const actions=document.createElement('div');actions.className='puzzle-actions';const status=document.createElement('span');
      const codeValue=puzzleCodeOf(record),isRemoved=removedPuzzleCodes.has(codeValue);
      status.className=`status-badge ${isRemoved?'removed':statusClass(progressStatusFor(codeValue))}`;status.textContent=isRemoved?'Removed':progressStatusFor(codeValue);
      if(isRemoved){
        const removeButton=document.createElement('button');removeButton.className='btn danger';removeButton.type='button';removeButton.textContent='Delete local copy';removeButton.addEventListener('click',()=>forgetPuzzleFromLocalStorage(codeValue));actions.append(status,removeButton);
      }else{
        const open=document.createElement('button');open.className='btn secondary';open.type='button';open.textContent='Play';open.addEventListener('click',()=>openRemotePuzzle(record));actions.append(status,open);
      }
      item.append(code,main,meta,actions);list.appendChild(item);
    });
    if(moreWrap)list.appendChild(moreWrap);
    updateLoadMoreButton();
  }

  function showLikedPuzzles(){showingLiked=true;libraryItems=getLikedPuzzles();libraryOffset=libraryItems.length;libraryVisibleCount=libraryItems.length;libraryHasMore=false;renderLibrary();$('libraryStatus').textContent=libraryItems.length?`${libraryItems.length} liked puzzle${libraryItems.length===1?'':'s'}.`:'No liked puzzles yet.'}

  function scrollLibraryByCard(){
    const list=$('libraryList');
    const card=list?.querySelector('.puzzle-card');
    if(!list||!card)return;
    const gap=parseFloat(getComputedStyle(list).rowGap)||0;
    list.scrollBy({top:card.getBoundingClientRect().height+gap,behavior:'smooth'});
  }

  async function handleLoadMore(){
    if(libraryLoading)return;
    const selectedStatus=$('statusFilter')?.value||'';
    const filteredCount=libraryItems.filter(record=>!selectedStatus||progressStatusFor(record.puzzle_number)===selectedStatus).length;
    if(filteredCount>libraryVisibleCount){
      libraryVisibleCount+=LIBRARY_PAGE_SIZE;
      renderLibrary();
      requestAnimationFrame(scrollLibraryByCard);
      return;
    }
    if(libraryHasMore){
      libraryVisibleCount+=LIBRARY_PAGE_SIZE;
      await fetchLibrary({reset:false});
      requestAnimationFrame(scrollLibraryByCard);
    }
  }

  async function fetchLibrary({reset=true}={}){
    showingLiked=false;
    const requestId=++libraryRequestId;
    const recentRequest=isRecentRequest(reset);
    libraryLoading=true;$('loadMoreBtn').disabled=true;$('libraryStatus').textContent='Loading puzzles…';
    try{
      const params=new URLSearchParams();
      params.set('limit',String(LIBRARY_BATCH_LIMIT));
      params.set('include','full');
      params.set('offset',reset?'0':String(libraryOffset));
      const difficulty=$('difficultyFilter').value,gridType=$('gridTypeFilter').value,gridCount=$('gridCountFilter').value,constraint=$('constraintFilter').value.trim();
      if(difficulty)params.set('difficulty',difficulty);
      if(gridType)params.set('gridType',gridType);
      if(gridCount)params.set('gridCount',gridCount);
      if(constraint)params.set('constraint',constraint);
      const data=await apiFetch(`/puzzles?${params.toString()}`);
      if(requestId!==libraryRequestId)return;
      if(reset){libraryItems=[];libraryVisibleCount=LIBRARY_PAGE_SIZE}
      libraryOffset=Number(data.nextOffset??(Number(data.offset||0)+Number(data.limit||LIBRARY_BATCH_LIMIT)));libraryHasMore=Boolean(data.hasMore);
      libraryItems=reset?[...(data.items||[])]:[...libraryItems,...(data.items||[])];
      cacheBatchPuzzlePayloads(data.items||[]);
      if(recentRequest){cacheRecentPuzzles(data.items||[]);cacheLibrarySnapshot(libraryItems,libraryOffset,libraryHasMore,data.nextOffset)}
      renderLibrary();
      $('libraryStatus').textContent=libraryItems.length?`${Math.min(libraryVisibleCount,libraryItems.length)} of ${libraryItems.length} puzzles loaded.`:'No puzzles match these selections.';
      updateLoadMoreButton();
    }catch(err){
      if(requestId!==libraryRequestId)return;
      const cached=recentRequest?getCachedRecentPuzzles():[];
      if(cached.length){
        libraryItems=cached;
        libraryOffset=cached.length;
        libraryVisibleCount=LIBRARY_PAGE_SIZE;
        libraryHasMore=false;
        renderLibrary();
        $('libraryStatus').textContent=`Showing ${cached.length} saved recent puzzle${cached.length===1?'':'s'}.`;
        $('loadMoreBtn').classList.add('hidden');
      }else{
        clearLibraryCards();$('libraryEmpty').classList.remove('hidden');$('libraryEmpty').textContent=err.message||'The puzzle library could not be loaded.';$('libraryStatus').textContent='The puzzle library could not be loaded.';
      }
    }finally{
      if(requestId===libraryRequestId){
        libraryLoading=false;
        $('loadMoreBtn').disabled=false;
      }
    }
  }

  async function searchPuzzle(){
    const code=normalizeCode($('librarySearch').value);
    if(!validCode(code)){toast('Enter a valid puzzle number.');return}
    const requestId=++libraryRequestId;
    showingLiked=false;
    libraryLoading=true;
    $('loadMoreBtn').disabled=true;
    $('libraryStatus').textContent='Searching…';
    clearLibraryCards();$('libraryEmpty').classList.add('hidden');$('loadMoreBtn').classList.add('hidden');
    const localRecord=getLoadedBatchRecords().find(record=>puzzleCodeOf(record)===code&&record?.puzzle);
    if(localRecord){
      if(requestId!==libraryRequestId)return;
      libraryItems=[localRecord];libraryOffset=1;libraryHasMore=false;libraryVisibleCount=1;renderLibrary(null,false,true);$('libraryStatus').textContent='1 puzzle found in the loaded batch.';$('libraryEmpty').classList.add('hidden');libraryLoading=false;$('loadMoreBtn').disabled=false;return;
    }
    try{
      const data=await apiFetch(`/puzzles/${encodeURIComponent(code)}`);
      if(requestId!==libraryRequestId)return;
      if(!data?.available||!data?.puzzle)throw new Error('This puzzle could not be found.');
      const metadata=data.metadata||{};
      const searchRecord={
        puzzle_number:normalizeCode(data.puzzleNumber||code),
        difficulty:metadata.difficulty,
        grid_type:metadata.gridType||metadata.grid_type,
        grid_count:metadata.gridCount??metadata.grid_count,
        constraint_type:metadata.constraintType||metadata.constraint_type,
        technique:metadata.technique,
        created_at:metadata.createdAt||metadata.created_at,
        updated_at:metadata.updatedAt||metadata.updated_at,
        puzzle:data.puzzle
      };
      cachePuzzlePayload(searchRecord.puzzle_number,data.puzzle,searchRecord);
      libraryItems=[searchRecord];
      libraryOffset=1;libraryHasMore=false;libraryVisibleCount=1;
      renderLibrary(null,false,true);
      $('libraryStatus').textContent='1 puzzle found.';
      $('libraryEmpty').classList.add('hidden');
    }catch(err){
      if(requestId!==libraryRequestId)return;
      libraryItems=[];renderLibrary([]);$('libraryStatus').textContent=err.message||'This puzzle could not be found.';
    }finally{
      if(requestId===libraryRequestId){
        libraryLoading=false;
        $('loadMoreBtn').disabled=false;
      }
    }
  }

  function focusPuzzleBoard(){
    const target=document.querySelector('.play-card')||$('board');
    if(!target||!state.puzzle)return;
    const scroll=()=>target.scrollIntoView({behavior:'smooth',block:'start'});
    requestAnimationFrame(()=>{scroll();setTimeout(scroll,350)});
  }

  async function openRemotePuzzle(recordOrCode){
    const record=typeof recordOrCode==='string'?{puzzle_number:recordOrCode}:recordOrCode||{};
    const code=puzzleCodeOf(record);
    if(!code)return;
    const cachedPayload=getCachedPuzzlePayload(code);
    if(record.puzzle||cachedPayload?.puzzle){
      const puzzle=record.puzzle||cachedPayload.puzzle;
      const cachedRecord=record.puzzle?record:{...(cachedPayload.record||{}),...record,puzzle_number:code};
      load(puzzle,{code,record:cachedRecord,progress:getProgress(code)});
      document.querySelector('.play-card')?.scrollIntoView({behavior:'smooth',block:'start'});
      return;
    }
    try{
      const data=await apiFetch(`/puzzles/${encodeURIComponent(code)}`);
      const normalizedCode=data.puzzleNumber||code;
      const fullRecord={puzzle_number:normalizedCode,...(data.metadata||record)};
      cachePuzzlePayload(normalizedCode,data.puzzle,fullRecord);
      load(data.puzzle,{code:normalizedCode,record:fullRecord,progress:getProgress(normalizedCode)});
      document.querySelector('.play-card')?.scrollIntoView({behavior:'smooth',block:'start'});
    }catch(err){
      const cached=getCachedPuzzlePayload(code);
      if(cached?.puzzle){
        const cachedRecord={puzzle_number:code,...(cached.record||record)};
        load(cached.puzzle,{code,record:cachedRecord,progress:getProgress(code)});
        document.querySelector('.play-card')?.scrollIntoView({behavior:'smooth',block:'start'});
        return;
      }
      if(err.status===404){
        const isSavedLiked=isLiked(code)||showingLiked;
        if(isSavedLiked){
          removedPuzzleCodes.add(code);
          renderLibrary();
          setStatus('Puzzle unavailable',`${code} has been removed from the online library. Use “Delete local copy” in the saved-puzzles list to remove it from this browser too.`,'bad');
          toast('Puzzle removed online. Delete the local copy when ready.');
        }else{
          setStatus('Puzzle unavailable',err.message||'This puzzle is no longer available. It has been removed from the puzzle library.','bad');
          toast('This puzzle is no longer available.');
        }
        return;
      }
      toast(err.message||'The puzzle could not be loaded.');
    }
  }

  function exportProgress(){
    cleanupExpiredUnlikedProgress();
    const payload={format:'lovdoku-progress',version:1,exportedAt:new Date().toISOString(),progress:getProgressStore()};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`lovdoku-progress-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Progress exported.');
  }

  function puzzleShareUrl(){
    const url=new URL(window.location.href);
    url.search='';
    if(state.currentPuzzleCode)url.searchParams.set('puzzle',normalizeCode(state.currentPuzzleCode));
    return url.toString();
  }
  async function copyText(text){
    try{
      if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return true}
      const textarea=document.createElement('textarea');textarea.value=text;textarea.style.position='fixed';textarea.style.opacity='0';document.body.appendChild(textarea);textarea.select();const copied=document.execCommand('copy');textarea.remove();return copied;
    }catch(_){return false}
  }
  async function sharePuzzleLink(){
    if(!state.currentPuzzleCode){toast('Choose a puzzle first.');return}
    const url=puzzleShareUrl();
    const shareData={title:`Lovdoku Puzzle ${normalizeCode(state.currentPuzzleCode)}`,text:`Play Lovdoku puzzle ${normalizeCode(state.currentPuzzleCode)}`,url};
    try{
      if(typeof navigator.share==='function'){
        await navigator.share(shareData);
        return;
      }
    }catch(error){
      if(error?.name==='AbortError')return;
    }
    const copied=await copyText(url);
    toast(copied?'Puzzle link copied.':'Could not share or copy the puzzle link.',3500);
  }
  function showLikeStorageInfo(){
    showAppDialog({kicker:'Saved progress',title:'How local progress is kept',message:'Liked puzzles keep their progress on this browser. Progress for puzzles you have not liked is automatically removed after 12 hours without an update. You can like up to 25 puzzles.',confirmLabel:'Got it',showCancel:false});
  }
  function showProgressDataInfo(){
    showAppDialog({kicker:'Progress Data',title:'Import and export progress',message:'Export Progress downloads a JSON backup of your saved progress. Import Progress restores and merges a compatible Lovdoku JSON backup into this browser. Nothing is uploaded to the server.',confirmLabel:'Got it',showCancel:false});
  }

  function sharedPuzzleCodeFromUrl(){
    const params=new URLSearchParams(window.location.search);
    if(!params.has('puzzle'))return null;
    const raw=params.get('puzzle')?.trim().toUpperCase()||'';
    if(!validCode(raw)){
      toast('The shared puzzle link is invalid. Puzzle numbers must look like A1234.',5000);
      return '';
    }
    return raw;
  }

  async function importProgressFile(file){
    try{
      const text=await file.text();const data=JSON.parse(text);const incoming=data?.progress&&typeof data.progress==='object'?data.progress:data;
      if(!incoming||typeof incoming!=='object'||Array.isArray(incoming))throw new Error('That progress file is not valid.');
      const store=getProgressStore();
      Object.entries(incoming).forEach(([code,record])=>{
        const normalized=normalizeCode(code);if(!validCode(normalized)||!record||typeof record!=='object')return;
        store[normalized]={code:normalized,values:Array.isArray(record.values)?record.values.map(num):[],notes:Array.isArray(record.notes)?record.notes.map(a=>Array.isArray(a)?a.map(num).filter(Boolean):[]):[],elapsed:Math.max(0,Number(record.elapsed)||0),mistakes:Math.max(0,Number(record.mistakes)||0),status:['Not Started','In Progress','Solved'].includes(record.status)?record.status:'Not Started',updatedAt:Number(record.updatedAt)||Date.now()};
      });
      if(!writeStorage(STORAGE_KEYS.progress,store))throw new Error('Progress could not be saved in this browser.');
      cleanupExpiredUnlikedProgress();
      renderLibrary();setStatusFromState();toast('Progress imported.');
    }catch(err){toast(err.message||'The progress file could not be imported.')}
  }

  function num(v){const n=Number(v);return Number.isFinite(n)&&n>=1&&n<=9?Math.trunc(n):0}
  function gridFrom(value,count=81){
    if(Array.isArray(value)) return Array.from({length:count},(_,i)=>num(value[i]));
    if(typeof value==='string'){
      const chars=value.replace(/[^0-9]/g,'').split(''); if(chars.length>=count)return chars.slice(0,count).map(num);
    }
    return Array(count).fill(0);
  }
  function normalizeLayout(rawLayout, constraintInfo){
    const source=Array.isArray(rawLayout)&&rawLayout.length?rawLayout:(Array.isArray(constraintInfo?.grids)?constraintInfo.grids:[]);
    const infoById=new Map((Array.isArray(constraintInfo?.grids)?constraintInfo.grids:[]).map(g=>[String(g?.id??g?.gridId),g]));
    return source.map((g,i)=>{
      const pos=g?.position||{},info=infoById.get(String(g?.id??g?.gridId??i+1))||{};
      const constraint=String(g?.constraint??g?.type??info?.constraint??info?.type??'classic').toLowerCase();
      const customShadingName=String(g?.customShadingName||info?.customShadingName||'').trim();
      const customShadingGroups=Array.isArray(g?.customShadingGroups)&&g.customShadingGroups.length?g.customShadingGroups:(Array.isArray(info?.customShadingGroups)?info.customShadingGroups:[]);
      const constraintGroups=Array.isArray(g?.groups)&&g.groups.length?g.groups:(Array.isArray(info?.groups)?info.groups:[]);
      return {id:Number(g?.id??g?.gridId??info?.id??i+1)||i+1,r0:Math.round(Number(g?.r0??pos.row??info?.position?.row??0)||0),c0:Math.round(Number(g?.c0??pos.column??info?.position?.column??0)||0),constraint,label:g?.label||info?.label||prettyConstraint(constraint),customShadingName,customShadingGroups,constraintGroups};
    });
  }
  function buildMultiMap(layout){
    const coordIndex=new Map(),coords=[],gridCellIndices=layout.map(()=>Array(81).fill(-1));
    layout.forEach((g,gi)=>{for(let lr=0;lr<9;lr++)for(let lc=0;lc<9;lc++){
      const r=g.r0+lr,c=g.c0+lc,key=`${r},${c}`;let idx=coordIndex.get(key);
      if(idx===undefined){idx=coords.length;coordIndex.set(key,idx);coords.push([r,c])}
      gridCellIndices[gi][lr*9+lc]=idx;
    }});
    return {coordIndex,coords,gridCellIndices};
  }
  function multiValues(direct,grids,layout,map){
    const total=map.coords.length,values=Array(total).fill(0);
    if(Array.isArray(direct)&&direct.length>=total) return direct.slice(0,total).map(num);
    const source=Array.isArray(grids)?grids:[];const byId=new Map(source.map(g=>[Number(g?.gridId??g?.id),g]));
    layout.forEach((g,gi)=>{const local=byId.get(Number(g.id))||source[gi];if(!local)return;const vals=Array.isArray(local.values)?local.values:[];for(let i=0;i<81;i++){const idx=map.gridCellIndices[gi][i],v=num(vals[i]);if(v)values[idx]=v}});
    return values;
  }
  function normalize(raw){
    let obj=raw;
    if(Array.isArray(raw)) obj=raw[0];
    if(obj&&Array.isArray(obj.puzzles)) obj=obj.puzzles[0];
    if(!obj||typeof obj!=='object') throw new Error('The puzzle data is not valid.');
    const size=Number(obj.gridSize||9); if(size!==9) throw new Error('This player currently supports 9×9 puzzles.');
    const mode=String(obj.mode||'single_grid').toLowerCase(),constraints=obj.constraints||{};
    const type=String(constraints.type||obj.constraint||'classic').toLowerCase();
    const customGroups=Array.isArray(obj.customShadingGroups)?obj.customShadingGroups:(Array.isArray(constraints.customShadingGroups)?constraints.customShadingGroups:[]);
    const constraintGroups=Array.isArray(constraints.groups)?constraints.groups.map(group=>({
      id:String(group?.id||''),
      type:String(group?.type||'no-repeat').toLowerCase(),
      cells:[...new Set((Array.isArray(group?.cells)?group.cells:[]).map(Number).filter(i=>Number.isInteger(i)&&i>=0&&i<81))],
      color:group?.color||null
    })).filter(group=>group.cells.length>0):[];
    if(mode==='multi_grid'){
      const layout=normalizeLayout(obj.numberGridLayout||obj.superLayout,constraints);if(!layout.length)throw new Error('This multi-grid puzzle has no valid layout.');
      const map=buildMultiMap(layout),total=map.coords.length;
      const givens=multiValues(obj.givens?.values,obj.givens?.grids,layout,map),solution=multiValues(obj.solution?.values,obj.solution?.grids,layout,map);
      if(givens.every(v=>!v))throw new Error('No givens were found in this multi-grid puzzle.');
      const owners=Array.from({length:total},()=>[]);layout.forEach((g,gi)=>{for(let i=0;i<81;i++){const idx=map.gridCellIndices[gi][i];owners[idx].push({gi,lr:Math.floor(i/9),lc:i%9,type:g.constraint,label:g.label,customShadingName:g.customShadingName,groups:g.customShadingGroups,constraintGroups:g.constraintGroups||[]})}});
      const gridDetails=[...new Set(layout.map(g=>g.customShadingName||g.label).filter(Boolean))];
      const constraintSummary=[...gridDetails];
      return {raw:obj,mode,layout,map,total,givens,solution,owners,constraints,type,label:constraints.label||'Multi Grid Sudoku',difficulty:obj.difficulty||{},colors:obj.colors||{},settings:obj.settings||{},customGroups,gridCount:layout.length,gridDetails,constraintSummary};
    }
    let givens=gridFrom(obj.givens?.values),solution=gridFrom(obj.solution?.values);
    if(givens.every(v=>!v)&&Array.isArray(obj.givens?.givenCells))obj.givens.givenCells.forEach(g=>{const i=Number(g.index);if(i>=0&&i<81)givens[i]=num(g.value)});
    if(solution.every(v=>!v)&&Array.isArray(obj.solution?.rows))solution=gridFrom(obj.solution.rows.flat());
    if(givens.every(v=>!v))throw new Error('No givens were found.');
    const layout=[{id:1,r0:0,c0:0,constraint:type,label:constraints.label||prettyConstraint(type),customShadingName:'',customShadingGroups:customGroups,constraintGroups}],map=buildMultiMap(layout);
    return {raw:obj,mode:'single_grid',layout,map,total:81,givens,solution,owners:Array.from({length:81},(_,i)=>[{gi:0,lr:Math.floor(i/9),lc:i%9,type,label:layout[0].label,customShadingName:'',groups:customGroups,constraintGroups}]),constraints,type,label:constraints.label||prettyConstraint(type),difficulty:obj.difficulty||{},colors:obj.colors||{},settings:obj.settings||{},customGroups,constraintGroups,gridCount:1,gridDetails:[layout[0].label],constraintSummary:[layout[0].label]};
  }
  function prettyConstraint(type){return ({classic:'Classic Sudoku',standard:'Standard Sudoku',windoku:'Windoku',asterisk:'Asterisk Sudoku',girandola:'Girandola Sudoku',diagonal:'Diagonal Sudoku',custom_shading:'Custom Shading',diamond_vertical:'Vertical Diamond',diamond_horizontal:'Horizontal Diamond'})[type]||type.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}
  function localConstraintGroups(type,customGroups,constraintGroups=[]){
    const out=[];
    if(Array.isArray(constraintGroups)&&constraintGroups.length){
      for(const group of constraintGroups){
        const cells=[...new Set((group?.cells||[]).map(Number).filter(i=>i>=0&&i<81))];
        if(cells.length>1)out.push(cells);
      }
      return out;
    }
    if(type==='custom_shading')for(const g of customGroups||[]){const cells=[...new Set((g?.cells||[]).map(Number).filter(i=>i>=0&&i<81))];if(cells.length>1)out.push(cells)}
    return out;
  }
  function groupSets(){
    if(!state.puzzle)return [];
    const groups=[];
    state.puzzle.layout.forEach((g,gi)=>{const map=state.puzzle.map.gridCellIndices[gi];
      for(let r=0;r<9;r++)groups.push(Array.from({length:9},(_,c)=>map[r*9+c]));
      for(let c=0;c<9;c++)groups.push(Array.from({length:9},(_,r)=>map[r*9+c]));
      for(let br=0;br<9;br+=3)for(let bc=0;bc<9;bc+=3)groups.push(Array.from({length:9},(_,k)=>map[(br+Math.floor(k/3))*9+bc+k%3]));
      const ownerGroups=state.puzzle.mode==='multi_grid' ? (state.puzzle.owners.find(list=>list.some(owner=>owner.gi===gi))?.find(owner=>owner.gi===gi)?.constraintGroups||[]) : state.puzzle.constraintGroups||[];
      localConstraintGroups(g.constraint,g.customShadingGroups,ownerGroups).forEach(local=>groups.push(local.map(i=>map[i])));
    });
    return groups;
  }
  function peersOf(index){const set=new Set();groupSets().forEach(g=>{if(g.includes(index))g.forEach(i=>{if(i!==index)set.add(i)})});return set}
  function constraintPalette(){return Object.assign({windokuBg:'#E0E7FF',asteriskBg:'#FFE4E6',girandolaBg:'#D1FAE5',diagonalBg:'#F3E8FF',customShadingBg:'#EDE9FE',diamondV1:'rgba(59,130,246,.10)',diamondV2:'rgba(16,185,129,.08)',diamondH1:'rgba(245,158,11,.08)',diamondH2:'rgba(239,68,68,.08)'},state.puzzle?.colors?.constraintBackgrounds||{})}
  function ownerColor(owner,index){
    const colors=constraintPalette(),local=owner.lr*9+owner.lc;
    for(const group of owner.constraintGroups||[]){
      const cells=Array.isArray(group?.cells)?group.cells.map(Number):[];
      if(cells.includes(local)){
        if(state.puzzle.colors?.mode==='bw')return colors.customShadingBg;
        if(group.color)return group.color;
        const colorKey={windoku:'windokuBg',asterisk:'asteriskBg',girandola:'girandolaBg',diagonal:'diagonalBg',diamond_vertical:'diamondV1',diamond_horizontal:'diamondH1'}[owner.type];
        return colorKey ? colors[colorKey] : colors.customShadingBg;
      }
    }
    if(owner.type==='custom_shading'){for(const g of owner.groups||[]){if((g?.cells||[]).map(Number).includes(local))return state.puzzle.colors?.mode==='bw'?colors.customShadingBg:(g.color||colors.customShadingBg)}return ''}
    return '';
  }
  function baseConstraintClass(cell,index){
    const owners=state.puzzle?.owners?.[index]||[];let painted=false;
    owners.forEach(owner=>{const color=ownerColor(owner,index);if(color&&!painted){cell.style.backgroundColor=color;painted=true;cell.dataset.constraintColor=color;cell.classList.add('constraint-'+(owner.type==='custom_shading'?'custom':owner.type.replace('_','-')))}});
  }

  function updateFullscreenButtonVisibility(){
    const button=$('fullscreenBtn');
    if(!button)return;
    const available=state.puzzle?.mode==='multi_grid';
    button.classList.toggle('hidden',!available);
    button.setAttribute('aria-hidden',String(!available));
  }

  function render(){
    if(!state.puzzle)return;
    updateFullscreenButtonVisibility();
    const board=$('board');board.innerHTML='';board.classList.toggle('multi',state.puzzle.mode==='multi_grid');
    // Appearance is applied once when a puzzle is loaded. Re-rendering for cell selection or input
    // must not overwrite the settings that are active for this puzzle during the session.
    const coords=state.puzzle.map.coords,minR=Math.min(...coords.map(x=>x[0])),maxR=Math.max(...coords.map(x=>x[0])),minC=Math.min(...coords.map(x=>x[1])),maxC=Math.max(...coords.map(x=>x[1]));
    const width=maxC-minC+1,height=maxR-minR+1;
    const lineScale=Math.max(0.25,Math.min(1.45,9/Math.max(1,width,height)));
    board.style.setProperty('--line-scale',lineScale.toFixed(3));
    if(state.puzzle.mode==='multi_grid'){const available=Math.max(260,board.parentElement?.clientWidth||840),cellSize=Math.min(48,available/width);board.style.width=`${width*cellSize}px`;board.style.height=`${height*cellSize}px`;board.style.gridTemplateColumns=`repeat(${width},${cellSize}px)`;board.style.gridTemplateRows=`repeat(${height},${cellSize}px)`}else{board.style.width='';board.style.height='';board.style.gridTemplateColumns='repeat(9,minmax(0,1fr))';board.style.gridTemplateRows='repeat(9,minmax(0,1fr))'}
    
    for(let r=minR;r<=maxR;r++)for(let c=minC;c<=maxC;c++){
      const i=state.puzzle.map.coordIndex.get(`${r},${c}`);if(i===undefined){const blank=document.createElement('div');blank.className='cell blank';board.appendChild(blank);continue}
      const cell=document.createElement('div');cell.className='cell';cell.dataset.index=i;cell.setAttribute('role','gridcell');cell.tabIndex=0;baseConstraintClass(cell,i);
      const owners=state.puzzle.owners[i]||[];
      if(owners.some(o=>o.lc===2||o.lc===5))cell.classList.add('box-right');
      if(owners.some(o=>o.lr===2||o.lr===5))cell.classList.add('box-bottom');
      if(state.puzzle.mode==='multi_grid'){
        const hasCellAt=(rr,cc)=>state.puzzle.map.coordIndex.has(`${rr},${cc}`);
        if(owners.some(o=>o.lc===0)&&!hasCellAt(r,c-1))cell.classList.add('grid-left');
        if(owners.some(o=>o.lc===8)&&!hasCellAt(r,c+1))cell.classList.add('grid-right');
        if(owners.some(o=>o.lr===0)&&!hasCellAt(r-1,c))cell.classList.add('grid-top');
        if(owners.some(o=>o.lr===8)&&!hasCellAt(r+1,c))cell.classList.add('grid-bottom');
      }
      if(state.givens[i]){cell.classList.add('given');if(state.conflicts.has(i))cell.classList.add('conflict');cell.textContent=state.givens[i]}else if(state.values[i]){cell.textContent=state.values[i];if(state.wrong.has(i))cell.classList.add('wrong');if(state.conflicts.has(i))cell.classList.add('conflict');if(state.values[i]===state.solution[i]&&state.solution[i])cell.classList.add('complete')}
      if(!state.givens[i]&&!state.values[i]&&state.notes[i]?.size){const notes=document.createElement('div');notes.className='notes';for(let n=1;n<=9;n++){const s=document.createElement('span');s.textContent=state.notes[i].has(n)?n:'';notes.appendChild(s)}cell.appendChild(notes)}
      cell.addEventListener('click',(e)=>{e.stopPropagation();select(i);});cell.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();move(e.key)}});board.appendChild(cell);
    }
    
    requestAnimationFrame(updateCellFontSizePx);
    highlight();
    updateStats();
    if(state.fsActive) requestAnimationFrame(applyFsTransform);
  }

  function select(i){
    if(!state.puzzle)return;
    if(hasPlayerEntries()&&!state.finished&&!state.timer)startTimer();
    if(state.selected===i){
      state.selected=-1;
      render();
      return;
    }
    state.selected=i;
    render();
    const cell=document.querySelector(`[data-index="${i}"]`);
    if(cell)cell.focus({preventScroll:true});
  }
  function highlight(){if(state.selected<0)return;const selected=state.selected,sv=state.values[selected]||state.givens[selected],peers=peersOf(selected);document.querySelectorAll('.cell[data-index]').forEach(cell=>{const i=Number(cell.dataset.index);if(i!==selected&&peers.has(i))cell.classList.add('peer');if(sv&&((state.values[i]||state.givens[i])===sv))cell.classList.add('same');if(i===selected)cell.classList.add('selected')})}
  function move(key){if(!state.puzzle)return;let i=state.selected<0?0:state.selected;const [r,c]=state.puzzle.map.coords[i]||[0,0];let dr=0,dc=0;if(key==='ArrowUp')dr=-1;if(key==='ArrowDown')dr=1;if(key==='ArrowLeft')dc=-1;if(key==='ArrowRight')dc=1;const exact=state.puzzle.map.coordIndex.get(`${r+dr},${c+dc}`);if(exact!==undefined){select(exact);return}const candidates=state.puzzle.map.coords.map((x,k)=>({x,k})).filter(o=>(dr&&o.x[1]===c)||(dc&&o.x[0]===r)).sort((a,b)=>Math.abs((dr?a.x[0]:a.x[1])-(dr?r:c))-Math.abs((dr?b.x[0]:b.x[1])-(dr?r:c)));if(candidates.length)select(candidates[0].k)}
  function toggleNotes(){state.notesMode=!state.notesMode;$('notesToggle').classList.toggle('on',state.notesMode);$('notesToggle')?.setAttribute('aria-pressed',String(state.notesMode));toast(state.notesMode?'Notes mode on':'Notes mode off')}
  function candidateNotesFor(index){
    if(state.givens[index]||state.values[index])return [];
    const used=new Set();
    peersOf(index).forEach(peer=>{const value=state.values[peer]||state.givens[peer];if(value)used.add(value)});
    return Array.from({length:9},(_,n)=>n+1).filter(n=>!used.has(n));
  }
  function refreshAutoPencilMarks(){
    if(!state.revealPencilMarks)return;
    state.notes.forEach((notes,index)=>{
      notes.clear();
      candidateNotesFor(index).forEach(n=>notes.add(n));
    });
  }
  async function toggleRevealPencilMarks(){
    if(!state.puzzle)return;
    if(state.revealPencilMarks){
      state.revealPencilMarks=false;
      $('revealPencilMarksToggle')?.classList.remove('on');
      $('revealPencilMarksToggle')?.setAttribute('aria-pressed','false');
      toast('Auto pencil marks off');
      render();
      return;
    }
    const result=await showAppDialog({kicker:'Pencil marks',title:'Reveal all pencil marks?',message:'This will replace your current notes with every possible pencil mark in each empty cell. The marks will update automatically as you enter or erase numbers.',confirmLabel:'Reveal pencil marks',cancelLabel:'Keep current notes'});
    if(!result.confirmed)return;
    state.revealPencilMarks=true;
    $('revealPencilMarksToggle')?.classList.add('on');
    $('revealPencilMarksToggle')?.setAttribute('aria-pressed','true');
    refreshAutoPencilMarks();
    persistProgress();
    render();
    toast('All pencil marks revealed');
  }
  function coloredConstraintFor(index){for(const owner of state.puzzle?.owners?.[index]||[]){if(ownerColor(owner,index))return owner.type==='custom_shading'?'Custom shading':prettyConstraint(owner.type)}return ''}
  
  function syncSolutionButtons(){
    const label=state.solutionShown?'Hide solution':'Show solution';
    [$('solveBtn'),$('fsSolveBtn')].forEach(button=>{
      if(!button)return;
      button.textContent=label;
      button.classList.toggle('warn',state.solutionShown);
      button.classList.toggle('secondary',!state.solutionShown);
    });
  }

  async function toggleSolution(){
    if(!state.puzzle) return;
    const puzzleCode=normalizeCode(state.currentPuzzleCode||state.currentPuzzleRecord?.puzzle_number);

    if(!state.solutionShown) {
      if(!solutionWarningAcknowledged(puzzleCode)){
        const result=await showAppDialog({kicker:'Solution reveal',title:'Reveal the complete solution?',message:'This will fill the unsolved cells with the answer. You can hide the solution later, but revealing it may spoil the puzzle.',confirmLabel:'Reveal solution',cancelLabel:'Keep solving'});
        if(!result.confirmed)return;
        acknowledgeSolutionWarning(puzzleCode);
      }

      state.preSolutionValues = [...state.values];
      state.preSolutionNotes = state.notes.map(set => new Set(set));

      state.solution.forEach((v, i) => {
        if (!state.givens[i]) {
          state.values[i] = v;
          state.notes[i].clear();
        }
      });
      state.wrong.clear();
      state.conflicts.clear();
      state.solutionShown = true;
      syncSolutionButtons();
      toast('Solution shown');
    } else {
      if (state.preSolutionValues) {
        state.values = [...state.preSolutionValues];
      }
      if (state.preSolutionNotes) {
        state.notes = state.preSolutionNotes.map(set => new Set(set));
      }
      state.solutionShown = false;
      state.conflicts = conflicts();
      syncSolutionButtons();
      toast('Solution hidden');
    }

    render();
    setStatusFromState();
  }

  function resetSolutionButtonState() {
    state.solutionShown = false;
    state.preSolutionValues = null;
    state.preSolutionNotes = null;
    syncSolutionButtons();
  }

  function input(n){if(!state.puzzle||state.selected<0)return;const i=state.selected;if(state.givens[i]){toast('Given clues cannot be changed.');return}if(state.notesMode&&n){if(state.notes[i].has(n)){state.notes[i].delete(n)}else{const blocker=noteConflictPeer(i,n);if(blocker!==undefined){toast(`Note ${n} rejected: that number is already nearby.`);return}state.notes[i].add(n)}state.values[i]=0}else{state.values[i]=n;state.notes[i].clear();autoRemoveNote(n,i);if(n&&!state.startedAt){state.startedAt=Date.now();startTimer()}}if(state.revealPencilMarks)refreshAutoPencilMarks();state.wrong.delete(i);state.conflicts=conflicts();syncStatusAfterChange();render();if(state.conflicts.has(i)){const region=coloredConstraintFor(i);setStatus('Duplicate number',region?`This number is repeated inside the colored ${region} region.`:'This number already appears in the same row, column, or box.','bad')}else setStatusFromState();}
  function noteConflictPeer(index,n){return [...peersOf(index)].find(p=>(state.values[p]||state.givens[p])===n)}
  function autoRemoveNote(n,index){if(!n)return;peersOf(index).forEach(p=>state.notes[p].delete(n))}
  function conflicts(){const bad=new Set();groupSets().forEach(g=>{const seen=new Map();g.forEach(i=>{const v=state.values[i]||state.givens[i];if(v){if(!seen.has(v))seen.set(v,[]);seen.get(v).push(i)}});seen.forEach(arr=>{if(arr.length>1)arr.forEach(i=>bad.add(i))})});return bad}
  function check(){const bad=conflicts();state.conflicts=bad;let wrong=0;state.values.forEach((v,i)=>{if(v&&state.solution[i]&&v!==state.solution[i]&&!state.givens[i]){state.wrong.add(i);wrong++}});state.mistakes+=wrong;if(state.values.some((v,i)=>!state.givens[i]&&v))state.status=isSolved()?'Solved':'In Progress';state.finished=state.status==='Solved';persistProgress();renderLibrary();render();if(bad.size||wrong){setStatus('Keep going','Some entries need attention. Red cells are conflicts or incorrect answers.','bad');toast(`${bad.size+wrong} answer${bad.size+wrong===1?'':'s'} need attention.`)}else if(isSolved()){setStatus('Solved','Puzzle complete — every required cell is correct.','ok');toast('Puzzle complete!')}else{setStatus('In Progress','Your progress is being saved automatically.','');toast('No mistakes so far.')}}
  function isSolved(){return state.values.every((v,i)=>v===state.solution[i]&&v>0)}
  function checkComplete(){if(state.solution.every(Boolean)&&isSolved()){state.finished=true;state.status='Solved';persistProgress();renderLibrary();setStatus('Solved','Puzzle complete — every required cell is correct.','ok');toast('Puzzle complete!')}}
  function hint(){if(!state.puzzle||state.selected<0){toast('Select an empty cell first.');return}let i=state.selected;if(state.givens[i]){const empties=state.values.map((v,k)=>!state.givens[k]&&!v?k:-1).filter(k=>k>=0);i=empties[0]??-1}if(i<0||!state.solution[i]){toast('No hint is available for this puzzle.');return}state.selected=i;state.values[i]=state.solution[i];state.notes[i].clear();autoRemoveNote(state.solution[i],i);state.conflicts.clear();syncStatusAfterChange();render();setStatusFromState();checkComplete()}
  async function reset(){
    if(!state.puzzle)return;
    const result=await showAppDialog({kicker:'Reset puzzle',title:'Reset this puzzle?',message:'This will clear your entries, notes, timer, and mistakes for this puzzle. This action cannot be undone.',confirmLabel:'Reset puzzle',cancelLabel:'Keep playing'});
    if(!result.confirmed)return;
    stopTimer();state.values=[...state.givens];state.notes=Array.from({length:state.puzzle.total},()=>new Set());state.selected=-1;state.mistakes=0;state.wrong.clear();state.conflicts.clear();state.finished=false;state.status='Not Started';state.startedAt=null;state.elapsed=0;resetSolutionButtonState();persistProgress();renderLibrary();setStatusFromState();render();toast('Puzzle reset.')
  }
  function updateStats(){const filled=state.values.filter(Boolean).length,total=state.puzzle?.total||81;$('filledStat').textContent=`${filled}/${total}`;$('mistakeStat').textContent=state.mistakes;$('timerStat').textContent=formatTime(state.elapsed)}

  function formatTime(s){
    s=Math.max(0,Math.floor(s));
    const m=Math.floor(s/60);
    const sec=s%60;
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  }

  function startTimer(){
    stopTimer();
    if(!state.puzzle||state.finished)return;
    if(!state.startedAt)state.startedAt=Date.now()-Math.max(0,state.elapsed)*1000;
    state.timer=setInterval(()=>{
      if(!state.finished&&state.puzzle){
        state.elapsed=liveElapsed();
        $('timerStat').textContent=formatTime(state.elapsed);
        persistProgress({immediate:false});
      }
    },1000);
  }

  function stopTimer(){
    if(state.timer){
      state.elapsed=liveElapsed();
      persistProgress();
      clearInterval(state.timer);
      state.timer=null;
    }
  }

  function syncPopupScrollLock(){
    const isPopupOpen=Boolean($('drawerPanel')?.classList.contains('open')||$('settingsModal')?.classList.contains('open')||$('fullscreenOverlay')?.classList.contains('active')||$('appDialog')?.classList.contains('open'));
    document.body.classList.toggle('popup-open',isPopupOpen);
  }

  function setStatus(title, text, type=''){
    const box = document.querySelector('.status-box');
    if($('statusTitle')) $('statusTitle').textContent = title;
    if($('statusText')) $('statusText').textContent = text;
    if(box){
      box.style.borderColor = type==='bad'?'var(--bad)':type==='ok'?'var(--good)':'var(--line)';
      box.style.backgroundColor = type==='bad'?'var(--bad-bg)':type==='ok'?'var(--good-bg)':'#f8fafc';
    }
  }

  function renderMetadata(){
    if(!state.puzzle)return;
    const p = state.puzzle;
    const difficulty = p.difficulty && typeof p.difficulty==='object' ? p.difficulty : {};
    const difficultyLevel = typeof p.difficulty==='string' ? p.difficulty : (difficulty.level || difficulty.name || p.raw?.metadata?.difficulty || 'Unrated');
    const givenCount = Number.isFinite(Number(difficulty.givenCount)) ? Number(difficulty.givenCount) : state.givens.filter(Boolean).length;
    $('difficultyMeta').textContent = difficultyLevel;
    $('givensMeta').textContent = `${givenCount} / ${p.total}`;
    $('gridCountMeta').textContent = p.gridCount || 1;
    $('gridModeMeta').textContent = p.mode === 'multi_grid' ? 'Multi Grid' : 'Single Grid';
    const gridDetailsEl = $('gridDetailsMeta');
    const gridDetails = [...new Set((p.gridDetails || []).map(label => String(label).trim()).filter(Boolean))];
    gridDetailsEl.innerHTML = gridDetails.length ? gridDetails.map(label=>`<span class="technique-tag">${label}</span>`).join('') : '<span class="techniques-empty">—</span>';

    const techEl = $('techniqueMeta');
    const techs = difficulty.techniques || p.raw?.techniques || [];
    if(techs.length){
      techEl.innerHTML = techs.map(t => `<span class="technique-tag">${t}</span>`).join('');
    } else {
      techEl.innerHTML = '<span class="techniques-empty">—</span>';
    }

    const colorsEl = $('constraintColors');
    const usedColors = [];
    if(p.owners){
      p.owners.forEach((ownerList, idx) => {
        ownerList.forEach(owner => {
          const col = ownerColor(owner, idx);
          if(col && !usedColors.some(uc => uc.color === col)){
            usedColors.push({
              color: col,
              label: owner.customShadingName || owner.label || prettyConstraint(owner.type)
            });
          }
        });
      });
    }
    if(usedColors.length){
      colorsEl.innerHTML = usedColors.map(c => `
        <div class="color-chip">
          <i style="background:${c.color}"></i>
          <span class="color-chip-label">${c.label}</span>
        </div>
      `).join('');
    } else {
      colorsEl.innerHTML = '<span class="colors-empty">None</span>';
    }
  }

  /* FIX 2: Full-screen mode & Pan-Zoom Grid focus implementation */
  function toggleFullscreen() {
    if (!state.fsActive) {
      enterFullscreen();
    } else {
      exitFullscreen();
    }
  }

  function enterFullscreen() {
    if (!state.puzzle) {
      toast('Select a puzzle from the library first.');
      return;
    }
    state.fsActive = true;
    state.fsZoom = 1.0;
    state.fsGridIndex = 'all';
    state.fsPanX = 0;
    state.fsPanY = 0;

    const overlay = $('fullscreenOverlay');
    const board = $('board');
    const keypad = $('keypad');
    const notesControls = document.querySelector('.board-notes-controls');

    if (board && $('fsBoardSlot')) $('fsBoardSlot').appendChild(board);
    if (keypad && $('fsKeypadSlot')) $('fsKeypadSlot').appendChild(keypad);
    if (notesControls && $('fsNotesSlot')) $('fsNotesSlot').appendChild(notesControls);

    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
    syncPopupScrollLock();

    // Use the app-level fullscreen overlay instead of native browser fullscreen.
    // This preserves the dark theater layout without triggering the browser popup.

    updateFsTitle();
    updateFsGridOptions();

    requestAnimationFrame(() => {
      applyFsTransform();
    });
  }

  function exitFullscreen() {
    state.fsActive = false;
    const overlay = $('fullscreenOverlay');
    const board = $('board');
    const keypad = $('keypad');
    const notesControls = document.querySelector('.board-notes-controls');
    const boardWrap = document.querySelector('.board-wrap');
    const gameState = $('gameState');

    if (board && boardWrap) boardWrap.appendChild(board);
    if (keypad && gameState) gameState.appendChild(keypad);
    if (notesControls && gameState) gameState.appendChild(notesControls);

    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
    syncPopupScrollLock();

    // Theater mode does not enter native browser fullscreen.

    render();
  }

  function updateFsTitle() {
    if ($('fsPuzzleBadge')) $('fsPuzzleBadge').textContent = `#${state.currentPuzzleCode || '—'}`;
    if ($('fsPuzzleTitle')) $('fsPuzzleTitle').textContent = state.puzzle?.label || 'Sudoku';
  }

  function updateFsGridOptions() {
    const select = $('fsGridSelect');
    if (!select || !state.puzzle) return;
    select.innerHTML = '';

    const optAll = document.createElement('option');
    optAll.value = 'all';
    optAll.textContent = state.puzzle.mode === 'multi_grid' ? 'Entire Board (Fit)' : 'Single Grid (Fit)';
    select.appendChild(optAll);

    state.puzzle.layout.forEach((g, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = `Grid ${idx + 1} · Fit: ${g.label || 'Subgrid'}`;
      select.appendChild(opt);
    });

    select.value = state.fsGridIndex;
    syncCustomSelect(select);
  }

  function setFsGridIndex(index) {
    state.fsGridIndex = index;
    if ($('fsGridSelect')) {
      $('fsGridSelect').value = String(index);
      syncCustomSelect($('fsGridSelect'));
    }
    state.fsZoom = 1;
    state.fsPanX = 0;
    state.fsPanY = 0;
    applyFsTransform();
  }

  function navFsGrid(direction) {
    if (!state.puzzle) return;
    const total = state.puzzle.layout.length;
    if (state.fsGridIndex === 'all') {
      setFsGridIndex(direction > 0 ? 0 : total - 1);
      return;
    }
    let current = Number(state.fsGridIndex);
    let next = current + direction;
    if (next < 0) next = total - 1;
    if (next >= total) next = 0;
    setFsGridIndex(next);
  }

  function changeFsZoom(delta) {
    state.fsZoom = Math.min(3.0, Math.max(0.4, Number((state.fsZoom + delta).toFixed(2))));
    applyFsTransform();
  }

  function resetFsZoom() {
    state.fsZoom = 1.0;
    state.fsPanX = 0;
    state.fsPanY = 0;
    applyFsTransform();
  }

  function applyFsTransform() {
    const viewport = $('fsViewport');
    const layer = $('fsTransformLayer');
    const board = $('board');
    if (!viewport || !layer || !board || !state.puzzle) return;

    const Vw = viewport.clientWidth || window.innerWidth;
    const Vh = viewport.clientHeight || (window.innerHeight - 150);

    const coords = state.puzzle.map.coords;
    const minR = Math.min(...coords.map(x => x[0]));
    const maxR = Math.max(...coords.map(x => x[0]));
    const minC = Math.min(...coords.map(x => x[1]));
    const maxC = Math.max(...coords.map(x => x[1]));

    const W = maxC - minC + 1;
    const H = maxR - minR + 1;

    const firstCell = board.querySelector('.cell:not(.blank)');
    const cellPx = firstCell ? (firstCell.clientWidth || 40) : 40;

    const boardWidthPx = W * cellPx;
    const boardHeightPx = H * cellPx;

    let targetScale = 1;
    let targetPanX = state.fsPanX;
    let targetPanY = state.fsPanY;

    if (state.fsGridIndex === 'all') {
      const scaleX = (Vw - 40) / boardWidthPx;
      const scaleY = (Vh - 40) / boardHeightPx;
      targetScale = Math.min(scaleX, scaleY) * state.fsZoom;
    } else {
      const gridIdx = Number(state.fsGridIndex);
      const g = state.puzzle.layout[gridIdx] || state.puzzle.layout[0];

      const gridCx = g.c0 + 4.5;
      const gridCy = g.r0 + 4.5;

      const boardCx = minC + W / 2;
      const boardCy = minR + H / 2;

      const cellOffX = boardCx - gridCx;
      const cellOffY = boardCy - gridCy;

      const basePanX = cellOffX * cellPx;
      const basePanY = cellOffY * cellPx;

      const gridPx = 9 * cellPx;
      const scaleX = (Vw - 60) / gridPx;
      const scaleY = (Vh - 60) / gridPx;
      const fitGridScale = Math.min(scaleX, scaleY);

      targetScale = fitGridScale * state.fsZoom;
      targetPanX = basePanX * targetScale + state.fsPanX;
      targetPanY = basePanY * targetScale + state.fsPanY;
    }

    layer.style.transform = `translate(calc(-50% + ${targetPanX}px), calc(-50% + ${targetPanY}px)) scale(${targetScale})`;
  }

  function load(puzzleRaw, {code, record, progress}={}){
    stopTimer();
    const parsed = normalize(puzzleRaw);
    if(parsed.mode!=='multi_grid' && state.fsActive)exitFullscreen();
    state.puzzle = parsed;
    state.givens = [...parsed.givens];
    state.solution = [...parsed.solution];
    state.values = [...parsed.givens];
    state.notes = Array.from({length: parsed.total}, () => new Set());
    state.selected = -1;
    state.notesMode = false;
    state.revealPencilMarks = false;
    $('notesToggle')?.classList.remove('on');
    $('notesToggle')?.setAttribute('aria-pressed','false');
    $('revealPencilMarksToggle')?.classList.remove('on');
    $('revealPencilMarksToggle')?.setAttribute('aria-pressed','false');
    state.mistakes = 0;
    state.wrong.clear();
    state.conflicts.clear();
    state.startedAt = null;
    state.elapsed = 0;
    state.finished = false;
    state.currentPuzzleCode = code || puzzleCodeOf(record) || 'CUSTOM';
    state.currentPuzzleRecord = record || null;
    state.status = 'Not Started';

    resetBoardAppearance();
    applyPuzzleAppearance(parsed);
    applyFontSettings();
    resetSolutionButtonState();

    if(progress){
      restoreProgress(progress);
    }

    $('emptyState').classList.add('hidden');
    $('gameState').classList.remove('hidden');
    $('puzzleTitle').textContent = parsed.label || 'Sudoku Puzzle';
    const difficultyLevel = typeof parsed.difficulty==='string' ? parsed.difficulty : (parsed.difficulty?.level || parsed.difficulty?.name || 'Unrated');
    $('puzzleSubtitle').textContent = difficultyLevel;
    $('boardPuzzleNumber').textContent = `#${state.currentPuzzleCode}`;

    updateCurrentLikeButton();
    renderMetadata();
    render();
    setStatusFromState();
    $('timerStat').textContent=formatTime(state.elapsed);

    if(state.fsActive) {
      updateFsTitle();
      updateFsGridOptions();
      requestAnimationFrame(applyFsTransform);
    }
  }

  function setupEventListeners() {
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA' || e.target.closest?.('.custom-select, .select-menu')) return;
      if (!state.puzzle) return;

      if (state.fsActive) {
        if (e.key === '[' || e.key === 'PageUp') {
          e.preventDefault();
          navFsGrid(-1);
          return;
        } else if (e.key === ']' || e.key === 'PageDown') {
          e.preventDefault();
          navFsGrid(1);
          return;
        }
      }

      if (e.key >= '1' && e.key <= '9') {
        input(Number(e.key));
      } else if (e.key === '0' || e.key === 'Backspace' || e.key === 'Delete') {
        input(0);
      } else if (e.key === 'n' || e.key === 'N') {
        toggleNotes();
      } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        move(e.key);
      }
    });

    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement && state.fsActive) {
        exitFullscreen();
      }
    });

    const saveTimerSnapshot=()=>{if(state.puzzle&&hasPlayerEntries()&&!state.finished){state.elapsed=liveElapsed();persistProgress()}};
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')saveTimerSnapshot()});
    window.addEventListener('pagehide',saveTimerSnapshot);

    const keypad = $('keypad');
    if (keypad) {
      keypad.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const key = btn.dataset.key;
        if (key === 'erase') input(0);
        else if (key) input(Number(key));
      });
    }

    $('notesToggle')?.addEventListener('click', toggleNotes);
    $('revealPencilMarksToggle')?.addEventListener('click', toggleRevealPencilMarks);
    $('checkBtn')?.addEventListener('click', check);
    $('hintBtn')?.addEventListener('click', hint);
    $('resetBtn')?.addEventListener('click', reset);
    $('solveBtn')?.addEventListener('click', toggleSolution);
    $('fullscreenBtn')?.addEventListener('click', toggleFullscreen);

    /* Fullscreen Viewport Controls */
    $('fsExitBtn')?.addEventListener('click', exitFullscreen);
    $('fsCheckBtn')?.addEventListener('click', check);
    $('fsHintBtn')?.addEventListener('click', hint);
    $('fsResetBtn')?.addEventListener('click', reset);
    $('fsSolveBtn')?.addEventListener('click', toggleSolution);
    $('fsPrevGridBtn')?.addEventListener('click', () => navFsGrid(-1));
    $('fsNextGridBtn')?.addEventListener('click', () => navFsGrid(1));
    $('fsGridSelect')?.addEventListener('change', (e) => setFsGridIndex(e.target.value));

    const viewport = $('fsViewport');
    const layer = $('fsTransformLayer');
    if (viewport && layer) {
      viewport.addEventListener('pointerdown', (e) => {
        state.fsPointers.set(e.pointerId, {x:e.clientX,y:e.clientY});
        if (state.fsPointers.size === 2) {
          const points=[...state.fsPointers.values()];
          state.fsPinchStartDistance=Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y)||1;
          state.fsPinchStartZoom=state.fsZoom;
          state.fsDragging=false;
          viewport.classList.remove('grabbing');
          layer.classList.remove('dragging');
          return;
        }
        if (e.target.closest('.cell')) return;
        state.fsDragging = true;
        state.fsDragStart = { x: e.clientX, y: e.clientY };
        state.fsPanStart = { x: state.fsPanX, y: state.fsPanY };
        viewport.classList.add('grabbing');
        layer.classList.add('dragging');
        viewport.setPointerCapture(e.pointerId);
      });

      viewport.addEventListener('pointermove', (e) => {
        if (state.fsPointers.has(e.pointerId)) state.fsPointers.set(e.pointerId, {x:e.clientX,y:e.clientY});
        if (state.fsPointers.size >= 2) {
          const points=[...state.fsPointers.values()];
          const distance=Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y)||1;
          const ratio=distance/(state.fsPinchStartDistance||distance);
          state.fsZoom=Math.min(3,Math.max(.5,Number((state.fsPinchStartZoom*ratio).toFixed(3))));
          applyFsTransform();
          return;
        }
        if (!state.fsDragging) return;
        const dx = e.clientX - state.fsDragStart.x;
        const dy = e.clientY - state.fsDragStart.y;
        state.fsPanX = state.fsPanStart.x + dx;
        state.fsPanY = state.fsPanStart.y + dy;
        applyFsTransform();
      });

      const endDrag = (e) => {
        state.fsPointers.delete(e.pointerId);
        if (state.fsPointers.size < 2) state.fsPinchStartDistance=0;
        if (!state.fsDragging) return;
        state.fsDragging = false;
        viewport.classList.remove('grabbing');
        layer.classList.remove('dragging');
        try { viewport.releasePointerCapture(e.pointerId); } catch (_) {}
      };

      viewport.addEventListener('pointerup', endDrag);
      viewport.addEventListener('pointercancel', endDrag);
    }

    $('searchPuzzleBtn')?.addEventListener('click', searchPuzzle);
    $('librarySearch')?.addEventListener('keydown', event => { if(event.key==='Enter'){event.preventDefault();searchPuzzle();} });
    $('applyFiltersBtn')?.addEventListener('click', applyFiltersLocalFirst);
    $('loadMoreBtn')?.addEventListener('click', handleLoadMore);
    $('recentBtn')?.addEventListener('click', () => fetchLibrary({ reset: true }));
    $('likedBtn')?.addEventListener('click', showLikedPuzzles);
    $('currentLikeBtn')?.addEventListener('click', () => toggleLike(state.currentPuzzleRecord || { puzzle_number: state.currentPuzzleCode }));
    const bindEmbeddedInfo = (id, handler) => {
      const control = $(id);
      if (!control) return;
      const activate = (event) => { event.preventDefault(); event.stopPropagation(); handler(); };
      control.addEventListener('click', activate);
      control.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') activate(event); });
    };
    bindEmbeddedInfo('likeInfoBtn', showLikeStorageInfo);
    bindEmbeddedInfo('progressInfoBtn', showProgressDataInfo);
    $('shareBtn')?.addEventListener('click', sharePuzzleLink);
    $('appDialogConfirm')?.addEventListener('click', () => resolveAppDialog(true));
    $('appDialogCancel')?.addEventListener('click', () => resolveAppDialog(false));
    $('appDialogDismiss')?.addEventListener('click', () => resolveAppDialog(false));
    $('appDialog')?.addEventListener('click', event => { if(event.target.id==='appDialog') resolveAppDialog(false); });
    document.addEventListener('keydown', event => { if(event.key==='Escape'&&$('appDialog')?.classList.contains('open')) resolveAppDialog(false); });

    $('gridTypeFilter')?.addEventListener('change', updateGridCountOptions);

    const hamburgerBtn = $('hamburgerBtn');
    const drawerPanel = $('drawerPanel');
    const drawerOverlay = $('drawerOverlay');
    const closeDrawerBtn = $('closeDrawerBtn');

    function openDrawer() {
      drawerPanel?.classList.add('open');
      drawerOverlay?.classList.add('open');
      drawerOverlay?.setAttribute('aria-hidden', 'false');
      syncPopupScrollLock();
    }

    function closeDrawer() {
      drawerPanel?.classList.remove('open');
      drawerOverlay?.classList.remove('open');
      drawerOverlay?.setAttribute('aria-hidden', 'true');
      syncPopupScrollLock();
    }

    hamburgerBtn?.addEventListener('click', openDrawer);
    closeDrawerBtn?.addEventListener('click', closeDrawer);
    drawerOverlay?.addEventListener('click', closeDrawer);

    const settingsBtn = $('settingsBtn');
    const drawerSettingsBtn = $('drawerSettingsBtn');
    const settingsModal = $('settingsModal');
    const closeSettingsBtn = $('closeSettingsBtn');

    function openSettings() {
      closeDrawer();
      settingsModal?.classList.add('open');
      settingsModal?.setAttribute('aria-hidden', 'false');
      syncPopupScrollLock();
    }

    function closeSettings() {
      settingsModal?.classList.remove('open');
      settingsModal?.setAttribute('aria-hidden', 'true');
      syncPopupScrollLock();
    }

    settingsBtn?.addEventListener('click', openSettings);
    drawerSettingsBtn?.addEventListener('click', openSettings);
    $('fsSettingsBtn')?.addEventListener('click', openSettings);
    closeSettingsBtn?.addEventListener('click', closeSettings);

    $('fontFamilySelect')?.addEventListener('change', (e) => {
      fontSettings.family = e.target.value;
      updateFontPreviewCell();
    });

    $('fontWeightSelect')?.addEventListener('change', (e) => {
      fontSettings.weight = e.target.value;
      updateFontPreviewCell();
    });

    $('entryColorSelect')?.addEventListener('change', (e) => {
      fontSettings.entryColor = e.target.value;
      updateFontPreviewCell();
    });

    $('saveFontSettingsBtn')?.addEventListener('click', () => {
      saveFontSettings();
      closeSettings();
      toast('Appearance settings saved.');
    });

    $('resetFontSettingsBtn')?.addEventListener('click', () => {
      fontSettings = { ...defaultFontSettings };
      saveFontSettings();
      toast('Appearance settings reset.');
    });

    $('noticeNextBtn')?.addEventListener('click', () => window.noticeCarousel?.toggle());
    $('noticePrevItemBtn')?.addEventListener('click', () => window.noticeCarousel?.previous());
    $('noticeNextItemBtn')?.addEventListener('click', () => window.noticeCarousel?.next());

    $('exportProgressBtn')?.addEventListener('click', exportProgress);
    $('progressFileInput')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) importProgressFile(file);
    });

    window.addEventListener('resize', () => {
      updateCellFontSizePx();
      if (state.fsActive) applyFsTransform();
    });

    setupCustomSelects();
  }

  async function init() {
    await initStorage();
    enforceLikedPuzzleLimit();
    cleanupExpiredUnlikedProgress();
    if(!progressCleanupTimer)progressCleanupTimer=setInterval(cleanupExpiredUnlikedProgress,PROGRESS_CLEANUP_INTERVAL_MS);
    setupPwa();
    loadFontSettings();
    setupEventListeners();
    window.noticeCarousel?.initialize();
    const sharedPuzzleCode=sharedPuzzleCodeFromUrl();
    if(sharedPuzzleCode)openRemotePuzzle(sharedPuzzleCode).then(()=>focusPuzzleBoard());
    if(!renderCachedLibraryImmediately())fetchLibrary({ reset: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

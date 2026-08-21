(() => {
  'use strict';

  const VIDEO_WIDTH = 2560;
  const VIDEO_HEIGHT = 1440;
  const FPS = 24;
  const VIEW_SECONDS = 2;
  const TRANSITION_SECONDS = 0.32;
  const EXPORT_BUTTON_ID = 'videoExportBtn';
  const STATUS_ID = 'videoExportStatus';

  const $ = id => document.getElementById(id);

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function yieldToBrowser() {
    return new Promise(resolve => requestAnimationFrame(() => resolve()));
  }

  function setStatus(message, tone = '') {
    const element = $(STATUS_ID);
    if (!element) return;
    element.textContent = message;
    element.dataset.tone = tone;
  }

  function setExporting(exporting) {
    const button = $(EXPORT_BUTTON_ID);
    if (!button) return;
    button.disabled = exporting;
    button.setAttribute('aria-busy', exporting ? 'true' : 'false');
    button.classList.toggle('exporting', exporting);
    button.textContent = exporting ? 'Generating 2K Video…' : 'Export 2K Video';
  }

  function getAppState() {
    return window.lovdokuApp?.getState?.() || null;
  }

  function cssVar(name, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  }

  function getVisualStyle() {
    return {
      given: cssVar('--given', '#0f172a'),
      entry: cssVar('--entry', '#2563eb'),
      thin: cssVar('--thin-line-color', '#cbd5e1'),
      thick: cssVar('--thick-line-color', '#1e293b'),
      boardFont: cssVar('--board-font-family', "'Plus Jakarta Sans', sans-serif"),
      boardWeight: cssVar('--board-font-weight', '700')
    };
  }

  function snapshotState() {
    const state = getAppState();
    if (!state?.puzzle) return null;
    return {
      puzzle: state.puzzle,
      givens: [...state.givens],
      values: [...state.values],
      code: state.currentPuzzleCode || 'CUSTOM',
      visual: getVisualStyle()
    };
  }

  function buildSequence(snapshot) {
    const puzzle = snapshot.puzzle;
    if (puzzle.mode !== 'multi_grid') return [{ kind: 'all', label: 'Full screen' }];

    const sequence = [{ kind: 'all', label: 'Full screen' }];
    puzzle.layout.forEach((grid, index) => {
      sequence.push({ kind: 'focus', index, label: `Board ${index + 1}` });
    });
    sequence.push({ kind: 'all', label: 'Full screen' });
    return sequence;
  }

  function getTotalDuration(sequence) {
    return sequence.length * VIEW_SECONDS;
  }

  function getPuzzleBounds(puzzle) {
    const coords = puzzle.map.coords || [];
    const rows = coords.map(coord => coord[0]);
    const cols = coords.map(coord => coord[1]);
    return {
      minR: Math.min(...rows),
      maxR: Math.max(...rows),
      minC: Math.min(...cols),
      maxC: Math.max(...cols),
      width: Math.max(...cols) - Math.min(...cols) + 1,
      height: Math.max(...rows) - Math.min(...rows) + 1
    };
  }

  function easeInOut(value) {
    const t = Math.max(0, Math.min(1, value));
    return t * t * (3 - 2 * t);
  }

  function drawCinematicBackground(ctx) {
    const gradient = ctx.createLinearGradient(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
    gradient.addColorStop(0, '#111827');
    gradient.addColorStop(0.5, '#1e1b4b');
    gradient.addColorStop(1, '#0f172a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);

    const leftGlow = ctx.createRadialGradient(320, 160, 20, 320, 160, 760);
    leftGlow.addColorStop(0, 'rgba(129,140,248,0.24)');
    leftGlow.addColorStop(1, 'rgba(129,140,248,0)');
    ctx.fillStyle = leftGlow;
    ctx.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);

    const rightGlow = ctx.createRadialGradient(2240, 1180, 20, 2240, 1180, 820);
    rightGlow.addColorStop(0, 'rgba(45,212,191,0.14)');
    rightGlow.addColorStop(1, 'rgba(45,212,191,0)');
    ctx.fillStyle = rightGlow;
    ctx.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
  }

  function drawHeader(ctx, snapshot, label) {
    const font = snapshot.visual.boardFont;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = `800 38px ${font}`;
    ctx.fillText('LOVDOKU', 92, 92);
    ctx.fillStyle = 'rgba(226,232,240,0.74)';
    ctx.font = `600 24px ${font}`;
    ctx.fillText(`#${snapshot.code}`, 94, 132);

    const labelWidth = ctx.measureText(label).width;
    ctx.fillStyle = 'rgba(15,23,42,0.56)';
    ctx.beginPath();
    ctx.roundRect(VIDEO_WIDTH - labelWidth - 150, 62, labelWidth + 72, 56, 28);
    ctx.fill();
    ctx.fillStyle = 'rgba(224,231,255,0.94)';
    ctx.font = `700 24px ${font}`;
    ctx.fillText(label, VIDEO_WIDTH - labelWidth - 114, 98);
    ctx.restore();
  }

  function drawFooter(ctx, snapshot) {
    ctx.save();
    ctx.fillStyle = 'rgba(226,232,240,0.6)';
    ctx.font = `500 22px ${snapshot.visual.boardFont}`;
    ctx.textAlign = 'center';
    ctx.fillText('Constraint Sudoku', VIDEO_WIDTH / 2, VIDEO_HEIGHT - 64);
    ctx.restore();
  }

  function roundedRectPath(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function firstConstraintColor(snapshot, index) {
    const owners = snapshot.puzzle.owners?.[index] || [];
    const appOwnerColor = window.lovdokuApp?.ownerColor;
    if (typeof appOwnerColor === 'function') {
      for (const owner of owners) {
        const color = appOwnerColor(owner, index);
        if (color) return color;
      }
    }
    return '';
  }

  function valueAt(snapshot, index) {
    return snapshot.givens[index] || snapshot.values[index] || 0;
  }

  function makeCellRecords(snapshot) {
    const puzzle = snapshot.puzzle;
    const bounds = getPuzzleBounds(puzzle);
    const records = [];
    const seen = new Set();
    for (const [row, col] of puzzle.map.coords) {
      const index = puzzle.map.coordIndex.get(`${row},${col}`);
      if (!Number.isInteger(index) || seen.has(index)) continue;
      seen.add(index);
      records.push({
        index,
        row: row - bounds.minR,
        col: col - bounds.minC,
        localRow: row,
        localCol: col,
        owners: puzzle.owners?.[index] || []
      });
    }
    return { records, width: bounds.width, height: bounds.height, minR: bounds.minR, minC: bounds.minC };
  }

  function getCamera(snapshot, view, layout) {
    const paddingX = view.kind === 'focus' ? 270 : 190;
    const paddingTop = view.kind === 'focus' ? 190 : 170;
    const paddingBottom = 180;
    const availableWidth = VIDEO_WIDTH - paddingX * 2;
    const availableHeight = VIDEO_HEIGHT - paddingTop - paddingBottom;
    let cellSize = Math.max(1, Math.floor(Math.min(availableWidth / layout.width, availableHeight / layout.height)));
    let originX = Math.round((VIDEO_WIDTH - layout.width * cellSize) / 2);
    let originY = Math.round(paddingTop + (availableHeight - layout.height * cellSize) / 2);

    if (view.kind === 'focus' && snapshot.puzzle.mode === 'multi_grid') {
      const grid = snapshot.puzzle.layout[view.index] || snapshot.puzzle.layout[0];
      cellSize = Math.max(1, Math.floor(Math.min(availableWidth / 9, availableHeight / 9)));
      const focusX = (grid.c0 - layout.minC) + 4.5;
      const focusY = (grid.r0 - layout.minR) + 4.5;
      originX = Math.round(VIDEO_WIDTH / 2 - focusX * cellSize);
      originY = Math.round(paddingTop + availableHeight / 2 - focusY * cellSize);
    }
    return { cellSize, originX, originY };
  }

  function interpolateCamera(from, to, amount) {
    return {
      cellSize: from.cellSize + (to.cellSize - from.cellSize) * amount,
      originX: from.originX + (to.originX - from.originX) * amount,
      originY: from.originY + (to.originY - from.originY) * amount
    };
  }

  function drawBoard(ctx, snapshot, view, alpha = 1, cameraOverride = null) {
    const layout = makeCellRecords(snapshot);
    if (!layout.records.length) return;
    const camera = cameraOverride || getCamera(snapshot, view, layout);
    const { cellSize, originX, originY } = camera;
    const boardWidth = layout.width * cellSize;
    const boardHeight = layout.height * cellSize;
    const scale = Math.max(0.25, Math.min(1.45, 9 / Math.max(1, layout.width, layout.height)));
    const thinWidth = Math.max(1, 1 * scale);
    const thickWidth = Math.max(2, 3 * scale);
    const { thin, thick, given, entry, boardFont, boardWeight } = snapshot.visual;
    const recordByCell = new Map(layout.records.map(record => [`${record.row},${record.col}`, record]));

    ctx.save();
    ctx.globalAlpha = alpha;

    if (snapshot.puzzle.mode !== 'multi_grid') {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.34)';
      ctx.shadowBlur = 34;
      ctx.shadowOffsetY = 18;
      ctx.fillStyle = '#ffffff';
      roundedRectPath(ctx, originX, originY, boardWidth, boardHeight, Math.min(26, cellSize * 0.15));
      ctx.fill();
      ctx.restore();
    }

    for (const record of layout.records) {
      const x = originX + record.col * cellSize;
      const y = originY + record.row * cellSize;
      const color = firstConstraintColor(snapshot, record.index);
      ctx.fillStyle = color || '#ffffff';
      ctx.fillRect(x, y, cellSize, cellSize);

      const value = valueAt(snapshot, record.index);
      if (value) {
        const isGiven = Boolean(snapshot.givens[record.index]);
        ctx.fillStyle = isGiven ? given : entry;
        ctx.font = `${boardWeight} ${Math.max(18, Math.floor(cellSize * 0.60))}px ${boardFont}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(value), x + cellSize / 2, y + cellSize / 2 + cellSize * 0.015);
      }
    }

    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';
    ctx.strokeStyle = thin;
    ctx.lineWidth = thinWidth;
    for (const record of layout.records) {
      const x = originX + record.col * cellSize;
      const y = originY + record.row * cellSize;
      if (recordByCell.has(`${record.row},${record.col + 1}`)) {
        ctx.beginPath();
        ctx.moveTo(x + cellSize, y);
        ctx.lineTo(x + cellSize, y + cellSize);
        ctx.stroke();
      }
      if (recordByCell.has(`${record.row + 1},${record.col}`)) {
        ctx.beginPath();
        ctx.moveTo(x, y + cellSize);
        ctx.lineTo(x + cellSize, y + cellSize);
        ctx.stroke();
      }
    }

    const heavySegments = new Set();
    for (const record of layout.records) {
      const x = originX + record.col * cellSize;
      const y = originY + record.row * cellSize;
      for (const owner of record.owners || []) {
        if (owner.lc === 2 || owner.lc === 5) heavySegments.add(`v:${x + cellSize}:${y}:${y + cellSize}`);
        if (owner.lr === 2 || owner.lr === 5) heavySegments.add(`h:${y + cellSize}:${x}:${x + cellSize}`);
        if (owner.lc === 0 && !recordByCell.has(`${record.row},${record.col - 1}`)) heavySegments.add(`v:${x}:${y}:${y + cellSize}`);
        if (owner.lc === 8 && !recordByCell.has(`${record.row},${record.col + 1}`)) heavySegments.add(`v:${x + cellSize}:${y}:${y + cellSize}`);
        if (owner.lr === 0 && !recordByCell.has(`${record.row - 1},${record.col}`)) heavySegments.add(`h:${y}:${x}:${x + cellSize}`);
        if (owner.lr === 8 && !recordByCell.has(`${record.row + 1},${record.col}`)) heavySegments.add(`h:${y + cellSize}:${x}:${x + cellSize}`);
      }
    }

    ctx.strokeStyle = thick;
    ctx.lineWidth = thickWidth;
    for (const segment of heavySegments) {
      const [kind, first, second, third] = segment.split(':');
      const a = Number(first);
      const b = Number(second);
      const c = Number(third);
      ctx.beginPath();
      if (kind === 'v') {
        ctx.moveTo(a, b);
        ctx.lineTo(a, c);
      } else {
        ctx.moveTo(b, a);
        ctx.lineTo(c, a);
      }
      ctx.stroke();
    }

    ctx.strokeStyle = thick;
    ctx.lineWidth = thickWidth;
    if (snapshot.puzzle.mode !== 'multi_grid') {
      ctx.strokeRect(originX, originY, boardWidth, boardHeight);
    }
    ctx.restore();
  }

  function drawFrame(ctx, snapshot, view, alpha = 1, cameraOverride = null) {
    drawBoard(ctx, snapshot, view, alpha, cameraOverride);
  }

  function renderAtTime(ctx, canvas, snapshot, sequence, timeSeconds) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawCinematicBackground(ctx);
    const safeTime = Math.max(0, Math.min(getTotalDuration(sequence) - 1 / FPS, timeSeconds));
    const segment = Math.min(sequence.length - 1, Math.floor(safeTime / VIEW_SECONDS));
    const local = safeTime - segment * VIEW_SECONDS;
    const current = sequence[segment];
    const next = sequence[segment + 1];
    const layout = makeCellRecords(snapshot);
    let camera = getCamera(snapshot, current, layout);
    if (next && local > VIEW_SECONDS - TRANSITION_SECONDS) {
      const amount = easeInOut((local - (VIEW_SECONDS - TRANSITION_SECONDS)) / TRANSITION_SECONDS);
      camera = interpolateCamera(camera, getCamera(snapshot, next, layout), amount);
    }

    drawHeader(ctx, snapshot, current.label);
    drawFrame(ctx, snapshot, current, 1, camera);
    drawFooter(ctx, snapshot);
  }

  async function pickSupportedAvcConfig(width, height, bitrate) {
    if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') return null;
    const codecs = ['avc1.640033', 'avc1.640034', 'avc1.4d0033', 'avc1.420033'];
    for (const codec of codecs) {
      const config = { codec, width, height, bitrate, framerate: FPS, latencyMode: 'quality' };
      try {
        const result = await VideoEncoder.isConfigSupported(config);
        if (result?.supported) return result.config || config;
      } catch (_) {
        // Try the next AVC profile/level combination.
      }
    }
    return null;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function filename(snapshot, extension) {
    const code = String(snapshot.code || 'CUSTOM').replace(/[^A-Z0-9_-]/gi, '-');
    return `lovdoku-${code}-2k.${extension}`;
  }

  async function exportWithWebCodecs(snapshot, sequence, canvas) {
    const config = await pickSupportedAvcConfig(VIDEO_WIDTH, VIDEO_HEIGHT, 16_000_000);
    if (!config || !window.Mp4Muxer) throw new Error('This browser does not support 2K WebCodecs MP4 export.');

    const target = new Mp4Muxer.ArrayBufferTarget();
    const muxer = new Mp4Muxer.Muxer({
      target,
      video: { codec: 'avc', width: VIDEO_WIDTH, height: VIDEO_HEIGHT },
      fastStart: 'in-memory'
    });
    let encoderError = null;
    const encoder = new VideoEncoder({
      output: (chunk, metadata) => muxer.addVideoChunk(chunk, metadata),
      error: error => { encoderError = error; }
    });
    encoder.configure(config);

    const totalFrames = Math.ceil(getTotalDuration(sequence) * FPS);
    const ctx = canvas.getContext('2d', { alpha: false });
    try {
      for (let frame = 0; frame < totalFrames; frame += 1) {
        if (encoderError) throw encoderError;
        renderAtTime(ctx, canvas, snapshot, sequence, frame / FPS);
        while (encoder.encodeQueueSize > 8) {
          await sleep(5);
          if (encoderError) throw encoderError;
        }
        const videoFrame = new VideoFrame(canvas, {
          timestamp: Math.round(frame * 1_000_000 / FPS),
          duration: Math.round(1_000_000 / FPS)
        });
        try {
          encoder.encode(videoFrame, { keyFrame: frame === 0 || frame % (FPS * 2) === 0 });
        } finally {
          videoFrame.close();
        }
        if (frame % Math.max(1, Math.floor(FPS / 2)) === 0) {
          setStatus(`Rendering 2K frame ${frame + 1} of ${totalFrames}…`);
          await yieldToBrowser();
        }
      }
      setStatus('Finalizing MP4…');
      await encoder.flush();
      if (encoderError) throw encoderError;
    } finally {
      if (encoder.state !== 'closed') encoder.close();
    }

    muxer.finalize();
    const blob = new Blob([target.buffer], { type: 'video/mp4' });
    downloadBlob(blob, filename(snapshot, 'mp4'));
  }

  async function exportWithMediaRecorder(snapshot, sequence, canvas) {
    if (!canvas.captureStream || typeof MediaRecorder === 'undefined') {
      throw new Error('This browser does not support browser-side video generation.');
    }
    const types = [
      'video/mp4;codecs=avc1',
      'video/mp4',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm'
    ];
    const selectedType = types.find(type => MediaRecorder.isTypeSupported?.(type)) || '';
    const stream = canvas.captureStream(FPS);
    const chunks = [];
    const recorder = selectedType ? new MediaRecorder(stream, { mimeType: selectedType }) : new MediaRecorder(stream);
    const ctx = canvas.getContext('2d', { alpha: false });
    const totalDuration = getTotalDuration(sequence);

    recorder.ondataavailable = event => {
      if (event.data?.size) chunks.push(event.data);
    };
    const stopped = new Promise(resolve => { recorder.onstop = resolve; });
    recorder.start(100);
    const start = performance.now();
    await new Promise((resolve, reject) => {
      const render = () => {
        try {
          const elapsed = (performance.now() - start) / 1000;
          const finished = elapsed >= totalDuration;
          renderAtTime(ctx, canvas, snapshot, sequence, finished ? totalDuration : elapsed);
          setStatus(`Recording video ${(Math.min(elapsed, totalDuration)).toFixed(1)}s / ${totalDuration.toFixed(1)}s…`);
          if (finished) {
            recorder.stop();
            resolve();
            return;
          }
          requestAnimationFrame(render);
        } catch (error) {
          reject(error);
        }
      };
      render();
    });
    await stopped;

    const isMp4 = selectedType.includes('mp4');
    const extension = isMp4 ? 'mp4' : 'webm';
    const blob = new Blob(chunks, { type: selectedType || 'video/webm' });
    downloadBlob(blob, filename(snapshot, extension));
    return isMp4;
  }

  async function exportVideo() {
    const button = $(EXPORT_BUTTON_ID);
    if (!button || button.disabled) return;
    const snapshot = snapshotState();
    if (!snapshot) {
      setStatus('Select a Sudoku puzzle first.', 'error');
      return;
    }

    const sequence = buildSequence(snapshot);
    const canvas = document.createElement('canvas');
    canvas.width = VIDEO_WIDTH;
    canvas.height = VIDEO_HEIGHT;
    setExporting(true);
    setStatus(`Preparing ${snapshot.puzzle.mode === 'multi_grid' ? 'multi-grid' : 'single-grid'} 2K video…`);

    try {
      if (document.fonts?.ready) await document.fonts.ready;
      const hasWebCodecs = typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined' && !!window.Mp4Muxer;
      if (hasWebCodecs) {
        await exportWithWebCodecs(snapshot, sequence, canvas);
        setStatus('MP4 downloaded successfully.', 'success');
      } else {
        const isMp4 = await exportWithMediaRecorder(snapshot, sequence, canvas);
        setStatus(isMp4 ? 'MP4 downloaded successfully.' : 'WebM downloaded; this browser does not expose MP4 recording.', isMp4 ? 'success' : 'warning');
      }
    } catch (error) {
      console.error('Lovdoku video export failed:', error);
      setStatus(error?.message || 'Video export failed. Try a Chromium-based browser.', 'error');
    } finally {
      setExporting(false);
    }
  }

  function setup() {
    $(EXPORT_BUTTON_ID)?.addEventListener('click', exportVideo);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup, { once: true });
  } else {
    setup();
  }
})();

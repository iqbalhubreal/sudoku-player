self.onmessage = async (event) => {
  const { bitmap, type = 'image/jpeg', quality = 0.88 } = event.data || {};

  try {
    if (!bitmap || typeof OffscreenCanvas === 'undefined') {
      throw new Error('Worker image processing is unavailable.');
    }

    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Could not create the worker canvas.');

    context.drawImage(bitmap, 0, 0);
    bitmap.close?.();

    const blob = await canvas.convertToBlob({ type, quality });
    self.postMessage({ ok: true, blob });
  } catch (error) {
    bitmap?.close?.();
    self.postMessage({ ok: false, error: error?.message || 'Worker image processing failed.' });
  }
};

self.postMessage({ ready: true });

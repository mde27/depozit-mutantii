// Client-side photo preparation for ticket uploads: every image is resized so its
// longest side is at most MAX_SIDE px and re-encoded as JPEG, so uploads stay small
// (typically 150–600 KB) and phone photos (often 5–10 MB) work over mobile data.
export const MAX_PHOTOS = 5;
export const MAX_SIDE = 1600;
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024; // keep in sync with MAX_PHOTO_BYTES in backend/Code.gs
const QUALITIES = [0.82, 0.7, 0.55];

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`"${file.name}" is not an image that can be read.`));
    };
    img.src = url;
  });
}

/** Returns size that fits in max×max, keeping the aspect ratio. */
export function fitSize(width, height, max = MAX_SIDE) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** base64 length → decoded byte count. */
export function base64Bytes(b64) {
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - pad;
}

/**
 * Resizes + compresses one image file.
 * Resolves { name, mimeType: 'image/jpeg', data (base64, no prefix), previewUrl, bytes, width, height }.
 */
export async function preparePhoto(file) {
  if (!file || !/^image\//.test(file.type || '')) {
    throw new Error(`"${file?.name || 'file'}" is not an image.`);
  }
  const { img, url } = await loadImage(file);
  try {
    const { width, height } = fitSize(img.naturalWidth || img.width, img.naturalHeight || img.height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; // transparent PNGs get a white background in JPEG
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    for (const q of QUALITIES) {
      const dataUrl = canvas.toDataURL('image/jpeg', q);
      const data = dataUrl.slice(dataUrl.indexOf(',') + 1);
      const bytes = base64Bytes(data);
      if (bytes <= MAX_PHOTO_BYTES) {
        const base = (file.name || 'photo').replace(/\.[^.]+$/, '').slice(0, 60) || 'photo';
        return { name: `${base}.jpg`, mimeType: 'image/jpeg', data, previewUrl: dataUrl, bytes, width, height };
      }
    }
    throw new Error(`"${file.name}" is too large even after compression.`);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Drive thumbnail / full-view URLs for a stored photo id (file shared "anyone with the link"). */
export const photoThumbUrl = (id, size = 400) => `https://lh3.googleusercontent.com/d/${encodeURIComponent(id)}=w${size}`;
export const photoViewUrl = (id) => `https://drive.google.com/file/d/${encodeURIComponent(id)}/view`;

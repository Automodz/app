// Image upload - Cloudinary unsigned upload (free, no credit card).
// Set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME + NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET.
// Firebase Storage was removed on purpose: new Firebase projects require a
// billing card for Storage, and Cloudinary's CDN serves images faster anyway.

const CLOUDINARY_CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

/** Client-side resize/compress to ≤maxWidth, then upload. Returns download URL + path. */
export const uploadImage = async (
  path: string, file: File, opts: { maxWidth?: number; quality?: number } = {},
): Promise<{ url: string; path: string }> => {
  if (!CLOUDINARY_CLOUD || !CLOUDINARY_PRESET) {
    throw new Error(
      'Image uploads not configured - set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET in .env.local',
    );
  }
  const { maxWidth = 1600, quality = 0.82 } = opts;
  const blob = await resizeImage(file, maxWidth, quality);

  const form = new FormData();
  form.append('file', blob);
  form.append('upload_preset', CLOUDINARY_PRESET);
  // folder mirrors the logical path, e.g. carListings/abc123
  form.append('folder', path.split('/').slice(0, -1).join('/'));
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
    method: 'POST', body: form,
  });
  if (!res.ok) throw new Error('Cloudinary upload failed');
  const data = await res.json() as { secure_url: string; public_id: string };
  return { url: data.secure_url, path: `cloudinary:${data.public_id}` };
};

export const deleteImage = async (_path: string) => {
  // Cloudinary unsigned uploads can't be deleted from the client (needs a signed
  // request) - orphaned images just age out of the media library. No-op is safe.
};

const resizeImage = (file: File, maxWidth: number, quality: number): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('canvas unavailable')); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        b => (b ? resolve(b) : reject(new Error('compress failed'))),
        'image/jpeg', quality,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image load failed')); };
    img.src = url;
  });

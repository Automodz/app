// Image upload - Cloudinary, SIGNED.
//
// This used to use an unsigned upload preset, which meant the cloud name and
// the permission to write to it both shipped in the public bundle: anyone could
// fill the studio's account. It also made deletion impossible, so removing a
// photo removed nothing. Both doors now go through the server, which holds the
// API secret and checks that the caller owns the path
// (/api/media/sign, /api/media/delete → lib/server/cloudinary.ts).
//
// Firebase Storage was removed on purpose: new Firebase projects require a
// billing card for Storage, and Cloudinary's CDN serves images faster anyway.

import { authedFetch } from '../clientSession';
const idToken = async (): Promise<string> => {
  /* Waited for, not guessed at - see lib/clientSession.ts. */
  const { idToken: token } = await import('../clientSession');
  const t = await token();
  if (!t) throw new Error('not-signed-in');
  return t;
};

/** Client-side resize/compress to ≤maxWidth, then upload. Returns download URL + path. */
export const uploadImage = async (
  path: string, file: File, opts: { maxWidth?: number; quality?: number } = {},
): Promise<{ url: string; path: string }> => {
  const { maxWidth = 1600, quality = 0.82 } = opts;
  if (tooLargeToUpload(file.size)) throw new Error('file-too-large');
  const blob = await resizeImage(file, maxWidth, quality);

  // one signature, bound to this exact public_id, valid for this upload only
  const signRes = await authedFetch('/api/media/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await idToken()}` },
    body: JSON.stringify({ path }),
  });
  if (!signRes.ok) {
    const { error } = await signRes.json().catch(() => ({ error: 'sign-failed' }));
    throw new Error(error ?? 'sign-failed');
  }
  const s = await signRes.json() as {
    cloudName: string; apiKey: string; publicId: string;
    timestamp: number; overwrite: string; signature: string;
  };

  const form = new FormData();
  form.append('file', blob);
  form.append('api_key', s.apiKey);
  form.append('timestamp', String(s.timestamp));
  form.append('public_id', s.publicId);
  form.append('overwrite', s.overwrite);
  form.append('signature', s.signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${s.cloudName}/image/upload`, {
    method: 'POST', body: form,
  });
  if (!res.ok) throw new Error('Cloudinary upload failed');
  const data = await res.json() as { secure_url: string; public_id: string };
  return { url: data.secure_url, path: `cloudinary:${data.public_id}` };
};

/** Actually deletes. Throws if the studio refuses - callers should surface that. */
export const deleteImage = async (path: string): Promise<void> => {
  if (!path) return;
  const res = await authedFetch('/api/media/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await idToken()}` },
    body: JSON.stringify({ path }),
  });
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: 'delete-failed' }));
    throw new Error(error ?? 'delete-failed');
  }
};

/**
 * The largest file worth decoding.
 *
 * Everything is re-encoded to JPEG at `maxWidth`, so what is uploaded is
 * bounded whatever arrives - but the DECODE is not. A 100MB burst frame or a
 * RAW export is pulled into an `<img>` and a canvas first, and on a phone that
 * is how a tab dies. A modern photograph is comfortably under this.
 */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/** Refused before anything is read. Non-images fail the decode below anyway. */
export const tooLargeToUpload = (bytes: number): boolean => bytes > MAX_UPLOAD_BYTES;

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

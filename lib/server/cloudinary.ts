import { createHash } from 'crypto';

/**
 * Cloudinary, signed.
 *
 * The upload preset used to be UNSIGNED and shipped in the client bundle as
 * `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`, which meant the cloud name and the
 * permission to write to it were public: anyone who opened devtools could POST
 * unlimited images into the studio's account. Deleting was the mirror problem -
 * unsigned uploads cannot be destroyed from the client, so `deleteImage()` was
 * a documented no-op and "remove this photo" removed nothing.
 *
 * Both halves need the same thing: a signature made with the API secret, which
 * only the server holds. This module is that signature and nothing else.
 */

const CLOUD = process.env.CLOUDINARY_CLOUD_NAME
  ?? process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;

export const cloudinaryConfigured = () => !!(CLOUD && API_KEY && API_SECRET);

/**
 * CAN THIS DEPLOYMENT ACCEPT A PHOTOGRAPH AT ALL?
 *
 * The same question `cloudinaryConfigured` answers, named for the surfaces
 * that ask it rather than for the service behind it — and it is asked because
 * §10.5 says nothing is inert. Without the API secret `/api/media/sign`
 * answers 503, so a customer who taps "Choose a photograph", picks one from
 * their phone and presses send is told it would not upload. That is a control
 * that does not work, and offering it is the product promising something the
 * deployment cannot do.
 *
 * Read on the SERVER and handed to the form, so it corrects itself the moment
 * the keys are set — the alternative, hiding the control by hand, would need
 * un-hiding by hand.
 */
export const canAcceptPhotographs = cloudinaryConfigured;

export const cloudinaryCloud = () => CLOUD!;
export const cloudinaryApiKey = () => API_KEY!;

/**
 * Cloudinary's scheme: sort the params, join `k=v` with `&`, append the secret,
 * SHA-1 the lot. `api_key`, `file` and `resource_type` are excluded by spec.
 */
export const sign = (params: Record<string, string | number>): string => {
  const base = Object.keys(params)
    .filter(k => params[k] !== undefined && params[k] !== '')
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join('&');
  return createHash('sha1').update(base + API_SECRET).digest('hex');
};

/** Destroy one asset. Returns true when it is gone (or was already gone). */
export const destroy = async (publicId: string): Promise<boolean> => {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = sign({ public_id: publicId, timestamp });
  const form = new URLSearchParams({
    public_id: publicId,
    timestamp: String(timestamp),
    api_key: API_KEY!,
    signature,
  });
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/destroy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  if (!res.ok) return false;
  const out = await res.json().catch(() => ({})) as { result?: string };
  // `not found` is success from the caller's point of view: it is not there
  return out.result === 'ok' || out.result === 'not found';
};

/**
 * WHO MAY TOUCH WHAT.
 *
 * Ownership is read off the asset's own folder, because that is the only thing
 * about a Cloudinary id the server can trust. The paths the app writes are:
 *
 *   vehicles/{uid}-...        the owner of that uid, or staff
 *   sellRequests/{uid}/...    the owner of that uid, or staff
 *   gallery/...               staff only
 *   carListings/{id}/...      staff only
 *   jobs/{jobId}/...          staff only
 *
 * Anything that does not match a known shape is refused rather than allowed -
 * an unrecognised path is not a permission to guess.
 */
export const mayWrite = (path: string, uid: string, isStaff: boolean): boolean => {
  // no traversal, no absolutes, no empty segments
  if (!path || path.startsWith('/') || path.includes('..') || path.includes('//')) return false;
  if (path.length > 300 || !/^[A-Za-z0-9/_.-]+$/.test(path)) return false;

  if (isStaff) return /^(vehicles|sellRequests|gallery|carListings|jobs)\//.test(path);

  // a customer owns exactly two shapes, both stamped with their own uid
  if (path.startsWith(`vehicles/${uid}-`)) return true;
  if (path.startsWith(`sellRequests/${uid}/`)) return true;
  return false;
};

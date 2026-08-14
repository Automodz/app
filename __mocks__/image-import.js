/**
 * A STATICALLY IMPORTED IMAGE, UNDER JEST.
 *
 * `lib/media.ts` imports the hero photograph rather than naming its path, so
 * that `next/image` reads the file's real width and height at build time and
 * no frame has to be told the aspect ratio by hand. Next's loader turns that
 * import into `{ src, width, height, blurDataURL }`; jest has no such loader
 * and tries to parse the JPEG as JavaScript, which fails on the first byte.
 *
 * So this stands in for it. The SHAPE is what matters - anything reading
 * `.width` / `.height` must get numbers rather than `undefined` - and the
 * values are deliberately not the real file's, because nothing may assert on
 * them: the whole point of the static import is that the dimensions come from
 * the file and change when it is recropped.
 */
module.exports = {
  __esModule: true,
  default: { src: '/test-image.jpg', width: 100, height: 100, blurDataURL: '' },
};

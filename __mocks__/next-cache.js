/**
 * `next/cache` under jest.
 *
 * `unstable_cache` reaches into Next's server runtime, which expects the
 * undici globals (`Request`, `Response`) that jsdom does not provide - so
 * importing it takes the whole suite down at module load, before a single
 * assertion runs.
 *
 * Stubbed rather than removed from the source, exactly as `server-only` is:
 * the cross-request cache is a property of the Next server and there is no
 * server here, so the honest stand-in is the uncached function. Every
 * assertion about WHAT is read stays true; only the caching, which has nothing
 * to assert against in a unit test, is absent.
 */
const unstable_cache = (fn) => fn;
const revalidateTag = () => {};
const revalidatePath = () => {};

module.exports = { unstable_cache, revalidateTag, revalidatePath };

/**
 * `next/navigation` outside a Next request.
 *
 * `renderToStaticMarkup` has no App Router context, so `useRouter` throws. The
 * screens legitimately need the router — an expansion that is addressable
 * (§6.4) has to be able to write its own address — so the fix is to supply the
 * context the test environment lacks, not to take the capability out of the
 * component.
 *
 * The mock is inert on purpose: these are RENDER tests. They assert what the
 * markup says, and a navigation that actually moved would invalidate the very
 * thing being measured.
 */
const noop = () => {};

module.exports = {
  useRouter: () => ({
    push: noop, replace: noop, refresh: noop,
    back: noop, forward: noop, prefetch: noop,
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
  redirect: noop,
  notFound: noop,
};

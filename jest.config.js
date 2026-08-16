/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    /* `server-only` exists to make a build fail if server code reaches a client
       bundle. Under jest there are no bundles, so it is stubbed rather than
       removed from the source - the guard stays real where it matters. */
    '^server-only$': '<rootDir>/__mocks__/server-only.js',
    /* See __mocks__/next-navigation.js - the App Router context does not exist
       under `renderToStaticMarkup`, and the screens need the router to keep
       their expansions addressable. */
    '^next/navigation$': '<rootDir>/__mocks__/next-navigation.js',
    /* See __mocks__/next-cache.js - `unstable_cache` drags in Next's server
       runtime, which needs undici globals jsdom has not got. */
    '^next/cache$': '<rootDir>/__mocks__/next-cache.js',
    /* Next's loader turns `import photo from './x.jpg'` into an object with the
       file's real dimensions; jest has no loader and parses the JPEG as JS.
       Mapped BEFORE the `@/` alias, or `@/public/...` would resolve to the
       binary and fail there instead. */
    '\\.(jpg|jpeg|png|gif|webp|avif|svg)$': '<rootDir>/__mocks__/image-import.js',
    '^@/(.*)$': '<rootDir>/$1',
  },
  setupFiles: ['<rootDir>/jest.setup.js'],
  transform: {
    /* `jsx: react-jsx` here rather than in tsconfig.json: Next compiles JSX
       itself and needs `preserve`, but ts-jest has to emit real calls. */
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: { jsx: 'react-jsx' } }],
  },
};

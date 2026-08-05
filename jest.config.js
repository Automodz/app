/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    /* `server-only` exists to make a build fail if server code reaches a client
       bundle. Under jest there are no bundles, so it is stubbed rather than
       removed from the source — the guard stays real where it matters. */
    '^server-only$': '<rootDir>/__mocks__/server-only.js',
    /* See __mocks__/next-navigation.js — the App Router context does not exist
       under `renderToStaticMarkup`, and the screens need the router to keep
       their expansions addressable. */
    '^next/navigation$': '<rootDir>/__mocks__/next-navigation.js',
    '^@/(.*)$': '<rootDir>/$1',
  },
  setupFiles: ['<rootDir>/jest.setup.js'],
  transform: {
    /* `jsx: react-jsx` here rather than in tsconfig.json: Next compiles JSX
       itself and needs `preserve`, but ts-jest has to emit real calls. */
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: { jsx: 'react-jsx' } }],
  },
};

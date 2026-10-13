/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  moduleNameMapper: {
    '^@cms/shared-types$': '<rootDir>/../../packages/shared-types/src/index.ts',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // pnpm giữ gói trong node_modules/.pnpm/<pkg>@ver/node_modules/<pkg>.
  // Phải cho phép transform các gói RN/Expo dù nằm sau đoạn .pnpm.
  transformIgnorePatterns: [
    'node_modules/(?!(?:.pnpm/[^/]+/node_modules/)?((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|react-native-css-interop|nativewind|@cms/.*))',
  ],
  testMatch: ['<rootDir>/src/**/*.test.ts', '<rootDir>/src/**/*.test.tsx'],
};

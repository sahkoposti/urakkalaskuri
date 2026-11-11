import tsParser from '@typescript-eslint/parser';

import boundaries from './eslint/import-boundaries-plugin.mjs';

export default [
  {
    ignores: [
      'node_modules/**',
      '**/__tests__/**',
      'scripts/**',
      '.expo/**',
    ],
  },
  {
    files: ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      boundaries,
    },
    rules: {
      'boundaries/feature-public-entry-only': 'warn',
      'boundaries/database-connection-scope': 'warn',
    },
  },
];

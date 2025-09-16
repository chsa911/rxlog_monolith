// backend/eslint.config.cjs
const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  // Default: all backend JS (Node)
  {
    files: ['**/*.js'],
    ignores: ['node_modules/**', 'coverage/**', 'dist/**'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',           // you use require()
      globals: {
        ...globals.node,                // process, __dirname, console, setTimeout, etc.
        ...globals.es2022,
      },
    },
    rules: {
      'no-console': 'off',              // allow server logs
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },

  // Tests: enable Jest globals
  {
    files: ['tests/**/*.js', '**/*.test.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,                // describe, it, expect, beforeAll, etc.
      },
    },
    rules: {
      'no-console': 'off',
    },
  },

  // Scripts (CLI/maintenance). Same globals, keep logs allowed.
  {
    files: ['scripts/**/*.js', 'jobs/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
];

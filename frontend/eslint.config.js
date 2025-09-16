// frontend/eslint.config.js
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'public/**',
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },   // ✅ JSX parsing lives here in v9
      },
      globals: {
        ...globals.browser,            // window, document, etc.
        ...globals.es2022,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // React hooks best practices
      ...reactHooks.configs.recommended.rules,
      // Vite fast refresh helper
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // General polish
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-undef': 'error',
      // Allow empty catch blocks if intentional
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },
];

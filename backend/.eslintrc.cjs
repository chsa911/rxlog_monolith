const js = require('@eslint/js');
module.exports = {
  root: true,
  env: { node: true, es2022: true },
  extends: [js.configs.recommended],
  ignorePatterns: ['node_modules/', 'coverage/', 'dist/'],
  rules: {
    'no-console': 'off',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  },
};

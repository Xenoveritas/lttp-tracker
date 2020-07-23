module.exports = {
  root: true,
  plugins: [
    '@typescript-eslint',
  ],
  extends: [
    'eslint:recommended',
  ],
  rules: {
    'no-unused-vars': [ 'error', { 'argsIgnorePattern': '^_' } ]
  },
  overrides: [
    {
      files: [ '*.ts' ],
      parser: '@typescript-eslint/parser',
      extends: [
        'plugin:@typescript-eslint/recommended',
      ],
      rules: {
        '@typescript-eslint/no-unused-vars': [ 'error', { 'argsIgnorePattern': '^_' } ]
      }
    },
    {
      files: [ '*.js' ],
      env: {
        'browser': false,
        'node': true,
        'es6': true
      }
    }
  ]
};
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'functional'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:functional/recommended'
  ],
  rules: {
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'warn',
    'functional/no-let': 'warn',
    'functional/immutable-data': 'warn',
    'functional/functional-parameters': 'warn',
    'functional/no-throw-statement': 'warn',
    'functional/prefer-readonly-type': 'warn',
    // Disable some strict functional rules that might be too restrictive
    'functional/no-conditional-statement': 'off',
    'functional/no-expression-statement': 'off',
    'functional/no-return-void': 'off'
  },
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    project: './tsconfig.json'
  },
  env: {
    node: true,
    es6: true
  }
};

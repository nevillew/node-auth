module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  env: {
    node: true,
    jest: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:functional/recommended',
    'plugin:prettier/recommended',
  ],
  plugins: ['@typescript-eslint', 'functional'],
  rules: {
    // Core ESLint rules
    'no-console': 'warn',
    'no-debugger': 'warn',
    'no-return-await': 'error',
    'no-unused-vars': 'off', // Replaced by TypeScript rule
    
    // TypeScript rules
    '@typescript-eslint/explicit-function-return-type': 'error',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
    '@typescript-eslint/await-thenable': 'error',
    '@typescript-eslint/no-use-before-define': 'error',
    
    // Functional plugin rules
    'functional/no-class': 'error',
    'functional/prefer-readonly-type': 'warn',
    'functional/no-this-expression': 'error',
    'functional/no-throw-statement': 'error',
    'functional/no-conditional-statement': ['warn', { allowReturningBranches: true }],
    'functional/no-loop-statement': 'error',
    'functional/immutable-data': 'error',
    
    // Disable some strict functional rules for practicality
    'functional/no-expression-statement': 'off',
    'functional/functional-parameters': 'off',
    'functional/no-mixed-type': 'off',
    'functional/no-return-void': 'off',
  },
  ignorePatterns: ['dist', 'node_modules', 'coverage', '**/*.js'],
};
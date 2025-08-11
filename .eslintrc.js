module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  env: { 
    node: true,
    jest: true,
    es2020: true,
    browser: true
  },
  globals: {
    MouseEvent: 'readonly',
    document: 'readonly',
    window: 'readonly',
    console: 'readonly'
  },
  plugins: [
    '@typescript-eslint',
  ],
  extends: [
    'eslint:recommended',
  ],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  rules: {
    // TypeScript specific rules
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { 
      args: 'none',
      ignoreRestSiblings: true 
    }],
    
    // General code quality rules
    'no-prototype-builtins': 'off',
    'prefer-const': 'error',
    'no-var': 'error',
    'object-shorthand': 'error',
    'prefer-arrow-callback': 'error',
    
    // Obsidian plugin specific
    'no-console': 'warn',
  },
  ignorePatterns: [
    'main.js',
    'node_modules/',
    'coverage/',
    '*.js.map'
  ]
};
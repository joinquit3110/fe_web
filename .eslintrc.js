module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  extends: [
    'react-app'
  ],
  rules: {
    'no-unused-vars': 'warn',
    'unicode-bom': 'off',
    'no-useless-escape': 'off',
    'react-hooks/exhaustive-deps': 'warn',
    'no-duplicate-imports': 'error'
  }
};

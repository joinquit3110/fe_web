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
    'no-unused-vars': 'off',
    'unicode-bom': 'off',
    'no-useless-escape': 'off',
    'react-hooks/exhaustive-deps': 'off'
  }
};

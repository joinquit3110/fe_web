const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'https://be-web-6c4k.onrender.com/',
      changeOrigin: true,
    })
  );
};

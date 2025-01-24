const node_env = process.env.NODE_ENV || 'development';
const isDevelopment = node_env === 'development';
const isTest = node_env === 'test';
const isProduction = node_env === 'production';

module.exports = {
  node_env,
  isDevelopment,
  isTest,
  isProduction,
  isDev: isDevelopment,
  isProd: isProduction,
};

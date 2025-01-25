const node_env = process.env.NODE_ENV || 'development';
const isDevelopment = node_env === 'development';
const isTest = node_env === 'test';
const isProduction = node_env === 'production';
const hashSalt = parseInt(process.env.HASH_SALT || 12, 10);

module.exports = {
  node_env,
  isDevelopment,
  isTest,
  isProduction,
  isDev: isDevelopment,
  isProd: isProduction,
  hashSalt,
};

const { DB_USER, DB_PASS, DB_NAME, DB_HOST, DIALECT } = process.env;

const createEnvConfig = (dialect) => {
  if (dialect === 'sqlite') {
    return {
      // use_env_variable: 'DATABASE_URL',
      'storage': DB_NAME,
      'dialect': 'sqlite',
    };
  } else if (dialect === 'postgres') {
    return {
      // use_env_variable: 'DATABASE_URL',
      'username': DB_USER,
      'password': DB_PASS,
      'database': DB_NAME || 'nodejs_api_authentication',
      'host': DB_HOST,
      'dialect': 'postgres',
    };
  } else {
    return {
      // use_env_variable: 'DATABASE_URL',
      'storage': ':memory:',
      'dialect': 'sqlite',
      pool: {
        idle: Infinity,
        max: 1,
      },
    };
  }
};

const config = {
  'development': createEnvConfig(DIALECT || 'sqlite'),
  'test': createEnvConfig('test'),
  'production': createEnvConfig(DIALECT || 'postgres'),
};

module.exports = config;

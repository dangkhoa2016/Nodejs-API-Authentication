(async function main() {
  require('dotenv').config();
  process.env.DIALECT = 'sqlite';
  process.env.DB_NAME = ':memory:';

  var models = require('../src/app/models');
  console.log('Migrating database...');
  await models.sequelize.sync({ force: false });

  console.log('Seeding database...');
  var userSeed = require('../src/database/seeders/20250125104053-user.js');
  console.log('userSeed:', userSeed);

  var result = await userSeed.up(models.sequelize.getQueryInterface(), models.Sequelize);
  console.log('result:', result);
})();

// Usage: require('./manual/database.js')

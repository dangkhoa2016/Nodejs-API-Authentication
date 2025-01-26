/* eslint-disable */

var jwt = require('hono/jwt');
var ms = require('ms');
var now = Date.now() / 1e3 | 0;

(async () => {

  require('dotenv').config();

  var models = require('./src/app/models');
  // await models.User.sync({ force: false });
  await models.sequelize.sync({ force: false });

  var user = await models.User.create({ email: 'test@user.local', username: 'testuser', });

  var user = await models.User.build({ email: 'test@user.local', username: 'testuser', password: 'password' });

  var users = await models.User.unscoped().findAll();
  var user = await models.User.findOne();
  var user = await models.User.findOne({ order: [['id', 'DESC']] });
  var count = await models.User.count();

})();

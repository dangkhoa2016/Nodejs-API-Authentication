'use strict';

/** @type {import('sequelize-cli').Migration} */

const defaultEmail = 'admin@localhost.test';
const defaultUsername = 'admin';
const debug = require('debug')('nodejs-api-authentication:database->seeders->user');
const { User } = require('../../app/models');

module.exports = {
  async up (/*queryInterface, Sequelize*/) {
    /**
     * Add seed commands here.
     *
     * Example:
     * await queryInterface.bulkInsert('People', [{
     *   name: 'John Doe',
     *   isBetaMember: false
     * }], {});
    */
    const email = process.env.ADMIN_EMAIL || defaultEmail;
    const username = process.env.ADMIN_USERNAME || defaultUsername;
    const password = process.env.ADMIN_PASSWORD || 'password';

    // not working
    // await queryInterface.bulkInsert('Users', [{ email, username, password, role: 'admin' }], {});

    debug(`Checking if admin user exists with email: ${email} and username: ${username}`);
    const user = await User.findOne({ where: { email, username } });
    if (user) {
      debug('Admin user already exists');
      return;
    }

    debug('Creating user with email:', email, 'username:', username);
    // await User.bulkCreate([{ email, username, password, role: 'admin' }]);
    await User.create({ email, username, password, role: 'admin' });
    debug('Admin user created successfully');
  },

  async down (queryInterface/*, Sequelize*/) {
    /**
     * Add commands to revert seed here.
     *
     * Example:
     * await queryInterface.bulkDelete('People', null, {});
     */
    const email = process.env.ADMIN_EMAIL || defaultEmail;
    const username = process.env.ADMIN_USERNAME || defaultUsername;

    await queryInterface.bulkDelete('Users', { email, username }, {});
    debug('Admin user deleted successfully');
  },
};

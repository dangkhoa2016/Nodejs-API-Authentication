'use strict';
/** @type {import('sequelize-cli').Migration} */
const debug = require('debug')('nodejs-api-authentication:database->migrations->jwt-denylist');
const { JwtDenylist } = require('../../app/models');

module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      jti: Sequelize.STRING,
      exp: {
        type: Sequelize.DATE,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    };

    const transaction = await queryInterface.sequelize.transaction();

    try {
      debug(`Creating table ${JwtDenylist.tableName}...`);
      await queryInterface.createTable(JwtDenylist.tableName, columns, { transaction });
      debug(`Table ${JwtDenylist.tableName} created successfully`);

      debug(`Adding index to ${JwtDenylist.tableName} table...`);
      await queryInterface.addIndex(JwtDenylist.tableName, ['jti'], { unique: true, transaction });
      debug(`Index added to ${JwtDenylist.tableName} table successfully`);

      await transaction.commit();
    } catch (error) {
      console.error(`Error creating ${JwtDenylist.tableName} table:`, error);
      await transaction.rollback();
      throw error;
    }
  },
  async down(queryInterface/*, Sequelize*/) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.dropTable(JwtDenylist.tableName, { transaction });

      await transaction.commit();
      debug(`Table ${JwtDenylist.tableName} dropped successfully`);
    } catch (error) {
      debug(`Error dropping ${JwtDenylist.tableName} table:`, error);
      await transaction.rollback();
      throw error;
    }
  },
};

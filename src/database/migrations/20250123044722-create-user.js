'use strict';
/** @type {import('sequelize-cli').Migration} */
const debug = require('debug')('nodejs-api-authentication:database->migrations->user');
const { User } = require('../../app/models');

module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        // unique: true,  // email must be unique
      },
      encrypted_password: {
        type: Sequelize.STRING,
      },
      username: {
        type: Sequelize.STRING,
        allowNull: false,
        // unique: true, // username must be unique
      },
      first_name: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
      },
      last_name: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
      },
      avatar: Sequelize.STRING,
      role: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'user',
      },
      reset_password_token: {
        type: Sequelize.STRING,
        // unique: true,  // reset_password_token must be unique
      },
      reset_password_sent_at: Sequelize.DATE,
      remember_created_at: Sequelize.DATE,
      sign_in_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      current_sign_in_at: Sequelize.DATE,
      last_sign_in_at: Sequelize.DATE,
      current_sign_in_ip: Sequelize.STRING,
      last_sign_in_ip: Sequelize.STRING,
      confirmation_token: {
        type: Sequelize.STRING,
        // unique: true,  // confirmation_token must be unique
      },
      confirmed_at: Sequelize.DATE,
      confirmation_sent_at: Sequelize.DATE,
      unconfirmed_email: Sequelize.STRING,
      failed_attempts: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      unlock_token: {
        type: Sequelize.STRING,
        // unique: true,  // unlock_token must be unique
      },
      locked_at: Sequelize.DATE,
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
      debug(`Creating table ${User.tableName}...`);
      await queryInterface.createTable(User.tableName, columns);
      debug(`Table ${User.tableName} created successfully`);

      debug(`Adding index to ${User.tableName} table...`);
      await queryInterface.addIndex(User.tableName, ['confirmation_token'], {
        unique: true, transaction,
      });

      await queryInterface.addIndex(User.tableName, ['email'], {
        unique: true, transaction,
      });

      await queryInterface.addIndex(User.tableName, ['username'], {
        unique: true, transaction,
      });

      await queryInterface.addIndex(User.tableName, ['reset_password_token'], {
        unique: true, transaction,
      });

      await queryInterface.addIndex(User.tableName, ['unlock_token'], {
        unique: true, transaction,
      });
      debug(`Index added to ${User.tableName} table successfully`);

      await transaction.commit();
    } catch (error) {
      console.error(`Error creating ${User.tableName} table:`, error);
      await transaction.rollback();
      throw error;
    }
  },
  async down(queryInterface/*, Sequelize*/) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.dropTable(User.tableName, { transaction });

      await transaction.commit();
      debug(`Table ${User.tableName} dropped successfully`);
    } catch (error) {
      debug(`Error dropping ${User.tableName} table:`, error);
      await transaction.rollback();
      throw error;
    }
  },
};

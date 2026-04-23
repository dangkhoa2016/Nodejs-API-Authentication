'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable('refresh_tokens', {
        id: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: Sequelize.INTEGER,
        },
        token: {
          type: Sequelize.STRING(512),
          allowNull: false,
          unique: true,
        },
        user_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'Users', key: 'id' },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
        expires_at: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        revoked_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        replaced_by: {
          type: Sequelize.STRING(512),
          allowNull: true,
        },
        created_at: {
          allowNull: false,
          type: Sequelize.DATE,
          defaultValue: Sequelize.fn('NOW'),
        },
        updated_at: {
          allowNull: false,
          type: Sequelize.DATE,
          defaultValue: Sequelize.fn('NOW'),
        },
      }, { transaction });

      await queryInterface.addIndex('refresh_tokens', ['user_id'],    { transaction });
      await queryInterface.addIndex('refresh_tokens', ['expires_at'], { transaction });
    });
  },

  down: async (queryInterface) => {
    return queryInterface.dropTable('refresh_tokens');
  },
};

'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class RefreshToken extends Model {
    static associate(models) {
      RefreshToken.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    }

    get isExpired() {
      return new Date() > new Date(this.expires_at);
    }

    get isValid() {
      return !this.revoked_at && !this.isExpired;
    }
  }

  RefreshToken.init({
    token: {
      type: DataTypes.STRING(512),
      allowNull: false,
      unique: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'Users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    revoked_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    replaced_by: {
      type: DataTypes.STRING(512),
      allowNull: true,
    },
  }, {
    sequelize,
    underscored: true,
    updatedAt: 'updated_at',
    createdAt: 'created_at',
  });

  return RefreshToken;
};

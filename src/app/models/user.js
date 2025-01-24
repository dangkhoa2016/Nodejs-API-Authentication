'use strict';

const { Op } = require('sequelize');

const {
  Model,
} = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(/* models */) {
      // define association here
    }

    getFullname() {
      return [this.first_name, this.last_name].join(' ');
    }

    isAdmin() {
      return this.role === 'admin';
    }
  }

  const columns = {
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      // unique: true,  // email must be unique
      validate: {
        isEmail: {
          msg: 'Email address must be valid', // Validate format of email address
        },
        async customValidator(value) {
          const existingUser = await User.findOne({ where: { email: value, id: { [Op.ne]: this.id } }, attributes: ['id'] });
          if (existingUser) {
            throw new Error('Email address must be unique');
          }
        },
      },
    },
    encrypted_password: {
      type: DataTypes.STRING,
      validate: {
        customValidator(value) {
          // just for testing
          if (value.length !== 60)
            throw new Error('Password must be a 60-character encoded string');
        },
      },
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      // unique: true, // username must be unique
    },
    first_name: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '',
    },
    last_name: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '',
    },
    avatar: DataTypes.STRING,
    role: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'user',
    },
    reset_password_token: {
      type: DataTypes.STRING,
      // unique: true,  // reset_password_token must be unique
    },
    reset_password_sent_at: DataTypes.DATE,
    remember_created_at: DataTypes.DATE,
    sign_in_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    current_sign_in_at: DataTypes.DATE,
    last_sign_in_at: DataTypes.DATE,
    current_sign_in_ip: DataTypes.STRING,
    last_sign_in_ip: DataTypes.STRING,
    confirmation_token: {
      type: DataTypes.STRING,
      // unique: true,  // confirmation_token must be unique
    },
    confirmed_at: DataTypes.DATE,
    confirmation_sent_at: DataTypes.DATE,
    unconfirmed_email: DataTypes.STRING,
    failed_attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    unlock_token: {
      type: DataTypes.STRING,
      // unique: true,  // unlock_token must be unique
    },
    locked_at: DataTypes.DATE,
  };

  User.init(columns, {
    sequelize,
    // modelName: 'User',
    underscored: true,
    updatedAt: 'updated_at',
    createdAt: 'created_at',
    defaultScope: {
      attributes: { exclude: ['encrypted_password'] },
    },
    scopes: {
      withPassword: {
        attributes: {},
      },
      random() {
        return {
          order: sequelize.random(),
        };
      },
      withRole(value) {
        return {
          where: {
            role: {
              [Op.eq]: value,
            },
          },
        };
      },
    },
    indexes: [
      {
        fields: ['confirmation_token'],
        unique: true,
      },
      {
        fields: ['email'],
        unique: true,
      },
      {
        fields: ['reset_password_token'],
        unique: true,
      },
      {
        fields: ['unlock_token'],
        unique: true,
      },
    ],
  });

  return User;
};

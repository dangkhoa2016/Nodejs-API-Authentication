'use strict';

const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const { appConfig: { hashSalt } } = require('../../config');
const debug = require('debug')('nodejs-api-authentication:models->user');
const {
  Model,
} = require('sequelize');

const isPasswordEncrypted = (password) => {
  return /^\$2[ayb]\$[0-9]{2}\$/.test(password) && password.length === 60;
};

const allowDisplayColumns = [
  'id',
  'email',
  'username',
  'first_name',
  'last_name',
  'avatar',
  'role',
  'confirmed_at',
  'created_at',
  'updated_at',
];

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

    get fullName() {
      return [this.first_name, this.last_name].filter(Boolean).join(' ');
    }

    get isAdmin() {
      return this.role?.toLowerCase() === 'admin';
    }

    async validPassword(password) {
      if (!password && !this.encrypted_password)
        return true;

      if (!password)
        return false;

      if (!this.encrypted_password) {
        this.constructor = this.constructor.unscoped();
        await this.reload();
      }

      if (!this.encrypted_password)
        return false;

      return await bcrypt.compare(password, this.encrypted_password);
    }
  }

  const columns = {
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,  // email must be unique
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
        async customValidator(value) {
          if (!isPasswordEncrypted(value))
            throw new Error('Password must be a 60-character encoded string');
        },
      },
      // allowNull: false, -> temporary allow null for encrypted the password
    },
    password: {
      type: DataTypes.VIRTUAL,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true, // username must be unique
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
      type: DataTypes.ENUM,
      values: ['user', 'admin'],
      allowNull: false,
      defaultValue: 'user',
    },
    reset_password_token: {
      type: DataTypes.STRING,
      unique: true,  // reset_password_token must be unique
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
      unique: true,  // confirmation_token must be unique
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
      unique: true,  // unlock_token must be unique
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
      // attributes: { exclude: ['encrypted_password'] },
    },
    scopes: {
      // withPassword: {
      //   attributes: {},
      // },
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
    hooks: {
      async beforeValidate(user) {
        if (!user)
          return;

        user.encrypted_password ||= '';
        await user.encryptPassword();
      },
    },
  });

  User.prototype.encryptPassword = async function () {
    if (isPasswordEncrypted(this.encrypted_password))
      return;

    let password = this.password;
    if (!password && this.encrypted_password)
      password = this.encrypted_password;
    if (!password)
      return;

    debug('Encrypting password with bcrypt using hashSalt:', hashSalt);
    password = await bcrypt.hash(this.password, hashSalt);
    this.setDataValue('encrypted_password', password);
    delete this.dataValues.password;
  };

  User.prototype.toJSON = function () {
    const values = {};
    for (const key of allowDisplayColumns) {
      values[key] = this[key];
    }

    return values;
  };

  return User;
};

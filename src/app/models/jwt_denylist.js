'use strict';

const {
  Model,
} = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class JwtDenylist extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(/* models */) {
      // define association here
    }
  }

  JwtDenylist.init({
    jti: {
      type: DataTypes.STRING,
      unique: true, // jti must be unique
    },
    exp: DataTypes.DATE,
  }, {
    sequelize,
    // modelName: 'JwtDenylist',
    underscored: true,
    updatedAt: 'updated_at',
    createdAt: 'created_at',
  });

  return JwtDenylist;
};

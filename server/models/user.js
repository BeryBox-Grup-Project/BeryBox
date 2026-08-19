'use strict';

const { Model } = require('sequelize');
const { hashPassword } = require('../helpers/bcrypt');

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      User.hasMany(models.Item, { foreignKey: 'ownerId' });
      User.hasOne(models.Organization, { foreignKey: 'userId' });
      User.hasMany(models.Request, { as: 'outgoingRequests', foreignKey: 'fromUserId' });
      User.hasMany(models.Request, { as: 'incomingRequests', foreignKey: 'toUserId' });
      User.hasMany(models.Conversation, { foreignKey: 'userAId' });
    }
  }

  User.init({
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { len: [8] },
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'user',
      validate: { isIn: [['user', 'organization', 'admin']] },
    },
    latitude: { type: DataTypes.FLOAT, allowNull: false },
    longitude: { type: DataTypes.FLOAT, allowNull: false },
    addressLabel: DataTypes.STRING,
    creditBalance: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 },
    },
    ratingAvg: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
  }, {
    sequelize,
    modelName: 'User',
    defaultScope: { attributes: { exclude: ['password'] } },
    scopes: { withPassword: {} },
    hooks: {
      beforeCreate: async (user) => {
        user.password = await hashPassword(user.password);
      },
      beforeUpdate: async (user) => {
        if (user.changed('password')) user.password = await hashPassword(user.password);
      },
    },
  });

  return User;
};

'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Organization extends Model {
    static associate(models) {
      Organization.belongsTo(models.User, { foreignKey: 'userId' });
    }
  }

  Organization.init({
    userId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    name: { type: DataTypes.STRING, allowNull: false },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { isIn: [['orphanage', 'volunteer', 'community', 'other']] },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: { len: [20] },
    },
    verified: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'pending',
      validate: { isIn: [['pending', 'approved', 'rejected']] },
    },
    latitude: DataTypes.FLOAT,
    longitude: DataTypes.FLOAT,
    addressLabel: DataTypes.STRING,
  }, { sequelize, modelName: 'Organization' });

  return Organization;
};

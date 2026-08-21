'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Organization extends Model {
    static associate(models) {
      Organization.belongsTo(models.User, { foreignKey: 'userId' });
    }
  }

  Organization.init({
    userId: { type: DataTypes.INTEGER, allowNull: true, unique: true },
    name: { type: DataTypes.STRING, allowNull: false },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { isIn: [['orphanage', 'volunteer', 'community', 'other']] },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: { len: [1] },
    },
    verified: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'pending',
      validate: { isIn: [['unverified', 'pending', 'approved', 'rejected']] },
    },
    source: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'manual',
      validate: { isIn: [['manual', 'google_places', 'openstreetmap']] },
    },
    googlePlaceId: { type: DataTypes.STRING, allowNull: true, unique: true },
    photoUrl: DataTypes.STRING,
    galleryUrls: { type: DataTypes.JSON, allowNull: true },
    website: DataTypes.STRING,
    phone: DataTypes.STRING,
    email: DataTypes.STRING,
    latitude: DataTypes.FLOAT,
    longitude: DataTypes.FLOAT,
    addressLabel: DataTypes.STRING,
  }, { sequelize, modelName: 'Organization' });

  return Organization;
};

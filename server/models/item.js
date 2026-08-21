'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Item extends Model {
    static associate(models) {
      Item.belongsTo(models.User, { as: 'owner', foreignKey: 'ownerId' });
    }
  }

  Item.init({
    ownerId: { type: DataTypes.INTEGER, allowNull: false },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { isIn: [['public', 'organization', 'barter']] },
    },
    title: { type: DataTypes.STRING, allowNull: false },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: { len: [20] },
    },
    condition: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { isIn: [['new', 'like_new', 'good', 'fair']] },
    },
    category: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { isIn: [['clothes', 'books', 'electronics', 'furniture', 'toys', 'kitchen', 'other']] },
    },
    creditValue: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 },
    },
    latitude: DataTypes.FLOAT,
    longitude: DataTypes.FLOAT,
    addressLabel: DataTypes.STRING,
    imageUrl: DataTypes.STRING,
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'available',
      validate: { isIn: [['available', 'pending', 'completed', 'cancelled']] },
    },
  }, { sequelize, modelName: 'Item' });

  return Item;
};

'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Request extends Model {
    static associate(models) {
      Request.belongsTo(models.User, { as: 'fromUser', foreignKey: 'fromUserId' });
      Request.belongsTo(models.User, { as: 'toUser', foreignKey: 'toUserId' });
      Request.belongsTo(models.Item, { foreignKey: 'itemId' });
      Request.belongsTo(models.Item, { as: 'targetItem', foreignKey: 'targetItemId' });
      Request.hasMany(models.Review, { foreignKey: 'requestId' });
    }
  }

  Request.init({
    type: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { isIn: [['claim', 'org_offer', 'barter']] },
    },
    fromUserId: { type: DataTypes.INTEGER, allowNull: false },
    toUserId: { type: DataTypes.INTEGER, allowNull: false },
    itemId: { type: DataTypes.INTEGER, allowNull: false },
    targetItemId: { type: DataTypes.INTEGER, allowNull: true },
    reason: { type: DataTypes.TEXT, allowNull: true },
    shippingMethod: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: { isIn: [['pickup', 'gosend', 'jne', 'jnt']] },
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'pending',
      validate: { isIn: [['pending', 'accepted', 'rejected', 'completed']] },
    },
  }, { sequelize, modelName: 'Request' });

  return Request;
};

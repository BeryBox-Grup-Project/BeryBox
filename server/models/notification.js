'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Notification extends Model {
    static associate(models) {
      Notification.belongsTo(models.User, { foreignKey: 'userId' });
    }
  }

  Notification.init({
    userId: { type: DataTypes.INTEGER, allowNull: false },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isIn: [[
          'claim',
          'offer',
          'accepted',
          'rejected',
          'message',
          'shipping_required',
          'payment_required',
          'tracking_updated',
          'delivered',
          'warning',
          'banned',
        ]],
      },
    },
    requestId: { type: DataTypes.INTEGER, allowNull: true },
    conversationId: { type: DataTypes.INTEGER, allowNull: true },
    message: { type: DataTypes.STRING, allowNull: false },
    readAt: { type: DataTypes.DATE, allowNull: true },
  }, { sequelize, modelName: 'Notification' });

  return Notification;
};

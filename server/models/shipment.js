'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Shipment extends Model {
    static associate(models) {
      Shipment.belongsTo(models.Request, { foreignKey: 'requestId' });
    }
  }

  Shipment.init({
    requestId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    method: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: { isIn: [['pickup', 'courier_agent']] },
    },
    payer: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'from_user',
      validate: { isIn: [['from_user', 'to_user']] },
    },
    paymentStatus: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'not_required',
      validate: { isIn: [['not_required', 'unpaid', 'paid']] },
    },
    trackingStatus: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'awaiting_method',
      validate: {
        isIn: [[
          'awaiting_method',
          'awaiting_payment',
          'ready_for_pickup',
          'preparing',
          'in_transit',
          'delivered',
        ]],
      },
    },
    midtransOrderId: { type: DataTypes.STRING, allowNull: true },
    snapToken: { type: DataTypes.TEXT, allowNull: true },
    grossAmount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 },
    },
  }, { sequelize, modelName: 'Shipment' });

  return Shipment;
};

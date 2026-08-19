'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Report extends Model {}

  Report.init({
    reporterId: { type: DataTypes.INTEGER, allowNull: false },
    targetType: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { isIn: [['item', 'user', 'organization']] },
    },
    targetId: { type: DataTypes.INTEGER, allowNull: false },
    reason: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: { len: [10] },
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'open',
      validate: { isIn: [['open', 'resolved']] },
    },
  }, { sequelize, modelName: 'Report' });

  return Report;
};

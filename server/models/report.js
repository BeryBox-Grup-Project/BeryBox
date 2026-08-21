'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Report extends Model {
    static associate(models) {
      Report.belongsTo(models.User, { as: 'reporter', foreignKey: 'reporterId' });
      Report.belongsTo(models.Request, { foreignKey: 'requestId' });
    }
  }

  Report.init({
    reporterId: { type: DataTypes.INTEGER, allowNull: false },
    requestId: { type: DataTypes.INTEGER, allowNull: true },
    targetType: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { isIn: [['item', 'user', 'organization']] },
    },
    targetId: { type: DataTypes.INTEGER, allowNull: false },
    reason: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: { len: [1] },
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

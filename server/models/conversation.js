'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Conversation extends Model {
    static associate(models) {
      Conversation.belongsTo(models.User, { as: 'userA', foreignKey: 'userAId' });
      Conversation.belongsTo(models.User, { as: 'userB', foreignKey: 'userBId' });
      Conversation.hasMany(models.Message, { foreignKey: 'conversationId' });
    }
  }

  Conversation.init({
    userAId: { type: DataTypes.INTEGER, allowNull: false },
    userBId: { type: DataTypes.INTEGER, allowNull: false },
    itemId: { type: DataTypes.INTEGER, allowNull: true },
  }, {
    sequelize,
    modelName: 'Conversation',
    indexes: [{ unique: true, fields: ['userAId', 'userBId'] }],
  });

  return Conversation;
};

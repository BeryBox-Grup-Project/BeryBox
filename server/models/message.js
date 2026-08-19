'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Message extends Model {
    static associate(models) {
      Message.belongsTo(models.Conversation, { foreignKey: 'conversationId' });
      Message.belongsTo(models.User, { as: 'sender', foreignKey: 'senderId' });
    }
  }

  Message.init({
    conversationId: { type: DataTypes.INTEGER, allowNull: false },
    senderId: { type: DataTypes.INTEGER, allowNull: false },
    body: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: { len: [1, 2000] },
    },
  }, { sequelize, modelName: 'Message' });

  return Message;
};

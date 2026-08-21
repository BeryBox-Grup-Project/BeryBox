const { sequelize, Conversation, Message } = require('../models');

function createError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function messageResponse(message) {
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    body: message.body,
    createdAt: message.createdAt,
  };
}

function validateMessageBody(body) {
  if (typeof body !== 'string' || body.length < 1 || body.length > 2000) {
    throw createError(400, 'Validation error');
  }
}

async function createMessage({ conversationId, senderId, body }) {
  validateMessageBody(body);

  const transaction = await sequelize.transaction();
  try {
    const conversation = await Conversation.findByPk(conversationId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!conversation) throw createError(404, 'Not found');
    if (![conversation.userAId, conversation.userBId].includes(senderId)) {
      throw createError(403, 'Forbidden');
    }

    const message = await Message.create({
      conversationId: conversation.id,
      senderId,
      body,
    }, { transaction });
    await conversation.update({ updatedAt: new Date() }, { transaction });

    await transaction.commit();
    return { message: messageResponse(message), conversation };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

module.exports = { createMessage, messageResponse, validateMessageBody };

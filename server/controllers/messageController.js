const { Message } = require('../models');
const { createMessage, messageResponse } = require('../services/messageService');
const { emitMessageEvents } = require('../socket');

async function history(req, res, next) {
  try {
    const messages = await Message.findAll({
      where: { conversationId: req.conversation.id },
      order: [['createdAt', 'ASC']],
    });
    return res.status(200).json(messages.map(messageResponse));
  } catch (error) {
    return next(error);
  }
}

async function create(req, res, next) {
  try {
    const result = await createMessage({
      conversationId: req.conversation.id,
      senderId: req.user.id,
      body: req.body?.body,
    });
    emitMessageEvents({
      ...result,
      senderUsername: req.authUser.username,
    });
    return res.status(201).json(result.message);
  } catch (error) {
    return next(error);
  }
}

module.exports = { history, create };

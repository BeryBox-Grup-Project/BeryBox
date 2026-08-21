const { Message } = require('../models');
const { createMessage, messageResponse } = require('../services/messageService');
const { emitMessageEvents } = require('../socket');
const { notify } = require('../services/notificationService');

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
      conversation: result.conversation,
      message: result.message,
    });
    const receiverId = result.message.senderId === result.conversation.userAId
      ? result.conversation.userBId
      : result.conversation.userAId;
    await notify(receiverId, {
      type: 'message',
      requestId: null,
      conversationId: result.conversation.id,
      message: `${req.authUser.username} sent you a message`,
    });
    return res.status(201).json(result.message);
  } catch (error) {
    return next(error);
  }
}

module.exports = { history, create };

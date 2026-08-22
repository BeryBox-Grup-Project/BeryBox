const { Op } = require('sequelize');
const { User, Item, Conversation, Message } = require('../models');
const { normalizeConversationPair } = require('../helpers/conversationPair');

function createError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function conversationResponse(conversation) {
  return {
    id: conversation.id,
    userAId: conversation.userAId,
    userBId: conversation.userBId,
    itemId: conversation.itemId,
  };
}

async function create(req, res, next) {
  try {
    const body = req.body;
    if (
      !body
      || typeof body !== 'object'
      || Array.isArray(body)
      || !Object.keys(body).every((field) => ['otherUserId', 'itemId'].includes(field))
      || !Number.isInteger(body.otherUserId)
      || body.otherUserId < 1
      || (body.itemId != null && (!Number.isInteger(body.itemId) || body.itemId < 1))
    ) {
      throw createError(400, 'Validation error');
    }

    const pair = normalizeConversationPair(req.user.id, body.otherUserId);
    const [otherUser, item] = await Promise.all([
      User.findByPk(body.otherUserId),
      body.itemId == null ? null : Item.findByPk(body.itemId),
    ]);
    if (!otherUser || (body.itemId != null && !item)) throw createError(404, 'Not found');

    const [conversation, created] = await Conversation.findOrCreate({
      where: pair,
      defaults: { ...pair, itemId: body.itemId ?? null },
    });
    return res.status(created ? 201 : 200).json(conversationResponse(conversation));
  } catch (error) {
    return next(error);
  }
}

async function inbox(req, res, next) {
  try {
    const myId = Number(req.user.id);
    const conversations = await Conversation.findAll({
      where: {
        [Op.or]: [{ userAId: myId }, { userBId: myId }],
      },
      include: [
        { model: User, as: 'userA', attributes: ['id', 'username', 'ratingAvg', 'photoUrl'] },
        { model: User, as: 'userB', attributes: ['id', 'username', 'ratingAvg', 'photoUrl'] },
        {
          model: Message,
          attributes: ['id', 'body', 'senderId', 'createdAt'],
          separate: true,
          limit: 1,
          order: [['createdAt', 'DESC']],
        },
      ],
      order: [['updatedAt', 'DESC']],
    });

    const response = conversations
      .filter((conversation) => conversation.userAId === myId || conversation.userBId === myId)
      .map((conversation) => {
        const otherUser = myId === conversation.userAId
          ? conversation.userB
          : conversation.userA;
        const lastMessage = conversation.Messages[0];
        return {
          id: conversation.id,
          userAId: conversation.userAId,
          userBId: conversation.userBId,
          itemId: conversation.itemId,
          otherUser: otherUser ? {
            id: otherUser.id,
            username: otherUser.username,
            ratingAvg: otherUser.ratingAvg,
            photoUrl: otherUser.photoUrl || null,
          } : null,
          lastMessage: lastMessage ? {
            id: lastMessage.id,
            body: lastMessage.body,
            senderId: lastMessage.senderId,
            createdAt: lastMessage.createdAt,
          } : null,
        };
      });
    return res.status(200).json(response);
  } catch (error) {
    return next(error);
  }
}

module.exports = { create, inbox };

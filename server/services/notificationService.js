const { Notification } = require('../models');
const { emitNotification } = require('../socket');

async function notify(userId, payload, options = {}) {
  const row = await Notification.create({
    userId,
    type: payload.type,
    requestId: payload.requestId ?? null,
    conversationId: payload.conversationId ?? null,
    message: payload.message,
  }, options.transaction ? { transaction: options.transaction } : undefined);

  const body = {
    id: row.id,
    type: row.type,
    requestId: row.requestId,
    conversationId: row.conversationId,
    message: row.message,
    readAt: row.readAt,
  };
  emitNotification(userId, body);
  return row;
}

function notificationResponse(row) {
  return {
    id: row.id,
    type: row.type,
    requestId: row.requestId,
    conversationId: row.conversationId,
    message: row.message,
    readAt: row.readAt,
    createdAt: row.createdAt,
  };
}

module.exports = { notify, notificationResponse };

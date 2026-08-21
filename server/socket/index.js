const { Server } = require('socket.io');
const { User, Conversation } = require('../models');
const { verifyToken } = require('../helpers/jwt');
const { createMessage } = require('../services/messageService');

let ioInstance;

function setIo(instance) {
  ioInstance = instance;
}

function emitNotification(userId, payload) {
  if (ioInstance) ioInstance.to(`user:${userId}`).emit('new_notification', payload);
}

function emitNewMessage(conversationId, payload) {
  if (ioInstance) ioInstance.to(`conversation:${conversationId}`).emit('new_message', payload);
}

function emitMessageEvents({ conversation, message, senderUsername }) {
  emitNewMessage(conversation.id, message);
  const receiverId = message.senderId === conversation.userAId
    ? conversation.userBId
    : conversation.userAId;
  emitNotification(receiverId, {
    type: 'message',
    requestId: null,
    conversationId: conversation.id,
    message: `${senderUsername} sent you a message`,
  });
}

function configureSocket(io) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== 'string' || !token) throw new Error('Invalid token');
      const payload = verifyToken(token);
      const user = await User.findByPk(payload.id);
      if (!user) throw new Error('Invalid token');

      socket.user = { id: user.id, email: user.email, role: user.role };
      socket.authUser = user;
      return next();
    } catch {
      return next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.user.id}`);

    socket.on('join_conversation', async (payload = {}) => {
      try {
        const conversationId = Number(payload.conversationId);
        if (!Number.isInteger(conversationId) || conversationId < 1) return;
        const conversation = await Conversation.findByPk(conversationId);
        if (!conversation || ![conversation.userAId, conversation.userBId].includes(socket.user.id)) {
          return;
        }
        await socket.join(`conversation:${conversation.id}`);
      } catch {
        // Private room failures are intentionally ignored.
      }
    });

    socket.on('send_message', async (payload = {}) => {
      try {
        const conversationId = Number(payload.conversationId);
        if (!Number.isInteger(conversationId) || conversationId < 1) return;
        const result = await createMessage({
          conversationId,
          senderId: socket.user.id,
          body: payload.body,
        });
        emitMessageEvents({
          ...result,
          senderUsername: socket.authUser.username,
        });
      } catch {
        // Invalid or unauthorized socket messages are intentionally ignored.
      }
    });
  });
}

function initializeSocket(server) {
  const allowedOrigins = [process.env.CLIENT_ORIGIN, process.env.CMS_ORIGIN].filter(Boolean);
  const io = new Server(server, {
    cors: {
      origin: allowedOrigins,
    },
  });
  setIo(io);
  configureSocket(io);
  return io;
}

module.exports = {
  initializeSocket,
  configureSocket,
  setIo,
  emitNotification,
  emitNewMessage,
  emitMessageEvents,
};

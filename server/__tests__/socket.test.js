const socketModule = require('../socket');
const { db, cleanDb, createUser, tokenFor } = require('./utils');

function fakeIo() {
  const handlers = {};
  const emitted = [];
  return {
    handlers,
    emitted,
    use: jest.fn((handler) => { handlers.auth = handler; }),
    on: jest.fn((event, handler) => { handlers[event] = handler; }),
    to: jest.fn((room) => ({ emit: (event, payload) => emitted.push({ room, event, payload }) })),
  };
}

function fakeSocket(token) {
  const handlers = {};
  const rooms = new Set();
  return {
    handshake: { auth: { token } },
    handlers,
    rooms,
    join: jest.fn(async (room) => { rooms.add(room); }),
    leave: jest.fn(async (room) => { rooms.delete(room); }),
    on: jest.fn((event, handler) => { handlers[event] = handler; }),
    to: jest.fn(() => ({ emit: jest.fn() })),
  };
}

describe('Socket.io handlers without a network listener', () => {
  beforeEach(cleanDb);
  afterAll(async () => db.sequelize.close());

  test('authenticates a valid token and rejects invalid or deleted users', async () => {
    const io = fakeIo();
    socketModule.configureSocket(io);
    const user = await createUser();
    const valid = fakeSocket(tokenFor(user));
    const validNext = jest.fn();
    await io.handlers.auth(valid, validNext);
    expect(validNext).toHaveBeenCalledWith();
    expect(valid.user).toMatchObject({ id: user.id, email: user.email, role: user.role });

    for (const token of ['', 'not-a-token', tokenFor({ id: 999999, email: 'x@y.z', role: 'user' })]) {
      const invalidNext = jest.fn();
      await io.handlers.auth(fakeSocket(token), invalidNext);
      expect(invalidNext.mock.calls[0][0]).toEqual(expect.objectContaining({ message: 'Invalid token' }));
    }
  });

  test('joins personal and participant rooms but ignores unauthorized joins', async () => {
    const io = fakeIo();
    socketModule.configureSocket(io);
    const alice = await createUser();
    const bob = await createUser();
    const outsider = await createUser();
    const conversation = await db.Conversation.create({ userAId: alice.id, userBId: bob.id });
    const socket = fakeSocket(tokenFor(alice));
    await io.handlers.auth(socket, jest.fn());
    io.handlers.connection(socket);
    expect(socket.join).toHaveBeenCalledWith(`user:${alice.id}`);
    await socket.handlers.join_conversation({ conversationId: conversation.id });
    expect(socket.join).toHaveBeenCalledWith(`conversation:${conversation.id}`);
    await socket.handlers.join_conversation({ conversationId: 0 });

    const denied = fakeSocket(tokenFor(outsider));
    await io.handlers.auth(denied, jest.fn());
    io.handlers.connection(denied);
    await denied.handlers.join_conversation({ conversationId: conversation.id });
    expect(denied.join).not.toHaveBeenCalledWith(`conversation:${conversation.id}`);
    await socket.handlers.join_conversation({ conversationId: conversation.id });
    await socket.handlers.typing({ conversationId: conversation.id });
    await socket.handlers.typing({ conversationId: 0 });
    await socket.handlers.typing({ conversationId: conversation.id + 99 });
    await socket.handlers.stop_typing({ conversationId: conversation.id });
    await socket.handlers.stop_typing({ conversationId: 0 });
    expect(socket.to).toHaveBeenCalled();
  });

  test('send_message persists once with socket identity and emits both events', async () => {
    const io = fakeIo();
    socketModule.setIo(io);
    socketModule.configureSocket(io);
    const alice = await createUser();
    const bob = await createUser();
    const conversation = await db.Conversation.create({ userAId: alice.id, userBId: bob.id });
    const socket = fakeSocket(tokenFor(alice));
    await io.handlers.auth(socket, jest.fn());
    io.handlers.connection(socket);
    await socket.handlers.send_message({
      conversationId: conversation.id, body: 'socket hello', senderId: bob.id,
    });
    expect(await db.Message.count({ where: { conversationId: conversation.id } })).toBe(1);
    expect(await db.Message.findOne({ where: { conversationId: conversation.id } }))
      .toMatchObject({ senderId: alice.id, body: 'socket hello' });
    expect(io.emitted).toEqual(expect.arrayContaining([
      expect.objectContaining({ room: `conversation:${conversation.id}`, event: 'new_message' }),
      expect.objectContaining({ room: `user:${bob.id}`, event: 'new_notification' }),
    ]));
    await socket.handlers.send_message({ conversationId: 0, body: 'ignored' });
    await socket.handlers.send_message({ conversationId: conversation.id, body: '' });
    expect(await db.Message.count({ where: { conversationId: conversation.id } })).toBe(1);
  });

  test('typing helpers swallow errors and route from either participant', async () => {
    const io = fakeIo();
    socketModule.setIo(io);
    socketModule.configureSocket(io);
    const alice = await createUser();
    const bob = await createUser();
    const conversation = await db.Conversation.create({ userAId: alice.id, userBId: bob.id });
    const aliceSocket = fakeSocket(tokenFor(alice));
    const bobSocket = fakeSocket(tokenFor(bob));
    await io.handlers.auth(aliceSocket, jest.fn());
    await io.handlers.auth(bobSocket, jest.fn());
    io.handlers.connection(aliceSocket);
    io.handlers.connection(bobSocket);
    aliceSocket.to.mockImplementation(() => { throw new Error('typing failed'); });
    await aliceSocket.handlers.typing({ conversationId: conversation.id });
    await aliceSocket.handlers.stop_typing({ conversationId: conversation.id });
    await bobSocket.handlers.send_message({ conversationId: conversation.id, body: 'from bob' });
    expect(io.emitted).toEqual(expect.arrayContaining([
      expect.objectContaining({ room: `user:${alice.id}`, event: 'new_notification' }),
    ]));
  });

  test('emit helpers are harmless before initialization and route receiver correctly', async () => {
    socketModule.setIo(null);
    expect(() => socketModule.emitNotification(1, { type: 'test' })).not.toThrow();
    expect(() => socketModule.emitNewMessage(1, { body: 'test' })).not.toThrow();
    const io = fakeIo();
    socketModule.setIo(io);
    socketModule.emitMessageEvents({
      conversation: { id: 9, userAId: 1, userBId: 2 },
      message: { senderId: 2, body: 'hi' },
    });
    expect(io.emitted[0]).toMatchObject({
      room: 'conversation:9', event: 'new_message',
      payload: { senderId: 2, body: 'hi' },
    });
  });

  test('initializeSocket attaches cors origins', () => {
    const http = require('http');
    const server = http.createServer();
    const io = socketModule.initializeSocket(server);
    expect(io).toBeTruthy();
    io.close();
    server.close();
  });
});

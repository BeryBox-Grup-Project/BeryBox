jest.mock('../services/geminiService', () => ({ generateReply: jest.fn() }));
jest.mock('../services/groqService', () => ({ generateReply: jest.fn() }));
jest.mock('../socket', () => ({ emitNotification: jest.fn() }));

const geminiService = require('../services/geminiService');
const groqService = require('../services/groqService');
const aiService = require('../services/aiService');
const { OFF_TOPIC_REPLY, SITE_REPLY } = require('../services/aiInstructions');
const { notify, notificationResponse } = require('../services/notificationService');
const { db, cleanDb, createUser } = require('./utils');
const socket = require('../socket');

describe('AI service fallbacks', () => {
  beforeEach(() => jest.clearAllMocks());

  test('uses gemini, then groq, then local fallback', async () => {
    geminiService.generateReply.mockResolvedValueOnce('dari gemini');
    await expect(aiService.generateReply({ message: 'barang kamera' })).resolves.toBe('dari gemini');

    geminiService.generateReply.mockRejectedValueOnce(new Error('g'));
    groqService.generateReply.mockResolvedValueOnce('dari groq');
    await expect(aiService.generateReply({ message: 'barang kamera' })).resolves.toBe('dari groq');

    geminiService.generateReply.mockRejectedValueOnce(new Error('g'));
    groqService.generateReply.mockRejectedValueOnce(new Error('q'));
    await expect(aiService.generateReply({ message: 'barang kamera', candidates: [] }))
      .resolves.toMatch(/Belum ada/);
  });

  test('local fallback covers org rows, site, and off-topic', async () => {
    expect(aiService.localFallbackReply({
      message: 'panti',
      candidates: [{ kind: 'organization', name: 'Panti Melati', distanceKm: 2 }],
    })).toContain('Panti Melati');
    expect(aiService.localFallbackReply({
      message: 'barang',
      candidates: [{ kind: 'item', title: 'Kamera', wantedTitle: 'Lensa', distanceKm: 1 }],
    })).toContain('Kamera');
    expect(aiService.localFallbackReply({
      message: 'barang',
      candidates: [{ kind: 'item', title: 'Meja' }],
    })).toContain('Meja');
    expect(aiService.localFallbackReply({ message: 'cara login', candidates: [] })).toBe(SITE_REPLY);
    expect(aiService.localFallbackReply({ message: 'resep nasi goreng' })).toBe(OFF_TOPIC_REPLY);
    expect(aiService.localFallbackReply({ message: 'barang kamera', candidates: [] })).toMatch(/Belum ada/);
    expect(aiService.localFallbackReply({
      message: 'barang',
      candidates: [{ kind: 'item', name: 'Hanya nama' }],
    })).toContain('Hanya nama');
    await expect(aiService.generateReply({ message: 'resep nasi goreng' })).resolves.toBe(OFF_TOPIC_REPLY);
    expect(new aiService.AIServiceUnavailable().message).toBe('AI service unavailable');
  });
});

describe('AI ranking helpers', () => {
  const {
    rankBarterCandidates,
    rankAndSelectCandidates,
    candidateKindsForMessage,
    itemTypesForMessage,
    queryTokens,
    wantsNearby,
    buildPrompt,
    classifyChatIntent,
  } = require('../services/aiInstructions');

  test('ranks barter and chat candidates with item/org kinds', () => {
    expect(candidateKindsForMessage('barang kamera')).toEqual(['item']);
    expect(candidateKindsForMessage('panti terdekat')).toEqual(['organization']);
    expect(candidateKindsForMessage('donasi kamera')).toEqual(['item']);
    expect(candidateKindsForMessage('halo')).toEqual(['organization', 'item']);
    expect(itemTypesForMessage('kamera')).toEqual(['public', 'barter']);
    expect(itemTypesForMessage('barang')).toEqual(['public']);
    expect(wantsNearby('yang terdekat')).toBe(true);
    expect(queryTokens('yang dan kamera').includes('kamera')).toBe(true);

    const ranked = rankBarterCandidates('kamera', 'lensa', [
      {
        context: { title: 'Lensa kit', description: 'lensa', wantedTitle: 'kamera analog', wantedCategory: 'electronics' },
        suggestion: { distanceKm: 3 },
      },
      {
        context: { title: 'Buku', description: 'novel', wantedTitle: 'meja' },
        suggestion: { distanceKm: 1 },
      },
    ], 5);
    expect(ranked[0].context.title).toBe('Lensa kit');
    expect(rankBarterCandidates('', '', null)).toEqual([]);
    const byHits = rankBarterCandidates('x', 'lensa kamera', [
      { context: { title: 'lensa', description: '', category: '' }, suggestion: { distanceKm: 1 } },
      { context: { title: 'lensa kamera', description: '', category: '' }, suggestion: { distanceKm: 9 } },
    ]);
    expect(byHits[0].context.title).toBe('lensa kamera');
    const byDistance = rankBarterCandidates('kamera', 'lensa', [
      { context: { title: 'lensa', wantedTitle: 'kamera' }, suggestion: { distanceKm: 8 } },
      { context: { title: 'lensa', wantedTitle: 'kamera' }, suggestion: { distanceKm: 2 } },
    ]);
    expect(byDistance[0].suggestion.distanceKm).toBe(2);

    const chat = rankAndSelectCandidates('barang kamera', [
      { context: { kind: 'item', title: 'Kamera analog', description: 'body kamera' }, suggestion: { distanceKm: 2 } },
      { context: { kind: 'organization', name: 'Panti Melati' }, suggestion: { distanceKm: 1 } },
    ], 5);
    expect(chat.every((row) => row.context.kind === 'item')).toBe(true);
    expect(buildPrompt({ message: 'halo', candidates: [{ kind: 'item' }] })).toContain('Intent:');
    expect(classifyChatIntent('')).toBe('site');
    expect(classifyChatIntent(null)).toBe('site');
    expect(candidateKindsForMessage(undefined)).toEqual(['organization', 'item']);
    const nearby = rankAndSelectCandidates('panti terdekat', [
      { context: { kind: 'organization', name: 'Far', description: 'panti asuhan' }, suggestion: { distanceKm: 9 } },
      { context: { kind: 'organization', name: 'Near', description: 'panti asuhan' }, suggestion: { distanceKm: 1 } },
    ]);
    expect(nearby[0].context.name).toBe('Near');
    expect(buildPrompt({ message: 'panti', candidates: [{ kind: 'organization' }] })).toContain('organizations');
    expect(buildPrompt({ message: 'barang kamera', candidates: [{ kind: 'item' }] })).toContain('items only');
    expect(buildPrompt({ message: 'resep kue', candidates: [] })).toContain('off-topic');
    expect(buildPrompt({ message: 'halo', candidates: [{ kind: 'item' }, { kind: 'organization' }] })).toContain('Intent:');
  });
});

describe('notification service', () => {
  beforeEach(cleanDb);
  afterAll(() => db.sequelize.close());

  test('persists, emits, and serializes notifications including transaction option', async () => {
    const user = await createUser();
    const row = await notify(user.id, {
      type: 'warning',
      requestId: null,
      conversationId: null,
      message: 'You received a warning from BeryBox moderators',
    });
    expect(socket.emitNotification).toHaveBeenCalledWith(user.id, expect.objectContaining({
      id: row.id, type: 'warning',
    }));
    expect(notificationResponse(row)).toEqual(expect.objectContaining({
      id: row.id, type: 'warning', readAt: null,
    }));
    const transaction = await db.sequelize.transaction();
    await notify(user.id, {
      type: 'message', requestId: null, conversationId: 1, message: 'hello',
    }, { transaction });
    await transaction.commit();
    expect(await db.Notification.count({ where: { userId: user.id } })).toBe(2);

    const { createMessage } = require('../services/messageService');
    const other = await createUser();
    const conversation = await db.Conversation.create({ userAId: user.id, userBId: other.id });
    await expect(createMessage({ conversationId: 999999, senderId: user.id, body: 'hello' }))
      .rejects.toMatchObject({ status: 404 });
    const stranger = await createUser();
    await expect(createMessage({ conversationId: conversation.id, senderId: stranger.id, body: 'hello' }))
      .rejects.toMatchObject({ status: 403 });
  });
});

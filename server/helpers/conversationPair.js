function normalizeConversationPair(id1, id2) {
  if (id1 === id2) {
    const error = new Error('Cannot chat with yourself');
    error.status = 400;
    throw error;
  }

  return {
    userAId: Math.min(id1, id2),
    userBId: Math.max(id1, id2),
  };
}

module.exports = { normalizeConversationPair };

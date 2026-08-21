const geminiService = require('./geminiService');
const groqService = require('./groqService');

class AIServiceUnavailable extends Error {
  constructor() {
    super('AI service unavailable');
    this.name = 'AIServiceUnavailable';
  }
}

async function generateReply(context) {
  try {
    return await geminiService.generateReply(context);
  } catch {
    try {
      return await groqService.generateReply(context);
    } catch {
      throw new AIServiceUnavailable();
    }
  }
}

module.exports = { generateReply, AIServiceUnavailable };

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { SYSTEM_INSTRUCTION, buildPrompt } = require('./aiInstructions');

const REQUEST_TIMEOUT_MS = 10000;

async function generateReply({ message, candidates }) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Gemini is not configured');
  }

  const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = client.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    systemInstruction: SYSTEM_INSTRUCTION,
  }, { timeout: REQUEST_TIMEOUT_MS });
  const prompt = buildPrompt({ message, candidates });
  const result = await model.generateContent(prompt);
  const response = await result.response;
  const reply = response.text();
  if (typeof reply !== 'string' || !reply.trim()) {
    throw new Error('Empty Gemini response');
  }
  return reply.trim();
}

module.exports = { generateReply, SYSTEM_INSTRUCTION };

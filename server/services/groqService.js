const Groq = require('groq-sdk');
const { SYSTEM_INSTRUCTION, buildPrompt } = require('./aiInstructions');

const REQUEST_TIMEOUT_MS = 10000;

async function generateReply(context) {
  if (!process.env.GROQ_API_KEY || !process.env.GROQ_MODEL) {
    throw new Error('Groq is not configured');
  }

  const client = new Groq({
    apiKey: process.env.GROQ_API_KEY,
    timeout: REQUEST_TIMEOUT_MS,
    maxRetries: 0,
  });
  const completion = await client.chat.completions.create({
    model: process.env.GROQ_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_INSTRUCTION },
      { role: 'user', content: buildPrompt(context) },
    ],
  });
  const reply = completion.choices?.[0]?.message?.content;
  if (typeof reply !== 'string' || !reply.trim()) {
    throw new Error('Empty Groq response');
  }
  return reply.trim();
}

module.exports = { generateReply };

const geminiService = require('./geminiService');
const groqService = require('./groqService');
const {
  classifyChatIntent,
  OFF_TOPIC_REPLY,
  SITE_REPLY,
} = require('./aiInstructions');

class AIServiceUnavailable extends Error {
  constructor() {
    super('AI service unavailable');
    this.name = 'AIServiceUnavailable';
  }
}

function localFallbackReply({ message, candidates }) {
  const intent = classifyChatIntent(message);
  if (intent === 'off_topic') return OFF_TOPIC_REPLY;
  if (intent === 'site') return SITE_REPLY;

  const rows = Array.isArray(candidates) ? candidates : [];
  if (rows.length === 0) {
    return 'Belum ada barang atau organisasi yang cocok di data BeryBox untuk permintaan itu. Coba unggah barang, buka beranda, atau lihat daftar organisasi.';
  }

  const lines = rows.slice(0, 3).map((row) => {
    const distance = row.distanceKm != null ? ` (${row.distanceKm} km)` : '';
    if (row.kind === 'organization') {
      return `- ${row.name}${distance}`;
    }
    const want = row.wantedTitle ? ` · mau ${row.wantedTitle}` : '';
    return `- ${row.title || row.name}${want}${distance}`;
  });
  return `Ini opsi dari data BeryBox yang paling relevan:\n${lines.join('\n')}\nBuka kartu di bawah untuk detail.`;
}

async function generateReply(context) {
  const message = context?.message;
  if (classifyChatIntent(message) === 'off_topic') {
    return OFF_TOPIC_REPLY;
  }

  try {
    return await geminiService.generateReply(context);
  } catch {
    try {
      return await groqService.generateReply(context);
    } catch {
      return localFallbackReply(context);
    }
  }
}

module.exports = { generateReply, AIServiceUnavailable, localFallbackReply };

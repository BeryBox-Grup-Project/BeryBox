jest.mock('@google/generative-ai', () => {
  const generateContent = jest.fn();
  const getGenerativeModel = jest.fn(() => ({ generateContent }));
  const GoogleGenerativeAI = jest.fn(() => ({ getGenerativeModel }));
  GoogleGenerativeAI.generateContent = generateContent;
  GoogleGenerativeAI.getGenerativeModel = getGenerativeModel;
  return { GoogleGenerativeAI };
});

jest.mock('groq-sdk', () => {
  const create = jest.fn();
  const Groq = jest.fn(() => ({ chat: { completions: { create } } }));
  Groq.create = create;
  return Groq;
});

const { GoogleGenerativeAI } = require('@google/generative-ai');
const Groq = require('groq-sdk');
const geminiService = require('../services/geminiService');
const groqService = require('../services/groqService');

describe('Gemini and Groq providers', () => {
  const previous = { ...process.env };

  afterEach(() => {
    process.env.GEMINI_API_KEY = previous.GEMINI_API_KEY;
    process.env.GEMINI_MODEL = previous.GEMINI_MODEL;
    process.env.GROQ_API_KEY = previous.GROQ_API_KEY;
    process.env.GROQ_MODEL = previous.GROQ_MODEL;
    jest.clearAllMocks();
  });

  test('gemini requires a key, rejects empty text, and uses default model', async () => {
    delete process.env.GEMINI_API_KEY;
    await expect(geminiService.generateReply({ message: 'halo' })).rejects.toThrow('Gemini is not configured');
    process.env.GEMINI_API_KEY = 'key';
    delete process.env.GEMINI_MODEL;
    GoogleGenerativeAI.generateContent.mockResolvedValue({
      response: { text: () => '   jawaban   ' },
    });
    await expect(geminiService.generateReply({ message: 'barang kamera' })).resolves.toBe('jawaban');
    expect(GoogleGenerativeAI.getGenerativeModel).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gemini-2.0-flash' }),
      expect.any(Object),
    );
    GoogleGenerativeAI.generateContent.mockResolvedValue({ response: { text: () => '   ' } });
    await expect(geminiService.generateReply({ message: 'barang' })).rejects.toThrow('Empty Gemini response');
  });

  test('groq requires a key, rejects empty text, and uses default model', async () => {
    delete process.env.GROQ_API_KEY;
    await expect(groqService.generateReply({ message: 'halo' })).rejects.toThrow('Groq is not configured');
    process.env.GROQ_API_KEY = 'key';
    delete process.env.GROQ_MODEL;
    Groq.create.mockResolvedValue({ choices: [{ message: { content: '  groq  ' } }] });
    await expect(groqService.generateReply({ message: 'barang kamera' })).resolves.toBe('groq');
    expect(Groq).toHaveBeenCalledWith(expect.objectContaining({ apiKey: 'key' }));
    Groq.create.mockResolvedValue({ choices: [] });
    await expect(groqService.generateReply({ message: 'barang' })).rejects.toThrow('Empty Groq response');
  });
});

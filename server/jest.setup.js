process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'jest-only-secret';
process.env.JWT_EXPIRES_IN = '1h';
process.env.IMAGEKIT_PUBLIC_KEY = 'public_test';
process.env.IMAGEKIT_PRIVATE_KEY = 'private_test';
process.env.IMAGEKIT_URL_ENDPOINT = 'https://ik.imagekit.io/test/';
process.env.GEMINI_API_KEY = 'gemini-test-key';
process.env.GEMINI_MODEL = 'gemini-test-model';
process.env.GROQ_API_KEY = 'groq-test-key';
process.env.GROQ_MODEL = 'groq-test-model';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
process.env.CMS_ORIGIN = 'http://127.0.0.1:4174';
process.env.GOOGLE_CLIENT_ID = 'google-test-client';

jest.setTimeout(40000);

global.fetch = jest.fn(async (url) => {
  if (String(url).includes('overpass-api.de')) {
    return { ok: true, json: async () => ({ elements: [] }) };
  }
  return { ok: false, json: async () => ({}) };
});

const { OAuth2Client } = require('google-auth-library');

let client;

function getGoogleClient() {
  if (!client) {
    client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  }
  return client;
}

async function verifyGoogleToken(idToken) {
  if (!process.env.GOOGLE_CLIENT_ID || typeof idToken !== 'string' || !idToken) {
    const error = new Error('Invalid google token');
    error.status = 401;
    throw error;
  }

  try {
    const ticket = await getGoogleClient().verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      const error = new Error('Invalid google token');
      error.status = 401;
      throw error;
    }
    return payload;
  } catch (error) {
    if (error.status === 401) throw error;
    const invalid = new Error('Invalid google token');
    invalid.status = 401;
    throw invalid;
  }
}

module.exports = { verifyGoogleToken };

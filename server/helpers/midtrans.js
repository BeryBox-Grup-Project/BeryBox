const crypto = require('crypto');
const midtransClient = require('midtrans-client');

function envValue(name) {
  const value = process.env[name];
  if (typeof value !== 'string') return '';
  return value.trim().replace(/^['"]|['"]$/g, '').replace(/,+$/, '').trim();
}

function isConfigured() {
  return Boolean(envValue('MIDTRANS_SERVER_KEY') && envValue('MIDTRANS_CLIENT_KEY'));
}

function snapConfig() {
  return {
    isProduction: envValue('MIDTRANS_IS_PRODUCTION') === 'true',
    serverKey: envValue('MIDTRANS_SERVER_KEY'),
    clientKey: envValue('MIDTRANS_CLIENT_KEY'),
  };
}

function createSnapClient() {
  if (!isConfigured()) {
    const error = new Error('Payment service unavailable');
    error.status = 502;
    throw error;
  }

  return new midtransClient.Snap(snapConfig());
}

function createCoreClient() {
  if (!isConfigured()) {
    const error = new Error('Payment service unavailable');
    error.status = 502;
    throw error;
  }

  return new midtransClient.CoreApi(snapConfig());
}

async function createSnapTransaction({ orderId, grossAmount, email, firstName }) {
  const snap = createSnapClient();
  return snap.createTransaction({
    transaction_details: {
      order_id: orderId,
      gross_amount: grossAmount,
    },
    customer_details: {
      email,
      first_name: firstName,
    },
  });
}

async function getTransactionStatus(orderId) {
  const core = createCoreClient();
  return core.transaction.status(orderId);
}

function verifyNotificationSignature({
  order_id: orderId,
  status_code: statusCode,
  gross_amount: grossAmount,
  signature_key: signatureKey,
}) {
  if (!isConfigured()) return false;
  const payload = `${orderId}${statusCode}${grossAmount}${envValue('MIDTRANS_SERVER_KEY')}`;
  const expected = crypto.createHash('sha512').update(payload).digest('hex');
  return expected === signatureKey;
}

function isPaidStatus(transactionStatus) {
  return ['capture', 'settlement'].includes(transactionStatus);
}

module.exports = {
  isConfigured,
  createSnapClient,
  createSnapTransaction,
  getTransactionStatus,
  verifyNotificationSignature,
  isPaidStatus,
  clientKey: () => envValue('MIDTRANS_CLIENT_KEY') || null,
  isProduction: () => envValue('MIDTRANS_IS_PRODUCTION') === 'true',
};

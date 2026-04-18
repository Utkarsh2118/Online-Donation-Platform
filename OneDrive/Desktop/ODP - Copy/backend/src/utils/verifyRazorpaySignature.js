const crypto = require('crypto');

const verifyRazorpaySignature = ({ orderId, paymentId, signature, secret }) => {
  const payload = `${orderId}|${paymentId}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return expectedSignature === signature;
};

module.exports = verifyRazorpaySignature;

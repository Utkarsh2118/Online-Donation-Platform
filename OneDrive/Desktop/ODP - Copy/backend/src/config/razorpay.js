const Razorpay = require('razorpay');

const getRazorpayInstance = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error('Razorpay keys are not configured in environment variables');
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret
  });
};

module.exports = getRazorpayInstance;

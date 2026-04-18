const express = require('express');
const {
  createDonation,
  verifyDonationPayment,
  markDonationFailed,
  getMyDonations,
  getCampaignDonations
} = require('../controllers/donationController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', protect, createDonation);
router.post('/verify-payment', protect, verifyDonationPayment);
router.post('/mark-failed', protect, markDonationFailed);
router.get('/me', protect, getMyDonations);
router.get('/campaign/:campaignId', getCampaignDonations);

module.exports = router;

const express = require('express');

const authRoutes = require('./authRoutes');
const campaignRoutes = require('./campaignRoutes');
const donationRoutes = require('./donationRoutes');
const adminRoutes = require('./adminRoutes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/campaigns', campaignRoutes);
router.use('/donations', donationRoutes);
router.use('/admin', adminRoutes);

module.exports = router;

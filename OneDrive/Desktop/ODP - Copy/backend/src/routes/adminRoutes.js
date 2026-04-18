const express = require('express');
const {
  getDashboardStats,
  getAllUsers,
  blockUser,
  unblockUser,
  deleteUser
} = require('../controllers/adminController');
const {
  getAllCampaignsForAdmin,
  createCampaign,
  updateCampaign,
  deleteCampaign
} = require('../controllers/campaignController');
const { getAllDonations } = require('../controllers/donationController');
const { protect } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/adminMiddleware');

const router = express.Router();

router.use(protect, requireAdmin);

router.get('/dashboard', getDashboardStats);

router.get('/users', getAllUsers);
router.patch('/users/:userId/block', blockUser);
router.patch('/users/:userId/unblock', unblockUser);
router.delete('/users/:userId', deleteUser);

router.get('/campaigns', getAllCampaignsForAdmin);
router.post('/campaigns', createCampaign);
router.put('/campaigns/:id', updateCampaign);
router.delete('/campaigns/:id', deleteCampaign);

router.get('/donations', getAllDonations);


module.exports = router;

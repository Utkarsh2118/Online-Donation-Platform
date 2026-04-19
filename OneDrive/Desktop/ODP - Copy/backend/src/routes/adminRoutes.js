const express = require('express');
const {
  getDashboardStats,
  getAllUsers,
  blockUser,
  unblockUser,
  deleteUser,
  restoreUser,
  getAuditLogs
} = require('../controllers/adminController');
const {
  getAllCampaignsForAdmin,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  restoreCampaign
} = require('../controllers/campaignController');
const { getAllDonations } = require('../controllers/donationController');
const { protect } = require('../middleware/authMiddleware');
const { requireRoles, requireStaff, requireFinance } = require('../middleware/adminMiddleware');

const router = express.Router();

router.use(protect);

router.get('/dashboard', requireStaff, getDashboardStats);

router.get('/users', requireRoles('support', 'admin', 'super_admin'), getAllUsers);
router.patch('/users/:userId/block', requireRoles('support', 'admin', 'super_admin'), blockUser);
router.patch('/users/:userId/unblock', requireRoles('support', 'admin', 'super_admin'), unblockUser);
router.patch('/users/:userId/restore', requireRoles('admin', 'super_admin'), restoreUser);
router.delete('/users/:userId', requireRoles('admin', 'super_admin'), deleteUser);

router.get('/campaigns', requireRoles('admin', 'super_admin'), getAllCampaignsForAdmin);
router.post('/campaigns', requireRoles('admin', 'super_admin'), createCampaign);
router.put('/campaigns/:id', requireRoles('admin', 'super_admin'), updateCampaign);
router.delete('/campaigns/:id', requireRoles('admin', 'super_admin'), deleteCampaign);
router.patch('/campaigns/:id/restore', requireRoles('admin', 'super_admin'), restoreCampaign);

router.get('/donations', requireFinance, getAllDonations);
router.get('/audit-logs', requireRoles('support', 'finance', 'admin', 'super_admin'), getAuditLogs);


module.exports = router;

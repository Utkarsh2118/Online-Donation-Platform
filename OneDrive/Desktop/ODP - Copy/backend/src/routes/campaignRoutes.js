const express = require('express');
const {
  getCampaigns,
  getCampaignById,
  getAllCampaignsForAdmin,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  restoreCampaign
} = require('../controllers/campaignController');
const { protect } = require('../middleware/authMiddleware');
const { requireRoles } = require('../middleware/adminMiddleware');

const router = express.Router();

router.get('/', getCampaigns);
router.get('/admin/all', protect, requireRoles('admin', 'super_admin'), getAllCampaignsForAdmin);
router.get('/:id', getCampaignById);

router.post('/', protect, requireRoles('admin', 'super_admin'), createCampaign);
router.put('/:id', protect, requireRoles('admin', 'super_admin'), updateCampaign);
router.delete('/:id', protect, requireRoles('admin', 'super_admin'), deleteCampaign);
router.patch('/:id/restore', protect, requireRoles('admin', 'super_admin'), restoreCampaign);

module.exports = router;

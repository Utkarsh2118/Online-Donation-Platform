const express = require('express');
const {
  getCampaigns,
  getCampaignById,
  getAllCampaignsForAdmin,
  createCampaign,
  updateCampaign,
  deleteCampaign
} = require('../controllers/campaignController');
const { protect } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/adminMiddleware');

const router = express.Router();

router.get('/', getCampaigns);
router.get('/admin/all', protect, requireAdmin, getAllCampaignsForAdmin);
router.get('/:id', getCampaignById);

router.post('/', protect, requireAdmin, createCampaign);
router.put('/:id', protect, requireAdmin, updateCampaign);
router.delete('/:id', protect, requireAdmin, deleteCampaign);

module.exports = router;

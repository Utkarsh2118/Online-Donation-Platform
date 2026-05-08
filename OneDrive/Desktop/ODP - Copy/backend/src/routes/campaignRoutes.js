const express = require('express');
const { getCampaigns, getCampaignById, getAllCampaignsForAdmin, createCampaign, updateCampaign, deleteCampaign, restoreCampaign } = require('../controllers/campaignController');
const { protect } = require('../middleware/authMiddleware');
const { isAdmin } = require('../middleware/adminMiddleware');
const { validate, createCampaignSchema, updateCampaignSchema } = require('../utils/validators');

const router = express.Router();

router.get('/',           getCampaigns);
router.get('/:id',        getCampaignById);
router.get('/admin/all',  protect, isAdmin, getAllCampaignsForAdmin);
router.post('/',          protect, isAdmin, validate(createCampaignSchema), createCampaign);
router.put('/:id',        protect, isAdmin, validate(updateCampaignSchema), updateCampaign);
router.delete('/:id',     protect, isAdmin, deleteCampaign);
router.post('/:id/restore', protect, isAdmin, restoreCampaign);

module.exports = router;

const express = require('express');
const {
	register,
	login,
	getMyProfile,
	updateMyProfile,
	seedAdmin
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/seed-admin', seedAdmin);
router.get('/me', protect, getMyProfile);
router.put('/me', protect, updateMyProfile);

module.exports = router;

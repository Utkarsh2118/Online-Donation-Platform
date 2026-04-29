const express = require('express');
const {
  register,
  login,
  forgotPassword,
  resetPassword,
  getMyProfile,
  updateMyProfile
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/me', protect, getMyProfile);
router.put('/me', protect, updateMyProfile);

module.exports = router;

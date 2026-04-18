const express = require('express');
const {
  register,
  login,
  getMyProfile,
  updateMyProfile
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMyProfile);
router.put('/me', protect, updateMyProfile);

module.exports = router;

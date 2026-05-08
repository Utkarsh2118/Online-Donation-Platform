const express = require('express');
const {
  register, verifyEmail, resendVerificationEmail,
  login, refreshToken, logout,
  forgotPassword, resetPassword,
  getMyProfile, updateMyProfile
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { validate, registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, updateProfileSchema } = require('../utils/validators');

const router = express.Router();

// Public
router.post('/register',                validate(registerSchema),       register);
router.post('/verify-email',                                            verifyEmail);
router.post('/resend-verification',                                     resendVerificationEmail);
router.post('/login',                   validate(loginSchema),          login);
router.post('/refresh-token',                                           refreshToken);
router.post('/logout',                  protect,                        logout);
router.post('/forgot-password',         validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password',          validate(resetPasswordSchema),  resetPassword);

// Protected
router.get('/me',                       protect,                        getMyProfile);
router.put('/me',                       protect, validate(updateProfileSchema), updateMyProfile);

module.exports = router;

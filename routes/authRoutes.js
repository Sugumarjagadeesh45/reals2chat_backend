const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const protect = require('../middleware/auth');

console.log('authController:', Object.keys(authController));
console.log('authController.googlePhone:', authController.googlePhone);

router.post('/register', authController.register);
router.post('/verify-phone', authController.verifyPhone);
router.post('/update-profile', protect, authController.updateProfile);
router.post('/google-signin', authController.googleSignIn);
router.post('/google-phone', authController.googlePhone);
router.post('/login', authController.login);
router.post('/logout', protect, authController.logout);
router.post('/check-user', authController.checkUser);
router.post('/send-otp-email', authController.sendOTPEmail);
router.post('/set-password', authController.setPassword); // Add this line
router.get('/profile', protect, authController.getUserProfile);
router.get('/me', protect, (req, res) => {
  res.json(req.user);
});

module.exports = router;
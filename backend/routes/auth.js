const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const authController = require('../controllers/authController');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', authenticate, authController.getMe);

module.exports = router;

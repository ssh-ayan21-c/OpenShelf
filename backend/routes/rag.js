const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middlewares/auth');
const ragController = require('../controllers/ragController');

// Embedding storage is admin-only
router.post('/embed', authenticate, requireAdmin, ragController.embed);

// Asking questions requires authentication
router.post('/ask', authenticate, ragController.ask);

module.exports = router;

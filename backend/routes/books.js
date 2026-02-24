const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middlewares/auth');
const { upload } = require('../middlewares/upload');
const bookController = require('../controllers/bookController');

// Public
router.get('/', bookController.list);
router.get('/:id', bookController.getById);

// Admin only
router.post('/', authenticate, requireAdmin, bookController.create);
router.put('/:id', authenticate, requireAdmin, bookController.update);
router.delete('/:id', authenticate, requireAdmin, bookController.remove);

// Charity upload (authenticated)
router.post('/upload', authenticate, upload.single('pdf'), bookController.uploadCharity);

module.exports = router;

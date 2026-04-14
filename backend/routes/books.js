const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middlewares/auth');
const { uploadBookAssets, uploadImage, upload } = require('../middlewares/upload');
const bookController = require('../controllers/bookController');

// Public
router.get('/', bookController.list);
router.get('/:id', bookController.getById);
router.get('/:id/read', authenticate, bookController.read);
router.post('/:id/rent', authenticate, bookController.rent);

// Admin only
router.post('/', authenticate, requireAdmin, bookController.create);
router.put('/:id', authenticate, requireAdmin, bookController.update);
router.delete('/:id', authenticate, requireAdmin, bookController.remove);

// Admin cover upload
router.put('/:id/cover', authenticate, requireAdmin, uploadImage.single('cover'), bookController.uploadCover);

// Admin PDF upload
router.put('/:id/pdf', authenticate, requireAdmin, upload.single('pdf'), bookController.uploadPdf);

// Charity upload (authenticated)
router.post('/upload', authenticate, uploadBookAssets, bookController.uploadCharity);

module.exports = router;

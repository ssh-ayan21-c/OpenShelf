const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middlewares/auth');
const reservationController = require('../controllers/reservationController');

// All reservation routes require authentication
router.use(authenticate);

router.post('/', reservationController.create);
router.get('/my', reservationController.myReservations);
router.delete('/:id', reservationController.cancel);

// Admin: process / fulfill next reservation
router.post('/process/:bookId', requireAdmin, reservationController.processNext);

module.exports = router;

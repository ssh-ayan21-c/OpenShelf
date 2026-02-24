const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const fineController = require('../controllers/fineController');

// All fine routes require authentication
router.use(authenticate);

router.get('/my', fineController.myFines);
router.post('/calculate', fineController.calculate);
router.post('/:id/pay', fineController.pay);

module.exports = router;

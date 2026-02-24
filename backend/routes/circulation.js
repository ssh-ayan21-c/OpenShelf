const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const circulationController = require('../controllers/circulationController');

// All circulation routes require authentication
router.use(authenticate);

router.post('/borrow', circulationController.borrow);
router.post('/return', circulationController.returnBook);
router.post('/rent', circulationController.rent);
router.post('/buy', circulationController.buy);
router.get('/my', circulationController.myCirculations);

module.exports = router;

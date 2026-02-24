const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middlewares/auth');
const adminController = require('../controllers/adminController');

// All admin routes require authentication + admin role
router.use(authenticate, requireAdmin);

router.get('/stats', adminController.stats);
router.get('/orgs', adminController.listOrgs);
router.post('/orgs', adminController.addOrg);

module.exports = router;

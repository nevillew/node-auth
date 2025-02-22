const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateHandler } = require('../middleware/auth');

// User management routes
router.post('/', authenticateHandler, userController.create);
router.get('/:id', authenticateHandler, userController.get);
router.put('/:id', authenticateHandler, userController.update);
router.delete('/:id', authenticateHandler, userController.delete);

// Password management
router.post('/:id/change-password', authenticateHandler, userController.changePassword);

// User's tenants
router.get('/:id/tenants', authenticateHandler, userController.getTenants);

module.exports = router;

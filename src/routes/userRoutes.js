const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateHandler } = require('../middleware/auth');

// User management routes
router.post('/', authenticateHandler, userController.create);
router.get('/:id', authenticateHandler, userController.get);
router.put('/:id', authenticateHandler, userController.update);
router.delete('/:id', authenticateHandler, userController.delete);

// Profile management
router.get('/:id/profile', authenticateHandler, userController.getProfile);
router.put('/:id/profile', authenticateHandler, userController.updateProfile);

// Account settings
router.get('/:id/preferences', authenticateHandler, userController.getPreferences);
router.put('/:id/preferences', authenticateHandler, userController.updatePreferences);

// Email preferences
router.get('/:id/email-preferences', authenticateHandler, userController.getEmailPreferences);
router.put('/:id/email-preferences', authenticateHandler, userController.updateEmailPreferences);

// Password management
router.post('/:id/change-password', authenticateHandler, userController.changePassword);
router.post('/:id/reset-password', userController.requestPasswordReset);
router.post('/:id/reset-password/confirm', userController.confirmPasswordReset);

// Activity history
router.get('/:id/activity', authenticateHandler, userController.getActivityHistory);
router.get('/:id/login-history', authenticateHandler, userController.getLoginHistory);

// User's tenants
router.get('/:id/tenants', authenticateHandler, userController.getTenants);

module.exports = router;

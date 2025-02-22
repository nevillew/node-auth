const express = require('express');
const router = express.Router();
const tenantController = require('../controllers/tenantController');
const { authenticateHandler } = require('../middleware/auth');
const { upload } = require('../middleware/fileUpload');

// Tenant management routes
router.post('/', 
  authenticateHandler, 
  (req, res, next) => {
    req.route = { scopes: ['admin'] };
    next();
  },
  tenantController.create
);
router.get('/:id', authenticateHandler, tenantController.get);
router.put('/:id', 
  authenticateHandler,
  upload.single('logo'),
  tenantController.update
);
router.post('/:id/suspend', authenticateHandler, tenantController.suspend);
router.delete('/:id', authenticateHandler, tenantController.delete);
router.post('/:id/restore', authenticateHandler, tenantController.restore);
router.get('/:id/audit-history', authenticateHandler, tenantController.getAuditHistory);

// Tenant user management routes

router.post('/invitations/accept', tenantController.acceptInvitation);
router.delete('/:id/users/:userId', authenticateHandler, tenantController.removeUser);
router.post('/:id/users/:userId/remove', authenticateHandler, tenantController.removeUser);
router.put('/:id/users/:userId/roles', authenticateHandler, tenantController.updateUserRoles);

module.exports = router;

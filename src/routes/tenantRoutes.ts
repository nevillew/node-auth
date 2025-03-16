import express, { Router, Request, Response, NextFunction } from 'express';
import { tenantController } from '../controllers';
import { authenticateHandler, upload, csrfProtection } from '../middleware';

/**
 * Set required scopes middleware factory (pure function)
 */
const requireScopes = (scopes: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    (req as any).route = { scopes };
    next();
  };
};

/**
 * Create and configure tenant routes (factory function)
 */
const createTenantRouter = (): Router => {
  const router = express.Router();

  // Tenant management routes
  router.post('/', 
    authenticateHandler, 
    requireScopes(['admin']),
    tenantController.create
  );
  
  router.get('/', authenticateHandler, tenantController.list);
  router.get('/:id', authenticateHandler, tenantController.get);
  
  router.put('/:id', 
    authenticateHandler,
    upload.single('logo'),
    tenantController.update
  );
  
  // Additional routes
  router.get('/:id/audit-history', authenticateHandler, tenantController.getAuditHistory);
  router.get('/:id/login-history', authenticateHandler, tenantController.getLoginHistory);
  router.get('/:id/ip-restrictions', authenticateHandler, tenantController.getIpRestrictions);

  // The following routes aren't fully implemented in the controller yet
  // They will work with the JavaScript implementation until converted
  router.post('/:id/suspend', authenticateHandler, tenantController.suspend);
  router.delete('/:id', authenticateHandler, tenantController.delete);
  router.post('/:id/restore', authenticateHandler, tenantController.restore);
  
  // Tenant user management routes
  router.post('/invitations/accept', tenantController.acceptInvitation);
  router.delete('/:id/users/:userId', authenticateHandler, tenantController.removeUser);
  router.post('/:id/users/:userId/remove', authenticateHandler, tenantController.removeUser);
  router.put('/:id/users/:userId/roles', authenticateHandler, tenantController.updateUserRoles);

  return router;
};

// Create and export the router
export default createTenantRouter();
import express, { Router, Request, Response, NextFunction } from 'express';
import { 
  authenticateHandler, 
  csrfProtection, 
  upload, 
  validate 
} from '../middleware';
import userController from '../controllers/userController';
import rateLimit from 'express-rate-limit';

/**
 * Create route-specific rate limiter (pure factory function)
 */
const createUserRateLimiter = () => rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 requests per hour
  message: 'Too many user creation requests, please try again later'
});

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
 * Create and configure user routes (factory function)
 */
const createUserRouter = (): Router => {
  const router = express.Router();
  const userCreationLimiter = createUserRateLimiter();

  // User management routes
  router.post('/', 
    authenticateHandler,
    // To be replaced with actual schema
    // validate(createUserSchema),
    csrfProtection,
    userCreationLimiter,
    requireScopes(['users:write']),
    userController.create
  );
  
  router.get('/', authenticateHandler, userController.list);
  router.get('/:id', authenticateHandler, userController.get);
  router.put('/:id', authenticateHandler, userController.update);
  router.delete('/:id', authenticateHandler, userController.delete);

  // User search and filtering
  router.get('/search', authenticateHandler, userController.search);

  // Bulk operations
  router.post('/bulk/update', authenticateHandler, userController.bulkUpdate);

  // Status management
  router.put('/:id/status', authenticateHandler, userController.updateStatus);

  // Role and permission management
  router.put('/:id/roles', authenticateHandler, userController.assignRoles);
  router.put('/:id/permissions', authenticateHandler, userController.updatePermissions);

  // Activity monitoring
  router.get('/:id/activity', 
    authenticateHandler,
    requireScopes(['users:activity:read']), 
    userController.getActivity
  );

  // Account deactivation
  router.post('/:id/deactivate', authenticateHandler, userController.deactivate);

  // Profile management
  router.get('/:id/profile', authenticateHandler, userController.getProfile);
  router.put('/:id/profile', 
    authenticateHandler,
    upload.single('avatar'),
    userController.update
  );

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

  // Activity and audit history
  router.get('/:id/activity', authenticateHandler, userController.getActivityHistory);
  router.get('/:id/login-history', authenticateHandler, userController.getLoginHistory);
  router.get('/:id/audit-history', authenticateHandler, userController.getAuditHistory);

  // User's tenants
  router.get('/:id/tenants', authenticateHandler, userController.getTenants);

  return router;
};

// Create and export the router
export default createUserRouter();
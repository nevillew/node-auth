import { Router } from 'express';
import { AuthController } from './auth.controller';
import { authenticate, requireRoles, validateTenantAccess } from './auth.middleware';

const router = Router();
const authController = new AuthController();

// Public routes
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.post('/refresh', authController.refresh);

// Protected routes
router.post(
  '/change-password',
  authenticate,
  validateTenantAccess,
  authController.changePassword
);

// Admin routes
router.get(
  '/users',
  authenticate,
  validateTenantAccess,
  requireRoles(['admin']),
  authController.listUsers
);

export default router;

/**
 * Routes Index
 * 
 * This file provides a centralized place to import and export all routes
 * allowing for easy importing from a single location.
 */

import userRoutes from './userRoutes';
import tenantRoutes from './tenantRoutes';
import notificationRoutes from './notificationRoutes';
import roleRoutes from './roleRoutes';
import emailRoutes from './emailRoutes';
import healthRoutes from './health';
import authRoutes from './auth';

export {
  userRoutes,
  tenantRoutes,
  notificationRoutes,
  roleRoutes,
  emailRoutes,
  healthRoutes,
  authRoutes
};

// Export a function that configures all routes on an Express app
import { Application } from 'express';

export const configureRoutes = (app: Application): void => {
  app.use('/api/users', userRoutes);
  app.use('/api/tenants', tenantRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/roles', roleRoutes);
  app.use('/auth', authRoutes);
  app.use('/email', emailRoutes);
  app.use('/', healthRoutes);
};
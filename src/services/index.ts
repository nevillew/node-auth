/**
 * Services Index
 * 
 * This file provides a centralized place to import and export all services
 * allowing for easy importing from a single location.
 */

// Import services that have been converted to TypeScript
import * as userService from './userService';
import * as roleService from './roleService';
import * as securityAuditService from './securityAuditService';
import * as tenantService from './tenantService';
import * as twoFactorService from './twoFactorService';
import * as cacheManager from './cacheManager';
import * as emailService from './emailService';
import * as notificationService from './notificationService';
import * as slackService from './slackService';
import * as emailQueueService from './emailQueueService';
import * as fallbackCache from './fallbackCache';
import * as tenantConfigService from './tenantConfigService';
import * as tokenIntrospectionService from './tokenIntrospectionService';
import * as tenantOnboardingService from './tenantOnboardingService';
import * as passKeyService from './passKeyService';

// Export all services
export {
  // TypeScript services (functional approach)
  userService,
  roleService,
  securityAuditService,
  tenantService,
  twoFactorService,
  cacheManager,
  emailService,
  notificationService,
  slackService,
  emailQueueService,
  fallbackCache,
  tenantConfigService,
  tokenIntrospectionService,
  tenantOnboardingService,
  passKeyService
};
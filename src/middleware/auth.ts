import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { createAppError } from './errorHandler';
import { Result, success, failure, fromPromise, ErrorCode } from '../utils/errors';
import OAuth2Server from 'oauth2-server';
import rateLimit from 'express-rate-limit';
import { validateCsrfToken } from './csrf';
import { oauth2Server } from '../config/auth';
import logger from '../config/logger';
import { User, OAuthToken, Tenant, Role, SecurityAuditLog } from '../models';
import { Op } from 'sequelize';
import { sendSystemNotification } from '../services/notificationService';
import { sendEmail } from '../services/emailService';

// Pure function for IP validation
const isValidIP = (ip: string): boolean => {
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
  
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
};

// Rate limiter configuration (pure function)
const createAuthRateLimiter = () => rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: 'Too many authentication attempts, please try again later'
});

const authRateLimiter = createAuthRateLimiter();

// Validate request headers (pure function)
const validateHeaders = (
  req: Request
): Result<void> => {
  if (!req.headers['x-request-id']) {
    return failure(createAppError('MISSING_REQUIRED', 400, {
      field: 'x-request-id',
      message: 'Missing request ID header'
    }));
  }

  if (!req.headers['x-api-version']) {
    return failure(createAppError('MISSING_REQUIRED', 400, {
      field: 'x-api-version',
      message: 'Missing API version header'
    }));
  }

  const clientIP = req.ip || req.connection.remoteAddress || '';
  if (!isValidIP(clientIP)) {
    return failure(createAppError('INVALID_FORMAT', 400, {
      field: 'clientIP',
      message: 'Invalid IP address format'
    }));
  }

  return success(undefined);
};

// Validate OAuth token (async with Result pattern)
const validateOAuthToken = async (
  req: Request, 
  res: Response
): Promise<Result<OAuth2Server.Token>> => {
  try {
    const request = new OAuth2Server.Request(req);
    const response = new OAuth2Server.Response(res);

    const token = await oauth2Server.authenticate(request, response);
    return success(token);
  } catch (err) {
    logger.error('OAuth authentication failed:', err);
    return failure({
      message: err instanceof Error ? err.message : 'Authentication failed',
      statusCode: err instanceof OAuth2Server.OAuthError ? err.code || 401 : 401,
      originalError: err instanceof Error ? err : new Error('Authentication failed'),
    });
  }
};

// Check impersonation permissions (async with Result pattern)
const checkImpersonation = async (
  token: OAuth2Server.Token
): Promise<Result<{ impersonator?: any }>> => {
  if (!token.impersonatorId) {
    return success({ impersonator: undefined });
  }

  try {
    // Verify impersonator still has permission
    const impersonator = await User.findByPk(token.impersonatorId, {
      include: [Role]
    });

    if (!impersonator) {
      return failure(createAppError('UNAUTHORIZED', 401, {
        message: 'Impersonator not found'
      }));
    }

    const hasPermission = impersonator.roles?.some(role => 
      role.permissions?.includes('impersonate')
    );

    if (!hasPermission) {
      return failure(createAppError('UNAUTHORIZED', 403, {
        message: 'Impersonation permission revoked'
      }));
    }

    return success({ impersonator });
  } catch (err) {
    logger.error('Impersonation check failed:', err);
    return failure({
      message: 'Impersonation verification failed',
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('Impersonation check failed'),
    });
  }
};

// Validate token for M2M access (async with Result pattern)
const validateM2MAccess = async (
  token: OAuth2Server.Token,
  req: Request
): Promise<Result<void>> => {
  if (token.type !== 'm2m') {
    return success(undefined);
  }

  const requestedTenantId = req.headers['x-tenant-id'];
  if (!requestedTenantId) {
    return failure(createAppError('MISSING_REQUIRED', 400, {
      field: 'x-tenant-id',
      message: 'Tenant ID required for M2M token access'
    }));
  }

  if (token.tenantId !== requestedTenantId) {
    // Log security audit
    await SecurityAuditLog.create({
      userId: token.user?.id,
      event: 'M2M_UNAUTHORIZED_TENANT_ACCESS',
      details: {
        tokenTenantId: token.tenantId,
        requestedTenantId,
        clientId: token.clientId
      },
      severity: 'high'
    });
    
    return failure(createAppError('UNAUTHORIZED', 403, {
      message: 'M2M token not authorized for this tenant'
    }));
  }

  return success(undefined);
};

// Verify required scopes (async with Result pattern)
const verifyScopes = async (
  token: OAuth2Server.Token,
  req: AuthenticatedRequest
): Promise<Result<void>> => {
  const requiredScopes = req.route?.scopes || [];
  if (requiredScopes.length === 0) {
    return success(undefined);
  }

  const { hasRequiredScopes } = await import('../auth/scopes');
  
  if (!hasRequiredScopes(token.scopes, requiredScopes)) {
    // Log security audit
    await SecurityAuditLog.create({
      userId: token.user?.id,
      event: 'INSUFFICIENT_SCOPE_ACCESS',
      details: {
        requiredScopes,
        userScopes: token.scopes,
        path: req.path,
        method: req.method
      },
      severity: 'medium'
    });
    
    return failure(createAppError('INSUFFICIENT_PERMISSIONS', 403, {
      required: requiredScopes,
      provided: token.scopes
    }));
  }

  return success(undefined);
};

// Check token revocation status (async with Result pattern)
const checkTokenRevocation = async (
  token: OAuth2Server.Token
): Promise<Result<void>> => {
  return fromPromise(
    OAuthToken.findOne({
      where: { accessToken: token.accessToken },
      include: [{
        model: Role,
        through: { attributes: [] }
      }]
    }),
    'auth.checkTokenRevocation'
  ).then(tokenResult => {
    if (!tokenResult.ok) return tokenResult;
    
    const tokenRecord = tokenResult.value;
    
    if (tokenRecord?.revoked) {
      return failure(createAppError('INVALID_TOKEN', 401, {
        message: 'Token has been revoked'
      }));
    }
    
    return success(undefined);
  });
};

// Handle concurrent session limits (async with Result pattern)
const handleConcurrentSessions = async (
  token: OAuth2Server.Token,
  tenant: any
): Promise<Result<void>> => {
  if (!tenant?.securityPolicy?.session?.maxConcurrentSessions) {
    return success(undefined);
  }
  
  const { maxConcurrentSessions } = tenant.securityPolicy.session;

  try {
    const activeSessions = await OAuthToken.count({
      where: {
        userId: token.user.id,
        revoked: false,
        expiresAt: { [Op.gt]: new Date() }
      }
    });

    if (activeSessions > maxConcurrentSessions) {
      // Revoke oldest sessions
      const oldestSessions = await OAuthToken.findAll({
        where: {
          userId: token.user.id,
          revoked: false
        },
        order: [['createdAt', 'ASC']],
        limit: activeSessions - maxConcurrentSessions + 1
      });

      await Promise.all(oldestSessions.map(session => 
        session.update({ revoked: true })
      ));

      return failure(createAppError('SESSION_LIMIT_EXCEEDED', 401, {
        message: 'Maximum concurrent sessions exceeded',
        limit: maxConcurrentSessions
      }));
    }

    return success(undefined);
  } catch (err) {
    logger.error('Concurrent session check failed:', err);
    return failure({
      message: 'Session verification failed',
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('Session check failed'),
    });
  }
};

// Check session timeout (pure function with Result pattern)
const checkSessionTimeout = (
  token: OAuth2Server.Token,
  tenant: any
): Result<void> => {
  if (!tenant?.securityPolicy?.session?.sessionTimeout) {
    return success(undefined);
  }

  const { sessionTimeout } = tenant.securityPolicy.session;
  const tokenAge = (Date.now() - token.createdAt.getTime()) / 1000; // in seconds
  
  if (tokenAge > sessionTimeout) {
    return failure(createAppError('TOKEN_EXPIRED', 401, {
      message: 'Session expired',
      timeout: sessionTimeout
    }));
  }

  return success(undefined);
};

// Enforce 2FA requirements (async with Result pattern)
const enforceTwoFactorAuth = async (
  token: OAuth2Server.Token,
  tenant: any
): Promise<Result<void>> => {
  if (!tenant?.securityPolicy?.twoFactor?.required) {
    return success(undefined);
  }

  try {
    const user = await User.findByPk(token.user.id, {
      include: [{
        model: Role,
        through: { attributes: ['roles'] }
      }]
    });

    if (!user) {
      return failure(createAppError('RESOURCE_NOT_FOUND', 404, {
        message: 'User not found'
      }));
    }

    // Check if user is exempt based on roles
    const isExempt = user.Roles?.some(role => 
      tenant.securityPolicy.twoFactor.exemptRoles.includes(role.name)
    );

    if (isExempt || user.twoFactorEnabled) {
      return success(undefined);
    }

    // Calculate grace period from enforcement date or user creation
    const enforcementDate = tenant.securityPolicy.twoFactor.enforcementDate || 
      new Date(user.createdAt.getTime() + 
        (tenant.securityPolicy.twoFactor.gracePeriodDays * 24 * 60 * 60 * 1000));
    
    const graceLoginsLeft = tenant.securityPolicy.twoFactor.graceLogins - (user.loginCount || 0);
    
    if (new Date() > enforcementDate && graceLoginsLeft <= 0) {
      // Create security audit log
      await SecurityAuditLog.create({
        userId: user.id,
        event: 'TWO_FACTOR_ENFORCEMENT_BLOCKED',
        severity: 'high',
        details: {
          enforcementDate,
          totalLogins: user.loginCount,
          tenantId: tenant.id
        }
      });
      
      return failure(createAppError('TWO_FACTOR_REQUIRED', 403, {
        enforcementDate,
        graceLoginsLeft: 0
      }));
    }
    
    // Increment login count and notify user
    await user.increment('loginCount');
    const remainingLogins = tenant.securityPolicy.twoFactor.graceLogins - user.loginCount;
    
    if (remainingLogins <= 3) {
      await Promise.all([
        sendSystemNotification(
          user.id,
          `2FA Required: ${remainingLogins} logins remaining before enforcement`
        ),
        sendEmail({
          to: user.email,
          subject: '2FA Setup Required',
          template: '2fa-required',
          context: {
            name: user.name,
            remainingLogins,
            enforcementDate: enforcementDate.toLocaleDateString(),
            setupUrl: `${process.env.FRONTEND_URL}/settings/security/2fa/setup`
          }
        })
      ]);
    }

    return success(undefined);
  } catch (err) {
    logger.error('2FA enforcement check failed:', err);
    return failure({
      message: '2FA verification failed',
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('2FA check failed'),
    });
  }
};

// Extend session if configured (async with Result pattern)
const extendSession = async (
  token: OAuth2Server.Token,
  tenant: any
): Promise<Result<void>> => {
  if (!tenant?.securityPolicy?.session?.extendOnActivity) {
    return success(undefined);
  }

  try {
    await OAuthToken.update(
      {
        expiresAt: new Date(Date.now() + (tenant.securityPolicy.session.sessionTimeout * 1000))
      },
      {
        where: { accessToken: token.accessToken }
      }
    );
    
    return success(undefined);
  } catch (err) {
    logger.error('Session extension failed:', err);
    return failure({
      message: 'Session extension failed',
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('Session extension failed'),
    });
  }
};

// Main authentication middleware (composition of all auth steps)
export const authenticateHandler = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    // Apply rate limiting
    await new Promise<void>((resolve, reject) => {
      authRateLimiter(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Validate CSRF token for authenticated requests
    if (req.headers.authorization) {
      await new Promise<void>((resolve, reject) => {
        validateCsrfToken(req, res, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    // Validate headers
    const headersResult = validateHeaders(req);
    if (!headersResult.ok) {
      return res.status(headersResult.error.statusCode).json({
        error: headersResult.error.code,
        message: headersResult.error.message,
        details: headersResult.error.details
      });
    }

    // Validate OAuth token
    const tokenResult = await validateOAuthToken(req, res);
    if (!tokenResult.ok) {
      return res.status(tokenResult.error.statusCode).json({
        error: tokenResult.error.code || 'AUTHENTICATION_FAILED',
        message: tokenResult.error.message
      });
    }

    const token = tokenResult.value;
    
    // Check impersonation
    const impersonationResult = await checkImpersonation(token);
    if (!impersonationResult.ok) {
      return res.status(impersonationResult.error.statusCode).json({
        error: impersonationResult.error.code,
        message: impersonationResult.error.message
      });
    }
    
    if (impersonationResult.value.impersonator) {
      (req as AuthenticatedRequest).impersonator = impersonationResult.value.impersonator;
    }

    // Validate M2M access
    const m2mResult = await validateM2MAccess(token, req);
    if (!m2mResult.ok) {
      return res.status(m2mResult.error.statusCode).json({
        error: m2mResult.error.code,
        message: m2mResult.error.message,
        details: m2mResult.error.details
      });
    }

    // Verify scopes
    const scopesResult = await verifyScopes(token, req as AuthenticatedRequest);
    if (!scopesResult.ok) {
      return res.status(scopesResult.error.statusCode).json({
        error: scopesResult.error.code,
        message: scopesResult.error.message,
        details: scopesResult.error.details
      });
    }

    // Check token revocation
    const revocationResult = await checkTokenRevocation(token);
    if (!revocationResult.ok) {
      return res.status(revocationResult.error.statusCode).json({
        error: revocationResult.error.code,
        message: revocationResult.error.message
      });
    }

    // Set user and token on request
    (req as AuthenticatedRequest).user = token.user;
    (req as AuthenticatedRequest).token = token;

    // Get tenant security policy
    const tenant = await Tenant.findByPk(req.headers['x-tenant']);
    
    if (tenant?.securityPolicy?.session) {
      // Handle concurrent sessions
      const sessionsResult = await handleConcurrentSessions(token, tenant);
      if (!sessionsResult.ok) {
        return res.status(sessionsResult.error.statusCode).json({
          error: sessionsResult.error.code,
          message: sessionsResult.error.message,
          details: sessionsResult.error.details
        });
      }

      // Check session timeout
      const timeoutResult = checkSessionTimeout(token, tenant);
      if (!timeoutResult.ok) {
        await OAuthToken.update(
          { revoked: true },
          { where: { accessToken: token.accessToken } }
        );
        
        return res.status(timeoutResult.error.statusCode).json({
          error: timeoutResult.error.code,
          message: timeoutResult.error.message
        });
      }

      // Enforce 2FA requirement
      const twoFactorResult = await enforceTwoFactorAuth(token, tenant);
      if (!twoFactorResult.ok) {
        return res.status(twoFactorResult.error.statusCode).json({
          error: twoFactorResult.error.code,
          message: twoFactorResult.error.message,
          details: twoFactorResult.error.details
        });
      }

      // Extend session if configured
      const extensionResult = await extendSession(token, tenant);
      if (!extensionResult.ok) {
        logger.warn('Session extension failed:', extensionResult.error);
        // Continue anyway, this is not critical
      }
    }

    next();
  } catch (err) {
    logger.error('Authentication failed:', err);
    if (err instanceof OAuth2Server.OAuthError) {
      res.status(err.code || 401).json({
        error: err.name,
        message: err.message
      });
    } else {
      next(createAppError('AUTHENTICATION_FAILED', 401));
    }
  }
};

// OAuth2 authorization endpoint handler
export const authorizeHandler = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const request = new OAuth2Server.Request(req);
    const response = new OAuth2Server.Response(res);

    const codeResult = await fromPromise(oauth2Server.authorize(request, response));
    
    if (!codeResult.ok) {
      return res.status(401).json({ 
        error: 'Authorization failed',
        message: codeResult.error.message
      });
    }
    
    res.locals.oauth = { code: codeResult.value };
    next();
  } catch (err) {
    res.status(401).json({ error: 'Authorization failed' });
  }
};

// Token generation handler
export const tokenHandler = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const request = new OAuth2Server.Request(req);
    const response = new OAuth2Server.Response(res);

    // Check if token is revoked
    if (request.body.grant_type === 'refresh_token') {
      const oldToken = await OAuthToken.findOne({
        where: { refreshToken: request.body.refresh_token }
      });
      
      if (oldToken?.revoked) {
        return res.status(401).json({ 
          error: 'INVALID_TOKEN',
          message: 'Token has been revoked'
        });
      }
    }

    // Generate new token
    const tokenResult = await fromPromise(oauth2Server.token(request, response));
    
    if (!tokenResult.ok) {
      return res.status(401).json({ 
        error: 'TOKEN_GENERATION_FAILED',
        message: tokenResult.error.message
      });
    }
    
    const token = tokenResult.value;
    
    // If this is a refresh token request, rotate the refresh token
    if (request.body.grant_type === 'refresh_token') {
      const oldRefreshToken = request.body.refresh_token;
      
      // Revoke old refresh token
      await OAuthToken.update(
        { revoked: true },
        { where: { refreshToken: oldRefreshToken } }
      );

      // Generate new refresh token
      const crypto = await import('crypto');
      token.refreshToken = crypto.randomBytes(40).toString('hex');
      token.refreshTokenExpiresAt = new Date(Date.now() + (14 * 24 * 60 * 60 * 1000)); // 14 days
      
      await OAuthToken.create({
        accessToken: token.accessToken,
        accessTokenExpiresAt: token.accessTokenExpiresAt,
        refreshToken: token.refreshToken,
        refreshTokenExpiresAt: token.refreshTokenExpiresAt,
        userId: token.user.id
      });
    }

    res.locals.oauth = { token };
    next();
  } catch (err) {
    res.status(401).json({ 
      error: 'TOKEN_GENERATION_FAILED',
      message: err instanceof Error ? err.message : 'Token generation failed'
    });
  }
};

const OAuth2Server = require('oauth2-server');
const { oauth2Server } = require('../config/auth');

const { validateCsrfToken } = require('./csrf');

const authenticateHandler = async (req, res, next) => {
  // Validate CSRF token for authenticated requests
  if (req.headers.authorization) {
    await validateCsrfToken(req, res, next);
  }
  
  try {
    const request = new OAuth2Server.Request(req);
    const response = new OAuth2Server.Response(res);

    let token = await oauth2Server.authenticate(request, response);
    
    // Handle impersonation tokens
    if (token.impersonatorId) {
      // Verify impersonator still has permission
      const impersonator = await User.findByPk(token.impersonatorId, {
        include: [Role]
      });
      
      const hasPermission = impersonator.roles.some(role => 
        role.permissions.includes('impersonate')
      );
      
      if (!hasPermission) {
        throw new Error('Impersonation permission revoked');
      }

      // Add impersonator info to request
      req.impersonator = impersonator;
    }
    
    // Check if token is revoked and has required scopes
    const tokenRecord = await OAuthToken.findOne({
      where: { accessToken: token.accessToken },
      include: [{
        model: Role,
        through: { attributes: [] }
      }]
    });

    // For M2M tokens, validate tenant access
    if (token.type === 'm2m') {
      const requestedTenantId = req.headers['x-tenant-id'];
      if (!requestedTenantId) {
        throw new Error('Tenant ID required for M2M token access');
      }
      
      if (token.tenantId !== requestedTenantId) {
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
        throw new Error('M2M token not authorized for this tenant');
      }
    }

    // Verify token has required scopes for the route
    const requiredScopes = req.route?.scopes || [];
    if (requiredScopes.length > 0) {
      const hasRequiredScopes = requiredScopes.every(scope => 
        token.scopes.includes(scope)
      );
      
      if (!hasRequiredScopes) {
        throw new Error('Insufficient scopes');
      }
    }
    
    if (tokenRecord?.revoked) {
      throw new Error('Token has been revoked');
    }
    req.user = token.user;
    req.token = token;

    // Get tenant security policy
    const tenant = await Tenant.findByPk(req.headers['x-tenant']);
    if (tenant?.securityPolicy?.session) {
      const { maxConcurrentSessions, sessionTimeout } = tenant.securityPolicy.session;

      // Check concurrent sessions
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

        throw new Error('Maximum concurrent sessions exceeded');
      }

      // Check session timeout
      const tokenAge = (Date.now() - token.createdAt) / 1000; // in seconds
      if (tokenAge > sessionTimeout) {
        await token.update({ revoked: true });
        throw new Error('Session expired');
      }

      // Check 2FA requirement
      if (tenant.securityPolicy.twoFactor?.required) {
        const user = await User.findByPk(token.user.id);
        if (!user.twoFactorEnabled) {
          // Check if within grace period
          const gracePeriodEnd = new Date(user.createdAt.getTime() + 
            (tenant.securityPolicy.twoFactor.gracePeriodDays * 24 * 60 * 60 * 1000));
          const graceLoginsLeft = tenant.securityPolicy.twoFactor.graceLogins - (user.loginCount || 0);
          
          if (new Date() > gracePeriodEnd && graceLoginsLeft <= 0) {
            // Create security audit log
            await SecurityAuditLog.create({
              userId: user.id,
              event: 'TWO_FACTOR_GRACE_PERIOD_EXPIRED',
              severity: 'high',
              details: {
                gracePeriodEnd,
                totalLogins: user.loginCount
              }
            });
            
            throw new AppError('2FA setup required - grace period expired', 403);
          }
          
          // Increment login count and notify user
          await user.increment('loginCount');
          const remainingLogins = tenant.securityPolicy.twoFactor.graceLogins - user.loginCount;
          
          if (remainingLogins <= 3) {
            await notificationService.sendSystemNotification(
              user.id,
              `Please set up 2FA. You have ${remainingLogins} logins remaining before it becomes mandatory.`
            );
          }
        }
      }

      // Extend session if configured
      if (tenant.securityPolicy.session.extendOnActivity) {
        await token.update({
          expiresAt: new Date(Date.now() + (sessionTimeout * 1000))
        });
      }
    }

    next();
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

const authorizeHandler = async (req, res, next) => {
  try {
    const request = new OAuth2Server.Request(req);
    const response = new OAuth2Server.Response(res);

    const code = await oauth2Server.authorize(request, response);
    res.locals.oauth = { code };
    next();
  } catch (err) {
    res.status(401).json({ error: 'Authorization failed' });
  }
};

const tokenHandler = async (req, res, next) => {
  try {
    const request = new OAuth2Server.Request(req);
    const response = new OAuth2Server.Response(res);

    // Check if token is revoked
    if (request.body.grant_type === 'refresh_token') {
      const oldToken = await OAuthToken.findOne({
        where: { refreshToken: request.body.refresh_token }
      });
      
      if (oldToken?.revoked) {
        throw new Error('Token has been revoked');
      }
    }

    // Generate new token
    const token = await oauth2Server.token(request, response);
    
    // If this is a refresh token request, rotate the refresh token
    if (request.body.grant_type === 'refresh_token') {
      const oldRefreshToken = request.body.refresh_token;
      
      // Revoke old refresh token
      await OAuthToken.update(
        { revoked: true },
        { where: { refreshToken: oldRefreshToken } }
      );

      // Generate new refresh token
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
    res.status(401).json({ error: 'Token generation failed' });
  }
};

module.exports = {
  authenticateHandler,
  authorizeHandler,
  tokenHandler
};

const OAuth2Server = require('oauth2-server');
const { oauth2Server } = require('../config/auth');

const authenticateHandler = async (req, res, next) => {
  try {
    const request = new OAuth2Server.Request(req);
    const response = new OAuth2Server.Response(res);

    const token = await oauth2Server.authenticate(request, response);
    
    // Check if token is revoked and has required scopes
    const tokenRecord = await OAuthToken.findOne({
      where: { accessToken: token.accessToken },
      include: [{
        model: Role,
        through: { attributes: [] }
      }]
    });

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

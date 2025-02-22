const OAuth2Server = require('oauth2-server');
const { oauth2Server } = require('../config/auth');

const authenticateHandler = async (req, res, next) => {
  try {
    const request = new OAuth2Server.Request(req);
    const response = new OAuth2Server.Response(res);

    const token = await oauth2Server.authenticate(request, response);
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

    const token = await oauth2Server.token(request, response);
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

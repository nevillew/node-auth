const OAuth2Server = require('oauth2-server');
const { oauth2Server } = require('../config/auth');

const authenticateHandler = async (req, res, next) => {
  try {
    const request = new OAuth2Server.Request(req);
    const response = new OAuth2Server.Response(res);

    const token = await oauth2Server.authenticate(request, response);
    req.user = token.user;
    req.token = token;
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

const { hasRequiredScopes } = require('../auth/scopes');
const logger = require('../utils/logger');

/**
 * Middleware to check if user has required scopes
 * @param {string[]} requiredScopes - Array of required scopes
 */
const scopeCheck = (requiredScopes) => {
  return (req, res, next) => {
    if (!req.user || !req.user.scopes) {
      logger.warn('No user scopes found in request');
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Missing required scopes',
        required: requiredScopes
      });
    }

    if (!hasRequiredScopes(req.user.scopes, requiredScopes)) {
      logger.warn('Insufficient scopes', {
        userId: req.user.id,
        userScopes: req.user.scopes,
        requiredScopes,
        path: req.path
      });

      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions',
        required: requiredScopes,
        provided: req.user.scopes
      });
    }

    next();
  };
};

module.exports = scopeCheck;

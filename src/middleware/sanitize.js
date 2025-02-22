const sanitizeHtml = require('sanitize-html');
const xss = require('xss');

const sanitizeObject = (obj) => {
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  if (obj !== null && typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }
  
  if (typeof obj === 'string') {
    // Sanitize HTML content
    const sanitizedHtml = sanitizeHtml(obj, {
      allowedTags: [], // Strip all HTML
      allowedAttributes: {},
      disallowedTagsMode: 'recursiveEscape'
    });
    
    // Additional XSS protection
    return xss(sanitizedHtml, {
      whiteList: {},          // Strip all tags
      stripIgnoreTag: true,   // Strip ignored tags
      stripIgnoreTagBody: ['script', 'style'] // Remove script and style tag contents
    });
  }
  
  return obj;
};

const sanitizeMiddleware = (req, res, next) => {
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }
  
  next();
};

module.exports = sanitizeMiddleware;

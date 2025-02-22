const sanitizeHtml = require('sanitize-html');
const xss = require('xss');
const validator = require('validator');

// HTML sanitization options
const htmlOptions = {
  allowedTags: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'ul', 'ol', 'li',
    'b', 'i', 'strong', 'em', 'strike', 'code', 'hr', 'table', 'thead',
    'tbody', 'tr', 'th', 'td', 'a', 'img'
  ],
  allowedAttributes: {
    'a': ['href', 'target', 'rel'],
    'img': ['src', 'alt', 'title', 'width', 'height'],
    '*': ['title', 'aria-*', 'data-*']
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: {
    img: ['http', 'https', 'data']
  },
  allowedStyling: [],
  allowedClasses: {
    'p': ['text-*', 'mb-*'],
    'a': ['btn', 'btn-*'],
    'img': ['img-fluid']
  },
  allowProtocolRelative: false,
  enforceHtmlBoundary: true
};

// XSS filter options
const xssOptions = {
  whiteList: {}, // No tags allowed
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style', 'xml']
};

// SQL injection patterns
const sqlInjectionPatterns = [
  /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,
  /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/i,
  /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/i,
  /((\%27)|(\'))union/i,
  /exec(\s|\+)+(s|x)p\w+/i,
  /UNION\s+ALL\s+SELECT/i
];

function sanitizeHtmlContent(html) {
  if (!html) return '';
  
  // First pass: Basic HTML sanitization
  let sanitized = sanitizeHtml(html, htmlOptions);
  
  // Second pass: XSS protection
  sanitized = xss(sanitized, xssOptions);
  
  return sanitized;
}

function sanitizeObject(obj) {
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  if (obj !== null && typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      // Sanitize key names
      const safeKey = validator.escape(key);
      sanitized[safeKey] = sanitizeObject(value);
    }
    return sanitized;
  }
  
  if (typeof obj === 'string') {
    // Check for SQL injection
    if (sqlInjectionPatterns.some(pattern => pattern.test(obj))) {
      throw new Error('Potential SQL injection detected');
    }
    
    // Sanitize string
    let sanitized = validator.escape(obj);
    sanitized = sanitizeHtmlContent(sanitized);
    
    // Additional validation for specific formats
    if (validator.isEmail(obj)) {
      sanitized = validator.normalizeEmail(obj);
    } else if (validator.isURL(obj)) {
      sanitized = validator.normalizeURL(obj);
    }
    
    return sanitized;
  }
  
  return obj;
}

function validateContentSecurityPolicy(content) {
  // Check for inline scripts
  if (/<script\b[^>]*>[\s\S]*?<\/script>/gi.test(content)) {
    throw new Error('Inline scripts not allowed');
  }
  
  // Check for inline styles
  if (/<style\b[^>]*>[\s\S]*?<\/style>/gi.test(content)) {
    throw new Error('Inline styles not allowed');
  }
  
  // Check for event handlers
  if (/\bon\w+\s*=/gi.test(content)) {
    throw new Error('Inline event handlers not allowed');
  }
  
  // Check for data: URLs
  if (/data:[^;]*;base64/gi.test(content)) {
    throw new Error('Data URLs not allowed');
  }
  
  return true;
}

module.exports = {
  sanitizeHtmlContent,
  sanitizeObject,
  validateContentSecurityPolicy,
  htmlOptions,
  xssOptions
};

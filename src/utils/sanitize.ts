import sanitizeHtml from 'sanitize-html';
import xss from 'xss';
import validator from 'validator';
import { Result, success, failure } from './errors';

// HTML sanitization options (pure configuration)
export const htmlOptions: sanitizeHtml.IOptions = {
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

// XSS filter options (pure configuration)
export const xssOptions: xss.IFilterXSSOptions = {
  whiteList: {}, // No tags allowed
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style', 'xml']
};

// SQL injection patterns (pure configuration)
export const sqlInjectionPatterns: RegExp[] = [
  /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,
  /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/i,
  /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/i,
  /((\%27)|(\'))union/i,
  /exec(\s|\+)+(s|x)p\w+/i,
  /UNION\s+ALL\s+SELECT/i
];

/**
 * Check if a string matches any SQL injection patterns (pure function)
 */
export const hasSqlInjection = (str: string): boolean => {
  return sqlInjectionPatterns.some(pattern => pattern.test(str));
};

/**
 * Sanitize HTML content with multiple layers of protection (pure function)
 */
export const sanitizeHtmlContent = (html: string): string => {
  if (!html) return '';
  
  // First pass: Basic HTML sanitization
  const sanitized = sanitizeHtml(html, htmlOptions);
  
  // Second pass: XSS protection
  return xss(sanitized, xssOptions);
};

/**
 * Format-specific sanitization functions (pure functions)
 */
export const sanitizeEmail = (email: string): string => {
  return validator.isEmail(email) ? validator.normalizeEmail(email) || email : email;
};

export const sanitizeUrl = (url: string): string => {
  return validator.isURL(url) ? url : '';
};

/**
 * Validate and sanitize a string based on content (pure function)
 */
export const sanitizeString = (str: string): Result<string> => {
  // Check for SQL injection
  if (hasSqlInjection(str)) {
    return failure({
      message: 'Potential SQL injection detected',
      statusCode: 400
    });
  }
  
  // Sanitize string
  let sanitized = validator.escape(str);
  sanitized = sanitizeHtmlContent(sanitized);
  
  // Format-specific sanitization
  if (validator.isEmail(str)) {
    sanitized = sanitizeEmail(str);
  } else if (validator.isURL(str)) {
    sanitized = sanitizeUrl(str);
  }
  
  return success(sanitized);
};

/**
 * Recursively sanitize an object or array (pure function)
 */
export const sanitizeObject = <T>(obj: T): Result<T> => {
  // Handle arrays
  if (Array.isArray(obj)) {
    const sanitizedArray: any[] = [];
    let hasFailure = false;
    let failureError = null;
    
    for (const item of obj) {
      const result = sanitizeObject(item);
      if (result.ok) {
        sanitizedArray.push(result.value);
      } else {
        hasFailure = true;
        failureError = result.error;
        break;
      }
    }
    
    return hasFailure 
      ? failure(failureError)
      : success(sanitizedArray as unknown as T);
  }
  
  // Handle objects
  if (obj !== null && typeof obj === 'object') {
    const sanitized: Record<string, any> = {};
    let hasFailure = false;
    let failureError = null;
    
    for (const [key, value] of Object.entries(obj)) {
      // Sanitize key names
      const safeKey = validator.escape(key);
      
      const result = sanitizeObject(value);
      if (result.ok) {
        sanitized[safeKey] = result.value;
      } else {
        hasFailure = true;
        failureError = result.error;
        break;
      }
    }
    
    return hasFailure 
      ? failure(failureError)
      : success(sanitized as unknown as T);
  }
  
  // Handle strings
  if (typeof obj === 'string') {
    return sanitizeString(obj) as Result<any>;
  }
  
  // Other primitive types pass through unchanged
  return success(obj);
};

/**
 * Validate content security policy string (pure function)
 */
export const validateContentSecurityPolicy = (content: string): Result<boolean> => {
  // Check for inline scripts
  if (/<script\b[^>]*>[\s\S]*?<\/script>/gi.test(content)) {
    return failure({
      message: 'Inline scripts not allowed',
      statusCode: 400
    });
  }
  
  // Check for inline styles
  if (/<style\b[^>]*>[\s\S]*?<\/style>/gi.test(content)) {
    return failure({
      message: 'Inline styles not allowed',
      statusCode: 400
    });
  }
  
  // Check for event handlers
  if (/\bon\w+\s*=/gi.test(content)) {
    return failure({
      message: 'Inline event handlers not allowed',
      statusCode: 400
    });
  }
  
  // Check for data: URLs
  if (/data:[^;]*;base64/gi.test(content)) {
    return failure({
      message: 'Data URLs not allowed',
      statusCode: 400
    });
  }
  
  return success(true);
};
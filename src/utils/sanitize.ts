import DOMPurify from 'dompurify';

/**
 * Sanitize user input to prevent XSS attacks
 * Removes all HTML tags and scripts by default
 */
export const sanitizeInput = (input: string): string => {
  if (!input) return '';
  
  // Remove all HTML tags and scripts
  return DOMPurify.sanitize(input, { 
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true
  });
};

/**
 * Sanitize HTML content while allowing safe formatting tags
 * Use this for rich text content that needs some HTML formatting
 */
export const sanitizeHTML = (html: string): string => {
  if (!html) return '';
  
  // Allow only safe formatting tags
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'b', 'i', 'em', 'strong', 'u', 's', 'strike',
      'p', 'br', 'span', 'div',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li',
      'blockquote', 'pre', 'code',
      'a'
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
    ALLOW_DATA_ATTR: false,
    // Ensure external links open in new tab with proper security
    ADD_ATTR: ['target', 'rel'],
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover']
  });
};

/**
 * Sanitize data before storing in database
 * Applies strict sanitization for database storage
 */
export const sanitizeForDatabase = (data: any): any => {
  if (typeof data === 'string') {
    return sanitizeInput(data);
  }
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeForDatabase(item));
  }
  
  if (data !== null && typeof data === 'object') {
    const sanitized: any = {};
    for (const key in data) {
      if (data.hasOwnProperty(key)) {
        sanitized[key] = sanitizeForDatabase(data[key]);
      }
    }
    return sanitized;
  }
  
  return data;
};

/**
 * Validate and sanitize email addresses
 */
export const sanitizeEmail = (email: string): string => {
  if (!email) return '';
  
  // Basic email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const sanitized = sanitizeInput(email.toLowerCase().trim());
  
  if (!emailRegex.test(sanitized)) {
    return '';
  }
  
  return sanitized;
};

/**
 * Sanitize file names to prevent directory traversal attacks
 */
export const sanitizeFileName = (fileName: string): string => {
  if (!fileName) return '';
  
  // Remove path traversal patterns and special characters
  return fileName
    .replace(/\.\./g, '')
    .replace(/[\/\\]/g, '')
    .replace(/^\.+/, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_');
};

/**
 * Sanitize URLs to prevent javascript: and data: protocols
 */
export const sanitizeURL = (url: string): string => {
  if (!url) return '';
  
  const sanitized = sanitizeInput(url.trim());
  
  // Block dangerous protocols
  const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
  const lowerUrl = sanitized.toLowerCase();
  
  for (const protocol of dangerousProtocols) {
    if (lowerUrl.startsWith(protocol)) {
      return '';
    }
  }
  
  // Ensure URL starts with http://, https://, or is a relative path
  if (!lowerUrl.startsWith('http://') && 
      !lowerUrl.startsWith('https://') && 
      !lowerUrl.startsWith('/')) {
    return '//' + sanitized; // Protocol-relative URL
  }
  
  return sanitized;
};

/**
 * Sanitize search queries to prevent injection attacks
 */
export const sanitizeSearchQuery = (query: string): string => {
  if (!query) return '';
  
  // Remove special characters that could be used in SQL injection
  return query
    .replace(/['"`;\\]/g, '')
    .replace(/--/g, '')
    .replace(/\/\*/g, '')
    .replace(/\*\//g, '')
    .trim()
    .substring(0, 100); // Limit query length
};

export default {
  sanitizeInput,
  sanitizeHTML,
  sanitizeForDatabase,
  sanitizeEmail,
  sanitizeFileName,
  sanitizeURL,
  sanitizeSearchQuery
};
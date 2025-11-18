/**
 * A simple but effective function to strip HTML tags from a string.
 * This helps prevent Stored XSS attacks by ensuring no executable HTML/JS
 * is ever stored in the database from user input fields.
 * @param {string} input The string to sanitize.
 * @returns {string} The sanitized string with HTML tags removed.
 */
export function sanitize(input) {
  if (typeof input !== 'string') return input;
  // Return an empty string if the input is only whitespace
  if (input.trim() === '') return '';
  // Replace any character that is a < or > with its HTML entity equivalent
  // This is a safer way to neutralize tags without removing content that might look like a tag.
  return input.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Sanitizes all string values in a given object, including nested objects and arrays.
 * @param {object} obj The object to sanitize.
 * @returns {object} The deeply sanitized object.
 */
export function sanitizeObject(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => {
      if (typeof item === 'string') {
        return sanitize(item);
      }
      return sanitizeObject(item);
    });
  }

  const sanitizedObj = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      if (typeof value === 'string') {
        sanitizedObj[key] = sanitize(value);
      } else {
        sanitizedObj[key] = sanitizeObject(value);
      }
    }
  }
  return sanitizedObj;
}
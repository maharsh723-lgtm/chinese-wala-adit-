// cryptoHelper.cjs - Salted PBKDF2 Password Hashing Utility

const crypto = require('crypto');

/**
 * Generates a salted PBKDF2 hash of a password
 * @param {string} password 
 * @returns {string} salt:hash format
 */
function hashPassword(password) {
  if (!password) return '';
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verifies a password against a stored salted hash
 * Supports legacy plain-text fallback check
 * @param {string} password 
 * @param {string} storedPassword 
 * @returns {boolean}
 */
function verifyPassword(password, storedPassword) {
  if (!storedPassword) return false;
  
  // Fallback for legacy plain-text passwords
  if (!storedPassword.includes(':')) {
    return password === storedPassword;
  }
  
  const [salt, hash] = storedPassword.split(':');
  const checkHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === checkHash;
}

module.exports = {
  hashPassword,
  verifyPassword
};

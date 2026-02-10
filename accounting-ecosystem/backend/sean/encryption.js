/**
 * ============================================================================
 * SEAN AI — Encryption Module
 * ============================================================================
 * AES-256-CBC encryption for company-specific codex data.
 * Each company gets its own encryption key — admin CANNOT read codex entries.
 * Zero external dependencies — uses Node.js built-in crypto.
 * ============================================================================
 */

const crypto = require('crypto');

class SeanEncryption {

  /**
   * Generate a new encryption key for a company.
   * Store the key securely (env var or vault) — it's the ONLY way to decrypt.
   */
  static generateCompanyKey(companyId) {
    const key = crypto.randomBytes(32);
    const keyId = `sean_key_comp${companyId}_${Date.now()}`;
    return { key: key.toString('hex'), keyId };
  }

  /**
   * Encrypt data object using AES-256-CBC.
   * Returns a Buffer containing IV:encryptedHex.
   */
  static encrypt(data, encryptionKey) {
    const algorithm = 'aes-256-cbc';
    const key = Buffer.from(encryptionKey, 'hex');
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(algorithm, key, iv);
    const jsonData = JSON.stringify(data);
    let encrypted = cipher.update(jsonData, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Return as Buffer: "iv_hex:encrypted_hex"
    return Buffer.from(iv.toString('hex') + ':' + encrypted);
  }

  /**
   * Decrypt a Buffer back to the original data object.
   */
  static decrypt(encryptedBuffer, encryptionKey) {
    const algorithm = 'aes-256-cbc';
    const key = Buffer.from(encryptionKey, 'hex');

    const encryptedText = encryptedBuffer.toString();
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];

    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  }

  /**
   * Create a SHA-256 hash of a context string for fast codex lookups.
   * Same context always yields same hash — no need to decrypt to find matches.
   */
  static hashContext(context) {
    return crypto.createHash('sha256').update(context).digest('hex');
  }

  /**
   * Anonymize a bank transaction description for global pattern sharing.
   * Strips all potentially identifying information.
   */
  static anonymizeDescription(description) {
    return description
      .toLowerCase()
      // Remove account numbers
      .replace(/\b\d{10,}\b/g, '')
      // Remove reference numbers
      .replace(/\b(ref|reference|acc|account)[:\s#]*[\w\d-]+/gi, '')
      // Remove dates
      .replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g, '')
      .replace(/\b\d{4}[/-]\d{2}[/-]\d{2}\b/g, '')
      // Remove amounts
      .replace(/\b(r|zar)?\s*\d+([.,]\d+)?\b/gi, '')
      // Remove phone numbers
      .replace(/\b0\d{9}\b/g, '')
      .replace(/\+27\d{9}\b/g, '')
      // Remove email patterns
      .replace(/[\w.-]+@[\w.-]+\.\w+/gi, '')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }
}

module.exports = SeanEncryption;

/**
 * ============================================================================
 * Format Detector — Identifies file type from buffer + filename
 * ============================================================================
 * Detects: Excel (.xlsx/.xls), CSV, PDF, Image (OCR placeholder)
 * Uses magic bytes + extension fallback.
 * ============================================================================
 */

class FormatDetector {

  /**
   * Detect file format from buffer and filename
   * @param {Buffer} fileBuffer - The raw file buffer
   * @param {string} fileName  - Original file name (for extension fallback)
   * @returns {{ type: string, details: object }}
   */
  static detect(fileBuffer, fileName) {
    const ext = (fileName || '').split('.').pop().toLowerCase();

    // Magic bytes detection
    if (fileBuffer && fileBuffer.length >= 4) {
      const header = fileBuffer.slice(0, 4);

      // ZIP signature (XLSX is a ZIP container)
      if (header[0] === 0x50 && header[1] === 0x4B && header[2] === 0x03 && header[3] === 0x04) {
        return { type: 'excel', details: { subType: 'xlsx', extension: ext } };
      }

      // OLE2 / Compound Document (old .xls)
      if (header[0] === 0xD0 && header[1] === 0xCF && header[2] === 0x11 && header[3] === 0xE0) {
        return { type: 'excel', details: { subType: 'xls', extension: ext } };
      }

      // PDF signature
      if (header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46) {
        return { type: 'pdf', details: { extension: ext } };
      }

      // JPEG
      if (header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF) {
        return { type: 'image', details: { subType: 'jpeg', extension: ext } };
      }

      // PNG
      if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) {
        return { type: 'image', details: { subType: 'png', extension: ext } };
      }
    }

    // Extension-based fallback
    switch (ext) {
      case 'xlsx':
      case 'xls':
      case 'xlsm':
      case 'xlsb':
        return { type: 'excel', details: { subType: ext, extension: ext } };

      case 'csv':
      case 'tsv':
      case 'txt':
        return { type: 'csv', details: { extension: ext } };

      case 'pdf':
        return { type: 'pdf', details: { extension: ext } };

      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'tiff':
      case 'bmp':
        return { type: 'image', details: { subType: ext, extension: ext } };

      default:
        // Try to detect CSV by content (text file with delimiters)
        if (fileBuffer) {
          const sample = fileBuffer.slice(0, 1024).toString('utf8');
          const lines = sample.split('\n').filter(l => l.trim());
          if (lines.length >= 2) {
            // Check for common delimiters
            const commas = (lines[0].match(/,/g) || []).length;
            const semicolons = (lines[0].match(/;/g) || []).length;
            const tabs = (lines[0].match(/\t/g) || []).length;
            if (commas >= 2 || semicolons >= 2 || tabs >= 2) {
              return { type: 'csv', details: { extension: ext, detected: true } };
            }
          }
        }
        return { type: 'unknown', details: { extension: ext } };
    }
  }
}

module.exports = FormatDetector;

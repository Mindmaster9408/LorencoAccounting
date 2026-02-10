/**
 * ============================================================================
 * CSV Parser — Handles any CSV/TSV/delimited text file
 * ============================================================================
 * Auto-detects delimiter (comma, semicolon, tab, pipe).
 * Handles quoted fields, embedded newlines, BOM, different encodings.
 * ============================================================================
 */

class CSVParser {

  /**
   * Parse a CSV buffer into rows
   * @param {Buffer} fileBuffer
   * @param {object} details - { delimiter, encoding }
   * @returns {{ rows: Array<Array>, totalRows: number, detectedDelimiter: string }}
   */
  static parse(fileBuffer, details = {}) {
    // Handle BOM
    let text = fileBuffer.toString(details.encoding || 'utf8');
    if (text.charCodeAt(0) === 0xFEFF) {
      text = text.slice(1); // Remove UTF-8 BOM
    }

    // Auto-detect delimiter
    const delimiter = details.delimiter || this.detectDelimiter(text);

    // Parse using custom parser (handles quoted fields)
    const rows = this.parseText(text, delimiter);

    // Clean up
    const cleaned = rows
      .map(row => row.map(cell => cell.trim()))
      .filter(row => row.some(cell => cell.length > 0));

    return {
      rows: cleaned,
      totalRows: cleaned.length,
      detectedDelimiter: delimiter
    };
  }

  /**
   * Detect the most likely delimiter
   */
  static detectDelimiter(text) {
    const lines = text.split('\n').slice(0, 10);
    const delimiters = [',', ';', '\t', '|'];
    let bestDelimiter = ',';
    let bestScore = 0;

    for (const d of delimiters) {
      // Count delimiters per line; a good delimiter appears consistently
      const counts = lines.map(line => (line.match(new RegExp(d === '|' ? '\\|' : d, 'g')) || []).length);
      const nonZero = counts.filter(c => c > 0);
      if (nonZero.length < 2) continue;

      // Consistent count across lines = good delimiter
      const avg = nonZero.reduce((a, b) => a + b, 0) / nonZero.length;
      const variance = nonZero.reduce((sum, c) => sum + Math.pow(c - avg, 2), 0) / nonZero.length;
      const consistency = avg / (1 + variance);

      const score = consistency * nonZero.length;
      if (score > bestScore) {
        bestScore = score;
        bestDelimiter = d;
      }
    }

    return bestDelimiter;
  }

  /**
   * Parse CSV text with proper quoting support
   */
  static parseText(text, delimiter) {
    const rows = [];
    let currentRow = [];
    let currentField = '';
    let inQuotes = false;
    let i = 0;

    while (i < text.length) {
      const char = text[i];

      if (inQuotes) {
        if (char === '"') {
          // Check for escaped quote ("")
          if (text[i + 1] === '"') {
            currentField += '"';
            i += 2;
          } else {
            inQuotes = false;
            i++;
          }
        } else {
          currentField += char;
          i++;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
          i++;
        } else if (char === delimiter) {
          currentRow.push(currentField);
          currentField = '';
          i++;
        } else if (char === '\n' || char === '\r') {
          currentRow.push(currentField);
          currentField = '';
          if (currentRow.some(f => f.length > 0)) {
            rows.push(currentRow);
          }
          currentRow = [];
          // Handle \r\n
          if (char === '\r' && text[i + 1] === '\n') i++;
          i++;
        } else {
          currentField += char;
          i++;
        }
      }
    }

    // Last field/row
    if (currentField || currentRow.length > 0) {
      currentRow.push(currentField);
      if (currentRow.some(f => f.length > 0)) {
        rows.push(currentRow);
      }
    }

    return rows;
  }
}

module.exports = CSVParser;

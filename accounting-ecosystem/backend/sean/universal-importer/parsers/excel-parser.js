/**
 * ============================================================================
 * Excel Parser — Extracts rows from any Excel file
 * ============================================================================
 * Uses SheetJS (xlsx) to parse .xlsx, .xls, .xlsm, .xlsb files.
 * Handles multi-sheet workbooks, merged cells, date serials.
 * Returns rows as 2D array for LayoutDetector.
 * ============================================================================
 */

const XLSX = require('xlsx');

class ExcelParser {

  /**
   * Parse an Excel file buffer into rows
   * @param {Buffer} fileBuffer - Raw file buffer
   * @param {object} details    - { subType, sheetIndex, sheetName }
   * @returns {{ rows: Array<Array>, sheets: Array<string>, activeSheet: string, totalRows: number }}
   */
  static parse(fileBuffer, details = {}) {
    const workbook = XLSX.read(fileBuffer, {
      type: 'buffer',
      cellDates: true,      // Parse date cells as JS Date objects
      cellNF: true,          // Keep number formats
      cellStyles: false,     // Skip styles for performance
      raw: false,            // Return formatted strings for display
      dateNF: 'yyyy-mm-dd'  // Normalize date format
    });

    const sheetNames = workbook.SheetNames;
    if (sheetNames.length === 0) {
      throw new Error('Excel file contains no sheets');
    }

    // Select sheet: by name, by index, or first sheet
    let selectedSheet;
    if (details.sheetName && sheetNames.includes(details.sheetName)) {
      selectedSheet = details.sheetName;
    } else if (details.sheetIndex != null && sheetNames[details.sheetIndex]) {
      selectedSheet = sheetNames[details.sheetIndex];
    } else {
      selectedSheet = sheetNames[0];
    }

    const worksheet = workbook.Sheets[selectedSheet];

    // Convert to 2D array (preserves all data)
    const rawRows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,       // Return array of arrays (not objects)
      defval: '',      // Default empty cells to ''
      blankrows: false, // Skip fully blank rows
      raw: false        // Return formatted values
    });

    // Post-process: clean up rows
    const rows = rawRows
      .map(row => this.cleanRow(row))
      .filter(row => row.some(cell => cell !== ''));  // Remove empty rows

    return {
      rows,
      sheets: sheetNames,
      activeSheet: selectedSheet,
      totalRows: rows.length
    };
  }

  /**
   * Parse and return all sheets
   * @param {Buffer} fileBuffer
   * @returns {object} { sheets: { [name]: rows[] } }
   */
  static parseAllSheets(fileBuffer) {
    const workbook = XLSX.read(fileBuffer, {
      type: 'buffer',
      cellDates: true,
      raw: false,
      dateNF: 'yyyy-mm-dd'
    });

    const result = {};
    for (const name of workbook.SheetNames) {
      const ws = workbook.Sheets[name];
      const rawRows = XLSX.utils.sheet_to_json(ws, {
        header: 1,
        defval: '',
        blankrows: false,
        raw: false
      });
      result[name] = rawRows
        .map(row => this.cleanRow(row))
        .filter(row => row.some(cell => cell !== ''));
    }

    return { sheets: result };
  }

  /**
   * Clean a single row — trim strings, normalize values
   */
  static cleanRow(row) {
    return row.map(cell => {
      if (cell === null || cell === undefined) return '';

      // Date objects → ISO string
      if (cell instanceof Date) {
        return cell.toISOString().split('T')[0]; // yyyy-mm-dd
      }

      // Numbers — keep as-is but convert to string
      if (typeof cell === 'number') {
        return String(cell);
      }

      // Strings — trim whitespace, normalize unicode
      return String(cell).trim().replace(/\s+/g, ' ');
    });
  }
}

module.exports = ExcelParser;

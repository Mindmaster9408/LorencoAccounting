const JournalService = require('../src/services/journalService');

describe('JournalService', () => {
  describe('validateBalance', () => {
    test('should validate balanced journal', () => {
      const lines = [
        { accountId: 1, debit: 100, credit: 0 },
        { accountId: 2, debit: 0, credit: 100 }
      ];
      
      const result = JournalService.validateBalance(lines);
      expect(result.valid).toBe(true);
      expect(result.totalDebits).toBe(100);
      expect(result.totalCredits).toBe(100);
    });
    
    test('should detect unbalanced journal', () => {
      const lines = [
        { accountId: 1, debit: 100, credit: 0 },
        { accountId: 2, debit: 0, credit: 50 }
      ];
      
      const result = JournalService.validateBalance(lines);
      expect(result.valid).toBe(false);
      expect(result.difference).toBe(50);
    });
    
    test('should allow small rounding differences', () => {
      const lines = [
        { accountId: 1, debit: 100.005, credit: 0 },
        { accountId: 2, debit: 0, credit: 100.004 }
      ];
      
      const result = JournalService.validateBalance(lines);
      expect(result.valid).toBe(true);
    });
  });
  
  describe('validateLines', () => {
    test('should require at least one line', () => {
      const result = JournalService.validateLines([]);
      expect(result.valid).toBe(false);
      expect(result.message).toContain('at least one line');
    });
    
    test('should require at least two lines for double-entry', () => {
      const lines = [{ accountId: 1, debit: 100, credit: 0 }];
      const result = JournalService.validateLines(lines);
      expect(result.valid).toBe(false);
      expect(result.message).toContain('at least two lines');
    });
    
    test('should not allow both debit and credit on same line', () => {
      const lines = [
        { accountId: 1, debit: 100, credit: 50 },
        { accountId: 2, debit: 0, credit: 50 }
      ];
      const result = JournalService.validateLines(lines);
      expect(result.valid).toBe(false);
      expect(result.message).toContain('Cannot have both debit and credit');
    });
    
    test('should require either debit or credit', () => {
      const lines = [
        { accountId: 1, debit: 0, credit: 0 },
        { accountId: 2, debit: 100, credit: 0 }
      ];
      const result = JournalService.validateLines(lines);
      expect(result.valid).toBe(false);
      expect(result.message).toContain('Must have either debit or credit');
    });
    
    test('should not allow negative amounts', () => {
      const lines = [
        { accountId: 1, debit: -100, credit: 0 },
        { accountId: 2, debit: 0, credit: 100 }
      ];
      const result = JournalService.validateLines(lines);
      expect(result.valid).toBe(false);
      expect(result.message).toContain('must be non-negative');
    });
  });
});

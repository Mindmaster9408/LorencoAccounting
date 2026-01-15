const AIGuard = require('../src/services/aiGuard');

describe('AIGuard', () => {
  describe('validateRequest', () => {
    test('should validate valid capability keys', () => {
      const validCapabilities = [
        'BANK_ALLOCATION',
        'BANK_RECONCILIATION',
        'JOURNAL_PREP',
        'REPORT_PREP'
      ];
      
      validCapabilities.forEach(capability => {
        const result = AIGuard.validateRequest(capability, { test: 'data' });
        expect(result.valid).toBe(true);
      });
    });
    
    test('should reject invalid capability keys', () => {
      const result = AIGuard.validateRequest('INVALID_CAPABILITY', { test: 'data' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid capability');
    });
    
    test('should require inputRefs object', () => {
      const result = AIGuard.validateRequest('BANK_ALLOCATION', null);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('inputRefs must be provided');
    });
  });
  
  describe('determineAction', () => {
    test('suggest mode should always return suggest', () => {
      const action = AIGuard.determineAction('suggest', 0.95, 0.80, 'admin');
      expect(action).toBe('suggest');
    });
    
    test('draft mode should always return draft', () => {
      const action = AIGuard.determineAction('draft', 0.95, 0.80, 'admin');
      expect(action).toBe('draft');
    });
    
    test('auto mode with sufficient confidence should return auto', () => {
      const action = AIGuard.determineAction('auto', 0.90, 0.80, 'admin');
      expect(action).toBe('auto');
    });
    
    test('auto mode with low confidence should fallback to draft', () => {
      const action = AIGuard.determineAction('auto', 0.70, 0.80, 'admin');
      expect(action).toBe('draft');
    });
    
    test('auto mode for bookkeeper should fallback to draft', () => {
      const action = AIGuard.determineAction('auto', 0.95, 0.80, 'bookkeeper');
      expect(action).toBe('draft');
    });
    
    test('auto mode for admin with high confidence should return auto', () => {
      const action = AIGuard.determineAction('auto', 0.95, 0.80, 'admin');
      expect(action).toBe('auto');
    });
  });
});

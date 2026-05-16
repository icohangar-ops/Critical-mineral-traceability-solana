import { describe, it, expect } from 'vitest';

describe('Critical Mineral Traceability Solana Basic Tests', () => {
  describe('cn utility', () => {
    it('should merge class names', () => {
      const { cn } = require('../src/lib/utils');
      const result = cn('text-sm', 'font-bold');
      expect(result).toContain('text-sm');
      expect(result).toContain('font-bold');
    });
  });

  describe('Solana SDK module', () => {
    it('should export a connection instance', () => {
      const solana = require('../src/lib/solana');
      expect(solana.connection).toBeDefined();
    });

    it('should export utility functions', () => {
      const solana = require('../src/lib/solana');
      expect(typeof solana.getClusterInfo).toBe('function');
      expect(typeof solana.formatPublicKey).toBe('function');
      expect(typeof solana.lamportsToSol).toBe('function');
    });
  });

  describe('formatPublicKey utility', () => {
    it('should truncate long keys', () => {
      const { formatPublicKey } = require('../src/lib/solana');
      const longKey = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef';
      const result = formatPublicKey(longKey);
      expect(result).toBe('ABCDEF...cdef');
    });

    it('should return short keys as-is', () => {
      const { formatPublicKey } = require('../src/lib/solana');
      expect(formatPublicKey('short')).toBe('short');
    });
  });

  describe('lamportsToSol utility', () => {
    it('should convert lamports to SOL', () => {
      const { lamportsToSol } = require('../src/lib/solana');
      // 1 SOL = 1 billion lamports
      expect(lamportsToSol(1000000000)).toBe(1);
      expect(lamportsToSol(0)).toBe(0);
    });
  });

  describe('project structure', () => {
    it('should have correct package.json', () => {
      const pkg = require('../package.json');
      expect(pkg.scripts).toBeDefined();
      expect(pkg.scripts.test).toBeDefined();
    });
  });
});

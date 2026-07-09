import { describe, it, expect } from 'vitest';
import {
  computeConfidence,
  computePriority,
  computeDomainHealth,
  computeOverallHealth,
  computeTrend
} from '../src/domain/scoring/scoring-service.js';
import type { ScoringConfig, HealthScoreConfig } from '../src/infrastructure/config/config-loader.js';

describe('Scoring Service', () => {
  const scoringConfig: ScoringConfig = {
    severityScores: { critical: 90, high: 75, medium: 50, low: 25 },
    domainWeights: { security: 1.5, medical: 1.5, default: 1.0 },
    recencyDecayHalfLifeSeconds: 3600,
    llmConfidenceClamp: { min: 0.1, max: 0.99 },
    memoryLookbackCount: 5,
  };

  const healthConfig: HealthScoreConfig = {
    weights: { criticalIncidentWeight: 20, highIncidentWeight: 10, pendingRecommendationWeight: 2 },
    normalizers: { default: 1 },
    domainWeights: { security: 2, medical: 2, navigation: 1, operations: 1 },
    trendWindowSnapshots: 5,
  };

  describe('computeConfidence', () => {
    it('should compute base confidence from severity and evidence', () => {
      const conf = computeConfidence('high', 2, undefined, undefined, scoringConfig);
      expect(conf).toBeGreaterThan(0.4);
      expect(conf).toBeLessThan(0.6);
    });

    it('should adjust confidence based on memory accuracy', () => {
      const baseConf = computeConfidence('high', 1, undefined, undefined, scoringConfig);
      const highAccConf = computeConfidence('high', 1, undefined, 0.9, scoringConfig);
      const lowAccConf = computeConfidence('high', 1, undefined, 0.4, scoringConfig);
      
      expect(highAccConf).toBeLessThan(baseConf);
      expect(lowAccConf).toBeLessThan(highAccConf);
    });

    it('should clamp confidence within bounds', () => {
      const conf = computeConfidence('critical', 10, undefined, 1.0, scoringConfig);
      expect(conf).toBeLessThanOrEqual(scoringConfig.llmConfidenceClamp.max);
    });
  });

  describe('computePriority', () => {
    it('should assign critical priority based on severity', () => {
      const p = computePriority('critical', 0, 'security', scoringConfig);
      expect(p).toBeGreaterThan(100);
    });

    it('should boost priority based on domain weights', () => {
      // Security is weighted 1.5, should boost medium to high
      const p = computePriority('medium', 0, 'security', scoringConfig);
      expect(p).toBeGreaterThan(50);
    });
  });

  describe('computeDomainHealth', () => {
    it('should compute health perfectly when no incidents', () => {
      const h = computeDomainHealth('security', 0, 0, 0, healthConfig);
      expect(h).toBe(100);
    });

    it('should deduct points for critical incidents', () => {
      const h = computeDomainHealth('security', 1, 0, 0, healthConfig);
      // normalizer default is 1
      expect(h).toBe(0);
    });

    it('should not go below zero', () => {
      const h = computeDomainHealth('security', 10, 10, 10, healthConfig);
      expect(h).toBe(0);
    });
  });

  describe('computeOverallHealth', () => {
    it('should compute weighted average of domain healths', () => {
      const domainScores = {
        security: 50,
        medical: 50,
        navigation: 100,
        operations: 100
      };
      
      const overall = computeOverallHealth(domainScores, healthConfig);
      // (50*2 + 50*2 + 100*1 + 100*1) / 6 = 400 / 6 = 66.66
      expect(overall).toBeCloseTo(66.66, 0);
    });
  });

  describe('computeTrend', () => {
    it('should return declining when scores go down', () => {
      expect(computeTrend([70, 80, 90])).toBe('declining');
    });
    
    it('should return improving when scores go up', () => {
      expect(computeTrend([90, 80, 70])).toBe('improving');
    });
    
    it('should return stable when scores are similar', () => {
      expect(computeTrend([90, 89, 91])).toBe('stable');
    });
  });
});

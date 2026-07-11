import { describe, it, expect } from 'vitest';
import { computeConfidence } from '../src/domain/scoring/scoring-service.js';

describe('Scoring Service', () => {
  it('computes confidence correctly based on severity and evidence count', () => {
    const config = {
      severityScores: { critical: 100, high: 75, medium: 50, low: 25 },
      llmConfidenceClamp: { min: 0.5, max: 1.5 },
      scoreWeights: { confidence: 0.4, severity: 0.4, time: 0.2 },
      decayRate: 0.05,
    };

    const result = computeConfidence('critical', 1, 1.0, 1.0, config);
    // Severity Score for critical is 1.0. 
    // base = 1.0 * (1 - 1 / (1 + 1)) = 1.0 * 0.5 = 0.5
    expect(result).toBe(0.5);
  });

  it('clamps confidence appropriately', () => {
    const config = {
      severityScores: { critical: 100, high: 75, medium: 50, low: 25 },
      llmConfidenceClamp: { min: 0.5, max: 1.5 },
      scoreWeights: { confidence: 0.4, severity: 0.4, time: 0.2 },
      decayRate: 0.05,
    };

    const result = computeConfidence('low', 0, 0.1, 0.1, config);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(1);
  });
});

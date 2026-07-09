import { describe, it, expect, beforeEach } from 'vitest';
import { DeterministicReasoner } from '../src/infrastructure/llm/deterministic-reasoner.js';
import type { AppConfig } from '../src/infrastructure/config/config-loader.js';
import type { SituationHypothesis } from '@aegis/shared';

describe('DeterministicReasoner', () => {
  let reasoner: DeterministicReasoner;
  let mockConfig: AppConfig;

  beforeEach(() => {
    // Basic mock config to satisfy the constructor dependencies
    mockConfig = {
      detectionRules: { rules: [] },
      scoring: { 
        severityScores: { low: 1, medium: 3, high: 5, critical: 10 },
        domainWeights: {},
        recencyDecayHalfLifeSeconds: 300,
        llmConfidenceClamp: { min: 0.1, max: 0.95 },
        memoryLookbackCount: 5,
      },
      healthScore: { weights: { criticalIncidentWeight: 10, highIncidentWeight: 5, pendingRecommendationWeight: 2 }, normalizers: {}, domainWeights: {}, trendWindowSnapshots: 5 },
      actionAllowList: { actions: { security: ['dispatch_security'] } },
      venueModel: { venue: { name: 'Test', city: 'Test', capacity: 100 }, zones: [] },
      prompts: { correlate: '', predictImpact: '', generateAlternatives: '', localize: '' },
      env: { port: 3000, host: '0.0.0.0', databaseUrl: '', llmProvider: 'deterministic', geminiApiKey: '', cycleMs: 15000, contextWindowMin: 30, recTtlMin: 30, logLevel: 'info', frontendUrl: '' }
    };
    reasoner = new DeterministicReasoner(mockConfig);
  });

  describe('correlate', () => {
    it('groups signals by zone and determines correct severity', async () => {
      const signals = [
        { id: '1', domain: 'crowd', type: 'density', zone: 'gate-a', severity: 'medium', summary: 'Crowd building' },
        { id: '2', domain: 'security', type: 'incident', zone: 'gate-a', severity: 'high', summary: 'Minor scuffle' }
      ];

      const result = await reasoner.correlate({ signals, stateSnapshot: '{}' });

      expect(result).toHaveLength(1);
      expect(result[0]?.zone).toBeUndefined(); // zone is embedded in title/id in deterministic reasoner
      expect(result[0]?.severity).toBe('high');
      expect(result[0]?.domains).toContain('crowd');
      expect(result[0]?.domains).toContain('security');
      expect(result[0]?.evidenceSignalIds).toContain('1');
      expect(result[0]?.evidenceSignalIds).toContain('2');
    });

    it('returns empty array when no signals are provided', async () => {
      const result = await reasoner.correlate({ signals: [], stateSnapshot: '{}' });
      expect(result).toHaveLength(0);
    });
  });

  describe('predictImpact', () => {
    it('generates expected impact based on situation severity', async () => {
      const situations: SituationHypothesis[] = [{
        id: 'sit_1',
        title: 'Test situation',
        domains: ['crowd'],
        severity: 'critical',
        evidenceSignalIds: ['1'],
        rationale: 'Test'
      }];

      const result = await reasoner.predictImpact({ situations, stateSnapshot: '{}' });

      expect(result).toHaveLength(1);
      expect(result[0]?.situationId).toBe('sit_1');
      expect(result[0]?.healthScoreDelta).toBe(-10); // Matches severityScore map in test mock penalty
      expect(result[0]?.predictedMetrics['severity_escalation_risk']).toBe(0.9);
    });
  });

  describe('generateAlternatives', () => {
    it('generates primary alternative if actions are allowed', async () => {
      const situation: SituationHypothesis = {
        id: 'sit_1',
        title: 'Test',
        domains: ['security'],
        severity: 'high',
        evidenceSignalIds: ['1'],
        rationale: 'Test'
      };

      const prediction = {
        situationId: 'sit_1',
        noActionOutcome: 'Bad things',
        predictedMetrics: {},
        timeHorizonMinutes: 15,
        healthScoreDelta: -10
      };

      const result = await reasoner.generateAlternatives({ situation, prediction, allowedActions: ['dispatch_security'] });

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]?.option).toContain('Dispatch security');
      expect(result[0]?.isRecommended).toBe(true);
    });

    it('generates escalation fallback if no allowed actions provided', async () => {
       const situation: SituationHypothesis = {
        id: 'sit_1',
        title: 'Test',
        domains: ['security'],
        severity: 'high',
        evidenceSignalIds: ['1'],
        rationale: 'Test'
      };

      const prediction = {
        situationId: 'sit_1',
        noActionOutcome: 'Bad things',
        predictedMetrics: {},
        timeHorizonMinutes: 15,
        healthScoreDelta: -10
      };

      const result = await reasoner.generateAlternatives({ situation, prediction, allowedActions: [] });

      expect(result).toHaveLength(1);
      expect(result[0]?.option).toBe('Escalate to organizer for manual assessment');
    });
  });
});

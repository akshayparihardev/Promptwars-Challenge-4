import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  IngestEventUseCase,
  RunReasoningCycleUseCase,
  ApproveDecisionUseCase,
  RejectDecisionUseCase
} from '../src/application/use-cases.js';
import type { UseCaseDeps } from '../src/application/use-cases.js';

describe('Application Use Cases', () => {
  let deps: UseCaseDeps;

  beforeEach(() => {
    deps = {
      eventRepo: {
        create: vi.fn().mockResolvedValue({ id: 'evt1', createdAt: new Date().toISOString() }),
        findInWindow: vi.fn().mockResolvedValue([]),
        countBySeverityAndDomain: vi.fn().mockResolvedValue([]),
      } as any,
      recRepo: {
        findActiveBySituationSignature: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'rec1' }),
        findExpired: vi.fn().mockResolvedValue([]),
        updateStatus: vi.fn(),
        findById: vi.fn().mockResolvedValue({
          id: 'rec1',
          status: 'proposed',
          targetRoles: ['venue_operations'],
          domain: 'operations'
        }),
      } as any,
      situationRepo: {
        findBySignature: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'sit1' }),
      } as any,
      decisionRepo: {
        create: vi.fn().mockResolvedValue({ id: 'dec1' }),
      } as any,
      actionRepo: {
        create: vi.fn().mockResolvedValue({ id: 'act1' }),
      } as any,
      auditRepo: {
        create: vi.fn(),
      } as any,
      memoryRepo: {
        findBySituationSignature: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
      } as any,
      healthSnapshotRepo: {
        findLatest: vi.fn().mockResolvedValue(null),
        findRecent: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
      } as any,
      llmReasoner: {
        correlate: vi.fn().mockResolvedValue([]),
        predictImpact: vi.fn().mockResolvedValue([]),
        generateAlternatives: vi.fn().mockResolvedValue([]),
        localize: vi.fn(),
      } as any,
      eventBus: {
        emit: vi.fn(),
      } as any,
      config: {
        env: { contextWindowMin: 30, llmProvider: 'deterministic', recTtlMin: 30 },
        detectionRules: { rules: [] },
        scoring: {
          severityScores: { critical: 90 },
          domainWeights: {},
          memoryLookbackCount: 5,
        },
        healthScore: {
          weights: { criticalIncidentWeight: 20, highIncidentWeight: 10, pendingRecommendationWeight: 2 },
          normalizers: {},
          domainWeights: {},
          trendWindowSnapshots: 5,
        },
        actionAllowList: { actions: {} },
        roleMapping: { roles: {}, defaultRole: 'organizer' }
      } as any,
    };
  });

  describe('IngestEventUseCase', () => {
    it('should create an event, audit trail, and emit event', async () => {
      const useCase = new IngestEventUseCase(deps);
      const res = await useCase.execute({
        domain: 'crowd',
        zone: 'gate-a',
        type: 'surge',
        severity: 'high',
        payload: { test: true },
      });

      expect(res.eventId).toBe('evt1');
      expect(deps.eventRepo.create).toHaveBeenCalled();
      expect(deps.auditRepo.create).toHaveBeenCalled();
      expect(deps.eventBus.emit).toHaveBeenCalledWith('event.ingested', expect.any(Object));
    });
  });

  describe('RunReasoningCycleUseCase', () => {
    it('should return no_events if window is empty', async () => {
      const useCase = new RunReasoningCycleUseCase(deps);
      const res = await useCase.execute();
      expect(res.source).toBe('no_events');
    });

    it('should generate recommendations if events trigger rules', async () => {
      // Mock detection rule match
      deps.eventRepo.findInWindow = vi.fn().mockResolvedValue([{ id: 'evt1', domain: 'crowd', severity: 'high', zone: 'gate-a', type: 'incident' }]);
      deps.config.detectionRules.rules = [
        { id: 'r1', domain: 'crowd', trigger: 'incident_severity_above', severity: 'high', signalType: 'surge', name: 'Rule' }
      ];
      
      deps.llmReasoner.correlate = vi.fn().mockResolvedValue([
        { id: 'sit1', title: 'Test Sit', domains: ['crowd'], evidenceSignalIds: ['evt1'], severity: 'high', rationale: 'Test' }
      ]);
      deps.llmReasoner.predictImpact = vi.fn().mockResolvedValue([
        { situationId: 'sit1', healthScoreDelta: -10 }
      ]);
      deps.llmReasoner.generateAlternatives = vi.fn().mockResolvedValue([
        { option: 'do_action', isRecommended: true }
      ]);

      const useCase = new RunReasoningCycleUseCase(deps);
      const res = await useCase.execute();

      expect(res.generated).toBe(1);
      expect(deps.recRepo.create).toHaveBeenCalled();
    });
  });

  describe('ApproveDecisionUseCase', () => {
    it('should approve recommendation and execute action if authorized', async () => {
      const useCase = new ApproveDecisionUseCase(deps);
      const res = await useCase.execute({
        recommendationId: 'rec1',
        actorRole: 'venue_operations',
      });

      expect(res.status).toBe('executed');
      expect(deps.decisionRepo.create).toHaveBeenCalled();
      expect(deps.recRepo.updateStatus).toHaveBeenCalledWith('rec1', 'executed');
    });

    it('should throw FORBIDDEN if role is not authorized', async () => {
      const useCase = new ApproveDecisionUseCase(deps);
      await expect(useCase.execute({
        recommendationId: 'rec1',
        actorRole: 'fan',
      })).rejects.toThrow(/not authorized/);
    });
  });

  describe('RejectDecisionUseCase', () => {
    it('should reject recommendation if authorized', async () => {
      const useCase = new RejectDecisionUseCase(deps);
      const res = await useCase.execute({
        recommendationId: 'rec1',
        actorRole: 'organizer', // organizer can reject anything
      });

      expect(res.status).toBe('rejected');
      expect(deps.recRepo.updateStatus).toHaveBeenCalledWith('rec1', 'rejected');
    });
  });
});

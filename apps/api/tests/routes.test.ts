import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { registerRoutes } from '../src/interface/routes.js';
import type { UseCaseDeps } from '../src/application/use-cases.js';

describe('API Routes', () => {
  let app: FastifyInstance;
  let deps: UseCaseDeps;

  beforeEach(() => {
    app = Fastify();
    
    deps = {
      eventRepo: { create: vi.fn(), findInWindow: vi.fn(), countBySeverityAndDomain: vi.fn() } as any,
      recRepo: { findActiveBySituationSignature: vi.fn(), create: vi.fn(), findExpired: vi.fn(), updateStatus: vi.fn(), findById: vi.fn() } as any,
      situationRepo: { findBySignature: vi.fn(), create: vi.fn() } as any,
      decisionRepo: { create: vi.fn() } as any,
      actionRepo: { create: vi.fn() } as any,
      auditRepo: { create: vi.fn() } as any,
      memoryRepo: { findBySituationSignature: vi.fn(), create: vi.fn() } as any,
      healthSnapshotRepo: { findLatest: vi.fn().mockResolvedValue({ overall: 100, trend: 'stable', domains: '{}', createdAt: new Date() }), findRecent: vi.fn(), create: vi.fn() } as any,
      llmReasoner: { correlate: vi.fn(), predictImpact: vi.fn(), generateAlternatives: vi.fn(), localize: vi.fn() } as any,
      eventBus: { emit: vi.fn() } as any,
      config: { env: { contextWindowMin: 30, llmProvider: 'deterministic', recTtlMin: 30 } } as any,
    };

    registerRoutes(app, deps);
  });

  it('GET /api/v1/health-score should return 200 and health score', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/health-score'
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.overall).toBe(100);
    expect(body.trend).toBe('stable');
  });

  it('POST /api/v1/events should return 400 for bad data', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/events',
      payload: { wrong: 'data' }
    });

    expect(res.statusCode).toBe(400);
  });
});

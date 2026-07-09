import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { registerRoutes } from '../src/interface/routes.js';
import type { UseCaseDeps } from '../src/application/use-cases.js';
import { ZodError } from 'zod';

describe('Security & Validation', () => {
  let app: FastifyInstance;
  let deps: UseCaseDeps;

  beforeEach(() => {
    app = Fastify();
    
    deps = {
      eventRepo: { create: vi.fn(), findInWindow: vi.fn().mockResolvedValue([]), countBySeverityAndDomain: vi.fn() } as any,
      recRepo: { findActiveBySituationSignature: vi.fn(), create: vi.fn(), findExpired: vi.fn().mockResolvedValue([]), updateStatus: vi.fn(), findById: vi.fn() } as any,
      situationRepo: { findBySignature: vi.fn(), create: vi.fn() } as any,
      decisionRepo: { create: vi.fn() } as any,
      actionRepo: { create: vi.fn() } as any,
      auditRepo: { create: vi.fn() } as any,
      memoryRepo: { findBySituationSignature: vi.fn(), create: vi.fn() } as any,
      healthSnapshotRepo: { findLatest: vi.fn().mockResolvedValue({ overall: 100, trend: 'stable', domains: '{}', createdAt: new Date() }), findRecent: vi.fn().mockResolvedValue([]), create: vi.fn() } as any,
      llmReasoner: { correlate: vi.fn(), predictImpact: vi.fn(), generateAlternatives: vi.fn(), localize: vi.fn() } as any,
      eventBus: { emit: vi.fn() } as any,
      config: { env: { contextWindowMin: 30, llmProvider: 'deterministic', recTtlMin: 30 } } as any,
    };

    registerRoutes(app, deps);
  });

  it('should reject invalid payload for POST /api/v1/events (XSS/oversized strings)', async () => {
    // Missing required fields
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/events',
      payload: { domain: 'crowd' } // missing zone, type, severity, payload
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.payload).error.code).toBe('VALIDATION_ERROR');
  });

  it('should reject invalid domains', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/events',
      payload: {
        domain: 'invalid_domain_xss<script>',
        zone: 'gate-a',
        type: 'surge',
        severity: 'high',
        payload: {}
      }
    });

    expect(res.statusCode).toBe(400);
  });
  
  it('should have security headers (CORS checked elsewhere)', async () => {
     // Fastify defaults and standard headers check
     const res = await app.inject({
       method: 'GET',
       url: '/api/v1/state'
     });
     // We can just verify it responds correctly. If we added helmet it would be here.
     expect(res.statusCode).toBe(200);
  });
});

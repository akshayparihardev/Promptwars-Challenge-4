// ============================================================
// Fastify Routes — All API endpoints from doc 09.
// ============================================================

import type { FastifyInstance } from 'fastify';
import { OperationalEventCreateSchema, DecisionCreateSchema, ListRecommendationsQuerySchema, ListAuditQuerySchema, ListMemoryQuerySchema, ChatRequestSchema } from '@aegis/shared';
import type { UseCaseDeps } from '../application/use-cases.js';
import { IngestEventUseCase, RunReasoningCycleUseCase, ApproveDecisionUseCase, RejectDecisionUseCase, ChatUseCase, AppError } from '../application/use-cases.js';

// Track Gemini usage per IP to prevent quota exhaustion
const ipGeminiUsage = new Map<string, number>();
export function registerRoutes(app: FastifyInstance, deps: UseCaseDeps): void {
  const ingestEvent = new IngestEventUseCase(deps);
  const runCycle = new RunReasoningCycleUseCase(deps);
  const approveDecision = new ApproveDecisionUseCase(deps);
  const rejectDecision = new RejectDecisionUseCase(deps);
  const chatUseCase = new ChatUseCase(deps);

  // Security handled by helmet in main.ts

  // ── Simple Token-Bucket Rate Limiter for /api/v1/chat ───────
  const rateBuckets = new Map<string, { tokens: number; lastRefill: number }>();
  const RATE_LIMIT_CAPACITY = 15;   // max burst
  const RATE_LIMIT_REFILL = 0.25;   // tokens per second (15 per minute)

  function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    let bucket = rateBuckets.get(ip);
    if (!bucket) {
      bucket = { tokens: RATE_LIMIT_CAPACITY, lastRefill: now };
      rateBuckets.set(ip, bucket);
    }
    // Refill tokens
    const elapsed = (now - bucket.lastRefill) / 1000;
    bucket.tokens = Math.min(RATE_LIMIT_CAPACITY, bucket.tokens + elapsed * RATE_LIMIT_REFILL);
    bucket.lastRefill = now;
    // Consume
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;
    }
    return false;
  }

  // ── POST /api/v1/events ─────────────────────────────────────
  app.post('/api/v1/events', async (req, reply) => {
    const parsed = OperationalEventCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid event data', details: parsed.error.issues },
      });
    }
    const result = await ingestEvent.execute(parsed.data);
    return reply.status(201).send(result);
  });

  // ── GET /api/v1/state ───────────────────────────────────────
  app.get('/api/v1/state', async (req, reply) => {
    const query = req.query as { windowMinutes?: string };
    const windowMinutes = parseInt(query.windowMinutes ?? '30', 10);
    const events = await deps.eventRepo.findInWindow(windowMinutes);

    // Compute zone density from events
    const zoneDensity: Record<string, number> = {};
    let activeIncidents = 0;
    let energyLoadPct = 0;

    for (const event of events) {
      const payload = typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload;
      if (event.type === 'density_reading' && payload.density) {
        zoneDensity[event.zone] = payload.density as number;
      }
      if (event.type === 'incident' || event.type === 'medical_incident' || event.type === 'security_incident') {
        activeIncidents++;
      }
      if (event.type === 'energy_reading' && payload.loadPct) {
        energyLoadPct = Math.max(energyLoadPct, payload.loadPct as number);
      }
    }

    // Get health score
    const snapshot = await deps.healthSnapshotRepo.findLatest();
    const healthScore = snapshot
      ? { domains: JSON.parse(snapshot.domains), overall: snapshot.overall, trend: snapshot.trend, computedAt: snapshot.createdAt.toISOString() }
      : { domains: {}, overall: 100, trend: 'stable', computedAt: new Date().toISOString() };

    return reply.send({
      windowMinutes,
      events,
      metrics: { zoneDensity, activeIncidents, energyLoadPct },
      healthScore,
    });
  });

  // ── POST /api/v1/reasoning/cycle ────────────────────────────
  app.post('/api/v1/reasoning/cycle', async (_req, reply) => {
    const result = await runCycle.execute();
    return reply.send({
      generated: result.generated,
      source: result.source,
      durationMs: result.durationMs,
    });
  });

  // ── GET /api/v1/recommendations ─────────────────────────────
  app.get('/api/v1/recommendations', async (req, reply) => {
    const query = req.query as Record<string, string>;
    const parsed = ListRecommendationsQuerySchema.safeParse(query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid query', details: parsed.error.issues },
      });
    }
    const recs = await deps.recRepo.findByFilters({
      role: parsed.data.role,
      domain: parsed.data.domain,
      status: parsed.data.status,
    });
    return reply.send(recs);
  });

  // ── POST /api/v1/decisions ──────────────────────────────────
  app.post('/api/v1/decisions', async (req, reply) => {
    const parsed = DecisionCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid decision', details: parsed.error.issues },
      });
    }

    const role = (req.headers['x-role'] as string) ?? 'organizer';

    try {
      const useCase = parsed.data.outcome === 'approved' ? approveDecision : rejectDecision;
      const result = await useCase.execute({
        recommendationId: parsed.data.recommendationId,
        actorRole: role,
        note: parsed.data.note,
      });
      return reply.send(result);
    } catch (err) {
      if (err instanceof AppError) {
        const statusMap: Record<string, number> = {
          NOT_FOUND: 404,
          FORBIDDEN: 403,
          CONFLICT: 409,
        };
        return reply.status(statusMap[err.code] ?? 500).send({
          error: { code: err.code, message: err.message },
        });
      }
      throw err;
    }
  });

  // ── POST /api/v1/chat ───────────────────────────────────────
  app.post('/api/v1/chat', async (req, reply) => {
    // Rate limiting
    const clientIp = req.ip ?? 'unknown';
    if (!checkRateLimit(clientIp)) {
      return reply.status(429).send({
        error: { code: 'RATE_LIMIT', message: 'Too many requests — please wait a moment and try again.' },
      });
    }

    const parsed = ChatRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid chat request', details: parsed.error.issues },
      });
    }

    try {
      // Allow 3 Gemini requests per IP, then force deterministic
      const currentUsage = ipGeminiUsage.get(clientIp) || 0;
      const forceDeterministic = currentUsage >= 3;
      
      if (!forceDeterministic) {
        ipGeminiUsage.set(clientIp, currentUsage + 1);
      }

      const result = await chatUseCase.execute(parsed.data, forceDeterministic);
      return reply.send(result);
    } catch (err: unknown) {
      const error = err as Error;
      return reply.status(500).send({
        error: { code: 'INTERNAL_ERROR', message: error.message },
      });
    }
  });

  // ── GET /api/v1/health-score ────────────────────────────────
  app.get('/api/v1/health-score', async (_req, reply) => {
    const snapshot = await deps.healthSnapshotRepo.findLatest();
    if (!snapshot) {
      return reply.send({
        domains: {},
        overall: 100,
        trend: 'stable',
        computedAt: new Date().toISOString(),
      });
    }
    return reply.send({
      domains: JSON.parse(snapshot.domains),
      overall: snapshot.overall,
      trend: snapshot.trend,
      computedAt: snapshot.createdAt.toISOString(),
    });
  });

  // ── GET /api/v1/memory ──────────────────────────────────────
  app.get('/api/v1/memory', async (req, reply) => {
    const query = req.query as Record<string, string>;
    const parsed = ListMemoryQuerySchema.safeParse(query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid query', details: parsed.error.issues },
      });
    }
    const entries = await deps.memoryRepo.findByFilters({
      domain: parsed.data.domain,
      limit: parsed.data.limit,
    });
    return reply.send(entries);
  });

  // ── GET /api/v1/audit ───────────────────────────────────────
  app.get('/api/v1/audit', async (req, reply) => {
    const query = req.query as Record<string, string>;
    const parsed = ListAuditQuerySchema.safeParse(query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid query', details: parsed.error.issues },
      });
    }
    const logs = await deps.auditRepo.findByFilters({
      entityType: parsed.data.entityType,
      entityId: parsed.data.entityId,
      limit: parsed.data.limit,
    });
    return reply.send(logs);
  });

  // ── GET /api/v1/stream (SSE) ────────────────────────────────
  app.get('/api/v1/stream', async (req, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': deps.config.env.frontendUrl,
    });

    const unsubscribe = deps.eventBus.subscribe((event, data) => {
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    });

    // Send heartbeat every 30s
    const heartbeat = setInterval(() => {
      reply.raw.write(': heartbeat\n\n');
    }, 30000);

    req.raw.on('close', () => {
      unsubscribe();
      clearInterval(heartbeat);
    });
  });

  // ── Global error handler ────────────────────────────────────
  app.setErrorHandler((error, _req, reply) => {
    console.error('[ERROR]', (error as Error).message ?? String(error));
    reply.status(500).send({
      error: { code: 'INTERNAL', message: 'An internal error occurred' },
    });
  });
}

// ============================================================
// AEGIS — Main Entry Point (Composition Root)
// Wires all layers together. Dependencies point inward.
// ============================================================

import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import { loadConfig } from './infrastructure/config/config-loader.js';
import { getPrisma, disconnectPrisma } from './infrastructure/db/prisma-client.js';
import {
  PrismaEventRepository,
  PrismaRecommendationRepository,
  PrismaSituationRepository,
  PrismaDecisionRepository,
  PrismaActionRepository,
  PrismaAuditRepository,
  PrismaMemoryRepository,
  PrismaHealthSnapshotRepository,
} from './infrastructure/db/repositories.js';
import { DeterministicReasoner } from './infrastructure/llm/deterministic-reasoner.js';
import { InProcessEventBus } from './infrastructure/event-bus.js';
import { registerRoutes } from './interface/routes.js';
import { RunReasoningCycleUseCase } from './application/use-cases.js';
import type { UseCaseDeps } from './application/use-cases.js';
import { seedDatabase } from './seed.js';

async function main(): Promise<void> {
  console.log('\n🛡️  AEGIS — Adaptive Event-Ground Intelligence System');
  console.log('   FIFA World Cup 2026 Operational Intelligence Platform\n');

  // ── Load & validate config (fail fast) ──────────────────────
  const config = loadConfig();
  console.log(`✅ Config loaded (LLM: ${config.env.llmProvider})`);

  // ── Database ────────────────────────────────────────────────
  const prisma = getPrisma();
  console.log('✅ Database connected');

  // ── Repositories ────────────────────────────────────────────
  const eventRepo = new PrismaEventRepository(prisma);
  const recRepo = new PrismaRecommendationRepository(prisma);
  const situationRepo = new PrismaSituationRepository(prisma);
  const decisionRepo = new PrismaDecisionRepository(prisma);
  const actionRepo = new PrismaActionRepository(prisma);
  const auditRepo = new PrismaAuditRepository(prisma);
  const memoryRepo = new PrismaMemoryRepository(prisma);
  const healthSnapshotRepo = new PrismaHealthSnapshotRepository(prisma);

  // ── LLM Reasoner ────────────────────────────────────────────
  // Always use deterministic for background reasoning to save API quota!
  const llmReasoner = new DeterministicReasoner(config);
  console.log(`✅ LLM Reasoner: background loop forced to deterministic`);

  // ── Event Bus ───────────────────────────────────────────────
  const eventBus = new InProcessEventBus();

  // ── Compose Dependencies ────────────────────────────────────
  const deps: UseCaseDeps = {
    eventRepo,
    recRepo,
    situationRepo,
    decisionRepo,
    actionRepo,
    auditRepo,
    memoryRepo,
    healthSnapshotRepo,
    llmReasoner,
    eventBus,
    config,
  };

  // ── Fastify Server ──────────────────────────────────────────
  const app = Fastify({
    logger: {
      level: config.env.logLevel,
      transport: {
        target: 'pino-pretty',
        options: { colorize: true },
      },
    },
  });

  await app.register(cors, {
    origin: config.env.frontendUrl,
    credentials: true,
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // ── Static Frontend (for single-server / Docker deployment) ──
  const possiblePaths = [
    path.join(process.cwd(), 'apps/web/dist'), // Docker prod
    path.join(process.cwd(), '../web/dist'), // Local dev
  ];
  const { existsSync } = await import('node:fs');
  const distPath = possiblePaths.find(p => existsSync(p)) || possiblePaths[0];
  
  await app.register(fastifyStatic, {
    root: distPath,
    prefix: '/',
    wildcard: false, // Don't catch all, we will handle catch-all manually for SPA
  });

  // Handle SPA routing for React (fallback to index.html if not API)
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/')) {
      reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'API route not found' } });
    } else {
      reply.sendFile('index.html');
    }
  });

  // ── Register Routes ─────────────────────────────────────────
  registerRoutes(app, deps);
  console.log('✅ Routes registered');

  // ── Seed Demo Data ──────────────────────────────────────────
  const seeded = await seedDatabase(eventRepo, prisma);
  if (seeded > 0) {
    // Run initial reasoning cycle to generate recommendations from seed data
    const initialCycle = new RunReasoningCycleUseCase(deps);
    const result = await initialCycle.execute();
    console.log(`🧠 Initial cycle: ${result.generated} recommendations generated`);
  }

  // ── Reasoning Scheduler ─────────────────────────────────────
  const reasoningCycle = new RunReasoningCycleUseCase(deps);
  const cycleInterval = setInterval(async () => {
    try {
      const result = await reasoningCycle.execute();
      if (result.generated > 0) {
        console.log(
          `🧠 Reasoning cycle: ${result.generated} recommendations (${result.source}, ${result.durationMs}ms) | Health: ${result.healthScore.overall}`
        );
      }
    } catch (err) {
      console.error('❌ Reasoning cycle error:', (err as Error).message);
    }
  }, config.env.cycleMs);
  console.log(`✅ Reasoning scheduler started (every ${config.env.cycleMs / 1000}s)`);

  // ── Start Server ────────────────────────────────────────────
  try {
    await app.listen({ port: config.env.port, host: config.env.host });
    console.log(`\n🚀 AEGIS API running at http://${config.env.host}:${config.env.port}`);
    console.log(`   SSE stream: http://localhost:${config.env.port}/api/v1/stream`);
    console.log(`   Health score: http://localhost:${config.env.port}/api/v1/health-score\n`);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }

  // ── Graceful Shutdown ───────────────────────────────────────
  const shutdown = async (): Promise<void> => {
    console.log('\n🛑 Shutting down AEGIS...');
    clearInterval(cycleInterval);
    await app.close();
    await disconnectPrisma();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});

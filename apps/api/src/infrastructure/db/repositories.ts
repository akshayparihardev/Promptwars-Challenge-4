// ============================================================
// Prisma Repository Implementations
// Implements all domain ports using Prisma/SQLite.
// ============================================================

import type { PrismaClient } from '@prisma/client';
import type { Domain, OperationalEvent, Recommendation, MemoryEntry } from '@aegis/shared';
import type {
  EventRepository,
  RecommendationRepository,
  SituationRepository,
  DecisionRepository,
  ActionRepository,
  AuditRepository,
  MemoryRepository,
  HealthSnapshotRepository,
} from '../../domain/ports/index.js';

// ── Event Repository ──────────────────────────────────────────

export class PrismaEventRepository implements EventRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(event: Omit<OperationalEvent, 'id' | 'createdAt'>): Promise<OperationalEvent> {
    const created = await this.db.operationalEvent.create({
      data: {
        domain: event.domain,
        zone: event.zone,
        type: event.type,
        severity: event.severity,
        payload: typeof event.payload === 'string' ? event.payload : JSON.stringify(event.payload),
        isOutcome: event.isOutcome,
      },
    });
    return {
      ...created,
      payload: safeJsonParse(created.payload),
      createdAt: created.createdAt.toISOString(),
    } as unknown as OperationalEvent;
  }

  async findInWindow(windowMinutes: number): Promise<OperationalEvent[]> {
    const since = new Date(Date.now() - windowMinutes * 60 * 1000);
    const rows = await this.db.operationalEvent.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(mapEvent);
  }

  async findByIds(ids: string[]): Promise<OperationalEvent[]> {
    const rows = await this.db.operationalEvent.findMany({
      where: { id: { in: ids } },
    });
    return rows.map(mapEvent);
  }

  async countBySeverityAndDomain(
    windowMinutes: number
  ): Promise<{ domain: string; severity: string; count: number }[]> {
    const since = new Date(Date.now() - windowMinutes * 60 * 1000);
    const rows = await this.db.operationalEvent.groupBy({
      by: ['domain', 'severity'],
      where: { createdAt: { gte: since } },
      _count: { id: true },
    });
    return rows.map((r) => ({
      domain: r.domain,
      severity: r.severity,
      count: r._count.id,
    }));
  }
}

// ── Recommendation Repository ─────────────────────────────────

export class PrismaRecommendationRepository implements RecommendationRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(rec: Omit<Recommendation, 'id'>): Promise<Recommendation> {
    const created = await this.db.recommendation.create({
      data: {
        situationId: rec.situationId,
        domain: rec.domain,
        targetRoles: JSON.stringify(rec.targetRoles),
        title: rec.title,
        recommendedAction: rec.recommendedAction,
        reason: rec.reason,
        evidence: JSON.stringify(rec.evidence),
        confidence: rec.confidence,
        expectedImpact: JSON.stringify(rec.expectedImpact),
        alternatives: JSON.stringify(rec.alternatives),
        prediction: JSON.stringify(rec.prediction),
        priority: rec.priority,
        status: rec.status,
        source: rec.source,
        expiresAt: new Date(rec.expiresAt),
      },
    });
    return mapRecommendation(created);
  }

  async findById(id: string): Promise<Recommendation | null> {
    const row = await this.db.recommendation.findUnique({ where: { id } });
    return row ? mapRecommendation(row) : null;
  }

  async findByFilters(filters: {
    role?: string;
    domain?: Domain;
    status?: string;
  }): Promise<Recommendation[]> {
    const rows = await this.db.recommendation.findMany({
      where: {
        ...(filters.domain && { domain: filters.domain }),
        ...(filters.status && { status: filters.status }),
      },
      orderBy: { priority: 'desc' },
    });

    let results = rows.map(mapRecommendation);

    // Filter by role — role must be in targetRoles or role is 'organizer' (sees all)
    if (filters.role && filters.role !== 'organizer') {
      results = results.filter((r) =>
        r.targetRoles.includes(filters.role as never)
      );
    }

    return results;
  }

  async updateStatus(id: string, status: string): Promise<Recommendation> {
    const updated = await this.db.recommendation.update({
      where: { id },
      data: { status },
    });
    return mapRecommendation(updated);
  }

  async findActiveBySituationSignature(signature: string): Promise<Recommendation | null> {
    const situation = await this.db.situation.findUnique({
      where: { signature },
      include: {
        recommendations: {
          where: { status: 'proposed' },
          take: 1,
        },
      },
    });
    const rec = situation?.recommendations[0];
    return rec ? mapRecommendation(rec) : null;
  }

  async findExpired(): Promise<Recommendation[]> {
    const rows = await this.db.recommendation.findMany({
      where: {
        status: 'proposed',
        expiresAt: { lte: new Date() },
      },
    });
    return rows.map(mapRecommendation);
  }
}

// ── Situation Repository ──────────────────────────────────────

export class PrismaSituationRepository implements SituationRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(situation: {
    title: string;
    domains: string;
    severity: string;
    rationale: string;
    signature: string;
  }): Promise<{ id: string }> {
    const created = await this.db.situation.create({ data: situation });
    return { id: created.id };
  }

  async findBySignature(signature: string): Promise<{ id: string } | null> {
    const row = await this.db.situation.findUnique({ where: { signature } });
    return row ? { id: row.id } : null;
  }
}

// ── Decision Repository ───────────────────────────────────────

export class PrismaDecisionRepository implements DecisionRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(decision: {
    recommendationId: string;
    actorRole: string;
    outcome: string;
    note?: string;
  }): Promise<{ id: string }> {
    const created = await this.db.decision.create({ data: decision });
    return { id: created.id };
  }
}

// ── Action Repository ─────────────────────────────────────────

export class PrismaActionRepository implements ActionRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(action: {
    decisionId: string;
    effect: string;
    outcomeEventId?: string;
  }): Promise<{ id: string }> {
    const created = await this.db.action.create({ data: action });
    return { id: created.id };
  }
}

// ── Audit Repository ──────────────────────────────────────────

export class PrismaAuditRepository implements AuditRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(log: {
    entityType: string;
    entityId: string;
    action: string;
    actorRole?: string;
    metadata: string;
  }): Promise<void> {
    await this.db.auditLog.create({ data: log });
  }

  async findByFilters(filters: {
    entityType?: string;
    entityId?: string;
    limit: number;
  }) {
    return this.db.auditLog.findMany({
      where: {
        ...(filters.entityType && { entityType: filters.entityType }),
        ...(filters.entityId && { entityId: filters.entityId }),
      },
      orderBy: { createdAt: 'desc' },
      take: filters.limit,
    });
  }
}

// ── Memory Repository ─────────────────────────────────────────

export class PrismaMemoryRepository implements MemoryRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(entry: Omit<MemoryEntry, 'id' | 'createdAt'>): Promise<MemoryEntry> {
    const created = await this.db.operationalMemory.create({
      data: {
        recommendationId: entry.recommendationId,
        situationSignature: entry.situationSignature,
        domain: entry.domain,
        predictedMetrics: JSON.stringify(entry.predictedMetrics),
        actualMetrics: JSON.stringify(entry.actualMetrics),
        predictionAccuracy: entry.predictionAccuracy,
      },
    });
    return mapMemory(created);
  }

  async findBySituationSignature(signature: string, limit: number): Promise<MemoryEntry[]> {
    const rows = await this.db.operationalMemory.findMany({
      where: { situationSignature: signature },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map(mapMemory);
  }

  async findByFilters(filters: { domain?: Domain; limit: number }): Promise<MemoryEntry[]> {
    const rows = await this.db.operationalMemory.findMany({
      where: filters.domain ? { domain: filters.domain } : {},
      orderBy: { createdAt: 'desc' },
      take: filters.limit,
    });
    return rows.map(mapMemory);
  }
}

// ── Health Snapshot Repository ────────────────────────────────

export class PrismaHealthSnapshotRepository implements HealthSnapshotRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(snapshot: { domains: string; overall: number; trend: string }): Promise<void> {
    await this.db.healthSnapshot.create({ data: snapshot });
  }

  async findLatest() {
    return this.db.healthSnapshot.findFirst({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findRecent(count: number) {
    return this.db.healthSnapshot.findMany({
      orderBy: { createdAt: 'desc' },
      take: count,
      select: { overall: true, createdAt: true },
    });
  }
}

// ── Mapping Helpers ───────────────────────────────────────────

function safeJsonParse(str: string): Record<string, unknown> {
  try {
    return JSON.parse(str) as Record<string, unknown>;
  } catch {
    return {};
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapEvent(row: any): OperationalEvent {
  return {
    id: row.id,
    domain: row.domain,
    zone: row.zone,
    type: row.type,
    severity: row.severity,
    payload: safeJsonParse(row.payload),
    isOutcome: row.isOutcome,
    createdAt: row.createdAt.toISOString(),
  } as OperationalEvent;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRecommendation(row: any): Recommendation {
  return {
    id: row.id,
    situationId: row.situationId,
    domain: row.domain,
    targetRoles: JSON.parse(row.targetRoles),
    title: row.title,
    recommendedAction: row.recommendedAction,
    reason: row.reason,
    evidence: JSON.parse(row.evidence),
    confidence: row.confidence,
    expectedImpact: JSON.parse(row.expectedImpact),
    alternatives: JSON.parse(row.alternatives),
    prediction: JSON.parse(row.prediction),
    priority: row.priority,
    status: row.status,
    source: row.source,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  } as Recommendation;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapMemory(row: any): MemoryEntry {
  return {
    id: row.id,
    recommendationId: row.recommendationId,
    situationSignature: row.situationSignature,
    domain: row.domain,
    predictedMetrics: JSON.parse(row.predictedMetrics),
    actualMetrics: JSON.parse(row.actualMetrics),
    predictionAccuracy: row.predictionAccuracy,
    createdAt: row.createdAt.toISOString(),
  } as MemoryEntry;
}

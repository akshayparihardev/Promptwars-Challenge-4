// ============================================================
// Domain Ports — Interfaces that the domain depends on.
// Infrastructure implements these. Dependencies point inward.
// ============================================================

import type {
  Domain,
  OperationalEvent,
  Recommendation,
  MemoryEntry,
  SituationHypothesis,
  ImpactPrediction,
  Alternative,
  LanguageCode,
} from '@aegis/shared';

// ── Event Repository ──────────────────────────────────────────

export interface EventRepository {
  create(event: Omit<OperationalEvent, 'id' | 'createdAt'>): Promise<OperationalEvent>;
  findInWindow(windowMinutes: number): Promise<OperationalEvent[]>;
  findByIds(ids: string[]): Promise<OperationalEvent[]>;
  countBySeverityAndDomain(
    windowMinutes: number
  ): Promise<{ domain: string; severity: string; count: number }[]>;
}

// ── Recommendation Repository ─────────────────────────────────

export interface RecommendationRepository {
  create(rec: Omit<Recommendation, 'id'>): Promise<Recommendation>;
  findById(id: string): Promise<Recommendation | null>;
  findByFilters(filters: {
    role?: string;
    domain?: Domain;
    status?: string;
    lang?: string;
  }): Promise<Recommendation[]>;
  updateStatus(id: string, status: string): Promise<Recommendation>;
  findActiveBySituationSignature(signature: string): Promise<Recommendation | null>;
  findExpired(): Promise<Recommendation[]>;
}

// ── Situation Repository ──────────────────────────────────────

export interface SituationRepository {
  create(situation: {
    title: string;
    domains: string;
    severity: string;
    rationale: string;
    signature: string;
  }): Promise<{ id: string }>;
  findBySignature(signature: string): Promise<{ id: string } | null>;
}

// ── Decision Repository ───────────────────────────────────────

export interface DecisionRepository {
  create(decision: {
    recommendationId: string;
    actorRole: string;
    outcome: string;
    note?: string;
  }): Promise<{ id: string }>;
}

// ── Action Repository ─────────────────────────────────────────

export interface ActionRepository {
  create(action: {
    decisionId: string;
    effect: string;
    outcomeEventId?: string;
  }): Promise<{ id: string }>;
}

// ── Audit Repository ──────────────────────────────────────────

export interface AuditRepository {
  create(log: {
    entityType: string;
    entityId: string;
    action: string;
    actorRole?: string;
    metadata: string;
  }): Promise<void>;
  findByFilters(filters: {
    entityType?: string;
    entityId?: string;
    limit: number;
  }): Promise<Array<{
    id: string;
    entityType: string;
    entityId: string;
    action: string;
    actorRole: string | null;
    metadata: string;
    createdAt: Date;
  }>>;
}

// ── Memory Repository ─────────────────────────────────────────

export interface MemoryRepository {
  create(entry: Omit<MemoryEntry, 'id' | 'createdAt'>): Promise<MemoryEntry>;
  findBySituationSignature(signature: string, limit: number): Promise<MemoryEntry[]>;
  findByFilters(filters: { domain?: Domain; limit: number }): Promise<MemoryEntry[]>;
}

// ── Health Snapshot Repository ────────────────────────────────

export interface HealthSnapshotRepository {
  create(snapshot: { domains: string; overall: number; trend: string }): Promise<void>;
  findLatest(): Promise<{ domains: string; overall: number; trend: string; createdAt: Date } | null>;
  findRecent(count: number): Promise<Array<{ overall: number; createdAt: Date }>>;
}

// ── LLM Reasoner Port ─────────────────────────────────────────

export interface LlmReasoner {
  correlate(input: {
    signals: Array<{ id: string; domain: string; type: string; zone: string; severity: string; summary: string }>;
    stateSnapshot: string;
  }): Promise<SituationHypothesis[]>;

  predictImpact(input: {
    situations: SituationHypothesis[];
    stateSnapshot: string;
  }): Promise<ImpactPrediction[]>;

  generateAlternatives(input: {
    situation: SituationHypothesis;
    prediction: ImpactPrediction;
    allowedActions: string[];
  }): Promise<Alternative[]>;

  localize(text: string, targetLang: LanguageCode): Promise<string>;
}

// ── Event Bus (SSE) ───────────────────────────────────────────

export interface EventBus {
  emit(event: string, data: unknown): void;
  subscribe(handler: (event: string, data: unknown) => void): () => void;
}

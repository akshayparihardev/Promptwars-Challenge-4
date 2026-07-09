// ============================================================
// @aegis/shared — Zod Schemas
// Runtime-validated schemas for all domain entities.
// Used for API request/response validation and type inference.
// ============================================================

import { z } from 'zod';
import {
  DOMAINS,
  SEVERITIES,
  REC_STATUSES,
  ROLES,
  LANGUAGES,
  TRENDS,
  IMPACT_DIRECTIONS,
  REC_SOURCES,
} from './constants.js';

// ── Primitives ────────────────────────────────────────────────

export const DomainSchema = z.enum(DOMAINS);
export const SeveritySchema = z.enum(SEVERITIES);
export const RecStatusSchema = z.enum(REC_STATUSES);
export const RoleSchema = z.enum(ROLES);
export const LanguageCodeSchema = z.enum(LANGUAGES);
export const TrendSchema = z.enum(TRENDS);
export const ImpactDirectionSchema = z.enum(IMPACT_DIRECTIONS);
export const RecSourceSchema = z.enum(REC_SOURCES);

// ── Operational Event ─────────────────────────────────────────

export const OperationalEventCreateSchema = z.object({
  domain: DomainSchema,
  zone: z.string().min(1).max(100),
  type: z.string().min(1).max(100),
  severity: SeveritySchema.default('low'),
  payload: z.record(z.string(), z.unknown()),
});

export type OperationalEventCreate = z.infer<typeof OperationalEventCreateSchema>;

export const OperationalEventSchema = OperationalEventCreateSchema.extend({
  id: z.string(),
  isOutcome: z.boolean().default(false),
  createdAt: z.string().datetime(),
});

export type OperationalEvent = z.infer<typeof OperationalEventSchema>;

// ── Evidence Reference ────────────────────────────────────────

export const EvidenceRefSchema = z.object({
  eventId: z.string(),
  summary: z.string().max(300),
});

export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;

// ── Expected Impact ───────────────────────────────────────────

export const ExpectedImpactSchema = z.object({
  description: z.string().max(500),
  metric: z.string().max(100).optional(),
  direction: ImpactDirectionSchema,
  estimatedMagnitude: z.string().max(50).optional(),
});

export type ExpectedImpact = z.infer<typeof ExpectedImpactSchema>;

// ── Alternative ───────────────────────────────────────────────

export const AlternativeSchema = z.object({
  option: z.string().max(200),
  pros: z.string().max(300),
  cons: z.string().max(300),
  confidence: z.number().min(0).max(1),
  predictedHealthImpact: z.number(),
  isRecommended: z.boolean().default(false),
});

export type Alternative = z.infer<typeof AlternativeSchema>;

// ── Prediction ────────────────────────────────────────────────

export const HealthScoreImpactSchema = z.object({
  current: z.number().min(0).max(100),
  projected: z.number().min(0).max(100),
  delta: z.number(),
});

export type HealthScoreImpact = z.infer<typeof HealthScoreImpactSchema>;

export const PredictionSchema = z.object({
  noActionOutcome: z.string().max(500),
  predictedMetrics: z.record(z.string(), z.number()),
  healthScoreImpact: HealthScoreImpactSchema,
});

export type Prediction = z.infer<typeof PredictionSchema>;

// ── Recommendation ────────────────────────────────────────────

export const RecommendationSchema = z.object({
  id: z.string(),
  situationId: z.string(),
  domain: DomainSchema,
  targetRoles: z.array(RoleSchema).min(1),
  title: z.string().max(200),
  recommendedAction: z.string().max(100),
  reason: z.string().max(600),
  evidence: z.array(EvidenceRefSchema).min(1),
  confidence: z.number().min(0).max(1),
  expectedImpact: ExpectedImpactSchema,
  alternatives: z.array(AlternativeSchema),
  prediction: PredictionSchema,
  priority: z.number(),
  status: RecStatusSchema,
  source: RecSourceSchema,
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
});

export type Recommendation = z.infer<typeof RecommendationSchema>;

// ── Situation Hypothesis ──────────────────────────────────────

export const SituationHypothesisSchema = z.object({
  id: z.string(),
  title: z.string().max(120),
  domains: z.array(DomainSchema).min(1),
  evidenceSignalIds: z.array(z.string()).min(1),
  severity: SeveritySchema,
  rationale: z.string().max(600),
});

export type SituationHypothesis = z.infer<typeof SituationHypothesisSchema>;

// ── Impact Prediction (LLM output) ───────────────────────────

export const ImpactPredictionSchema = z.object({
  situationId: z.string(),
  noActionOutcome: z.string().max(300),
  predictedMetrics: z.record(z.string(), z.number()),
  timeHorizonMinutes: z.number(),
  healthScoreDelta: z.number(),
});

export type ImpactPrediction = z.infer<typeof ImpactPredictionSchema>;

// ── Decision ──────────────────────────────────────────────────

export const DecisionCreateSchema = z.object({
  recommendationId: z.string(),
  outcome: z.enum(['approved', 'rejected']),
  note: z.string().max(500).optional(),
});

export type DecisionCreate = z.infer<typeof DecisionCreateSchema>;

export const DecisionSchema = DecisionCreateSchema.extend({
  id: z.string(),
  actorRole: RoleSchema,
  createdAt: z.string().datetime(),
});

export type Decision = z.infer<typeof DecisionSchema>;

// ── Health Score ──────────────────────────────────────────────

export const HealthScoreSchema = z.object({
  domains: z.record(DomainSchema, z.number().min(0).max(100)),
  overall: z.number().min(0).max(100),
  trend: TrendSchema,
  computedAt: z.string().datetime(),
});

export type HealthScore = z.infer<typeof HealthScoreSchema>;

// ── Operational Memory ────────────────────────────────────────

export const MemoryEntrySchema = z.object({
  id: z.string(),
  recommendationId: z.string(),
  situationSignature: z.string(),
  domain: DomainSchema,
  predictedMetrics: z.record(z.string(), z.number()),
  actualMetrics: z.record(z.string(), z.number()),
  predictionAccuracy: z.number().min(0).max(1),
  createdAt: z.string().datetime(),
});

export type MemoryEntry = z.infer<typeof MemoryEntrySchema>;

// ── Audit Log ─────────────────────────────────────────────────

export const AuditLogSchema = z.object({
  id: z.string(),
  entityType: z.enum(['recommendation', 'decision', 'action', 'event']),
  entityId: z.string(),
  action: z.enum(['created', 'approved', 'rejected', 'executed', 'expired']),
  actorRole: RoleSchema.optional(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
});

export type AuditLog = z.infer<typeof AuditLogSchema>;

// ── Live Stadium State ────────────────────────────────────────

export const ZoneMetricsSchema = z.record(z.string(), z.number());

export const LiveStadiumStateSchema = z.object({
  windowMinutes: z.number(),
  events: z.array(OperationalEventSchema),
  metrics: z.object({
    zoneDensity: z.record(z.string(), z.number()),
    activeIncidents: z.number(),
    energyLoadPct: z.number(),
  }),
  healthScore: HealthScoreSchema,
});

export type LiveStadiumState = z.infer<typeof LiveStadiumStateSchema>;

// ── API Request Schemas ───────────────────────────────────────

export const ListRecommendationsQuerySchema = z.object({
  role: RoleSchema,
  domain: DomainSchema.optional(),
  status: RecStatusSchema.optional().default('proposed'),
  lang: LanguageCodeSchema.optional().default('en'),
});

export type ListRecommendationsQuery = z.infer<typeof ListRecommendationsQuerySchema>;

export const ListAuditQuerySchema = z.object({
  entityType: z.enum(['recommendation', 'decision', 'action', 'event']).optional(),
  entityId: z.string().optional(),
  limit: z.coerce.number().min(1).max(500).optional().default(100),
});

export type ListAuditQuery = z.infer<typeof ListAuditQuerySchema>;

export const ListMemoryQuerySchema = z.object({
  domain: DomainSchema.optional(),
  limit: z.coerce.number().min(1).max(500).optional().default(50),
});

export type ListMemoryQuery = z.infer<typeof ListMemoryQuerySchema>;

// ── API Response Schemas ──────────────────────────────────────

export const IngestEventResponseSchema = z.object({
  eventId: z.string(),
  createdAt: z.string().datetime(),
});

export type IngestEventResponse = z.infer<typeof IngestEventResponseSchema>;

export const CycleResponseSchema = z.object({
  generated: z.number(),
  source: RecSourceSchema,
  durationMs: z.number(),
});

export type CycleResponse = z.infer<typeof CycleResponseSchema>;

export const ChatRequestSchema = z.object({
  message: z.string().max(500),
  role: RoleSchema,
  language: LanguageCodeSchema.default('en'),
  accessibilityNeeds: z.array(z.string()).optional(),
  currentLocation: z.string().optional(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export const ChatResponseSchema = z.object({
  answer: z.string(),
  source: z.enum(['genai', 'rules']),
});

export type ChatResponse = z.infer<typeof ChatResponseSchema>;

export const DecisionResponseSchema = z.object({
  recommendationId: z.string(),
  status: RecStatusSchema,
  decisionId: z.string(),
  actionId: z.string().optional(),
});

export type DecisionResponse = z.infer<typeof DecisionResponseSchema>;

// ── SSE Event Types ───────────────────────────────────────────

export const SSE_EVENT_TYPES = [
  'recommendation.created',
  'event.ingested',
  'recommendation.updated',
  'cycle.completed',
  'health.updated',
  'memory.recorded',
] as const;

export type SseEventType = (typeof SSE_EVENT_TYPES)[number];

// ── Error Response ────────────────────────────────────────────

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

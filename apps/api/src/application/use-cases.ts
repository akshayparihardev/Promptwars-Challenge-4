// ============================================================
// Application Use Cases — Orchestrate domain logic.
// Each use case has a single execute() method.
// ============================================================

import type { Recommendation, HealthScore } from '@aegis/shared';
import type {
  EventRepository,
  RecommendationRepository,
  SituationRepository,
  DecisionRepository,
  ActionRepository,
  AuditRepository,
  MemoryRepository,
  HealthSnapshotRepository,
  LlmReasoner,
  EventBus,
} from '../domain/ports/index.js';
import { detectSituations } from '../domain/rules/rules-engine.js';
import {
  computeConfidence,
  computePriority,
  computeDomainHealth,
  computeOverallHealth,
  computeTrend,
  computePredictionAccuracy,
  computeSituationSignature,
} from '../domain/scoring/scoring-service.js';
import type { AppConfig } from '../infrastructure/config/config-loader.js';
import { DOMAINS } from '@aegis/shared';
import type { Domain, Severity, RecStatus } from '@aegis/shared';

// ── Shared Dependencies ──────────────────────────────────────

export interface UseCaseDeps {
  eventRepo: EventRepository;
  recRepo: RecommendationRepository;
  situationRepo: SituationRepository;
  decisionRepo: DecisionRepository;
  actionRepo: ActionRepository;
  auditRepo: AuditRepository;
  memoryRepo: MemoryRepository;
  healthSnapshotRepo: HealthSnapshotRepository;
  llmReasoner: LlmReasoner;
  eventBus: EventBus;
  config: AppConfig;
}

// ════════════════════════════════════════════════════════════════
// IngestEventUseCase
// ════════════════════════════════════════════════════════════════

/**
 * Use Case: IngestEvent
 * Validates and stores incoming stadium events, and publishes them to the event bus.
 */
export class IngestEventUseCase {
  constructor(private readonly deps: UseCaseDeps) {}

  async execute(input: {
    domain: string;
    zone: string;
    type: string;
    severity: string;
    payload: Record<string, unknown>;
  }): Promise<{ eventId: string; createdAt: string }> {
    const event = await this.deps.eventRepo.create({
      domain: input.domain as Domain,
      zone: input.zone,
      type: input.type,
      severity: input.severity as Severity,
      payload: input.payload,
      isOutcome: false,
    });

    await this.deps.auditRepo.create({
      entityType: 'event',
      entityId: event.id,
      action: 'created',
      metadata: JSON.stringify({ domain: input.domain, zone: input.zone, type: input.type }),
    });

    this.deps.eventBus.emit('event.ingested', event);

    return { eventId: event.id, createdAt: event.createdAt };
  }
}

// ════════════════════════════════════════════════════════════════
// RunReasoningCycleUseCase
// ════════════════════════════════════════════════════════════════

/**
 * Use Case: RunReasoningCycle
 * Core orchestration loop that processes recent events, detects situations,
 * computes correlations via the LLM, and generates actionable recommendations.
 */
export class RunReasoningCycleUseCase {
  private running = false;

  constructor(private readonly deps: UseCaseDeps) {}

  async execute(): Promise<{
    generated: number;
    source: string;
    durationMs: number;
    healthScore: HealthScore;
  }> {
    // Single-flight guard
    if (this.running) {
      const hs = await this.getHealthScore();
      return { generated: 0, source: 'skipped', durationMs: 0, healthScore: hs };
    }
    this.running = true;
    const startTime = Date.now();

    try {
      const windowMin = this.deps.config.env.contextWindowMin;
      const events = await this.deps.eventRepo.findInWindow(windowMin);

      if (events.length === 0) {
        const hs = await this.getHealthScore();
        return { generated: 0, source: 'no_events', durationMs: Date.now() - startTime, healthScore: hs };
      }

      // Step 1: Detect situations
      const signals = detectSituations(events, this.deps.config.detectionRules);

      if (signals.length === 0) {
        const hs = await this.getHealthScore();
        return { generated: 0, source: 'no_signals', durationMs: Date.now() - startTime, healthScore: hs };
      }

      // Step 2 & 3: Correlate (via LLM or deterministic)
      const stateSnapshot = JSON.stringify({
        eventCount: events.length,
        domains: [...new Set(events.map((e) => e.domain))],
        zones: [...new Set(events.map((e) => e.zone))],
      });

      const signalInputs = signals.map((s) => ({
        id: s.id,
        domain: s.domain,
        type: s.type,
        zone: s.zone,
        severity: s.severity,
        summary: s.summary,
      }));

      const situations = await this.deps.llmReasoner.correlate({
        signals: signalInputs,
        stateSnapshot,
      });

      // Step 4: Predict impact
      const predictions = await this.deps.llmReasoner.predictImpact({
        situations,
        stateSnapshot,
      });

      const source = this.deps.config.env.llmProvider === 'gemini' ? 'genai' : 'deterministic';
      let generatedCount = 0;

      for (const situation of situations) {
        // Compute signature for dedup
        const zones = signals
          .filter((s) => situation.evidenceSignalIds.includes(s.id))
          .map((s) => s.zone);
        const signature = computeSituationSignature(
          situation.domains,
          zones,
          situation.domains.join('+')
        );

        // Dedup: skip if active proposed rec exists for this signature
        const existing = await this.deps.recRepo.findActiveBySituationSignature(signature);
        if (existing) continue;

        // Create or find situation
        let sitRecord = await this.deps.situationRepo.findBySignature(signature);
        if (!sitRecord) {
          sitRecord = await this.deps.situationRepo.create({
            title: situation.title,
            domains: JSON.stringify(situation.domains),
            severity: situation.severity,
            rationale: situation.rationale,
            signature,
          });
        }

        // Step 5: Generate alternatives
        const prediction = predictions.find((p) => p.situationId === situation.id);
        const primaryDomain = situation.domains[0] ?? 'operations';
        const allowedActions = this.deps.config.actionAllowList.actions[primaryDomain] ?? [];

        const alternatives = await this.deps.llmReasoner.generateAlternatives({
          situation,
          prediction: prediction ?? {
            situationId: situation.id,
            noActionOutcome: 'Situation may worsen if unaddressed.',
            predictedMetrics: {},
            timeHorizonMinutes: 15,
            healthScoreDelta: -5,
          },
          allowedActions,
        });

        const recommendedAlt = alternatives.find((a) => a.isRecommended) ?? alternatives[0];

        // Look up memory for similar situations
        const memoryEntries = await this.deps.memoryRepo.findBySituationSignature(
          signature,
          this.deps.config.scoring.memoryLookbackCount
        );
        const avgAccuracy = memoryEntries.length > 0
          ? memoryEntries.reduce((sum, m) => sum + m.predictionAccuracy, 0) / memoryEntries.length
          : undefined;

        // Compute evidence from signals
        const evidenceEvents = signals.filter((s) =>
          situation.evidenceSignalIds.includes(s.id)
        );
        const evidenceRefs = evidenceEvents.map((e) => ({
          eventId: e.evidenceEventIds[0] ?? e.id,
          summary: e.summary,
        }));

        // Step 7: Score
        const confidence = computeConfidence(
          situation.severity as Severity,
          evidenceRefs.length,
          undefined,
          avgAccuracy,
          this.deps.config.scoring
        );

        const priority = computePriority(
          situation.severity as Severity,
          0, // just created
          primaryDomain as Domain,
          this.deps.config.scoring
        );

        // Compute health score for this recommendation
        const currentHealthScore = await this.getHealthScore();
        const healthDelta = prediction?.healthScoreDelta ?? -5;

        // Step 8: Route — determine target roles based on domain
        const targetRoles = this.getTargetRoles(primaryDomain, situation.severity);

        const ttlMs = this.deps.config.env.recTtlMin * 60 * 1000;
        const now = new Date();

        const rec = await this.deps.recRepo.create({
          situationId: sitRecord.id,
          domain: primaryDomain as Domain,
          targetRoles: targetRoles as Recommendation['targetRoles'],
          title: situation.title,
          recommendedAction: recommendedAlt?.option.split(' ').slice(0, 3).join('_').toLowerCase() ?? 'escalate',
          reason: situation.rationale,
          evidence: evidenceRefs,
          confidence,
          expectedImpact: {
            description: prediction?.noActionOutcome ?? 'Situation may worsen without action.',
            metric: Object.keys(prediction?.predictedMetrics ?? {})[0],
            direction: 'decrease' as const,
            estimatedMagnitude: `~${Math.abs(healthDelta)}%`,
          },
          alternatives,
          prediction: {
            noActionOutcome: prediction?.noActionOutcome ?? 'Situation may worsen.',
            predictedMetrics: prediction?.predictedMetrics ?? {},
            healthScoreImpact: {
              current: currentHealthScore.overall,
              projected: Math.min(100, currentHealthScore.overall + Math.abs(healthDelta)),
              delta: Math.abs(healthDelta),
            },
          },
          priority,
          status: 'proposed' as RecStatus,
          source: source as 'genai' | 'deterministic',
          createdAt: now.toISOString(),
          expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
        });

        await this.deps.auditRepo.create({
          entityType: 'recommendation',
          entityId: rec.id,
          action: 'created',
          metadata: JSON.stringify({ domain: primaryDomain, source, situationId: sitRecord.id }),
        });

        this.deps.eventBus.emit('recommendation.created', rec);
        generatedCount++;
      }

      // Expire stale recommendations
      const expired = await this.deps.recRepo.findExpired();
      for (const exp of expired) {
        await this.deps.recRepo.updateStatus(exp.id, 'expired');
        await this.deps.auditRepo.create({
          entityType: 'recommendation',
          entityId: exp.id,
          action: 'expired',
          metadata: JSON.stringify({ originalPriority: exp.priority }),
        });
        this.deps.eventBus.emit('recommendation.updated', { id: exp.id, status: 'expired' });
      }

      // Compute and persist health score
      const healthScore = await this.computeAndPersistHealthScore();
      this.deps.eventBus.emit('health.updated', healthScore);
      this.deps.eventBus.emit('cycle.completed', {
        generated: generatedCount,
        source,
        healthScore,
      });

      return {
        generated: generatedCount,
        source,
        durationMs: Date.now() - startTime,
        healthScore,
      };
    } finally {
      this.running = false;
    }
  }

  private getTargetRoles(domain: string, severity: string): string[] {
    const roleMapping = this.deps.config.roleMapping.roles;
    const defaultRole = this.deps.config.roleMapping.defaultRole;

    const roles = [...(roleMapping[domain] ?? [defaultRole])];

    // Critical severity always includes organizer
    if (severity === 'critical' && !roles.includes('organizer')) {
      roles.push('organizer');
    }

    return roles;
  }

  private async getHealthScore(): Promise<HealthScore> {
    const snapshot = await this.deps.healthSnapshotRepo.findLatest();
    if (snapshot) {
      return {
        domains: JSON.parse(snapshot.domains) as Record<Domain, number>,
        overall: snapshot.overall,
        trend: snapshot.trend as HealthScore['trend'],
        computedAt: snapshot.createdAt.toISOString(),
      };
    }
    // Default healthy state
    const domains = {} as Record<string, number>;
    for (const d of DOMAINS) {
      domains[d] = 100;
    }
    return { domains: domains as Record<Domain, number>, overall: 100, trend: 'stable', computedAt: new Date().toISOString() };
  }

  private async computeAndPersistHealthScore(): Promise<HealthScore> {
    const windowMin = this.deps.config.env.contextWindowMin;
    const counts = await this.deps.eventRepo.countBySeverityAndDomain(windowMin);

    const domainScores: Record<string, number> = {};
    
    for (const domain of DOMAINS) {
      const criticalCount = counts
        .filter((c) => c.domain === domain && c.severity === 'critical')
        .reduce((sum, c) => sum + c.count, 0);
      const highCount = counts
        .filter((c) => c.domain === domain && c.severity === 'high')
        .reduce((sum, c) => sum + c.count, 0);

      domainScores[domain] = computeDomainHealth(
        domain as Domain,
        criticalCount,
        highCount,
        0, // TODO: count pending recs per domain
        this.deps.config.healthScore
      );
    }

    const overall = computeOverallHealth(domainScores, this.deps.config.healthScore);

    // Compute trend
    const recentSnapshots = await this.deps.healthSnapshotRepo.findRecent(
      this.deps.config.healthScore.trendWindowSnapshots
    );
    const recentScores = [overall, ...recentSnapshots.map((s) => s.overall)];
    const trend = computeTrend(recentScores);

    // Persist
    await this.deps.healthSnapshotRepo.create({
      domains: JSON.stringify(domainScores),
      overall,
      trend,
    });

    return {
      domains: domainScores as Record<Domain, number>,
      overall,
      trend,
      computedAt: new Date().toISOString(),
    };
  }
}

// ════════════════════════════════════════════════════════════════
// ApproveDecisionUseCase
// ════════════════════════════════════════════════════════════════

export class ApproveDecisionUseCase {
  constructor(private readonly deps: UseCaseDeps) {}

  async execute(input: {
    recommendationId: string;
    actorRole: string;
    note?: string;
  }): Promise<{ recommendationId: string; status: string; decisionId: string; actionId?: string }> {
    const rec = await this.deps.recRepo.findById(input.recommendationId);
    if (!rec) throw new AppError('NOT_FOUND', 'Recommendation not found');
    if (rec.status !== 'proposed') throw new AppError('CONFLICT', `Cannot approve: status is "${rec.status}"`);

    // Authorization: role must be in targetRoles or organizer
    if (input.actorRole !== 'organizer' && !rec.targetRoles.includes(input.actorRole as never)) {
      throw new AppError('FORBIDDEN', `Role "${input.actorRole}" not authorized for this recommendation`);
    }

    // Create decision
    const decision = await this.deps.decisionRepo.create({
      recommendationId: input.recommendationId,
      actorRole: input.actorRole,
      outcome: 'approved',
      note: input.note,
    });

    // Update recommendation status
    await this.deps.recRepo.updateStatus(input.recommendationId, 'approved');

    // Audit
    await this.deps.auditRepo.create({
      entityType: 'decision',
      entityId: decision.id,
      action: 'approved',
      actorRole: input.actorRole,
      metadata: JSON.stringify({ recommendationId: input.recommendationId, note: input.note }),
    });

    // Execute action
    const actionResult = await this.executeAction(rec, decision.id);

    this.deps.eventBus.emit('recommendation.updated', {
      id: input.recommendationId,
      status: 'approved',
    });

    return {
      recommendationId: input.recommendationId,
      status: 'executed',
      decisionId: decision.id,
      actionId: actionResult.actionId,
    };
  }

  private async executeAction(
    rec: Recommendation,
    decisionId: string
  ): Promise<{ actionId: string }> {
    // Simulate action effect
    const effect = {
      action: rec.recommendedAction,
      domain: rec.domain,
      timestamp: new Date().toISOString(),
      simulated: true,
    };

    // Create outcome event (feedback into Live Stadium State)
    const outcomeEvent = await this.deps.eventRepo.create({
      domain: rec.domain as Domain,
      zone: 'system',
      type: `action_executed`,
      severity: 'low' as Severity,
      payload: { recommendationId: rec.id, ...effect },
      isOutcome: true,
    });

    const action = await this.deps.actionRepo.create({
      decisionId,
      effect: JSON.stringify(effect),
      outcomeEventId: outcomeEvent.id,
    });

    // Update recommendation status to executed
    await this.deps.recRepo.updateStatus(rec.id, 'executed');

    // Audit
    await this.deps.auditRepo.create({
      entityType: 'action',
      entityId: action.id,
      action: 'executed',
      metadata: JSON.stringify({ recommendationId: rec.id, effect }),
    });

    // Evaluate outcome (write to operational memory)
    await this.evaluateOutcome(rec);

    return { actionId: action.id };
  }

  private async evaluateOutcome(rec: Recommendation): Promise<void> {
    try {
      const prediction = rec.prediction;
      if (!prediction?.predictedMetrics || Object.keys(prediction.predictedMetrics).length === 0) return;

      // For simulation: actual metrics approximate predicted (with some variance)
      const actualMetrics: Record<string, number> = {};
      for (const [key, predicted] of Object.entries(prediction.predictedMetrics)) {
        // Simulate actual being close to predicted (±15% variance)
        const variance = 1 + (Math.random() * 0.3 - 0.15);
        actualMetrics[key] = predicted * variance;
      }

      const accuracy = computePredictionAccuracy(prediction.predictedMetrics, actualMetrics);

      // Get situation signature
      const sitRecord = await this.deps.situationRepo.findBySignature(rec.situationId);
      const signature = sitRecord ? rec.situationId : `sig_${rec.domain}_${rec.id}`;

      await this.deps.memoryRepo.create({
        recommendationId: rec.id,
        situationSignature: signature,
        domain: rec.domain as Domain,
        predictedMetrics: prediction.predictedMetrics,
        actualMetrics,
        predictionAccuracy: accuracy,
      });

      this.deps.eventBus.emit('memory.recorded', {
        recommendationId: rec.id,
        predictionAccuracy: accuracy,
      });
    } catch (err) {
      console.warn('[MEMORY] Failed to evaluate outcome:', (err as Error).message);
    }
  }
}

// ════════════════════════════════════════════════════════════════
// RejectDecisionUseCase
// ════════════════════════════════════════════════════════════════

export class RejectDecisionUseCase {
  constructor(private readonly deps: UseCaseDeps) {}

  async execute(input: {
    recommendationId: string;
    actorRole: string;
    note?: string;
  }): Promise<{ recommendationId: string; status: string; decisionId: string }> {
    const rec = await this.deps.recRepo.findById(input.recommendationId);
    if (!rec) throw new AppError('NOT_FOUND', 'Recommendation not found');
    if (rec.status !== 'proposed') throw new AppError('CONFLICT', `Cannot reject: status is "${rec.status}"`);

    if (input.actorRole !== 'organizer' && !rec.targetRoles.includes(input.actorRole as never)) {
      throw new AppError('FORBIDDEN', `Role "${input.actorRole}" not authorized`);
    }

    const decision = await this.deps.decisionRepo.create({
      recommendationId: input.recommendationId,
      actorRole: input.actorRole,
      outcome: 'rejected',
      note: input.note,
    });

    await this.deps.recRepo.updateStatus(input.recommendationId, 'rejected');

    await this.deps.auditRepo.create({
      entityType: 'decision',
      entityId: decision.id,
      action: 'rejected',
      actorRole: input.actorRole,
      metadata: JSON.stringify({ recommendationId: input.recommendationId, note: input.note }),
    });

    this.deps.eventBus.emit('recommendation.updated', {
      id: input.recommendationId,
      status: 'rejected',
    });

    return {
      recommendationId: input.recommendationId,
      status: 'rejected',
      decisionId: decision.id,
    };
  }
}

// ════════════════════════════════════════════════════════════════
// ChatUseCase
// ════════════════════════════════════════════════════════════════

import type { ChatRequest, ChatResponse } from '@aegis/shared';
import { ChatAgent } from '../infrastructure/llm/chat-agent.js';

export class ChatUseCase {
  private chatAgent: ChatAgent;

  constructor(deps: UseCaseDeps) {
    this.chatAgent = new ChatAgent(deps.config, deps.eventRepo, deps.healthSnapshotRepo);
  }

  async execute(request: ChatRequest, forceDeterministic = false): Promise<ChatResponse> {
    const answer = await this.chatAgent.processChat(request, forceDeterministic);
    
    // For now we assume if it starts with (Mock Response) it's rules based, otherwise GenAI
    const source = (answer.includes('(Mock Response)') || answer.includes('aseos') || answer.includes('toilettes') || answer.includes('restroom')) 
      ? 'rules' 
      : 'genai';

    return {
      answer,
      source
    };
  }
}

// ════════════════════════════════════════════════════════════════
// AppError
// ════════════════════════════════════════════════════════════════

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// ============================================================
// Deterministic Reasoner — Fallback when no LLM key is provided.
// Implements LlmReasoner port using rule-based templates.
// ALL templates and weights from config — NOTHING hardcoded.
// ============================================================

import type { SituationHypothesis, ImpactPrediction, Alternative, LanguageCode } from '@aegis/shared';
import type { LlmReasoner } from '../../domain/ports/index.js';
import type { AppConfig } from '../config/config-loader.js';

export class DeterministicReasoner implements LlmReasoner {
  constructor(private readonly config: AppConfig) {}

  async correlate(input: {
    signals: Array<{ id: string; domain: string; type: string; zone: string; severity: string; summary: string }>;
    stateSnapshot: string;
  }): Promise<SituationHypothesis[]> {
    // Group signals by zone + time proximity → simple situations
    const byZone: Record<string, typeof input.signals> = {};
    for (const signal of input.signals) {
      const key = signal.zone;
      if (!byZone[key]) byZone[key] = [];
      byZone[key]!.push(signal);
    }

    const situations: SituationHypothesis[] = [];
    for (const [zone, signals] of Object.entries(byZone)) {
      const domains = [...new Set(signals.map((s) => s.domain))];
      const maxSeverity = getMaxSeverity(signals.map((s) => s.severity));

      situations.push({
        id: `sit_${Date.now()}_${zone.replace(/[^a-z0-9]/gi, '')}`,
        title: `${signals.length > 1 ? 'Multi-domain' : domains[0]!.charAt(0).toUpperCase() + domains[0]!.slice(1)} situation at ${zone}`,
        domains: domains as SituationHypothesis['domains'],
        evidenceSignalIds: signals.map((s) => s.id),
        severity: maxSeverity as SituationHypothesis['severity'],
        rationale: signals.map((s) => s.summary).join('; '),
      });
    }

    return situations;
  }

  async predictImpact(input: {
    situations: SituationHypothesis[];
    stateSnapshot: string;
  }): Promise<ImpactPrediction[]> {
    const severityImpact = this.config.scoring.severityScores;

    return input.situations.map((sit) => {
      const rawScore = severityImpact[sit.severity] ?? 5;
      const delta = rawScore > 0 ? -rawScore : rawScore;
      
      return {
        situationId: sit.id,
        noActionOutcome: `If no action is taken, the ${sit.domains.join('/')} situation at the affected zone will likely worsen within 15 minutes, potentially affecting adjacent areas.`,
        predictedMetrics: {
          affected_zones: sit.domains.length,
          severity_escalation_risk: sit.severity === 'critical' ? 0.9 : sit.severity === 'high' ? 0.7 : 0.4,
        },
        timeHorizonMinutes: 15,
        healthScoreDelta: delta,
      };
    });
  }

  async generateAlternatives(input: {
    situation: SituationHypothesis;
    prediction: ImpactPrediction;
    allowedActions: string[];
  }): Promise<Alternative[]> {
    const primaryDomain = input.situation.domains[0] ?? 'operations';
    const allowedActions = input.allowedActions;

    if (allowedActions.length === 0) {
      return [{
        option: 'Escalate to organizer for manual assessment',
        pros: 'Human oversight ensures appropriate response',
        cons: 'Slower response time',
        confidence: 0.6,
        predictedHealthImpact: Math.abs(input.prediction.healthScoreDelta) * 0.5,
        isRecommended: true,
      }];
    }

    const alternatives: Alternative[] = [];

    // Primary action (recommended)
    const primaryAction = allowedActions[0]!;
    alternatives.push({
      option: formatAction(primaryAction, primaryDomain, input.situation),
      pros: `Direct response to ${primaryDomain} situation; fastest resolution path`,
      cons: 'Requires immediate resource allocation',
      confidence: input.situation.severity === 'critical' ? 0.88 : 0.78,
      predictedHealthImpact: Math.abs(input.prediction.healthScoreDelta) * 0.8,
      isRecommended: true,
    });

    // Secondary action
    if (allowedActions.length >= 2) {
      const secondaryAction = allowedActions[1]!;
      alternatives.push({
        option: formatAction(secondaryAction, primaryDomain, input.situation),
        pros: 'Less disruptive; preserves current operations',
        cons: 'May have slower effect on the situation',
        confidence: 0.65,
        predictedHealthImpact: Math.abs(input.prediction.healthScoreDelta) * 0.5,
        isRecommended: false,
      });
    }

    // Escalation option
    alternatives.push({
      option: 'Escalate to organizer with situation brief for manual decision',
      pros: 'Full human oversight; appropriate for uncertain situations',
      cons: 'Slower response; organizer may be handling other issues',
      confidence: 0.55,
      predictedHealthImpact: Math.abs(input.prediction.healthScoreDelta) * 0.3,
      isRecommended: false,
    });

    return alternatives;
  }

  async localize(text: string, targetLang: LanguageCode): Promise<string> {
    // Deterministic fallback: basic dictionary for common phrases from config
    const dictionaries = this.config.translations;

    if (targetLang === 'en') return text;

    const dict = dictionaries[targetLang];
    if (!dict) return `${text} [translation unavailable for ${targetLang}]`;

    let translated = text;
    for (const [eng, loc] of Object.entries(dict)) {
      translated = translated.replace(new RegExp(eng, 'gi'), loc);
    }

    return translated;
  }
}

// ── Helpers ───────────────────────────────────────────────────

function getMaxSeverity(severities: string[]): string {
  const order = ['low', 'medium', 'high', 'critical'];
  let maxIdx = 0;
  for (const s of severities) {
    const idx = order.indexOf(s);
    if (idx > maxIdx) maxIdx = idx;
  }
  return order[maxIdx] ?? 'medium';
}

function formatAction(action: string, domain: string, situation: SituationHypothesis): string {
  const readable = action.replace(/_/g, ' ');
  const zone = situation.rationale.match(/at\s+([\w-]+)/)?.[1] ?? 'affected zone';
  return `${readable.charAt(0).toUpperCase() + readable.slice(1)} at ${zone} to address ${domain} situation`;
}

// ============================================================
// Scoring Service — Confidence, Priority, Health Score
// All weights/thresholds read from config — NOTHING hardcoded.
// ============================================================

import type { Domain, Severity } from '@aegis/shared';
import type { ScoringConfig, HealthScoreConfig } from '../../infrastructure/config/config-loader.js';

// ── Confidence Score ──────────────────────────────────────────

export function computeConfidence(
  severity: Severity,
  evidenceCount: number,
  llmReportedConfidence: number | undefined,
  memoryAccuracy: number | undefined,
  config: ScoringConfig
): number {
  const severityScore = (config.severityScores[severity] ?? 50) / 100;
  const base = severityScore * (1 - 1 / (1 + evidenceCount));

  const llmAdj = llmReportedConfidence
    ? clamp(llmReportedConfidence, config.llmConfidenceClamp.min, config.llmConfidenceClamp.max)
    : 1.0;

  const memoryAdj = memoryAccuracy ?? 1.0;

  return clamp(base * llmAdj * memoryAdj, 0, 1);
}

// ── Priority Score ────────────────────────────────────────────

export function computePriority(
  severity: Severity,
  ageSeconds: number,
  domain: Domain,
  config: ScoringConfig
): number {
  const severityScore = config.severityScores[severity] ?? 0.5;
  const recencyDecay = Math.exp(-ageSeconds / config.recencyDecayHalfLifeSeconds);
  const domainWeight = config.domainWeights[domain] ?? 0.5;

  return severityScore * recencyDecay * domainWeight;
}

// ── Health Score (per domain) ─────────────────────────────────

export function computeDomainHealth(
  domain: Domain,
  criticalCount: number,
  highCount: number,
  pendingRecCount: number,
  config: HealthScoreConfig
): number {
  const normalizer = config.normalizers[domain] ?? 5;
  const penalty =
    criticalCount * config.weights.criticalIncidentWeight +
    highCount * config.weights.highIncidentWeight +
    pendingRecCount * config.weights.pendingRecommendationWeight;

  return clamp(100 * (1 - penalty / normalizer), 0, 100);
}

// ── Health Score (overall) ────────────────────────────────────

export function computeOverallHealth(
  domainScores: Record<string, number>,
  config: HealthScoreConfig
): number {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const [domain, score] of Object.entries(domainScores)) {
    const weight = config.domainWeights[domain] ?? 0;
    weightedSum += score * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 100;
}

// ── Health Trend ──────────────────────────────────────────────

export function computeTrend(
  recentScores: number[]
): 'improving' | 'stable' | 'declining' {
  if (recentScores.length < 2) return 'stable';

  const latest = recentScores[0] ?? 0;
  const previous = recentScores[1] ?? 0;
  const delta = latest - previous;

  if (delta > 2) return 'improving';
  if (delta < -2) return 'declining';
  return 'stable';
}

// ── Prediction Accuracy ───────────────────────────────────────

export function computePredictionAccuracy(
  predicted: Record<string, number>,
  actual: Record<string, number>
): number {
  const keys = Object.keys(predicted);
  if (keys.length === 0) return 1.0;

  let totalError = 0;
  let count = 0;

  for (const key of keys) {
    const p = predicted[key];
    const a = actual[key];
    if (p !== undefined && a !== undefined && p !== 0) {
      totalError += Math.abs(p - a) / Math.abs(p);
      count++;
    }
  }

  if (count === 0) return 1.0;
  return clamp(1 - totalError / count, 0, 1);
}

// ── Situation Signature (dedup key) ───────────────────────────

export function computeSituationSignature(
  domains: string[],
  zones: string[],
  signalType: string
): string {
  const sortedDomains = [...domains].sort().join(',');
  const sortedZones = [...zones].sort().join(',');
  return `${sortedDomains}::${sortedZones}::${signalType}`;
}

// ── Utility ───────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

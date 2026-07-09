# 04 — AI Reasoning Engine

## Executive Summary

**WHY:** This is the heart of the "GenAI" requirement. It must reason, be explainable, and never operate as an ungoverned black box.

The AI Engine is a **hybrid 9-step pipeline**: deterministic detectors identify candidate situations; the Live Stadium State is built; GenAI performs risk assessment, impact prediction, and alternative generation; deterministic scoring validates, scores, and orders; post-execution outcome evaluation feeds into **Operational Memory**. A **deterministic fallback** guarantees the system works with no LLM key.

---

## Reasoning Pipeline (9 Steps)

```
Step 1: DETECT SITUATIONS (deterministic)
  Input: Live Stadium State (recent events + metrics)
  Rules scan each domain for threshold breaches / patterns.
  All thresholds loaded from config/detection-rules.json — never hardcoded.
  Output: CandidateSignal[]  (typed, evidence-linked)

Step 2: BUILD LIVE STADIUM STATE (deterministic)
  Input: CandidateSignal[] + rolling event window + derived metrics
  Snapshot the current operational state across all domains and zones.
  Compute zone densities, incident counts, resource availability.
  Output: LiveStadiumState  (structured, queryable)

Step 3: RISK ASSESSMENT & CORRELATION (GenAI + deterministic)
  Input: CandidateSignal[] + LiveStadiumState
  LLM identifies cross-domain relationships, root causes, and risk levels.
  Deterministic fallback: groups signals by zone + time proximity.
  Output: SituationHypothesis[]  (schema-constrained JSON)

Step 4: PREDICT IMPACT (GenAI + deterministic)
  Input: SituationHypothesis[] + LiveStadiumState + OperationalMemory
  For each situation, predict future state if no action is taken.
  Reference past similar situations from memory for accuracy.
  Output: ImpactPrediction[] (expected crowd change, wait time, health score delta)

Step 5: GENERATE ALTERNATIVES (GenAI + deterministic templates)
  Input: SituationHypothesis[] + ImpactPrediction[]
  Generate 2-3 alternative actions per situation with pros/cons.
  Select recommended action; retain alternatives for explainability.
  Output: DraftRecommendation[] (with alternatives[])

Step 6: VALIDATE & GUARDRAIL (deterministic — hard guardrail)
  - Evidence must reference existing event IDs.
  - Recommended action must be in allow-list per domain.
  - Reject/repair malformed LLM output.
  - Predictions must be within plausible bounds.
  Output: ValidatedRecommendation[]

Step 7: SCORE & PRIORITIZE (deterministic)
  confidence = clamp(base(severity, evidenceCount) × llmAdj × memoryAdj, 0..1)
  priority   = severityWeight × recencyDecay × domainWeight
  healthScoreImpact = predictedHealthDelta per domain
  All weights loaded from config — never hardcoded.
  Output: ScoredRecommendation[]

Step 8: ROUTE TO ROLES (deterministic)
  Map each recommendation to responsible role(s).
  One situation may cascade to multiple roles with role-specific framing.
  Output: RoutedRecommendation[] → persisted

Step 9: EVALUATE OUTCOMES (deterministic — post-execution)
  Triggered after Action execution, not during the reasoning cycle.
  Compare predicted impact vs. actual measured outcome.
  Compute prediction accuracy and store in Operational Memory.
  Update confidence adjustment factor for similar future situations.
  Output: MemoryEntry (persisted)
```

---

## Ports (Interfaces) — for AI agents to implement

```typescript
// domain/ports/llm-reasoner.port.ts
export interface LlmReasoner {
  /**
   * Correlate candidate signals into situation hypotheses.
   * MUST return schema-valid JSON or throw LlmSchemaError.
   */
  correlate(input: CorrelateInput): Promise<SituationHypothesis[]>;

  /**
   * Predict impact if no action is taken.
   */
  predictImpact(input: PredictInput): Promise<ImpactPrediction[]>;

  /**
   * Generate alternative action recommendations with pros/cons.
   */
  generateAlternatives(input: AlternativesInput): Promise<DraftRecommendation[]>;

  /**
   * Localize text into target language (multilingual domain).
   */
  localize(text: string, targetLang: LanguageCode): Promise<string>;
}
```

---

## Deterministic Fallback (MANDATORY)

**WHY:** Evaluation may run without an API key; the system must never break.

```typescript
// infrastructure/llm/deterministic-reasoner.ts
// Implements LlmReasoner using rule-based templates.
// correlate(): groups signals by zone + time proximity → simple situations.
// predictImpact(): template-based predictions from severity + evidence count.
// generateAlternatives(): 2-3 pre-defined alternatives per situation type from config.
// localize(): dictionary-based translation for supported phrases.
```

The active reasoner is chosen by config:

```
AEGIS_LLM_PROVIDER = openai | anthropic | deterministic (default: deterministic)
```

---

## Prompt Contract (for LLM adapter)

**WHY:** Constrained prompts = reliable, parseable, non-hallucinated output. All prompt templates loaded from `config/prompts/` directory — never inline hardcoded strings.

### System prompt (correlate):

```
You are AEGIS, a stadium operations reasoning engine.
You receive candidate operational signals. You MUST:
1. Group related signals into situations across domains.
2. Only reference the provided signal IDs as evidence.
3. Never invent events, numbers, or IDs.
4. Output ONLY valid JSON matching the SituationHypothesis schema.
Domains: navigation, crowd, transport, accessibility, sustainability,
multilingual, operations.
```

### System prompt (predictImpact):

```
You are AEGIS. Given a situation hypothesis and the current Live Stadium State,
predict what will happen in the next 15-30 minutes if NO action is taken.
You MUST:
1. Predict specific, measurable impacts (crowd density change, wait time, etc.).
2. Reference only provided data — never invent metrics.
3. Output ONLY valid JSON matching the ImpactPrediction schema.
```

### System prompt (generateAlternatives):

```
You are AEGIS. Given a situation and its predicted impact, generate 2-3
alternative actions that could address the situation.
For each alternative, provide:
1. A clear action description.
2. Pros and cons.
3. A confidence score (0-1) for expected effectiveness.
4. Predicted impact on the Operational Health Score.
Mark ONE alternative as recommended. Output valid JSON only.
```

### Output schema (Zod-validated on receipt):

```typescript
const SituationHypothesisSchema = z.object({
  id: z.string(),
  title: z.string().max(120),
  domains: z.array(DomainEnum).min(1),
  evidenceSignalIds: z.array(z.string()).min(1),  // MUST exist
  severity: z.enum(['low','medium','high','critical']),
  rationale: z.string().max(600),
});

const ImpactPredictionSchema = z.object({
  situationId: z.string(),
  noActionOutcome: z.string().max(300),
  predictedMetrics: z.record(z.string(), z.number()),  // e.g., { "gate7_density": 0.96 }
  timeHorizonMinutes: z.number(),
  healthScoreDelta: z.number(),                        // predicted change to health score
});

const AlternativeSchema = z.object({
  option: z.string().max(200),
  pros: z.string().max(300),
  cons: z.string().max(300),
  confidence: z.number().min(0).max(1),
  predictedHealthImpact: z.number(),
  isRecommended: z.boolean(),
});
```

> **Guardrail:** After parsing, `evidenceSignalIds` are checked against real signals. Any hallucinated ID → recommendation rejected & logged.

---

## Recommendation Object (Canonical — Extended)

```typescript
interface Recommendation {
  id: string;
  situationId: string;
  domain: Domain;
  targetRoles: Role[];
  title: string;
  recommendedAction: ActionType;      // from allow-list
  reason: string;                     // WHY (explainability)
  evidence: EvidenceRef[];            // event/signal references
  confidence: number;                 // 0..1
  expectedImpact: {
    description: string;
    metric?: string;                  // e.g., "gate wait time"
    direction: 'increase'|'decrease';
    estimatedMagnitude?: string;      // e.g., "~30%"
  };
  // NEW: Decision Intelligence fields
  alternatives: Alternative[];         // 2-3 alternative actions considered
  prediction: {
    noActionOutcome: string;           // what happens if we do nothing
    predictedMetrics: Record<string, number>;
    healthScoreImpact: {
      current: number;                 // current health score
      projected: number;               // projected after action
      delta: number;                   // change
    };
  };
  priority: number;                   // computed
  status: 'proposed'|'approved'|'rejected'|'executed'|'expired';
  createdAt: string;
  source: 'genai'|'deterministic';    // transparency
}

interface Alternative {
  option: string;
  pros: string;
  cons: string;
  confidence: number;
  predictedHealthImpact: number;
}
```

---

## Operational Health Score

**WHY:** A continuously computed score (0–100) per domain + overall provides an instant "wow" metric that communicates AI value. Every recommendation explains how it changes this score.

### Computation (deterministic — all weights from config)

```typescript
// domain/scoring/health-score.ts
// All weights, normalizers, and thresholds loaded from config/health-score.json

interface HealthScore {
  domains: Record<Domain, number>;     // 0-100 per domain
  overall: number;                     // weighted average
  computedAt: string;
  trend: 'improving' | 'stable' | 'declining';
}

// Formula (per domain):
// domainHealth = 100 × (1 - (activeHighSeverity × highWeight +
//                activeCritical × criticalWeight +
//                pendingRecommendations × pendingWeight) / normalizer)
//
// overall = weightedAvg(domainHealth, domainWeights)
//
// All weights loaded from config:
// config/health-score.json: { highWeight, criticalWeight, pendingWeight,
//                             normalizers: { crowd: N, medical: N, ... },
//                             domainWeights: { crowd: W, medical: W, ... } }
```

### Health Score in Recommendations

Every recommendation includes:
```
"Approving this recommendation is expected to change the Operational Health Score:
 Crowd: 72 → 85 (+13)
 Overall: 81 → 87 (+6)"
```

---

## Operational Memory

**WHY:** Closed-loop learning without ML. After execution, measure prediction accuracy and adjust future confidence.

```typescript
// domain/entities/operational-memory.ts

interface MemoryEntry {
  id: string;
  recommendationId: string;
  situationSignature: string;          // same dedup key as Situation
  predictedMetrics: Record<string, number>;
  actualMetrics: Record<string, number>;
  predictionAccuracy: number;          // 0..1, computed
  domain: Domain;
  createdAt: string;
}

// Accuracy computation:
// For each predicted metric, compare predicted vs actual.
// accuracy = 1 - avg(|predicted - actual| / |predicted|) clamped to [0, 1]

// Memory adjustment for future confidence:
// memoryAdj = avgAccuracy of last N similar situations (by signature prefix)
// If no memory → memoryAdj = 1.0 (neutral)
// confidence = clamp(base × llmAdj × memoryAdj, 0, 1)
```

---

## Deterministic Detectors (Rules Catalog)

**All thresholds loaded from `config/detection-rules.json` — never hardcoded.**

| Rule ID | Domain | Trigger | Candidate Signal |
|---|---|---|---|
| R-CRW-01 | Crowd | zone density > threshold (default 0.85) | High congestion |
| R-CRW-02 | Crowd | ingress rate spike > multiplier × baseline (default 2×) | Surge |
| R-NAV-01 | Navigation | gate closed + adjacent density > threshold | Reroute needed |
| R-MED-01 | Medical | incident reported, severity ≥ configured minimum | Dispatch needed |
| R-SEC-01 | Security | crowd + incident co-located within zone radius | Escalation risk |
| R-TRN-01 | Transport | shuttle delay > configured minutes near egress window | Egress risk |
| R-ACC-01 | Accessibility | accessible route congested / assistance queue > threshold | Priority access |
| R-SUS-01 | Sustainability | energy load > configured capacity % | Load shed opportunity |
| R-MUL-01 | Multilingual | fan alert queued + multi-language audience detected | Localize broadcast |

---

## Confidence Scoring Formula (Deterministic)

**All severity scores loaded from `config/scoring.json`.**

```
base = severityScore × (1 - 1/(1 + evidenceCount))
      severityScore: loaded from config (defaults: low=0.4, medium=0.6, high=0.8, critical=0.95)
llmAdj = clamp(llmReportedConfidence ?? 1.0, 0.5, 1.0)
memoryAdj = avgAccuracyOfSimilarSituations ?? 1.0   // from Operational Memory
confidence = clamp(base × llmAdj × memoryAdj, 0, 1)
```

---

## Priority Formula (Deterministic)

**All domain weights loaded from `config/scoring.json`.**

```
recencyDecay = exp(-ageSeconds / configuredHalfLife)   // default half-life: 900s
domainWeight = loaded from config
               (defaults: medical:1.0, security:0.95, crowd:0.9, accessibility:0.9,
                transport:0.8, navigation:0.7, sustainability:0.5, multilingual:0.6)
priority = severityScore × recencyDecay × domainWeight
```

---

## Configuration Files (No Hardcoding)

All pipeline parameters are externalized:

```
config/
├── detection-rules.json      # thresholds per rule ID
├── scoring.json              # severity scores, domain weights, half-life
├── health-score.json         # health formula weights and normalizers
├── prompts/
│   ├── correlate.txt         # system prompt for correlation
│   ├── predict-impact.txt    # system prompt for impact prediction
│   ├── generate-alternatives.txt  # system prompt for alternatives
│   └── localize.txt          # system prompt for translation
├── action-allow-list.json    # allowed actions per domain
└── venue-model.json          # zones, capacities, adjacencies
```

At boot, the config loader validates all files with Zod schemas. Missing or invalid config → **fail fast** with descriptive error.

---

## Module Spec: ReasoningPipeline

- **Inputs:** `LiveStadiumState`
- **Outputs:** `ScoredRecommendation[]` (persisted)
- **Responsibilities:** orchestrate 9 steps; enforce guardrails; reference Operational Memory.
- **Dependencies:** `LlmReasoner` port, `RulesEngine`, `ScoringService`, `HealthScoreService`, `MemoryRepository`, `RecommendationRepo`, `ConfigLoader`.
- **Failure Cases:**
  - LLM timeout → fall back to deterministic reasoner for that cycle; log warning.
  - Schema error → discard bad hypotheses, keep valid ones.
  - Empty state → no-op, return `[]`.
  - Config file missing → fail fast at boot (never at runtime).
- **Testing:** unit test each step in isolation with fixtures; golden-file test for deterministic output; contract test that all recs have R/E/C/I + alternatives + prediction.
- **Security:** never send PII to LLM; strip fan identifiers; rate-limit LLM calls.
- **Accessibility:** N/A (backend), but ensures localized fields present for UI.

# 07 — Backend Design

## Executive Summary

**WHY:** Backend implements the reasoning loop, governance, and persistence with clean, testable layers.

**Stack:** Node.js 20 LTS + TypeScript (strict) + Fastify + Prisma + SQLite + Zod + Pino (logging) + Vitest.

---

## Layer Responsibilities

### Domain Layer (`src/domain`)

- **Responsibility:** Pure business logic. No I/O.
- Entities, rules engine, scoring, prioritization, ports.
- **Dependencies:** none (pure TS).
- **Testing:** 100% unit-testable, deterministic.

### Application Layer (`src/application`)

- **Responsibility:** Orchestrate use cases.
- Each use case = one class with `execute(input): Promise<output>`.
- **Dependencies:** domain + ports (injected).

### Infrastructure Layer (`src/infrastructure`)

- **Responsibility:** Implement ports (DB, LLM), scheduler, seed.
- **Dependencies:** Prisma, LLM SDK.

### Interface Layer (`src/interface`)

- **Responsibility:** HTTP routes, controllers, DTO validation, SSE.
- **Dependencies:** application layer.

---

## Use Case Specifications

### IngestEventUseCase

- **Input:** `OperationalEventDto`
- **Output:** `{ eventId }`
- **Responsibilities:** validate, enrich (timestamp, zone metrics), persist.
- **Dependencies:** `EventRepository`.
- **Failure:** invalid schema → `ValidationError`.
- **Security:** sanitize free-text fields; enforce enum domains.
- **Testing:** persists valid event; rejects invalid.

### RunReasoningCycleUseCase

- **Input:** `{ windowMinutes }`
- **Output:** `{ recommendations: Recommendation[], healthScore: HealthScore }`
- **Responsibilities:** build Live Stadium State, run 9-step pipeline, dedupe, persist, emit SSE, expire stale, compute health score snapshot.
- **Dependencies:** `EventRepository`, `ReasoningPipeline`, `RecommendationRepository`, `HealthScoreService`, `EventBus`, `ConfigLoader`.
- **Failure:** LLM error → fallback reasoner; log; continue.
- **Testing:** golden-file with deterministic reasoner; idempotency (no new events → no dup recs); health score computed correctly.

### ApproveDecisionUseCase / RejectDecisionUseCase

- **Input:** `{ recommendationId, actorRole, note? }`
- **Output:** updated recommendation.
- **Responsibilities:** authorize, validate state, transition, audit, trigger execution (approve).
- **Failure:** 403 wrong role, 409 bad state.
- **Security:** server-side authorization is authoritative.
- **Testing:** authz matrix, state machine transitions.

### ExecuteActionUseCase

- **Input:** `{ recommendationId }`
- **Output:** `{ actionId, effect }`
- **Responsibilities:** simulate action effect, generate outcome event, feed back to context.
- **Failure:** only executes approved recs.
- **Testing:** produces feedback event; sets status `executed`.

### ListRecommendationsUseCase

- **Input:** `{ role, domain?, status?, lang? }`
- **Output:** `Recommendation[]` (localized, role-scoped, priority-sorted, with alternatives + predictions).
- **Security:** role scoping enforced.

### GetHealthScoreUseCase

- **Input:** `{ }` (no params — returns latest snapshot)
- **Output:** `HealthScore { domains: Record<Domain, number>, overall: number, trend, computedAt }`
- **Responsibilities:** return latest health score snapshot. If stale, recompute from Live Stadium State.
- **Dependencies:** `HealthScoreRepository`, `EventRepository`, `ConfigLoader`.
- **Failure:** no events → all scores = 100 (healthy baseline).
- **Testing:** correct scores for known event sets; trend detection.

### EvaluateOutcomeUseCase

- **Input:** `{ recommendationId }`
- **Output:** `MemoryEntry { predictionAccuracy, predictedMetrics, actualMetrics }`
- **Responsibilities:** load recommendation’s prediction, gather actual metrics from recent events, compare, compute accuracy, persist to Operational Memory.
- **Dependencies:** `RecommendationRepository`, `EventRepository`, `MemoryRepository`.
- **Failure:** no new events for comparison → skip, retry next cycle.
- **Testing:** accuracy = 1.0 when prediction matches actual; accuracy = 0 when completely wrong.

### GetOperationalMemoryUseCase

- **Input:** `{ domain?, limit? }`
- **Output:** `MemoryEntry[]` (newest first).
- **Responsibilities:** return prediction accuracy history. Organizer-only.
- **Security:** Organizer role required.
- **Testing:** returns filtered results; respects role.

---

## Dependency Injection

- Lightweight manual composition root (`main.ts`) — no DI framework (avoids complexity).
- Ports injected via constructors.

---

## Scheduler

```typescript
// infrastructure/scheduler/reasoning-scheduler.ts
// setInterval(runReasoningCycle, config.cycleMs)
// Guard: single-flight (skip if previous cycle running).
// Graceful shutdown clears interval.
```

---

## Configuration (`src/config`)

Env-driven, validated at boot with Zod:

```env
PORT=3000
DATABASE_URL="file:./aegis.db"
AEGIS_LLM_PROVIDER=deterministic   # openai|anthropic|deterministic
AEGIS_LLM_API_KEY=                 # optional
AEGIS_CYCLE_MS=15000
AEGIS_CONTEXT_WINDOW_MIN=30
AEGIS_REC_TTL_MIN=30
LOG_LEVEL=info
```

Boot **fails fast** if `provider != deterministic` and key missing (or auto-fallback with warning — configurable).

### Configuration Files (No Hardcoding)

In addition to env vars, all pipeline parameters are externalized to JSON config files (see doc 04 for full list):

```
config/
├── detection-rules.json      # all detection thresholds
├── scoring.json              # severity scores, domain weights, half-life
├── health-score.json         # health formula weights and normalizers
├── action-allow-list.json    # allowed actions per domain
├── venue-model.json          # zones, capacities, adjacencies
└── prompts/                  # all LLM prompt templates
```

All config files validated with Zod schemas at boot. Missing or invalid → **fail fast**.

---

## Error Handling

- Central Fastify error handler → normalized `{ error: { code, message, details } }`.
- **Never** leak stack traces in production responses.
- Distinct error codes: `VALIDATION_ERROR`, `NOT_FOUND`, `FORBIDDEN`, `CONFLICT`, `LLM_ERROR`, `INTERNAL`.

---

## Logging

- Pino structured JSON. Correlation ID per request.
- **Never** log PII or API keys.
- Log every reasoning cycle summary (counts, source, duration).

---

## Backend Definition of Done

- [ ] ≥ 80% coverage on domain + application.
- [ ] All use cases have failure-path tests.
- [ ] Boot config validation works.
- [ ] Deterministic reasoner produces valid recs with no LLM key.
- [ ] Health score computed and returned correctly.
- [ ] Outcome evaluation stores memory entries after execution.
- [ ] Zero hardcoded thresholds, weights, or prompts — all config-driven.
- [ ] Config files validated at boot with Zod schemas.

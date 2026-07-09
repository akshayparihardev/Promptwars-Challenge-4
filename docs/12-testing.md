# 12 — Testing Strategy

## Executive Summary

**WHY:** ≥ 80% backend test coverage on core logic is a Definition of Done requirement. Testing is not afterthought — it validates the reasoning pipeline, governance rules, and explainability contracts that define AEGIS.

---

## Testing Philosophy

1. **Test behavior, not implementation.** Tests describe what the system does, not how.
2. **Deterministic tests.** No flaky tests. Mock external dependencies (LLM, clock).
3. **Pyramid model:** many unit tests, focused integration tests, minimal E2E.
4. **Golden files** for deterministic reasoner output — regression detection.
5. **Contract tests** for the R/E/C/I explainability guarantee.

---

## Testing Stack

| Tool | Purpose |
|---|---|
| **Vitest** | Unit + integration tests (backend & shared) |
| **React Testing Library (RTL)** | Frontend component tests |
| **axe-core** | Accessibility violation detection |
| **Supertest** | HTTP integration tests (Fastify) |
| **msw (Mock Service Worker)** | API mocking in frontend tests |

---

## Test Categories

### Unit Tests (Domain Layer)

**Target:** ≥ 90% coverage. Pure functions, no I/O.

| Module | Key Tests |
|---|---|
| `rules/` (detectors) | Each rule triggers on correct input; does not trigger below threshold |
| `scoring/confidence` | Formula correctness; clamping bounds; edge cases (0 evidence, critical severity) |
| `scoring/priority` | Recency decay curve; domain weight ordering; boundary values |
| `entities/` | Entity creation; validation; immutability |
| Recommendation state machine | Valid transitions: proposed→approved→executed; proposed→rejected; proposed→expired |
| State machine invalid transitions | approved→proposed (rejected), executed→approved, etc. |

```typescript
// Example: confidence scoring test
describe('calculateConfidence', () => {
  it('returns 0 for zero evidence regardless of severity', () => {
    // base = severityScore * (1 - 1/(1+0)) = severityScore * 0 = 0
    expect(calculateConfidence('critical', 0)).toBe(0);
  });

  it('approaches severityScore as evidence increases', () => {
    const conf = calculateConfidence('high', 100);
    expect(conf).toBeCloseTo(0.8, 1); // severityScore for high = 0.8
  });

  it('clamps between 0 and 1', () => {
    expect(calculateConfidence('critical', 50)).toBeLessThanOrEqual(1);
    expect(calculateConfidence('low', 1)).toBeGreaterThanOrEqual(0);
  });
});
```

### Unit Tests (Application Layer)

**Target:** ≥ 80% coverage. Use case orchestration with mocked ports.

| Use Case | Key Tests |
|---|---|
| `IngestEventUseCase` | Valid event persisted; invalid rejected; enrichment applied |
| `RunReasoningCycleUseCase` | Pipeline called with context; dedup prevents spam; stale recs expired; idempotent on no new events |
| `ApproveDecisionUseCase` | Authorized role approves; unauthorized rejected (403); wrong state rejected (409); audit logged |
| `RejectDecisionUseCase` | Same authz matrix; status transitions correctly |
| `ExecuteActionUseCase` | Only approved recs executed; outcome event generated; status set to executed |
| `ListRecommendationsUseCase` | Role scoping enforced; domain filter works; language localization applied |

### Integration Tests (Interface Layer)

**Target:** Key paths tested with Supertest against real Fastify instance + SQLite in-memory.

| Endpoint | Key Tests |
|---|---|
| `POST /events` | 201 on valid; 400 on invalid schema; event persisted in DB |
| `GET /recommendations` | Returns role-scoped results; filters by domain/status; sorted by priority |
| `POST /decisions` | Full approval flow: ingest → cycle → approve → execute; role authz enforced |
| `GET /audit` | Returns chronological log; Organizer-only access |
| `GET /stream` | SSE connection established; events emitted on recommendation creation |

### Frontend Tests (RTL + axe-core)

**Target:** All components tested; 0 accessibility violations.

| Component | Key Tests |
|---|---|
| `RecommendationFeed` | Renders cards in priority order; empty state; filters by domain |
| `RecommendationCard` | All 4 R/E/C/I pillars rendered; approve/reject buttons present for authorized role |
| `ExplainabilityPanel` | Reason, Evidence, Confidence, Impact all visible; `<dl>` semantics |
| `ApprovalControls` | Click triggers mutation; confirmation dialog for critical; disabled for unauthorized role |
| `RoleSwitcher` | Changes role; triggers refetch; accessible select |
| `LanguageSelector` | Changes language; triggers re-render; RTL for Arabic |
| `ContextTimeline` | Renders events; updates on SSE; `aria-live` region |

### Golden File Tests

```typescript
// Deterministic reasoner always produces the same output for the same input.
// Golden file: tests/fixtures/golden-recommendations.json
describe('DeterministicReasoner golden file', () => {
  it('produces expected output for standard scenario', () => {
    const context = loadFixture('standard-match-day-context.json');
    const result = deterministicReasoner.run(context);
    expect(result).toMatchSnapshot(); // or toEqual(goldenFile)
  });
});
```

### Contract Tests (R/E/C/I Guarantee)

```typescript
// EVERY recommendation, regardless of source, must have all 4 explainability pillars.
describe('Recommendation R/E/C/I contract', () => {
  it('every recommendation has reason, evidence, confidence, expectedImpact', () => {
    const recs = generateTestRecommendations();
    for (const rec of recs) {
      expect(rec.reason).toBeTruthy();
      expect(rec.evidence.length).toBeGreaterThan(0);
      expect(rec.confidence).toBeGreaterThanOrEqual(0);
      expect(rec.confidence).toBeLessThanOrEqual(1);
      expect(rec.expectedImpact).toBeDefined();
      expect(rec.expectedImpact.description).toBeTruthy();
    }
  });
});
```

---

## Test Data Strategy

| Data Set | Location | Purpose |
|---|---|---|
| `standard-match-day-context.json` | `tests/fixtures/` | Full match-day scenario across all domains |
| `edge-case-events.json` | `tests/fixtures/` | Boundary conditions, missing fields, adversarial input |
| `golden-recommendations.json` | `tests/fixtures/` | Expected output from deterministic reasoner |
| `authorization-matrix.json` | `tests/fixtures/` | Role × endpoint × expected status code |

---

## Coverage Requirements

| Layer | Minimum Coverage | Rationale |
|---|---|---|
| Domain | 90% | Pure logic; no excuse for gaps |
| Application | 80% | Use case orchestration; critical paths |
| Infrastructure | 60% | Adapters; some covered by integration tests |
| Interface | 70% | Routes; covered by integration tests |
| Frontend components | 80% | UI correctness; accessibility |

---

## CI Integration

```yaml
# .github/workflows/ci.yml (test section)
- name: Backend Tests
  run: npm run test:api -- --coverage --reporter=verbose
  
- name: Frontend Tests
  run: npm run test:web -- --coverage --reporter=verbose

- name: Coverage Check
  run: |
    # Fail if domain coverage < 90%
    # Fail if application coverage < 80%
```

---

## Testing Definition of Done

- [ ] ≥ 80% backend test coverage (domain + application).
- [ ] All use cases have success + failure path tests.
- [ ] Golden file test passes for deterministic reasoner.
- [ ] R/E/C/I contract test passes.
- [ ] axe-core: 0 violations in frontend tests.
- [ ] Authorization matrix fully tested.
- [ ] No flaky tests in CI.

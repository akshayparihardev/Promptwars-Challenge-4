# 05 — Workflows

## Executive Summary

**WHY:** AI agents need exact behavioral contracts. This document defines every operational workflow as sequence/state diagrams.

---

## Workflow 1: Event Ingestion → Recommendation

### Sequence Diagram

```
Simulator/Client   API(/events)   IngestUseCase   Repo   Scheduler   Pipeline   Repo
     |                 |               |            |         |          |         |
     |  POST event     |               |            |         |          |         |
     |---------------->|               |            |         |          |         |
     |                 | validate(Zod) |            |         |          |         |
     |                 |-------------->|            |         |          |         |
     |                 |               | persist    |         |          |         |
     |                 |               |----------->|         |          |         |
     |  201 {eventId}  |<--------------|            |         |          |         |
     |<----------------|               |            |         |          |         |
     |                 |               |            | tick(15s)          |         |
     |                 |               |            |-------->| run cycle |         |
     |                 |               |            |         |--------->| persist |
     |                 |               |            |         |          |-------->|
     |     SSE: recommendation.created                         |         |         |
     |<-------------------------------------------------------|         |         |
```

---

## Workflow 2: Human Approval → Execution → Outcome Evaluation

### State Diagram (Recommendation — Extended with Memory)

```
        ┌─────────┐  approve   ┌──────────┐  execute   ┌──────────┐
        │proposed │──────────► │ approved │──────────► │ executed │
        └────┬────┘            └──────────┘            └─────┬────┘
             │ reject                                        │
             ▼                                               │ outcome measured
        ┌─────────┐                                          ▼
        │rejected │                                   ┌───────────────┐
        └─────────┘                                   │ Outcome       │
             ▲ expire (TTL 30m, if proposed)          │ Evaluation    │
        ┌─────────┐                                   └───────┬───────┘
        │expired  │                                           │
        └─────────┘                                           ▼
                                                      ┌───────────────┐
                                                      │ Operational   │
                                                      │ Memory Write  │
                                                      └───────┬───────┘
                                                              │
                                                              ▼
                                                      ┌───────────────┐
                                                      │ Live Stadium  │
                                                      │ State Update  │
                                                      └───────────────┘
```

### Sequence: Approval → Execution → Memory

```
Operator   API(/decisions)  ApproveUC  RecRepo  AuditRepo  ActionUC  EvalOutcomeUC  MemoryRepo
   |  POST approve   |         |         |         |          |            |            |
   |---------------->|         |         |         |          |            |            |
   |                 | authz   |         |         |          |            |            |
   |                 |-------->|         |         |          |            |            |
   |                 |         | load    |         |          |            |            |
   |                 |         |-------->|         |          |            |            |
   |                 |         | check status=proposed        |            |            |
   |                 |         | approve |         |          |            |            |
   |                 |         |-------->|         |          |            |            |
   |                 |         | audit   |         |          |            |            |
   |                 |         |--------------------->|       |            |            |
   |                 |         | execute              |       |            |            |
   |                 |         |----------------------------->|            |            |
   |                 |         |                              | measure    |            |
   |                 |         |                              |----------->|            |
   |                 |         |                              |            | compare    |
   |                 |         |                              |            | pred vs act|
   |                 |         |                              |            | store      |
   |                 |         |                              |            |----------->|
   |  200 approved   |<--------|         |         |          |            |            |
```

---

## Workflow 3: Multilingual Rendering

```
Fan client requests feed with ?lang=es
 → controller checks cache (rec.localizations[es])
 → if missing: LlmReasoner.localize(reason/title/impact/alternatives) → store → return
 → deterministic fallback: dictionary lookup, else original + [untranslated] flag
```

---

## Workflow 4: Reasoning Cycle (Scheduler Tick)

```
Every 15s (configurable via AEGIS_CYCLE_MS):
  1. Build Live Stadium State (events in last N minutes + derived metrics).
  2. If no new events since last cycle → skip (idempotency guard).
  3. Run ReasoningPipeline (9 steps: Detect → State → Risk → Predict → Alternatives → Validate → Score → Route).
  4. Deduplicate: skip if identical situation already has active proposed rec.
  5. Persist new recommendations (with alternatives + predictions + health score impact).
  6. Emit SSE events.
  7. Expire stale proposed recs (> configurable TTL).
  8. Compute & persist updated Operational Health Score snapshot.
```

---

## Workflow 5: Outcome Evaluation & Operational Memory

**WHY:** This closes the feedback loop. After execution, compare prediction vs. reality.

```
Triggered after ActionExecution completes:
  1. Load the original recommendation's prediction (predictedMetrics).
  2. Wait for next reasoning cycle to capture actual metrics from new events.
  3. Compare predicted vs. actual for each metric.
  4. Compute predictionAccuracy (0..1).
  5. Persist MemoryEntry { recommendationId, situationSignature,
                           predictedMetrics, actualMetrics, accuracy, domain }.
  6. Future reasoning cycles query OperationalMemory for similar situations
     (by signature prefix) to adjust confidence via memoryAdj factor.

Note: Step 2 uses a configurable evaluation delay (default: 1 reasoning cycle).
This is NOT real-time ML. It is a deterministic comparison.
```

---

## Workflow 6: Multi-Persona Event Cascade

**WHY:** A single operational event should trigger role-specific recommendations for every affected persona — demonstrating cross-domain intelligence.

### Example: Medical Incident Cascade

```
Event: Medical incident reported at Section 114 (severity: high)

Reasoning Pipeline detects and generates:

  ┌─ Security ────────── "Dispatch security to Section 114 for crowd control"
  │                      (targetRoles: [security])
  │
  ├─ Medical ─────────── "Deploy nearest medical team via Route B (fastest)"
  │                      (targetRoles: [medical])
  │
  ├─ Volunteer ───────── "Redirect volunteer V-23 to assist at Section 114"
  │                      (targetRoles: [volunteer])
  │
  ├─ Accessibility ──── "Clear accessible route near Section 114 for medical access"
  │                      (targetRoles: [accessibility_coordinator])
  │
  ├─ Fan (nearby) ──── "Safety notice: avoid Section 114 area, use Gate 9"
  │                      (targetRoles: [fan])
  │
  └─ Transport ──────── "Pre-position ambulance at Transport Hub East"
                         (targetRoles: [transportation_coordinator])

Each recommendation has its own R/E/C/I, alternatives, and predicted impact.
All share the same Situation but are routed to different roles.
The Organizer sees all of them in a unified cascade view.
```

### How This Works Architecturally

- The **Route to Roles** step (Step 8) in the pipeline generates one recommendation per target role.
- `targetRoles: Role[]` on a recommendation may contain multiple roles if the action applies to all.
- The Organizer persona always sees all recommendations (super-view).
- Each role sees only their relevant subset via the role-scoped query.

---

## Business Rules

- A recommendation **cannot** be executed unless `status === 'approved'`.
- Only roles in `targetRoles` (or Organizer) may approve/reject.
- Duplicate suppression: one active proposed rec per (situation signature + role).
- All state transitions write to the **audit log**.
- Outcome evaluation runs automatically after execution — no human trigger needed.
- Health Score is recomputed every reasoning cycle.

---

## Failure & Edge Cases

| Case | Behavior |
|---|---|
| LLM unavailable | Deterministic reasoner used; `source: deterministic` |
| Malformed event | 400 with Zod error detail; not persisted |
| Approve already-executed rec | 409 Conflict |
| Approve by wrong role | 403 Forbidden |
| SSE connection drop | Client reconnects + refetches feed |
| Outcome evaluation — no new events to compare | Skip evaluation; retry next cycle |
| Config file missing at boot | Fail fast with descriptive error |
| Health Score domain has zero events | Score = 100 (no issues detected) |

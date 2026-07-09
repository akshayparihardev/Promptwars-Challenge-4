# 09 — API Specification

## Executive Summary

**WHY:** Exact contracts remove ambiguity for frontend + AI agents. REST, JSON, versioned, Zod-validated.

**Base URL:** `/api/v1`. All requests/responses `application/json` (except SSE). All bodies validated with Zod. Errors normalized.

---

## Conventions

- **Timestamps:** ISO 8601 UTC.
- **Errors:** `{ "error": { "code": string, "message": string, "details"?: unknown } }`.
- **Auth:** header `X-Role: <role>` (simplified role simulation for hackathon; see Security doc for hardening path).

---

## Endpoints

### POST `/api/v1/events`

Ingest an operational event.

**Request:**

```json
{
  "domain": "crowd",
  "zone": "gate-7",
  "type": "density_reading",
  "severity": "high",
  "payload": { "density": 0.91, "count": 4200 }
}
```

**Response 201:**

```json
{ "eventId": "evt_abc123", "createdAt": "2026-06-15T18:22:03Z" }
```

**Errors:** `400 VALIDATION_ERROR`.

---

### GET `/api/v1/state?windowMinutes=30`

Return current Live Stadium State.

**Response 200:**

```json
{
  "windowMinutes": 30,
  "events": [ /* OperationalEvent[] newest first */ ],
  "metrics": {
    "zoneDensity": { "gate-7": 0.91, "concourse-north": 0.62 },
    "activeIncidents": 2,
    "energyLoadPct": 0.88
  },
  "healthScore": {
    "domains": { "crowd": 72, "medical": 95, "transport": 74, "accessibility": 91, "sustainability": 88, "security": 90, "navigation": 85, "operations": 92, "multilingual": 98 },
    "overall": 86,
    "trend": "stable",
    "computedAt": "2026-06-15T18:22:00Z"
  }
}
```

---

### POST `/api/v1/reasoning/cycle`

Manually trigger a reasoning cycle (also runs on scheduler).

**Response 200:**

```json
{ "generated": 3, "source": "deterministic", "durationMs": 42 }
```

---

### GET `/api/v1/recommendations`

**Query params:** `role` (required), `domain?`, `status?` (default `proposed`), `lang?` (default `en`).

**Response 200:**

```json
[
  {
    "id": "rec_001",
    "domain": "crowd",
    "targetRoles": ["security", "venue_operations"],
    "title": "Reroute inbound crowd from Gate 7 to Gate 9",
    "recommendedAction": "reroute_crowd",
    "reason": "Gate 7 density at 0.91 while Gate 9 is at 0.34; ingress surge detected.",
    "evidence": [
      { "eventId": "evt_abc123", "summary": "Gate 7 density 0.91" },
      { "eventId": "evt_abc124", "summary": "Ingress rate 2.3x baseline" }
    ],
    "confidence": 0.86,
    "expectedImpact": {
      "description": "Reduce Gate 7 wait time and prevent crush risk",
      "metric": "gate_wait_time",
      "direction": "decrease",
      "estimatedMagnitude": "~30%"
    },
    "alternatives": [
      {
        "option": "Close Gate 7 temporarily and redirect all traffic to Gates 9 and 12",
        "pros": "Immediate density relief at Gate 7",
        "cons": "May cause temporary confusion; Gates 9/12 capacity must be verified",
        "confidence": 0.81,
        "predictedHealthImpact": 8
      },
      {
        "option": "Deploy additional volunteers at Gate 7 for crowd management",
        "pros": "No rerouting needed; less disruptive",
        "cons": "Slower impact; may not prevent crush risk in time",
        "confidence": 0.62,
        "predictedHealthImpact": 4
      }
    ],
    "prediction": {
      "noActionOutcome": "Gate 7 density projected to reach 0.97 within 10 minutes, triggering crush risk threshold",
      "predictedMetrics": { "gate7_density_after": 0.65, "gate9_density_after": 0.52 },
      "healthScoreImpact": {
        "current": 86,
        "projected": 91,
        "delta": 5
      }
    },
    "priority": 0.79,
    "status": "proposed",
    "source": "deterministic",
    "createdAt": "2026-06-15T18:22:10Z"
  }
]
```

**Security:** results scoped to `role` (+ Organizer sees all).

---

### POST `/api/v1/decisions`

Approve or reject a recommendation.

**Request:**

```json
{ "recommendationId": "rec_001", "outcome": "approved", "note": "Confirmed via CCTV" }
```

**Header:** `X-Role: security`.

**Response 200:**

```json
{
  "recommendationId": "rec_001",
  "status": "approved",
  "decisionId": "dec_001",
  "actionId": "act_001"
}
```

**Errors:** `403 FORBIDDEN` (role not in targetRoles), `409 CONFLICT` (not proposed), `404 NOT_FOUND`.

---

### GET `/api/v1/audit`

**Query:** `entityType?`, `entityId?`, `limit?` (default 100).

**Response 200:** `AuditLog[]` newest first. (Organizer role recommended.)

---

### GET `/api/v1/stream` (SSE)

Server-Sent Events. Event types:

```
event: recommendation.created   data: { ...Recommendation }
event: event.ingested           data: { ...OperationalEvent }
event: recommendation.updated   data: { id, status }
event: cycle.completed          data: { generated, source, healthScore }
event: health.updated           data: { ...HealthScore }
event: memory.recorded          data: { recommendationId, predictionAccuracy }
```

**A11y note:** frontend maps `recommendation.created` (critical) to an `aria-live` announcement; `health.updated` updates the dashboard.

---

### GET `/api/v1/health-score`

Return current Operational Health Score.

**Response 200:**

```json
{
  "domains": {
    "crowd": 72,
    "medical": 95,
    "transport": 74,
    "accessibility": 91,
    "sustainability": 88,
    "security": 90,
    "navigation": 85,
    "operations": 92,
    "multilingual": 98
  },
  "overall": 86,
  "trend": "stable",
  "computedAt": "2026-06-15T18:22:00Z"
}
```

---

### GET `/api/v1/memory`

Return Operational Memory (prediction accuracy history). Organizer role recommended.

**Query:** `domain?`, `limit?` (default 50).

**Response 200:**

```json
[
  {
    "id": "mem_001",
    "recommendationId": "rec_001",
    "domain": "crowd",
    "predictedMetrics": { "gate7_density_after": 0.65 },
    "actualMetrics": { "gate7_density_after": 0.68 },
    "predictionAccuracy": 0.95,
    "createdAt": "2026-06-15T18:45:00Z"
  }
]
```

---

## OpenAPI

- A generated `openapi.yaml` is committed under `apps/api/openapi.yaml` (from Zod → OpenAPI via `@asteasolutions/zod-to-openapi`).

---

## Rate Limiting

- Fastify rate-limit plugin: 100 req/min per IP on write endpoints.

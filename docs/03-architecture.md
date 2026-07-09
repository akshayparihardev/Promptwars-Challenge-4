# 03 — System Architecture

## Executive Summary

**WHY:** A clear, simple architecture that AI agents can implement without inventing structure.

AEGIS is a **modular monolith**: a single deployable application with cleanly separated layers (Clean Architecture). One backend (Node.js + TypeScript + Fastify), one frontend (React + TypeScript + Vite), one database (SQLite via Prisma), one LLM adapter (provider-agnostic).

---

## Architectural Style: Clean Architecture (Layered)

**WHY:** Testability, replaceability of the LLM provider, and clarity for AI agents. Dependencies point inward.

```
+---------------------------------------------------------------+
|                     PRESENTATION (Web UI)                     |
|            React + TypeScript + Vite + Tailwind               |
+----------------------------+----------------------------------+
                             | HTTP/JSON (REST)
+----------------------------v----------------------------------+
|                    INTERFACE / ADAPTERS                        |
|      Fastify routes • Controllers • DTO validation (Zod)      |
+----------------------------+----------------------------------+
                             |
+----------------------------v----------------------------------+
|                      APPLICATION LAYER                         |
|   Use Cases (services): IngestEvent, RunReasoningCycle,        |
|   GenerateRecommendations, ApproveDecision, ExecuteAction     |
+----------------------------+----------------------------------+
                             |
+----------------------------v----------------------------------+
|                       DOMAIN LAYER                             |
|   Entities: OperationalEvent, LiveStadiumState, Recommendation,|
|   Decision, Action, MemoryEntry • Rules • Scoring • Health    |
+----------------------------+----------------------------------+
                             |
+----------------------------v----------------------------------+
|                    INFRASTRUCTURE LAYER                        |
|  Prisma/SQLite Repo • LLM Adapter • Clock • Logger • Config   |
+---------------------------------------------------------------+
```

**Dependency rule:** Domain depends on nothing. Application depends on Domain (+ ports). Infrastructure implements ports. Interface calls Application.

---

## The Core Loop (Canonical Diagram)

```
   [Simulated / Live Operational Events]
                 |
                 v
     +------------------------+
     |  Ingestion Service     |  validate + persist
     +-----------+------------+
                 |
                 v
     +-----------------------------+
     |  Live Stadium State Builder |  rolling window + metrics
     +-----------+-----------------+  + health score computation
                 |
                 v
     +-----------------------------+
     |  Reasoning Pipeline (9 steps)|
     |  Detect → State → Risk →    |
     |  Predict → Alternatives →   |
     |  Validate → Score → Route   |
     +-----------+-----------------+
                 |
                 v
     +-----------------------------+
     |  Recommendations            |  R/E/C/I + alternatives
     |  (explainable, with         |  + predictions + health
     |   predicted impact)         |  score delta
     +-----------+-----------------+
                 |
                 v
     +------------------------+
     |  Human Approval        |  approve / reject / modify
     +-----------+------------+
                 |
        approved v
     +------------------------+
     |  Action Execution      |  (simulated effect)
     +-----------+------------+
                 |
                 v
     +-----------------------------+
     |  Outcome Evaluation         |  predicted vs actual
     +-----------+-----------------+
                 |
                 v
     +-----------------------------+
     |  Operational Memory         |  accuracy stored;
     |  + State Update             |  future confidence adjusted
     +-----------+-----------------+
                 |
                 +---> loop
```

---

## Component Diagram

```
FRONTEND (React SPA)
 ├── RecommendationFeed
 ├── ExplainabilityPanel
 ├── ApprovalControls
 ├── RoleSwitcher (persona)
 ├── ContextTimeline
 ├── DomainFilterBar
 └── LanguageSelector
        │ REST
        ▼
BACKEND (Fastify Monolith)
 ├── /api/events          → IngestEventUseCase
 ├── /api/state           → GetLiveStadiumStateUseCase
 ├── /api/reasoning/cycle → RunReasoningCycleUseCase
 ├── /api/recommendations → ListRecommendationsUseCase
 ├── /api/decisions       → Approve/RejectDecisionUseCase
 ├── /api/actions         → ExecuteActionUseCase
 ├── /api/health-score    → GetHealthScoreUseCase
 ├── /api/memory          → GetOperationalMemoryUseCase
 └── /api/audit           → ListAuditUseCase
        │
        ▼
DOMAIN CORE
 ├── entities/ (Event, State, Recommendation, Memory, HealthScore)
 ├── rules/ (deterministic detectors — config-driven thresholds)
 ├── scoring/ (confidence, priority, health score)
 └── ports/ (LlmReasoner, Repository interfaces)
        │
        ▼
INFRASTRUCTURE
 ├── prisma repositories
 ├── llm/ (OpenAI/Anthropic adapter + deterministic fallback)
 ├── config/ (detection-rules, scoring, health-score, prompts, venue-model)
 ├── scheduler (reasoning tick)
 └── seed/ (simulated event stream)
```

---

## Real-Time Strategy (Without Forbidden Tech)

**WHY:** We need "live" feel without Kafka/Redis/MQTT.

- **Reasoning cycle** runs on an in-process interval (`setInterval`, default 15s) — a deterministic "tick".
- **Frontend** uses **Server-Sent Events (SSE)** over a single HTTP connection for push, OR polling fallback. SSE is native, dependency-free, and simpler than WebSockets.
- **Event simulation** feeds new operational events from a seed script on a timer to emulate a live venue.

---

## Folder Structure (Monorepo, npm workspaces)

```
/aegis
├── package.json                # workspaces: apps/
├── tsconfig.base.json
├── .github/workflows/ci.yml
├── docs/                       # all 16 docs
├── apps/
│   ├── api/                    # backend
│   │   ├── src/
│   │   │   ├── domain/
│   │   │   │   ├── entities/   # Event, State, Recommendation, Memory, HealthScore
│   │   │   │   ├── rules/      # detectors (thresholds from config)
│   │   │   │   ├── scoring/    # confidence, priority, health score
│   │   │   │   └── ports/      # LlmReasoner, repositories
│   │   │   ├── application/    # use cases
│   │   │   ├── infrastructure/
│   │   │   │   ├── db/         # prisma client + repos
│   │   │   │   ├── llm/        # adapter + fallback
│   │   │   │   ├── config/     # config loader + validators
│   │   │   │   ├── scheduler/
│   │   │   │   └── seed/
│   │   │   ├── interface/
│   │   │   │   ├── routes/
│   │   │   │   ├── controllers/
│   │   │   │   ├── dto/        # zod schemas
│   │   │   │   └── sse/
│   │   │   ├── config/         # Zod schema for env validation
│   │   │   └── main.ts
│   │   ├── config/             # externalized config files (NO hardcoding)
│   │   │   ├── detection-rules.json
│   │   │   ├── scoring.json
│   │   │   ├── health-score.json
│   │   │   ├── action-allow-list.json
│   │   │   ├── venue-model.json
│   │   │   └── prompts/
│   │   │       ├── correlate.txt
│   │   │       ├── predict-impact.txt
│   │   │       ├── generate-alternatives.txt
│   │   │       └── localize.txt
│   │   ├── prisma/schema.prisma
│   │   ├── tests/
│   │   └── package.json
│   └── web/                    # frontend
│       ├── src/
│       │   ├── components/
│       │   ├── features/
│       │   ├── hooks/
│       │   ├── api/
│       │   ├── i18n/
│       │   ├── state/
│       │   ├── styles/
│       │   └── main.tsx
│       ├── tests/
│       └── package.json
└── packages/
    └── shared/                 # shared types & zod schemas
        └── src/
```

---

## Coding Standards (Summary — full in doc 15)

- TypeScript strict mode everywhere.
- ESLint + Prettier enforced in CI.
- No `any` (lint error). Use `unknown` + narrowing.
- Functions ≤ 40 lines; files ≤ 300 lines (guideline).
- Pure domain functions; side effects only in infrastructure.

## Naming Conventions

- Files: `kebab-case.ts`. React components: `PascalCase.tsx`.
- Classes/Types: `PascalCase`. Functions/vars: `camelCase`. Constants: `UPPER_SNAKE`.
- Use cases: `VerbNounUseCase` (e.g., `IngestEventUseCase`).
- DTOs: `NameRequestDto` / `NameResponseDto`.

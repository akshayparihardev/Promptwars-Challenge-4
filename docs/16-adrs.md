# 16 — Architecture Decision Records (ADRs)

## Executive Summary

**WHY:** ADRs capture the reasoning behind critical technical decisions. They prevent re-litigation, document trade-offs, and guide AI agents away from over-engineering.

---

## ADR-001: Modular Monolith over Microservices

### Status: Accepted

### Context
The AEGIS system could be built as microservices (separate services for ingestion, reasoning, recommendations, etc.) or as a monolith.

### Decision
**Modular monolith** — single deployable, cleanly layered internally.

### Rationale
- **One-week timeline:** Microservices add deployment, networking, and debugging overhead.
- **Forbidden tech:** Kafka, Redis, K8s are explicitly prohibited.
- **Single SQLite DB:** No distributed data story to manage.
- **Testability:** Clean Architecture achieves module isolation without network boundaries.
- **Deployability:** Single process, single Dockerfile, single platform.

### Consequences
- All modules share a process; a crash affects everything. **Mitigation:** Process supervisor (PM2 or platform restart).
- Cannot scale modules independently. **Acceptable:** Tournament-scale is out of scope.

---

## ADR-002: SQLite over PostgreSQL / MySQL

### Status: Accepted

### Context
Need a persistent relational database. Options: PostgreSQL, MySQL, SQLite.

### Decision
**SQLite** via Prisma.

### Rationale
- **Zero ops:** No database server to install, configure, or manage.
- **< 10MB repo:** No Docker images, no database dumps.
- **Evaluator-friendly:** `npm run db:migrate` creates the database file.
- **Sufficient for scope:** Single-writer, moderate read volume, no concurrent multi-server access.
- **Prisma abstraction:** Switching to PostgreSQL later requires only changing `datasource` in schema.

### Consequences
- No concurrent write scaling. **Acceptable:** Single process handles all writes sequentially.
- No native JSON column type. **Mitigation:** JSON stored as text, validated with Zod at boundary.
- No full-text search. **Acceptable:** Not a requirement.

---

## ADR-003: Deterministic + GenAI Hybrid Reasoning

### Status: Accepted

### Context
The brief requires "GenAI-powered" but the system must work without an API key and must be explainable.

### Decision
**Hybrid pipeline:** deterministic detectors + GenAI correlation/explanation + deterministic scoring/validation.

### Rationale
- **Deterministic detectors** are fast, testable, and reliable for threshold-based alerts.
- **GenAI** adds genuine value for cross-domain synthesis and natural-language explanation.
- **Deterministic validation** ensures GenAI output is safe (no hallucinated evidence, allowed actions only).
- **Deterministic fallback** guarantees functionality with no API key.

### Consequences
- Maintaining two reasoning paths (GenAI + deterministic). **Mitigation:** Shared interface (`LlmReasoner` port); both implement same contract.
- Deterministic reasoner produces simpler correlations. **Acceptable:** Better than no correlations.

---

## ADR-004: Server-Sent Events over WebSockets

### Status: Accepted

### Context
Need real-time updates from backend to frontend. Options: WebSockets, SSE, polling.

### Decision
**Server-Sent Events (SSE)** with polling fallback.

### Rationale
- **Unidirectional:** Backend pushes to frontend only — SSE's model.
- **Native:** Built into browsers and Fastify; no additional library.
- **HTTP-compatible:** Works through proxies, load balancers, and platforms without WebSocket support.
- **Simpler:** No connection upgrade negotiation, no ping/pong.
- **Fallback:** Frontend falls back to polling if SSE fails (reconnection built into EventSource API).

### Consequences
- No client-to-server push over SSE. **Mitigation:** REST endpoints handle all client actions.
- Connection limit per domain (6 in HTTP/1.1). **Acceptable:** Single SSE connection.

---

## ADR-005: No Redux — TanStack Query + React Context

### Status: Accepted

### Context
Frontend state management approach. Options: Redux, Zustand, Jotai, TanStack Query + Context.

### Decision
**TanStack Query** for server state, **React Context** for UI state.

### Rationale
- **Server state dominance:** Most state is fetched from the API (recommendations, context, audit). TanStack Query handles caching, refetching, optimistic updates natively.
- **Minimal UI state:** Only role, language, and filters — React Context is sufficient.
- **No Redux boilerplate:** Avoids actions, reducers, middleware, and store setup for what amounts to ~5 state values.
- **SSE integration:** TanStack Query's `queryClient.invalidateQueries` triggered on SSE events.

### Consequences
- No centralized devtools for all state. **Mitigation:** TanStack Query devtools for server state; React DevTools for context.
- Complex state interactions would require refactoring. **Acceptable:** Current scope does not require complex state.

---

## ADR-006: Zod for Validation Everywhere

### Status: Accepted

### Context
Need input validation, type generation, and schema documentation.

### Decision
**Zod** as the single validation/schema library across backend, frontend, and shared packages.

### Rationale
- **Single source of truth:** Zod schema → TypeScript type → OpenAPI spec → runtime validation.
- **Shared schemas:** `packages/shared` exports Zod schemas used by both backend (request validation) and frontend (response validation).
- **LLM output validation:** GenAI output parsed and validated with Zod — malformed output rejected.
- **Lightweight:** ~50KB; no heavy dependency.

### Consequences
- Runtime overhead for validation. **Acceptable:** Validation is fast; correctness trumps nanoseconds.
- Zod is a runtime dependency. **Acceptable:** It provides genuine value across the stack.

---

## ADR-007: No ORM Query Builder — Prisma Client Only

### Status: Accepted

### Context
Database access approach. Options: Raw SQL, Knex, Prisma, Drizzle.

### Decision
**Prisma Client** (generated, type-safe).

### Rationale
- **Type safety:** Generated client catches query errors at compile time.
- **Migration management:** Prisma Migrate handles schema evolution.
- **SQLite support:** First-class SQLite support.
- **Evaluator experience:** `npx prisma migrate dev` is well-documented and predictable.

### Consequences
- Some complex queries may require `$queryRaw`. **Acceptable:** AEGIS queries are straightforward.
- Prisma generates a large client. **Mitigation:** Not committed to repo; generated at install.

---

## ADR-008: Role Simulation via Header (X-Role)

### Status: Accepted

### Context
Full authentication (OAuth, JWT, sessions) is out of scope for a one-week hackathon, but role-based access control is critical.

### Decision
**Simplified role via `X-Role` header.** The frontend sends the selected role; the backend validates and enforces RBAC.

### Rationale
- **Demo-friendly:** Role switching is instant via UI dropdown.
- **RBAC is real:** Server-side authorization enforced regardless of how the role is set.
- **Documented hardening path:** Security doc (10) specifies the production path (OAuth + JWT + MFA).

### Consequences
- No real authentication; any client can claim any role. **Acceptable for hackathon.** The important thing is that the RBAC logic is correct and tested.
- Must be very clearly documented as "hackathon simplification, not production pattern."

---

## DO NOT BUILD List

**WHY:** Preventing over-engineering is as important as building the right things.

| Forbidden Item | Why Not |
|---|---|
| Kafka / RabbitMQ / MQTT | Prohibited by brief; SSE + setInterval sufficient |
| Redis | Prohibited; SQLite sufficient for caching |
| Kubernetes / Docker Compose (multi-service) | Prohibited; monolith deploys as single process |
| Microservices | ADR-001; monolith is correct choice |
| GraphQL | REST is simpler, sufficient, and more evaluator-friendly |
| WebSockets | ADR-004; SSE is simpler and sufficient |
| Redux / MobX | ADR-005; TanStack Query + Context sufficient |
| Custom ORM | ADR-007; Prisma handles everything needed |
| ML model training | Out of scope; AEGIS uses LLM APIs |
| Real IoT integration | Simulated events; real sensors not available |
| Native mobile apps | Responsive web only |
| Payment / ticketing system | Explicitly out of scope |
| Chat interface / chatbot | AEGIS is proactive, not conversational |
| Map / geospatial rendering | Not required; zone-based model sufficient |
| Custom auth system | ADR-008; header-based role sufficient |
| Monorepo tools (Nx, Turborepo) | npm workspaces sufficient for 2 apps + 1 package |

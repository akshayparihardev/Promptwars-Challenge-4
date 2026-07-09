# 10 — Security Strategy

## Executive Summary

**WHY:** Security is a scored criterion and non-negotiable for operational systems. This document defines security posture, threat model, and implementation requirements for AEGIS.

---

## Threat Model

### Assets to Protect

| Asset | Sensitivity | Justification |
|---|---|---|
| Operational Events | Medium | Real-time venue state — operational security |
| Recommendations | Medium | AI-generated actions with potential safety impact |
| Decisions & Audit Log | High | Accountability chain; immutable record |
| LLM API Keys | Critical | Financial and operational exposure |
| User Role Context | Medium | Authorization boundary |

### Threat Actors

| Actor | Capability | Motivation |
|---|---|---|
| Curious fan | Low | Access information beyond their role |
| Malicious insider | Medium | Manipulate recommendations or approvals |
| External attacker | Medium | Disrupt operations, data exfiltration |
| LLM prompt injection | Medium | Manipulate AI reasoning via crafted events |

---

## Security Architecture

### Authentication & Authorization

**Hackathon scope:** Role-based via `X-Role` header (simplified). No full auth system.

**Hardening path (documented for production):**
1. OAuth 2.0 / OpenID Connect integration.
2. JWT tokens with role claims.
3. Session management with secure, httpOnly cookies.
4. MFA for operational roles.

### Current Implementation

```typescript
// Middleware: extractRole
// 1. Read X-Role header
// 2. Validate against Role enum (Zod)
// 3. Attach to request context
// 4. If missing/invalid → 401 Unauthorized

// Middleware: authorizeRoles(...allowedRoles)
// 1. Check req.role against allowedRoles
// 2. If not authorized → 403 Forbidden
// 3. Log authorization attempt (pass/fail)
```

### Role-Based Access Control Matrix

| Endpoint | fan | volunteer | security | medical | organizer | venue_ops | accessibility | transport |
|---|---|---|---|---|---|---|---|---|
| GET /recommendations | ✓ (own) | ✓ (own) | ✓ (own) | ✓ (own) | ✓ (all) | ✓ (own) | ✓ (own) | ✓ (own) |
| POST /decisions | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| POST /events | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| GET /audit | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ |
| POST /reasoning/cycle | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ |
| GET /stream (SSE) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

---

## Input Validation & Sanitization

### Principles

1. **Validate everything at the boundary** — Zod schemas on every request body, query param, and path param.
2. **Sanitize free-text fields** — strip HTML/script tags from event payloads and decision notes.
3. **Enforce enums** — domain, severity, role, status are strict enums; reject unknown values.
4. **Limit payload sizes** — Fastify body limit: 1MB (default, sufficient).

### LLM-Specific Input Security

```
CRITICAL: Events ingested by the system may contain adversarial text
designed to manipulate LLM reasoning (prompt injection).

Mitigations:
1. Event payloads are NEVER interpolated raw into LLM prompts.
2. Events are summarized via deterministic templates before LLM input.
3. LLM output is schema-validated (Zod) — unexpected fields rejected.
4. Evidence IDs are cross-referenced against real events.
5. Confidence scores are clamped by deterministic bounds.
```

---

## Data Protection

### Secrets Management

- **No secrets in code or repo.** `.env` files in `.gitignore`.
- **API keys** via environment variables only.
- **Documented** `.env.example` with placeholder values.
- **Boot validation:** app refuses to start with `openai`/`anthropic` provider and missing key (fail-fast).

### Data at Rest

- SQLite file stored locally; no encryption at rest (hackathon scope).
- **Production path:** encrypted SQLite via SQLCipher or move to managed DB.

### Data in Transit

- HTTPS enforced in production (reverse proxy / platform).
- Development: HTTP acceptable.

---

## Logging & Monitoring Security

### What We Log

- Every API request (method, path, role, status code, duration).
- Every reasoning cycle (event count, recommendation count, source, duration).
- Every authorization decision (pass/fail, role, endpoint).
- Every state transition (recommendation status changes).

### What We Never Log

- LLM API keys or tokens.
- Full LLM prompts/responses in production (configurable for debug).
- PII (fan names, personal identifiers).
- Raw passwords or credentials.

---

## Security Headers

```typescript
// Fastify helmet plugin configuration
{
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],  // Tailwind requires
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
    }
  },
  crossOriginEmbedderPolicy: false,  // SSE compatibility
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}
```

---

## Dependency Security

- `npm audit` run in CI — zero critical/high vulnerabilities.
- Minimal dependency tree (see Architecture doc constraints).
- Lockfile (`package-lock.json`) committed.
- No `eval()`, `Function()`, or dynamic code execution.

---

## Security Testing

| Test | Tool | Frequency |
|---|---|---|
| Input validation | Vitest unit tests | Every commit (CI) |
| Authorization matrix | Vitest integration tests | Every commit (CI) |
| Dependency audit | `npm audit` | Every commit (CI) |
| Security headers | Helmet defaults + manual check | Pre-submission |
| Prompt injection | Manual adversarial event test cases | Pre-submission |

---

## Security Definition of Done

- [ ] All endpoints validate input with Zod.
- [ ] Authorization enforced server-side (RBAC matrix tested).
- [ ] No secrets in codebase; `.env.example` documented.
- [ ] `npm audit` clean (0 critical/high).
- [ ] LLM input sanitized; output validated.
- [ ] Security headers configured.
- [ ] Audit log captures all state transitions.

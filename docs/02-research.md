# 02 — Research & Domain Analysis

## Executive Summary

**WHY:** Grounding design decisions in domain reality prevents building the wrong thing well.

---

## The Fragmentation Problem — Evidence

**WHY this matters:** We must prove the problem is real to justify the architecture.

Large stadium operations (65,000–90,000 capacity World Cup venues) coordinate:

- **Ingress/egress flows** across 10–40 gates.
- **Concourse & concession congestion.**
- **Medical & security incident response.**
- **Transport hubs** (rail, shuttle, rideshare, parking).
- **Accessibility services** (wheelchair routes, assistance requests, sensory zones).
- **Utilities** (energy, water, waste) for sustainability targets.

Each domain traditionally runs on its own tooling and command channel. The **correlation gap** — e.g., a gate closure (security) causing a transport hub surge (transportation) that overwhelms an accessible route (accessibility) — is where incidents escalate. **AEGIS targets exactly this gap.**

---

## Why GenAI (and Where NOT)

**WHY:** Overusing GenAI adds cost, latency, and non-determinism. Underusing it misses the brief.

| Task | Approach | Rationale |
|---|---|---|
| Threshold breach detection (e.g., density > X) | **Deterministic rules** | Fast, cheap, testable, no hallucination risk |
| Cross-domain situation synthesis | **GenAI reasoning** | Correlation across heterogeneous signals is where LLMs excel |
| Explanation generation (Reason/Impact prose) | **GenAI** | Natural-language justification is a genuine LLM strength |
| Multilingual rendering | **GenAI** | Context-aware translation beats static dictionaries |
| Confidence scoring | **Hybrid** | Deterministic base + GenAI adjustment, clamped |
| Priority ordering | **Deterministic** | Severity × recency × domain-weight; must be predictable |

> **Principle:** Deterministic guardrails wrap GenAI reasoning. GenAI proposes; deterministic code validates, scores, and orders.

---

## Competitive / Prior-Art Scan (Conceptual)

- **Traditional VOC (Venue Operations Center) dashboards:** show data, don't reason. AEGIS reasons.
- **Generic LLM chatbots:** reactive, no operational context, no approval loop. AEGIS is proactive & governed.
- **Rules-only alerting systems:** brittle, no cross-domain synthesis, no explanation. AEGIS fuses rules + reasoning.

**AEGIS differentiator:** proactive cross-domain reasoning with mandatory explainability and human-in-the-loop governance.

---

## Constraints Analysis

| Constraint | Implication |
|---|---|
| One week build | Monolith, SQLite, single LLM provider, simulated stream |
| < 10MB repo | No committed binaries/models; seed data as JSON; no node_modules committed |
| Single branch | Trunk-based dev; strict PR discipline moot but keep atomic commits |
| One submission | Robust CI + comprehensive tests before final push |
| Public repo | No secrets committed; env-based config; documented setup |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| LLM hallucination in recommendations | Med | High | Deterministic validation layer; evidence must cite real events; schema-constrained output |
| LLM latency degrades UX | Med | Med | Async job queue (in-DB), optimistic UI, deterministic fallback recs |
| No API key at eval time | Med | High | Deterministic reasoning fallback + recorded/mock LLM responses |
| Over-engineering | High | High | Enforced "DO NOT BUILD" list in ADRs |
| Accessibility gaps | Med | High | axe-core in CI; manual keyboard/SR audit checklist |

---

## Key Design Insight

> The **Live Stadium State** is the product's moat. The AI is only as good as the state it builds. Therefore the schema and ingestion of operational events are prioritized equally with the reasoning layer.

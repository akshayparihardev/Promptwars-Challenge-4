# 01 — Product Definition

## Executive Summary

**WHY this document exists:** AI coding agents and human reviewers must share a single, unambiguous understanding of what AEGIS is before *how* it is built. This document is the source of truth for product intent.

AEGIS is a **GenAI-powered Operational Intelligence Platform** for large-scale stadium operations during the **FIFA World Cup 2026**. It is not a chatbot, dashboard, map, or ticketing app. AEGIS continuously ingests structured operational events from a venue, builds a **Live Stadium State**, applies **Generative AI reasoning** over that state, and proactively emits **explainable, role-specific recommendations** that a human operator can approve or reject. Approved recommendations become executed actions whose outcomes are measured against predictions, feeding back into the Live Stadium State and building **Operational Memory** that improves future recommendations — closing the loop.

The defining characteristic of AEGIS is **proactive, explainable, human-in-the-loop reasoning**. The AI does not wait to be asked. It watches the venue's operational state and surfaces the next best action with a **Reason, Evidence, Confidence, and Expected Impact** attached to every recommendation.

---

## Problem Statement Analysis

**WHY:** The official brief warns against misinterpretation. We anchor the design in the actual problem.

### The Real Problem

**Fragmented operational decision-making during a large international sporting event.**

During a World Cup match, dozens of independent operational signals arrive simultaneously — gate congestion, medical incidents, transport delays, weather shifts, accessibility bottlenecks, energy spikes. Today these signals live in separate systems and separate heads. No single actor sees the whole picture, correlations are missed, and decisions are slow, inconsistent, and untraceable.

### What "Solving It" Means

A platform that:

1. **Unifies** disparate operational signals into a single evolving **Live Stadium State**.
2. **Reasons** across that state using GenAI to detect situations a single-domain view would miss.
3. **Predicts** future impact and generates alternatives, not just single actions.
4. **Recommends** the next best action, per role, with full explainability.
5. **Keeps humans in control** — AI proposes, humans dispose.
6. **Learns** from outcomes — measures prediction accuracy, stores results in **Operational Memory**, and improves future confidence scoring.
7. **Quantifies** operational health via a continuously computed **Operational Health Score** (0–100) across all domains.

### Mapping to Official Requirements

| Requirement | How AEGIS Addresses It |
|---|---|
| Navigation | Reasoning over crowd density + gate state → reroute recommendations |
| Crowd Management | Congestion signals correlated across zones → proactive flow control |
| Accessibility | Accessibility events prioritized in reasoning; recommendations tagged for Accessibility Coordinator |
| Transportation | Transport delay signals fused with egress predictions |
| Sustainability | Energy/waste signals → optimization recommendations |
| Multilingual Assistance | Recommendations & fan-facing messages localized via GenAI |
| Operational Intelligence | The core: Live Stadium State + reasoning + Operational Health Score |
| Real-Time Decision Support | The recommendation → approval → execution → outcome evaluation loop |

---

## Vision

> To make every operational decision during the world's largest sporting event **fast, correlated, explainable, and human-controlled**.

## Mission

> Build a lean, production-quality platform that transforms fragmented live stadium signals into proactive, explainable, role-specific recommendations — implementable in one week, extensible for a real tournament.

---

## Product Principles (Non-Negotiable)

1. **Every recommendation includes Reason, Evidence, Confidence, Expected Impact.**
2. **AI recommends; humans approve.** No autonomous execution.
3. **Explainability over black-box.** If we cannot explain it, we do not show it.
4. **Deterministic where possible, GenAI where reasoning adds value.**
5. **Accessibility is a first-class domain**, not an afterthought.
6. **Auditability:** every recommendation, decision, and execution is logged immutably.

---

## Personas & Their Jobs-to-be-Done

| Persona | Primary Job | Key Recommendation Types |
|---|---|---|
| **Fan** | Get where I need safely & informed | Navigation reroute, multilingual alerts (receive only) |
| **Volunteer** | Execute assigned tasks efficiently | Redeployment, crowd guidance tasks |
| **Security** | Prevent & respond to incidents | Zone lockdown, resource dispatch |
| **Medical** | Reach & treat incidents fast | Fastest medical route, resource pre-positioning |
| **Organizer** | Keep the tournament running | Cross-domain situation summaries, escalations |
| **Venue Operations** | Keep the venue functioning | Gate control, energy optimization |
| **Accessibility Coordinator** | Ensure equitable access | Accessible route provisioning, priority assistance |
| **Transportation Coordinator** | Manage arrivals/egress | Egress staggering, shuttle dispatch |

---

## Feature Catalog

Each feature answers: *Why does this exist? / Who benefits? / Which requirement? / Which evaluation criterion?*

### F1 — Live Stadium State Engine

- **Why:** Fragmentation is the root problem; a unified, continuously updated state is the cure.
- **Who:** All operational personas.
- **Requirement:** Operational Intelligence.
- **Criterion:** Problem Statement Alignment (highest).

### F2 — Proactive Recommendation Feed

- **Why:** AI must recommend, not wait.
- **Who:** All operational personas.
- **Requirement:** Real-Time Decision Support.
- **Criterion:** Problem Statement Alignment.

### F3 — Explainability Panel (Reason / Evidence / Confidence / Impact)

- **Why:** Core principle; trust requires explanation.
- **Who:** All decision-makers.
- **Requirement:** Decision Support.
- **Criterion:** Problem Statement Alignment, Code Quality.

### F4 — Human Approval Workflow

- **Why:** Humans remain in control.
- **Who:** Security, Medical, Organizer, Venue Ops, Coordinators.
- **Requirement:** Decision Support.
- **Criterion:** Security, Alignment.

### F5 — Role-Scoped Views

- **Why:** Each role needs only its relevant recommendations.
- **Who:** All personas.
- **Requirement:** All domains.
- **Criterion:** Accessibility, Alignment.

### F6 — Multilingual Recommendation Rendering

- **Why:** International event; fans/staff speak many languages.
- **Who:** Fan, Volunteer.
- **Requirement:** Multilingual Assistance.
- **Criterion:** Accessibility, Alignment.

### F7 — Sustainability Optimizer

- **Why:** Sustainability is an explicit domain.
- **Who:** Venue Operations, Organizer.
- **Requirement:** Sustainability.
- **Criterion:** Alignment.

### F8 — Immutable Decision Audit Log

- **Why:** Accountability and post-event review.
- **Who:** Organizer.
- **Requirement:** Operational Intelligence.
- **Criterion:** Security, Code Quality.

### F9 — Accessibility-First UI

- **Why:** Evaluation criterion + persona need.
- **Who:** All, especially Accessibility Coordinator.
- **Requirement:** Accessibility.
- **Criterion:** Accessibility.

### F10 — Operational Health Score

- **Why:** A continuously computed 0–100 score per domain creates a clear, measurable narrative of AI value. Every recommendation explains how it changes the score.
- **Who:** All operational personas (visible); Organizer (primary consumer).
- **Requirement:** Operational Intelligence, Real-Time Decision Support.
- **Criterion:** Problem Statement Alignment, GenAI Usage.
- **Implementation:** Deterministic formula over Live Stadium State metrics. All weights and normalizers loaded from config — never hardcoded.

### F11 — Operational Memory

- **Why:** Closed-loop learning. After execution, the system measures whether its prediction was accurate, stores the result, and adjusts future confidence scoring. This is NOT machine learning — it is a lightweight feedback mechanism.
- **Who:** Organizer (visible accuracy metrics); system (internal confidence adjustment).
- **Requirement:** Operational Intelligence.
- **Criterion:** GenAI Usage, Code Quality.

---

## Out of Scope (Explicit)

- Real IoT sensor integration (simulated event stream instead).
- Autonomous action execution.
- Native mobile apps (responsive web only).
- Payment/ticketing.
- The forbidden tech list (Kafka, Redis, K8s, microservices, etc.).

---

## Definition of Done (Product Level)

- [ ] All 8 domains represented in seed data and reasoning.
- [ ] Every recommendation renders R/E/C/I + alternatives + predicted impact.
- [ ] Approval loop functional end-to-end.
- [ ] Outcome evaluation writes to Operational Memory after execution.
- [ ] Operational Health Score computed and displayed per domain + overall.
- [ ] Role scoping enforced.
- [ ] WCAG 2.1 AA verified.
- [ ] ≥ 80% backend test coverage on core logic.
- [ ] Deployed, public, < 10MB repo.
- [ ] Zero hardcoded thresholds, weights, or prompt templates — all config-driven.

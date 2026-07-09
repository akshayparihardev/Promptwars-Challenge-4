# 06 — Frontend Design

## Executive Summary

**WHY:** The UI must make proactive, explainable recommendations legible and actionable — accessibly, multilingually, per role.

**Stack:** React 18 + TypeScript (strict) + Vite + Tailwind CSS + TanStack Query + react-i18next + Zod (shared schemas). No heavy UI framework; accessible headless primitives (Radix UI, tree-shakeable).

---

## Design Principles

1. **Recommendation-centric layout** (not a dashboard of charts).
2. **Explainability always visible** — R/E/C/I in every card.
3. **Keyboard-first, screen-reader-first.**
4. **Language switch is global and instant.**
5. **Role switch reshapes the entire feed.**

---

## Screen Map

```
/                  → Redirect to /ops
/ops               → Operational Console (main)
   ├─ HealthScoreDashboard (top — overall + per-domain scores)
   ├─ RoleSwitcher (top bar)
   ├─ LanguageSelector (top bar)
   ├─ DomainFilterBar
   ├─ RecommendationFeed (priority-sorted)
   │    └─ RecommendationCard
   │         ├─ ExplainabilityPanel (Reason/Evidence/Confidence/Impact)
   │         ├─ AlternativesPanel (2-3 alternatives with pros/cons)
   │         ├─ PredictionPanel (no-action outcome + health score delta)
   │         └─ ApprovalControls (Approve/Reject/Details)
   └─ ContextTimeline (live events, SSE)
/audit             → Decision Audit Log (Organizer)
/memory            → Operational Memory (Organizer — prediction accuracy)
```

---

## Component Catalog (each with spec)

### RecommendationFeed

- **Inputs:** `role`, `domainFilter`, `lang`.
- **Outputs:** rendered priority-ordered list; approval actions.
- **Responsibilities:** subscribe to SSE, fetch initial list, sort by priority, virtualize if >50.
- **Dependencies:** `useRecommendations` hook, `RecommendationCard`.
- **Failure:** empty state ("No active recommendations"), error banner with retry.
- **Testing:** RTL — renders cards, filters by domain, updates on SSE.
- **A11y:** `role="feed"`, each card `role="article"` with `aria-labelledby`.

### RecommendationCard

- **Inputs:** `recommendation`, `lang`.
- **Outputs:** approve/reject events.
- **Responsibilities:** render title, domain badge, priority, confidence bar, R/E/C/I, alternatives count badge, health score impact indicator.
- **A11y:** confidence bar has `aria-valuenow`/`min`/`max`; color never sole signal (icon + text); health score delta announced via `aria-label`.
- **Testing:** snapshot + interaction; asserts R/E/C/I + alternatives + prediction all present.

### ExplainabilityPanel

- **Inputs:** `reason`, `evidence[]`, `confidence`, `expectedImpact`.
- **Responsibilities:** display all four pillars clearly labeled.
- **Failure:** if any pillar missing → render "Data unavailable" (should never happen; guardrail ensures presence).
- **A11y:** definition list `<dl>` semantics.

### ApprovalControls

- **Inputs:** `recommendationId`, `currentRole`.
- **Outputs:** POST `/decisions`.
- **Responsibilities:** show Approve/Reject only if role authorized; optimistic update; confirm dialog for critical.
- **A11y:** buttons with descriptive `aria-label` (e.g., "Approve recommendation: Reroute Gate 7 crowd").
- **Security:** authorization also enforced server-side (never trust client).

### RoleSwitcher

- **Inputs:** available roles.
- **Outputs:** sets active role in state + refetch.
- **A11y:** `<select>` labeled "Operating as role".

### LanguageSelector

- **Supported:** en, es, fr, pt, ar (RTL), de.
- **Switching** triggers `i18n.changeLanguage` + refetch localized recs.
- **A11y:** RTL layout switch for Arabic (`dir="rtl"`).

### ContextTimeline

- **Inputs:** SSE event stream.
- **Responsibilities:** live-append operational events (newest top), max 100 shown.
- **A11y:** `aria-live="polite"` region announces new critical events.

### HealthScoreDashboard

- **Inputs:** `healthScore` (from SSE or polling).
- **Responsibilities:** display overall health score (0–100) + per-domain scores. Show trend indicator (improving/stable/declining). Color-coded but with icon + text — never color alone.
- **Dependencies:** `useHealthScore` hook.
- **Failure:** if API unavailable → show "Score unavailable" with retry.
- **A11y:** each domain score rendered with `aria-label="Crowd health: 82 out of 100"`; overall score has `role="status"`.
- **Testing:** RTL — renders all domains; updates on SSE; accessibility audit.

### AlternativesPanel

- **Inputs:** `alternatives[]` from recommendation.
- **Responsibilities:** display 2–3 alternatives with option, pros, cons, confidence. Highlight the recommended alternative. Expandable/collapsible.
- **A11y:** `<details>/<summary>` or Radix Accordion; each alternative has `aria-label` with its option text.
- **Testing:** asserts all alternatives render; recommended one visually distinct.

### PredictionPanel

- **Inputs:** `prediction` from recommendation.
- **Responsibilities:** display no-action outcome, predicted metrics, health score impact (current → projected with delta).
- **A11y:** health score change announced as "Expected to change crowd health from 72 to 85, an increase of 13 points".
- **Testing:** asserts prediction fields render; health score delta calculation correct.

---

## State Management

- **Server state:** TanStack Query (recommendations, context, audit).
- **UI state:** React Context (role, language, filters).
- **No Redux** (unnecessary complexity — see ADR).

---

## API Layer (src/api/)

- Typed client generated from shared Zod schemas.
- All responses validated with Zod at runtime (defense in depth).

---

## Responsive & Theming

- Mobile-first; feed collapses to single column.
- Dark/light via CSS variables; respects `prefers-color-scheme`.
- Contrast ratios ≥ 4.5:1 (verified).

---

## Frontend Definition of Done

- [ ] All components pass RTL tests.
- [ ] axe-core: 0 violations.
- [ ] Keyboard-only full flow works.
- [ ] All 6 languages render (Arabic RTL correct).
- [ ] No console errors/warnings.
- [ ] HealthScoreDashboard displays all domains + overall.
- [ ] Alternatives and predictions render in every recommendation card.
- [ ] Health score impact shown for every recommendation.

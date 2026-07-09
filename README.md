# AEGIS 🛡️

**Adaptive Event-Ground Intelligence System for FIFA World Cup 2026**

AEGIS is a GenAI-enabled operational intelligence platform that enhances stadium operations, crowd management, security, and accessibility. It provides real-time decision support for venue staff, organizers, and volunteers by detecting incidents across domains, predicting cascading impacts, and recommending actionable interventions.

Modelled venue: **MetLife Stadium** (New York New Jersey Stadium), host of the 2026 Final. 

---

## 1. Chosen vertical & persona

- **Personas:** Venue Operations, Security, Medical, Organizer, Fan, Volunteer
- **Vertical:** Operational Intelligence + Real-Time Decision Support
- **Product:** *AEGIS Assistant & Dashboard* — An interactive command center that ingests high-velocity stadium events, runs reasoning cycles to correlate data, and provides context-aware guidance via a conversational chat assistant and live recommendation feed.

## 2. Approach & logic — *rules before LLM*

The core design principle is **deterministic filtering first, language model second**:

```
Live Events ─▶ Rules Engine (deterministic) ─▶ High-Severity Signals ─▶ GenAI (Correlate & Predict) ─▶ Actionable Recommendations
              • severity thresholds           • zone correlation
              • domain filtering              • cascading impact
```

1. **The rules engine (`rules-engine.ts`) acts as a filter** — It continuously monitors the event stream and extracts high-severity incidents, preventing LLM noise and reducing cost.
2. **The LLM (Gemini 1.5 Flash)** analyzes the filtered signals, correlates multi-domain incidents (e.g., crowd surge leading to medical emergency), predicts health score impact if ignored, and generates tailored alternatives based on allowed actions.
3. If no LLM key is provided, the app **short-circuits** to a robust deterministic fallback reasoner, ensuring 100% uptime.

## 3. How it works — setup & run

**Requirements:** Node.js 20+

```bash
npm install
npm run build
npm start
```

Open <http://localhost:3000>.

**Environment config** (create `.env`):

| Variable | Purpose | Default |
|----------|---------|---------|
| `AEGIS_LLM_PROVIDER` | `gemini` or `deterministic` | `deterministic` |
| `AEGIS_GEMINI_API_KEY` | Enables GenAI reasoning. **Absent → deterministic.** | *(unset)* |
| `NODE_ENV` | Environment | `development` |

> 🔐 The app runs **fully offline without any key**: if `AEGIS_LLM_PROVIDER=deterministic`, it transparently falls back to a rules-based reasoner, so it never crashes.

**Using the UI:** Use the **Role Dropdown** (top right) to switch between Organizer, Security, Fan, etc. Click **Simulate Incident** to inject a high-severity event into the system. The **AEGIS Assistant** chat panel allows you to interact conversationally with the system for immediate answers.

## 4. Quality attributes

### ⚡ Code Quality & Architecture
- **Clean Architecture:** Strict separation of Domain (Ports, Entities), Application (Use Cases), and Infrastructure (Adapters).
- **No Hardcoding:** Role mappings, translations, severity scores, and detection rules are all externally configured in `apps/api/config/*.json`.
- **TypeScript Strict Mode:** 100% type safety across the monorepo (`@aegis/shared` for Zod schemas).

### ♿ Accessibility — WCAG 2.1 AA
- **Semantic HTML & ARIA:** Single `<h1>`, `<main>` landmark, `skip-to-content` link (`<a href="#main" class="sr-only">`), and `aria-live="polite"` on chat and feeds.
- **Visual Design:** High-contrast color palette with WCAG compliant text contrast ratios.
- **Reduced Motion:** Fully respects `prefers-reduced-motion` media queries, disabling animations for users with vestibular disorders.
- **Focus States:** Every interactive element has highly visible `:focus-visible` outlines for keyboard navigation.

### 🔐 Security
- **Strict Input Validation (Zod):** Every API endpoint validates payloads. Oversized strings and invalid domains are rejected (400 Bad Request).
- **No Secrets in Code:** The API key is read exclusively from `.env`.
- **Authorization:** Only authorized roles can approve/reject recommendations (e.g. `fan` cannot approve `security` actions).

### 🧪 Testing
The backend business logic is extensively tested using **Vitest**.

```bash
npm run test --workspace=apps/api
```

- `test/rules-engine.test.ts`: Asserts deterministic filtering behavior.
- `test/scoring.test.ts`: Verifies math for confidence bounds, priority, and health scores.
- `test/use-cases.test.ts`: Asserts business workflows (RunCycle, Ingest, Approve).
- `test/routes.test.ts`: API endpoint integration tests.
- `test/security.test.ts`: Input validation and error handling.

## License

MIT License.

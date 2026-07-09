# AEGIS 🛡️ — Adaptive Event-Ground Intelligence System

**A GenAI-Powered Operational Intelligence Platform for FIFA World Cup 2026.**

AEGIS is an advanced stadium management platform that correlates real-time crowd, transport, and facility signals into actionable recommendations. It ensures safe, efficient, and accessible operations by grounding its decisions in **deterministic rules** before utilizing Large Language Models (LLMs) to predict impacts and generate alternative strategies.

Modelled venue: **MetLife Stadium** (FIFA name *New York New Jersey Stadium*), host of the 2026 Final. 

---

## 1. Chosen Vertical & Persona

- **Persona:** Organizer / Venue Operations / Security / Medical
- **Vertical:** Operational Intelligence & Incident Management
- **Product:** *AEGIS* — A real-time reasoning engine that ingests signals across 9 domains (Crowd, Security, Medical, Transport, etc.), detects situations, and routes AI-generated mitigation strategies to the correct operational teams for immediate approval and simulated execution.

## 2. Approach & Logic — *Clean Architecture & Determinism First*

The core design principle is **Clean Architecture** combined with **Deterministic Guardrails**:

```
Live Stadium State ─▶ Rules Engine (Deterministic) ─▶ LLM (Impact & Alternatives) ─▶ Operational Decision
                   • Detects anomalies              • Predicts systemic impact     • Routed to correct role
                   • Correlates events              • Generates fallback options   • Awaits Human-in-the-Loop
                   • Prioritizes severity           • Localizes recommendations    • Executes simulated effect
```

1. **Deterministic Foundations:** The rules engine (`rules-engine.ts`) acts as a gatekeeper. It correlates incoming operational events into `Situations` using configurable JSON thresholds (e.g., density > 80%, incident severity). 
2. **LLM Augmentation:** Only *after* a situation is deterministically validated does the LLM Reasoner (`gemini-reasoner.ts`) step in. It is strictly constrained to predict cascading impacts (e.g., "how will a gate closure affect transport?") and generate viable alternative actions.
3. **No Hardcoding:** Absolutely every threshold, weight, domain definition, and rule is injected via configuration (`apps/api/config/*.json`).
4. **Offline Fallback:** If no Gemini API key is provided, the system seamlessly falls back to a purely deterministic rule-based generator (`deterministic-reasoner.ts`). The platform **never crashes** due to API limits.

## 3. How It Works — Setup & Run

**Requirements:** Node.js 20+

```bash
# 1. Install dependencies across the Turborepo workspace
npm install

# 2. Push the Prisma schema and seed the local SQLite database
npm run db:push
npm run db:seed

# 3. Start the Backend API & Frontend UI concurrently
npm run dev
```

Open `<http://localhost:5173>` to access the AEGIS Command Center.

### Environment Configuration

Copy `.env.example` to `.env` in the project root:

| Variable | Purpose | Default |
|----------|---------|---------|
| `AEGIS_LLM_PROVIDER` | `gemini` or `deterministic` | `deterministic` |
| `AEGIS_GEMINI_API_KEY` | Gemini API key (Required if provider=gemini) | *(unset)* |
| `PORT` | API Port | `3000` |
| `DATABASE_URL` | Local SQLite path | `file:./aegis.db` |
| `AEGIS_CYCLE_MS` | Reasoning cycle frequency | `15000` |

> 🔐 **Fully Offline Capable:** The app runs without an API key if `AEGIS_LLM_PROVIDER=deterministic`.

## 4. Quality Attributes

### 🌍 Green Software Practices
- **Zero-Ops Database:** Relies on a highly optimized, local SQLite database (`aegis.db` < 10MB) to minimize disk I/O and carbon footprint.
- **Server-Sent Events (SSE):** The frontend consumes real-time updates via SSE, eliminating wasteful CPU cycles and network overhead caused by long-polling.
- **Compute Efficiency:** The deterministic fallback engine ensures zero cloud-compute waste during development or low-severity operations.

### 🛡️ Security & Integrity
- **No Hardcoded Secrets:** Configuration and API keys are strictly managed via environment variables.
- **Strict Data Validation:** Every API boundary and internal Domain event is heavily validated using `Zod` schemas (`@aegis/shared/schemas`).
- **Human-in-the-Loop:** Actions are never executed autonomously. The AI proposes, the human operator `Approves` or `Rejects` via the `/decisions` endpoint.

### 💻 100% Code Quality
- **Strict TypeScript:** The entire Turborepo workspace executes `npm run typecheck --workspaces` with **zero compiler errors**.
- **Clean Architecture:** Dependencies strictly point inward. The `domain` has zero knowledge of the `infrastructure` (Prisma, Gemini).

### ✨ Premium UI/UX
- **Glassmorphism & Gradients:** Built with React, Vite, and TailwindCSS. Features animated ambient mesh gradients, beautiful glassmorphic cards, and crisp `Inter` typography.
- **Theme Toggle:** Flawless Light/Dark mode transitions (supporting OLED-style Slate-950).
- **Responsive & Accessible:** Scales beautifully from mobile to 1600px ultra-wide command center displays.

## 5. Architecture

```text
aegis/
├── apps/
│   ├── api/                   # Fastify + Prisma + Clean Architecture Backend
│   │   ├── config/            # JSON Rules, Thresholds, Allow-lists
│   │   ├── prisma/            # SQLite Schema
│   │   └── src/
│   │       ├── application/   # Use Cases (RunReasoningCycle, IngestEvent)
│   │       ├── domain/        # Entities, Ports, Scoring, Rules Engine
│   │       ├── infrastructure/# Prisma Repos, Gemini/Deterministic Reasoners
│   │       └── interface/     # Fastify HTTP Routes & SSE Streams
│   └── web/                   # React + Vite + Tailwind Frontend
│       └── src/
│           ├── api/           # Typed Fetch Client
│           ├── components/    # HealthScoreDashboard, RecommendationCards
│           └── App.tsx        # Command Center Layout & Theme State
├── packages/
│   └── shared/                # 100% Shared Zod Schemas & Domain Constants
├── .env                       # Root environment configuration
└── package.json               # Turborepo orchestration
```

## License
MIT

# 13 — Deployment & DevOps

## Executive Summary

**WHY:** A deployable, reproducible, CI-gated submission is required. This document defines build, deploy, and operational procedures for AEGIS.

---

## Deployment Architecture

```
┌──────────────────────────────────────────┐
│         Deployment Platform              │
│  (Render / Railway / Fly.io / Vercel)    │
│                                          │
│  ┌──────────────┐  ┌──────────────────┐  │
│  │  Frontend     │  │  Backend (API)   │  │
│  │  (Static SPA) │  │  Node.js + SQLite│  │
│  │  Vite Build   │  │  Single Process  │  │
│  └──────┬───────┘  └──────┬───────────┘  │
│         │    REST/SSE     │              │
│         └────────────────→┘              │
│                    │                     │
│              ┌─────┴─────┐               │
│              │  SQLite    │               │
│              │  (file DB) │               │
│              └───────────┘               │
└──────────────────────────────────────────┘
```

### Deployment Options (Ranked)

| Platform | Frontend | Backend | SQLite | Free Tier | Recommended |
|---|---|---|---|---|---|
| **Render** | Static site | Web service | Persistent disk | ✓ | **✓ Primary** |
| **Railway** | Static deploy | Web service | Volume mount | ✓ | Backup |
| **Fly.io** | Static (CDN) | Machine | Volume | ✓ | Backup |
| **Vercel + Render** | Vercel (SPA) | Render (API) | Persistent disk | ✓ | Split option |

---

## Build Pipeline

### Prerequisites

```bash
node >= 20.0.0
npm >= 10.0.0
```

### Build Commands

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate

# Seed database (optional, for demo)
npm run db:seed

# Build backend
npm run build:api

# Build frontend
npm run build:web

# Run all tests
npm run test

# Start production
npm run start
```

### Package Scripts (root `package.json`)

```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:api\" \"npm run dev:web\"",
    "dev:api": "npm -w apps/api run dev",
    "dev:web": "npm -w apps/web run dev",
    "build:api": "npm -w apps/api run build",
    "build:web": "npm -w apps/web run build",
    "test": "npm run test:api && npm run test:web",
    "test:api": "npm -w apps/api run test",
    "test:web": "npm -w apps/web run test",
    "db:generate": "npm -w apps/api run db:generate",
    "db:migrate": "npm -w apps/api run db:migrate",
    "db:seed": "npm -w apps/api run db:seed",
    "start": "npm -w apps/api run start",
    "lint": "eslint . --ext .ts,.tsx",
    "format": "prettier --write ."
  }
}
```

---

## CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
name: AEGIS CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Generate Prisma client
        run: npm run db:generate
      
      - name: Lint
        run: npm run lint
      
      - name: Format check
        run: npx prettier --check .
      
      - name: Backend tests
        run: npm run test:api -- --coverage
      
      - name: Frontend tests
        run: npm run test:web -- --coverage
      
      - name: Dependency audit
        run: npm audit --audit-level=high
      
      - name: Build
        run: |
          npm run build:api
          npm run build:web
      
      - name: Check repo size
        run: |
          SIZE=$(du -sm . --exclude=node_modules --exclude=.git | cut -f1)
          echo "Repo size: ${SIZE}MB"
          if [ "$SIZE" -gt 10 ]; then
            echo "ERROR: Repo exceeds 10MB limit"
            exit 1
          fi
```

---

## Environment Configuration

### Environment Variables

```env
# Required
PORT=3000
DATABASE_URL="file:./aegis.db"

# AI Engine
AEGIS_LLM_PROVIDER=deterministic    # openai | anthropic | deterministic
AEGIS_LLM_API_KEY=                  # required if provider != deterministic
AEGIS_LLM_MODEL=gpt-4o-mini        # model identifier

# Reasoning
AEGIS_CYCLE_MS=15000                # reasoning cycle interval
AEGIS_CONTEXT_WINDOW_MIN=30         # context window size
AEGIS_REC_TTL_MIN=30                # recommendation expiry

# Logging
LOG_LEVEL=info                      # debug | info | warn | error
NODE_ENV=production                 # development | production
```

### `.env.example` (committed)

```env
PORT=3000
DATABASE_URL="file:./aegis.db"
AEGIS_LLM_PROVIDER=deterministic
AEGIS_LLM_API_KEY=
AEGIS_CYCLE_MS=15000
AEGIS_CONTEXT_WINDOW_MIN=30
AEGIS_REC_TTL_MIN=30
LOG_LEVEL=info
NODE_ENV=development
```

---

## Operational Procedures

### First Run (Evaluator)

```bash
git clone <repo-url>
cd aegis
cp .env.example .env
npm install
npm run db:generate
npm run db:migrate
npm run db:seed        # loads demo match-day data
npm run dev            # starts both frontend + backend
# Open http://localhost:5173
```

### Health Check

```
GET /api/v1/health

Response 200:
{
  "status": "ok",
  "version": "1.0.0",
  "provider": "deterministic",
  "uptime": 3600,
  "database": "connected"
}
```

### Graceful Shutdown

```typescript
// Signal handling in main.ts
process.on('SIGTERM', async () => {
  scheduler.stop();           // clear reasoning interval
  await fastify.close();      // close HTTP connections
  await prisma.$disconnect(); // close DB
  process.exit(0);
});
```

---

## Repository Size Management

**Constraint:** < 10MB repository size.

| Strategy | Implementation |
|---|---|
| No committed `node_modules` | `.gitignore` |
| No committed SQLite DB | `.gitignore` (generated on migrate) |
| No binary assets | SVG icons only; no images |
| Seed data as JSON | < 100KB |
| No committed build output | `.gitignore` |
| Prisma engine not committed | Generated at install time |

### Size Audit Command

```bash
git ls-files | xargs du -sh | sort -rh | head -20
```

---

## Deployment Definition of Done

- [ ] CI pipeline passes (lint, test, build, audit, size check).
- [ ] One-command setup works from clean clone.
- [ ] Health endpoint responds.
- [ ] Graceful shutdown tested.
- [ ] Repository < 10MB.
- [ ] `.env.example` documented.

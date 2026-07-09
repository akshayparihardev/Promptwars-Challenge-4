# 15 — Coding Standards & Conventions

## Executive Summary

**WHY:** Consistent code is reviewable, maintainable, and AI-agent-friendly. These standards are enforced by linting and CI — they are not optional.

---

## Language & Runtime

- **TypeScript** (strict mode) everywhere — backend, frontend, shared.
- **Node.js 20 LTS** runtime.
- **ES2022** target (top-level await, structuredClone available).
- **ESM modules** (`"type": "module"` in `package.json`).

---

## TypeScript Configuration

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "exactOptionalPropertyTypes": false,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  }
}
```

### Strict Rules (Non-Negotiable)

| Rule | Rationale |
|---|---|
| `strict: true` | Catches null/undefined errors, implicit any, etc. |
| `noUncheckedIndexedAccess: true` | Array/object indexing returns `T \| undefined` — prevents runtime errors |
| `noImplicitReturns: true` | Every code path must return |
| No `any` | Use `unknown` + type narrowing. Lint error on `any`. |
| No `// @ts-ignore` | Fix the type, don't suppress the check |
| No `as` type assertions (except `as const`) | Use type guards and narrowing instead |

---

## Naming Conventions

### Files

| Type | Convention | Example |
|---|---|---|
| TypeScript modules | `kebab-case.ts` | `reasoning-pipeline.ts` |
| React components | `PascalCase.tsx` | `RecommendationCard.tsx` |
| Test files | `*.test.ts` / `*.test.tsx` | `scoring.test.ts` |
| Types/interfaces (standalone) | `kebab-case.types.ts` | `recommendation.types.ts` |
| Constants | `kebab-case.constants.ts` | `domain-weights.constants.ts` |

### Code

| Type | Convention | Example |
|---|---|---|
| Classes | `PascalCase` | `ReasoningPipeline` |
| Interfaces | `PascalCase` (no `I` prefix) | `LlmReasoner` (not `ILlmReasoner`) |
| Types | `PascalCase` | `Recommendation` |
| Functions | `camelCase` | `calculateConfidence` |
| Variables | `camelCase` | `contextWindow` |
| Constants | `UPPER_SNAKE_CASE` | `DOMAIN_WEIGHTS` |
| Enums | `PascalCase` members | `Severity.High` |
| Use cases | `VerbNounUseCase` | `IngestEventUseCase` |
| DTOs | `NounVerbDto` | `EventCreateRequestDto` |
| Ports (interfaces) | `NounPort` | `LlmReasonerPort` |
| Repositories | `NounRepository` | `EventRepository` |

---

## Code Organization Rules

### Size Limits (Guidelines, not hard errors)

| Metric | Limit | Rationale |
|---|---|---|
| Function body | ≤ 40 lines | Readability; single responsibility |
| File | ≤ 300 lines | Cohesion; navigability |
| Module (directory) | ≤ 15 files | Manageability |
| Import count per file | ≤ 15 | Coupling signal |

### Layer Rules (Hard)

| Rule | Enforcement |
|---|---|
| Domain layer has **zero imports** from other layers | ESLint import boundaries |
| Application layer imports only from domain | ESLint import boundaries |
| Infrastructure implements ports defined in domain | TypeScript type checking |
| Interface layer calls only application layer | ESLint import boundaries |
| No circular dependencies | `madge` or eslint-plugin-import |

---

## Error Handling

```typescript
// Domain errors (pure, no HTTP knowledge)
export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, details?: unknown) {
    super('VALIDATION_ERROR', message, details);
  }
}

export class NotFoundError extends DomainError {
  constructor(entity: string, id: string) {
    super('NOT_FOUND', `${entity} not found: ${id}`);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message: string) {
    super('FORBIDDEN', message);
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super('CONFLICT', message);
  }
}

// Interface layer maps DomainError → HTTP status
// VALIDATION_ERROR → 400
// NOT_FOUND → 404
// FORBIDDEN → 403
// CONFLICT → 409
// * → 500
```

---

## Function Patterns

### Use Case Pattern

```typescript
export class IngestEventUseCase {
  constructor(
    private readonly eventRepo: EventRepository,
    private readonly auditRepo: AuditRepository,
  ) {}

  async execute(input: IngestEventInput): Promise<IngestEventOutput> {
    // 1. Validate (Zod at interface layer, domain rules here)
    // 2. Execute business logic
    // 3. Persist
    // 4. Side effects (audit, SSE)
    // 5. Return result
  }
}
```

### Pure Domain Function Pattern

```typescript
// No side effects, no I/O, fully testable
export function calculateConfidence(
  severity: Severity,
  evidenceCount: number,
  llmConfidence?: number,
): number {
  const severityScore = SEVERITY_SCORES[severity];
  const base = severityScore * (1 - 1 / (1 + evidenceCount));
  const llmAdj = clamp(llmConfidence ?? 1.0, 0.5, 1.0);
  return clamp(base * llmAdj, 0, 1);
}
```

---

## Commenting Standards

| Type | When | Format |
|---|---|---|
| **JSDoc** | All exported functions, classes, interfaces | `/** ... */` |
| **WHY comments** | Non-obvious decisions | `// WHY: <explanation>` |
| **TODO** | Known incomplete work | `// TODO(username): <description>` |
| **No obvious comments** | Never | ~~`// increment counter`~~ |

---

## ESLint Configuration

```json
{
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/strict-type-checked",
    "plugin:@typescript-eslint/stylistic-type-checked",
    "plugin:import/typescript",
    "prettier"
  ],
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-non-null-assertion": "error",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "import/no-cycle": "error",
    "import/order": ["error", {
      "groups": ["builtin", "external", "internal", "parent", "sibling"],
      "newlines-between": "always",
      "alphabetize": { "order": "asc" }
    }],
    "no-console": ["error", { "allow": ["warn", "error"] }],
    "prefer-const": "error",
    "eqeqeq": ["error", "always"]
  }
}
```

---

## Prettier Configuration

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

---

## Git Conventions

### Commit Messages

```
<type>(<scope>): <description>

Types: feat, fix, docs, style, refactor, test, chore
Scope: domain, application, infrastructure, interface, web, shared, ci

Examples:
feat(domain): add confidence scoring formula
fix(interface): return 403 on unauthorized decision
test(application): add golden file test for deterministic reasoner
docs: update API specification with SSE events
```

### Branch Strategy

- **Trunk-based**: all work on `main` (single branch requirement).
- Atomic commits; each commit should pass CI.

---

## Coding Standards Definition of Done

- [ ] ESLint: 0 errors, 0 warnings.
- [ ] Prettier: all files formatted.
- [ ] TypeScript: strict mode, 0 errors.
- [ ] No `any` in codebase.
- [ ] All exported symbols have JSDoc.
- [ ] Layer dependency rules enforced.

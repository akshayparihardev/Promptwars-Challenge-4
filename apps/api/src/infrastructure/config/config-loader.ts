// ============================================================
// Config Loader — Loads and validates all config files at boot.
// Fail fast with descriptive errors if config is missing/invalid.
// ============================================================

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { config as loadDotenv } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = resolve(__dirname, '../../../config');

// Load .env from project root (2 levels up from apps/api/)
const PROJECT_ROOT = resolve(__dirname, '../../../../..');
const envPath = resolve(PROJECT_ROOT, '.env');
if (existsSync(envPath)) {
  loadDotenv({ path: envPath });
}

// ── Config Schemas ────────────────────────────────────────────

const DetectionRuleSchema = z.object({
  id: z.string(),
  domain: z.string(),
  name: z.string(),
  trigger: z.string(),
  severity: z.string(),
  signalType: z.string(),
  threshold: z.number().optional(),
  multiplier: z.number().optional(),
  minimumSeverity: z.string().optional(),
  zoneRadiusMeters: z.number().optional(),
  delayThresholdMinutes: z.number().optional(),
  queueThreshold: z.number().optional(),
  densityThreshold: z.number().optional(),
});

const DetectionRulesConfigSchema = z.object({
  rules: z.array(DetectionRuleSchema),
});

const ScoringConfigSchema = z.object({
  severityScores: z.record(z.string(), z.number()),
  domainWeights: z.record(z.string(), z.number()),
  recencyDecayHalfLifeSeconds: z.number(),
  llmConfidenceClamp: z.object({ min: z.number(), max: z.number() }),
  memoryLookbackCount: z.number(),
});

const HealthScoreConfigSchema = z.object({
  weights: z.object({
    criticalIncidentWeight: z.number(),
    highIncidentWeight: z.number(),
    pendingRecommendationWeight: z.number(),
  }),
  normalizers: z.record(z.string(), z.number()),
  domainWeights: z.record(z.string(), z.number()),
  trendWindowSnapshots: z.number(),
});

const ActionAllowListConfigSchema = z.object({
  actions: z.record(z.string(), z.array(z.string())),
});

const ZoneSchema = z.object({
  id: z.string(),
  type: z.string(),
  capacity: z.number(),
  adjacent: z.array(z.string()),
  accessible: z.boolean(),
});

const VenueModelConfigSchema = z.object({
  venue: z.object({
    name: z.string(),
    city: z.string(),
    capacity: z.number(),
  }),
  zones: z.array(ZoneSchema),
});

// ── Type Exports ──────────────────────────────────────────────

export type DetectionRule = z.infer<typeof DetectionRuleSchema>;
export type DetectionRulesConfig = z.infer<typeof DetectionRulesConfigSchema>;
export type ScoringConfig = z.infer<typeof ScoringConfigSchema>;
export type HealthScoreConfig = z.infer<typeof HealthScoreConfigSchema>;
export type ActionAllowListConfig = z.infer<typeof ActionAllowListConfigSchema>;
export type VenueZone = z.infer<typeof ZoneSchema>;
export type VenueModelConfig = z.infer<typeof VenueModelConfigSchema>;

// ── Loader Functions ──────────────────────────────────────────

function loadJson<T>(filename: string, schema: z.ZodType<T>): T {
  const filepath = resolve(CONFIG_DIR, filename);
  let raw: string;
  try {
    raw = readFileSync(filepath, 'utf-8');
  } catch (err) {
    throw new Error(
      `[CONFIG] Failed to read config file: ${filepath}. ` +
        `Ensure the file exists. Error: ${(err as Error).message}`
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`[CONFIG] Invalid JSON in config file: ${filepath}`);
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `[CONFIG] Validation failed for ${filepath}:\n` +
        result.error.issues
          .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
          .join('\n')
    );
  }

  return result.data;
}

function loadPrompt(filename: string): string {
  const filepath = resolve(CONFIG_DIR, 'prompts', filename);
  try {
    return readFileSync(filepath, 'utf-8').trim();
  } catch (err) {
    throw new Error(
      `[CONFIG] Failed to read prompt file: ${filepath}. Error: ${(err as Error).message}`
    );
  }
}

// ── Singleton Config ──────────────────────────────────────────

export interface AppConfig {
  detectionRules: DetectionRulesConfig;
  scoring: ScoringConfig;
  healthScore: HealthScoreConfig;
  actionAllowList: ActionAllowListConfig;
  venueModel: VenueModelConfig;
  prompts: {
    correlate: string;
    predictImpact: string;
    generateAlternatives: string;
    localize: string;
  };
  env: {
    port: number;
    host: string;
    databaseUrl: string;
    llmProvider: 'gemini' | 'deterministic';
    geminiApiKey: string;
    cycleMs: number;
    contextWindowMin: number;
    recTtlMin: number;
    logLevel: string;
    frontendUrl: string;
  };
}

export function loadConfig(): AppConfig {
  // ── Load config files ──
  const detectionRules = loadJson('detection-rules.json', DetectionRulesConfigSchema);
  const scoring = loadJson('scoring.json', ScoringConfigSchema);
  const healthScore = loadJson('health-score.json', HealthScoreConfigSchema);
  const actionAllowList = loadJson('action-allow-list.json', ActionAllowListConfigSchema);
  const venueModel = loadJson('venue-model.json', VenueModelConfigSchema);

  // ── Load prompt templates ──
  const prompts = {
    correlate: loadPrompt('correlate.txt'),
    predictImpact: loadPrompt('predict-impact.txt'),
    generateAlternatives: loadPrompt('generate-alternatives.txt'),
    localize: loadPrompt('localize.txt'),
  };

  // ── Load and validate env vars ──
  const llmProvider = (process.env['AEGIS_LLM_PROVIDER'] ?? 'deterministic') as
    | 'gemini'
    | 'deterministic';
  const geminiApiKey = process.env['AEGIS_GEMINI_API_KEY'] ?? '';

  if (llmProvider === 'gemini' && !geminiApiKey) {
    throw new Error(
      '[CONFIG] AEGIS_LLM_PROVIDER is "gemini" but AEGIS_GEMINI_API_KEY is not set. ' +
        'Either provide the key or set AEGIS_LLM_PROVIDER=deterministic.'
    );
  }

  const env = {
    port: parseInt(process.env['PORT'] ?? '3000', 10),
    host: process.env['HOST'] ?? '0.0.0.0',
    databaseUrl: process.env['DATABASE_URL'] ?? 'file:./aegis.db',
    llmProvider,
    geminiApiKey,
    cycleMs: parseInt(process.env['AEGIS_CYCLE_MS'] ?? '15000', 10),
    contextWindowMin: parseInt(process.env['AEGIS_CONTEXT_WINDOW_MIN'] ?? '30', 10),
    recTtlMin: parseInt(process.env['AEGIS_REC_TTL_MIN'] ?? '30', 10),
    logLevel: process.env['LOG_LEVEL'] ?? 'info',
    frontendUrl: process.env['FRONTEND_URL'] ?? 'http://localhost:5173',
  };

  return { detectionRules, scoring, healthScore, actionAllowList, venueModel, prompts, env };
}

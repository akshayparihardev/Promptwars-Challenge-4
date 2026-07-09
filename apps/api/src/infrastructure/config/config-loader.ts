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

export const EnvSchema = z.object({
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().default('file:./aegis.db'),
  LLM_PROVIDER: z.enum(['gemini', 'deterministic']).default('gemini'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-1.5-flash'),
  CYCLE_INTERVAL_MS: z.coerce.number().default(10000),
  AEGIS_CONTEXT_WINDOW_MIN: z.coerce.number().default(30),
  AEGIS_REC_TTL_MIN: z.coerce.number().default(30),
  LOG_LEVEL: z.string().default('info'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
});

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

const RoleMappingConfigSchema = z.object({
  roles: z.record(z.string(), z.array(z.string())),
  defaultRole: z.string(),
});

const TranslationsConfigSchema = z.record(z.string(), z.record(z.string(), z.string()));

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
export type RoleMappingConfig = z.infer<typeof RoleMappingConfigSchema>;
export type TranslationsConfig = z.infer<typeof TranslationsConfigSchema>;
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
  roleMapping: RoleMappingConfig;
  translations: TranslationsConfig;
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
    geminiModel: string;
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
  const roleMapping = loadJson('role-mapping.json', RoleMappingConfigSchema);
  const translations = loadJson('translations.json', TranslationsConfigSchema);
  const venueModel = loadJson('venue-model.json', VenueModelConfigSchema);

  // ── Load prompt templates ──
  const prompts = {
    correlate: loadPrompt('correlate.txt'),
    predictImpact: loadPrompt('predict-impact.txt'),
    generateAlternatives: loadPrompt('generate-alternatives.txt'),
    localize: loadPrompt('localize.txt'),
  };

  // ── Load and validate env vars ──
  const envParsed = EnvSchema.parse(process.env);

  if (envParsed.LLM_PROVIDER === 'gemini' && !envParsed.GEMINI_API_KEY) {
    throw new Error(
      '[CONFIG] LLM_PROVIDER is "gemini" but GEMINI_API_KEY is not set. ' +
        'Either provide the key or set LLM_PROVIDER=deterministic.'
    );
  }

  const env = {
    port: envParsed.PORT,
    host: envParsed.HOST,
    databaseUrl: envParsed.DATABASE_URL,
    llmProvider: envParsed.LLM_PROVIDER,
    geminiApiKey: envParsed.GEMINI_API_KEY ?? '',
    geminiModel: envParsed.GEMINI_MODEL,
    cycleMs: envParsed.CYCLE_INTERVAL_MS,
    contextWindowMin: envParsed.AEGIS_CONTEXT_WINDOW_MIN,
    recTtlMin: envParsed.AEGIS_REC_TTL_MIN,
    logLevel: envParsed.LOG_LEVEL,
    frontendUrl: envParsed.FRONTEND_URL,
  };

  return { detectionRules, scoring, healthScore, actionAllowList, roleMapping, translations, venueModel, prompts, env };
}

// ============================================================
// @aegis/shared — Domain Constants
// All domain enums and constants used across the entire stack.
// These are the ONLY place domain values are defined.
// ============================================================

/** Operational domains that AEGIS monitors */
export const DOMAINS = [
  'navigation',
  'crowd',
  'transport',
  'accessibility',
  'sustainability',
  'multilingual',
  'operations',
  'medical',
  'security',
] as const;

export type Domain = (typeof DOMAINS)[number];

/** Severity levels for events and situations */
export const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export type Severity = (typeof SEVERITIES)[number];

/** Recommendation lifecycle states */
export const REC_STATUSES = [
  'proposed',
  'approved',
  'rejected',
  'executed',
  'expired',
] as const;
export type RecStatus = (typeof REC_STATUSES)[number];

/** Persona roles in the system */
export const ROLES = [
  'fan',
  'volunteer',
  'security',
  'medical',
  'organizer',
  'venue_operations',
  'accessibility_coordinator',
  'transportation_coordinator',
] as const;
export type Role = (typeof ROLES)[number];

/** Supported languages for i18n */
export const LANGUAGES = ['en', 'es', 'fr', 'pt', 'ar', 'de'] as const;
export type LanguageCode = (typeof LANGUAGES)[number];

/** Health score trend direction */
export const TRENDS = ['improving', 'stable', 'declining'] as const;
export type Trend = (typeof TRENDS)[number];

/** Impact direction */
export const IMPACT_DIRECTIONS = ['increase', 'decrease'] as const;
export type ImpactDirection = (typeof IMPACT_DIRECTIONS)[number];

/** Recommendation source */
export const REC_SOURCES = ['genai', 'deterministic'] as const;
export type RecSource = (typeof REC_SOURCES)[number];

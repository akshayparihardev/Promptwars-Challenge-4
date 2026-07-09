/** Operational domains that AEGIS monitors */
export declare const DOMAINS: readonly ["navigation", "crowd", "transport", "accessibility", "sustainability", "multilingual", "operations", "medical", "security"];
export type Domain = (typeof DOMAINS)[number];
/** Severity levels for events and situations */
export declare const SEVERITIES: readonly ["low", "medium", "high", "critical"];
export type Severity = (typeof SEVERITIES)[number];
/** Recommendation lifecycle states */
export declare const REC_STATUSES: readonly ["proposed", "approved", "rejected", "executed", "expired"];
export type RecStatus = (typeof REC_STATUSES)[number];
/** Persona roles in the system */
export declare const ROLES: readonly ["fan", "volunteer", "security", "medical", "organizer", "venue_operations", "accessibility_coordinator", "transportation_coordinator"];
export type Role = (typeof ROLES)[number];
/** Supported languages for i18n */
export declare const LANGUAGES: readonly ["en", "es", "fr", "pt", "ar", "de"];
export type LanguageCode = (typeof LANGUAGES)[number];
/** Health score trend direction */
export declare const TRENDS: readonly ["improving", "stable", "declining"];
export type Trend = (typeof TRENDS)[number];
/** Impact direction */
export declare const IMPACT_DIRECTIONS: readonly ["increase", "decrease"];
export type ImpactDirection = (typeof IMPACT_DIRECTIONS)[number];
/** Recommendation source */
export declare const REC_SOURCES: readonly ["genai", "deterministic"];
export type RecSource = (typeof REC_SOURCES)[number];
//# sourceMappingURL=constants.d.ts.map
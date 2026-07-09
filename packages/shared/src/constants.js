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
];
/** Severity levels for events and situations */
export const SEVERITIES = ['low', 'medium', 'high', 'critical'];
/** Recommendation lifecycle states */
export const REC_STATUSES = [
    'proposed',
    'approved',
    'rejected',
    'executed',
    'expired',
];
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
];
/** Supported languages for i18n */
export const LANGUAGES = ['en', 'es', 'fr', 'pt', 'ar', 'de'];
/** Health score trend direction */
export const TRENDS = ['improving', 'stable', 'declining'];
/** Impact direction */
export const IMPACT_DIRECTIONS = ['increase', 'decrease'];
/** Recommendation source */
export const REC_SOURCES = ['genai', 'deterministic'];
//# sourceMappingURL=constants.js.map
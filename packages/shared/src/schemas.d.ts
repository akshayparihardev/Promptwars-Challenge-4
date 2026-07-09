import { z } from 'zod';
export declare const DomainSchema: z.ZodEnum<["navigation", "crowd", "transport", "accessibility", "sustainability", "multilingual", "operations", "medical", "security"]>;
export declare const SeveritySchema: z.ZodEnum<["low", "medium", "high", "critical"]>;
export declare const RecStatusSchema: z.ZodEnum<["proposed", "approved", "rejected", "executed", "expired"]>;
export declare const RoleSchema: z.ZodEnum<["fan", "volunteer", "security", "medical", "organizer", "venue_operations", "accessibility_coordinator", "transportation_coordinator"]>;
export declare const LanguageCodeSchema: z.ZodEnum<["en", "es", "fr", "pt", "ar", "de"]>;
export declare const TrendSchema: z.ZodEnum<["improving", "stable", "declining"]>;
export declare const ImpactDirectionSchema: z.ZodEnum<["increase", "decrease"]>;
export declare const RecSourceSchema: z.ZodEnum<["genai", "deterministic"]>;
export declare const OperationalEventCreateSchema: z.ZodObject<{
    domain: z.ZodEnum<["navigation", "crowd", "transport", "accessibility", "sustainability", "multilingual", "operations", "medical", "security"]>;
    zone: z.ZodString;
    type: z.ZodString;
    severity: z.ZodDefault<z.ZodEnum<["low", "medium", "high", "critical"]>>;
    payload: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    domain: "navigation" | "crowd" | "transport" | "accessibility" | "sustainability" | "multilingual" | "operations" | "medical" | "security";
    zone: string;
    type: string;
    severity: "low" | "medium" | "high" | "critical";
    payload: Record<string, unknown>;
}, {
    domain: "navigation" | "crowd" | "transport" | "accessibility" | "sustainability" | "multilingual" | "operations" | "medical" | "security";
    zone: string;
    type: string;
    payload: Record<string, unknown>;
    severity?: "low" | "medium" | "high" | "critical" | undefined;
}>;
export type OperationalEventCreate = z.infer<typeof OperationalEventCreateSchema>;
export declare const OperationalEventSchema: z.ZodObject<{
    domain: z.ZodEnum<["navigation", "crowd", "transport", "accessibility", "sustainability", "multilingual", "operations", "medical", "security"]>;
    zone: z.ZodString;
    type: z.ZodString;
    severity: z.ZodDefault<z.ZodEnum<["low", "medium", "high", "critical"]>>;
    payload: z.ZodRecord<z.ZodString, z.ZodUnknown>;
} & {
    id: z.ZodString;
    isOutcome: z.ZodDefault<z.ZodBoolean>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    domain: "navigation" | "crowd" | "transport" | "accessibility" | "sustainability" | "multilingual" | "operations" | "medical" | "security";
    zone: string;
    type: string;
    severity: "low" | "medium" | "high" | "critical";
    payload: Record<string, unknown>;
    id: string;
    isOutcome: boolean;
    createdAt: string;
}, {
    domain: "navigation" | "crowd" | "transport" | "accessibility" | "sustainability" | "multilingual" | "operations" | "medical" | "security";
    zone: string;
    type: string;
    payload: Record<string, unknown>;
    id: string;
    createdAt: string;
    severity?: "low" | "medium" | "high" | "critical" | undefined;
    isOutcome?: boolean | undefined;
}>;
export type OperationalEvent = z.infer<typeof OperationalEventSchema>;
export declare const EvidenceRefSchema: z.ZodObject<{
    eventId: z.ZodString;
    summary: z.ZodString;
}, "strip", z.ZodTypeAny, {
    eventId: string;
    summary: string;
}, {
    eventId: string;
    summary: string;
}>;
export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;
export declare const ExpectedImpactSchema: z.ZodObject<{
    description: z.ZodString;
    metric: z.ZodOptional<z.ZodString>;
    direction: z.ZodEnum<["increase", "decrease"]>;
    estimatedMagnitude: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    description: string;
    direction: "increase" | "decrease";
    metric?: string | undefined;
    estimatedMagnitude?: string | undefined;
}, {
    description: string;
    direction: "increase" | "decrease";
    metric?: string | undefined;
    estimatedMagnitude?: string | undefined;
}>;
export type ExpectedImpact = z.infer<typeof ExpectedImpactSchema>;
export declare const AlternativeSchema: z.ZodObject<{
    option: z.ZodString;
    pros: z.ZodString;
    cons: z.ZodString;
    confidence: z.ZodNumber;
    predictedHealthImpact: z.ZodNumber;
    isRecommended: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    option: string;
    pros: string;
    cons: string;
    confidence: number;
    predictedHealthImpact: number;
    isRecommended: boolean;
}, {
    option: string;
    pros: string;
    cons: string;
    confidence: number;
    predictedHealthImpact: number;
    isRecommended?: boolean | undefined;
}>;
export type Alternative = z.infer<typeof AlternativeSchema>;
export declare const HealthScoreImpactSchema: z.ZodObject<{
    current: z.ZodNumber;
    projected: z.ZodNumber;
    delta: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    current: number;
    projected: number;
    delta: number;
}, {
    current: number;
    projected: number;
    delta: number;
}>;
export type HealthScoreImpact = z.infer<typeof HealthScoreImpactSchema>;
export declare const PredictionSchema: z.ZodObject<{
    noActionOutcome: z.ZodString;
    predictedMetrics: z.ZodRecord<z.ZodString, z.ZodNumber>;
    healthScoreImpact: z.ZodObject<{
        current: z.ZodNumber;
        projected: z.ZodNumber;
        delta: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        current: number;
        projected: number;
        delta: number;
    }, {
        current: number;
        projected: number;
        delta: number;
    }>;
}, "strip", z.ZodTypeAny, {
    noActionOutcome: string;
    predictedMetrics: Record<string, number>;
    healthScoreImpact: {
        current: number;
        projected: number;
        delta: number;
    };
}, {
    noActionOutcome: string;
    predictedMetrics: Record<string, number>;
    healthScoreImpact: {
        current: number;
        projected: number;
        delta: number;
    };
}>;
export type Prediction = z.infer<typeof PredictionSchema>;
export declare const RecommendationSchema: z.ZodObject<{
    id: z.ZodString;
    situationId: z.ZodString;
    domain: z.ZodEnum<["navigation", "crowd", "transport", "accessibility", "sustainability", "multilingual", "operations", "medical", "security"]>;
    targetRoles: z.ZodArray<z.ZodEnum<["fan", "volunteer", "security", "medical", "organizer", "venue_operations", "accessibility_coordinator", "transportation_coordinator"]>, "many">;
    title: z.ZodString;
    recommendedAction: z.ZodString;
    reason: z.ZodString;
    evidence: z.ZodArray<z.ZodObject<{
        eventId: z.ZodString;
        summary: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        eventId: string;
        summary: string;
    }, {
        eventId: string;
        summary: string;
    }>, "many">;
    confidence: z.ZodNumber;
    expectedImpact: z.ZodObject<{
        description: z.ZodString;
        metric: z.ZodOptional<z.ZodString>;
        direction: z.ZodEnum<["increase", "decrease"]>;
        estimatedMagnitude: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        description: string;
        direction: "increase" | "decrease";
        metric?: string | undefined;
        estimatedMagnitude?: string | undefined;
    }, {
        description: string;
        direction: "increase" | "decrease";
        metric?: string | undefined;
        estimatedMagnitude?: string | undefined;
    }>;
    alternatives: z.ZodArray<z.ZodObject<{
        option: z.ZodString;
        pros: z.ZodString;
        cons: z.ZodString;
        confidence: z.ZodNumber;
        predictedHealthImpact: z.ZodNumber;
        isRecommended: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        option: string;
        pros: string;
        cons: string;
        confidence: number;
        predictedHealthImpact: number;
        isRecommended: boolean;
    }, {
        option: string;
        pros: string;
        cons: string;
        confidence: number;
        predictedHealthImpact: number;
        isRecommended?: boolean | undefined;
    }>, "many">;
    prediction: z.ZodObject<{
        noActionOutcome: z.ZodString;
        predictedMetrics: z.ZodRecord<z.ZodString, z.ZodNumber>;
        healthScoreImpact: z.ZodObject<{
            current: z.ZodNumber;
            projected: z.ZodNumber;
            delta: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            current: number;
            projected: number;
            delta: number;
        }, {
            current: number;
            projected: number;
            delta: number;
        }>;
    }, "strip", z.ZodTypeAny, {
        noActionOutcome: string;
        predictedMetrics: Record<string, number>;
        healthScoreImpact: {
            current: number;
            projected: number;
            delta: number;
        };
    }, {
        noActionOutcome: string;
        predictedMetrics: Record<string, number>;
        healthScoreImpact: {
            current: number;
            projected: number;
            delta: number;
        };
    }>;
    priority: z.ZodNumber;
    status: z.ZodEnum<["proposed", "approved", "rejected", "executed", "expired"]>;
    source: z.ZodEnum<["genai", "deterministic"]>;
    createdAt: z.ZodString;
    expiresAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    domain: "navigation" | "crowd" | "transport" | "accessibility" | "sustainability" | "multilingual" | "operations" | "medical" | "security";
    status: "proposed" | "approved" | "rejected" | "executed" | "expired";
    id: string;
    createdAt: string;
    confidence: number;
    situationId: string;
    targetRoles: ("medical" | "security" | "fan" | "volunteer" | "organizer" | "venue_operations" | "accessibility_coordinator" | "transportation_coordinator")[];
    title: string;
    recommendedAction: string;
    reason: string;
    evidence: {
        eventId: string;
        summary: string;
    }[];
    expectedImpact: {
        description: string;
        direction: "increase" | "decrease";
        metric?: string | undefined;
        estimatedMagnitude?: string | undefined;
    };
    alternatives: {
        option: string;
        pros: string;
        cons: string;
        confidence: number;
        predictedHealthImpact: number;
        isRecommended: boolean;
    }[];
    prediction: {
        noActionOutcome: string;
        predictedMetrics: Record<string, number>;
        healthScoreImpact: {
            current: number;
            projected: number;
            delta: number;
        };
    };
    priority: number;
    source: "genai" | "deterministic";
    expiresAt: string;
}, {
    domain: "navigation" | "crowd" | "transport" | "accessibility" | "sustainability" | "multilingual" | "operations" | "medical" | "security";
    status: "proposed" | "approved" | "rejected" | "executed" | "expired";
    id: string;
    createdAt: string;
    confidence: number;
    situationId: string;
    targetRoles: ("medical" | "security" | "fan" | "volunteer" | "organizer" | "venue_operations" | "accessibility_coordinator" | "transportation_coordinator")[];
    title: string;
    recommendedAction: string;
    reason: string;
    evidence: {
        eventId: string;
        summary: string;
    }[];
    expectedImpact: {
        description: string;
        direction: "increase" | "decrease";
        metric?: string | undefined;
        estimatedMagnitude?: string | undefined;
    };
    alternatives: {
        option: string;
        pros: string;
        cons: string;
        confidence: number;
        predictedHealthImpact: number;
        isRecommended?: boolean | undefined;
    }[];
    prediction: {
        noActionOutcome: string;
        predictedMetrics: Record<string, number>;
        healthScoreImpact: {
            current: number;
            projected: number;
            delta: number;
        };
    };
    priority: number;
    source: "genai" | "deterministic";
    expiresAt: string;
}>;
export type Recommendation = z.infer<typeof RecommendationSchema>;
export declare const SituationHypothesisSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    domains: z.ZodArray<z.ZodEnum<["navigation", "crowd", "transport", "accessibility", "sustainability", "multilingual", "operations", "medical", "security"]>, "many">;
    evidenceSignalIds: z.ZodArray<z.ZodString, "many">;
    severity: z.ZodEnum<["low", "medium", "high", "critical"]>;
    rationale: z.ZodString;
}, "strip", z.ZodTypeAny, {
    severity: "low" | "medium" | "high" | "critical";
    id: string;
    title: string;
    domains: ("navigation" | "crowd" | "transport" | "accessibility" | "sustainability" | "multilingual" | "operations" | "medical" | "security")[];
    evidenceSignalIds: string[];
    rationale: string;
}, {
    severity: "low" | "medium" | "high" | "critical";
    id: string;
    title: string;
    domains: ("navigation" | "crowd" | "transport" | "accessibility" | "sustainability" | "multilingual" | "operations" | "medical" | "security")[];
    evidenceSignalIds: string[];
    rationale: string;
}>;
export type SituationHypothesis = z.infer<typeof SituationHypothesisSchema>;
export declare const ImpactPredictionSchema: z.ZodObject<{
    situationId: z.ZodString;
    noActionOutcome: z.ZodString;
    predictedMetrics: z.ZodRecord<z.ZodString, z.ZodNumber>;
    timeHorizonMinutes: z.ZodNumber;
    healthScoreDelta: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    noActionOutcome: string;
    predictedMetrics: Record<string, number>;
    situationId: string;
    timeHorizonMinutes: number;
    healthScoreDelta: number;
}, {
    noActionOutcome: string;
    predictedMetrics: Record<string, number>;
    situationId: string;
    timeHorizonMinutes: number;
    healthScoreDelta: number;
}>;
export type ImpactPrediction = z.infer<typeof ImpactPredictionSchema>;
export declare const DecisionCreateSchema: z.ZodObject<{
    recommendationId: z.ZodString;
    outcome: z.ZodEnum<["approved", "rejected"]>;
    note: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    recommendationId: string;
    outcome: "approved" | "rejected";
    note?: string | undefined;
}, {
    recommendationId: string;
    outcome: "approved" | "rejected";
    note?: string | undefined;
}>;
export type DecisionCreate = z.infer<typeof DecisionCreateSchema>;
export declare const DecisionSchema: z.ZodObject<{
    recommendationId: z.ZodString;
    outcome: z.ZodEnum<["approved", "rejected"]>;
    note: z.ZodOptional<z.ZodString>;
} & {
    id: z.ZodString;
    actorRole: z.ZodEnum<["fan", "volunteer", "security", "medical", "organizer", "venue_operations", "accessibility_coordinator", "transportation_coordinator"]>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    recommendationId: string;
    outcome: "approved" | "rejected";
    actorRole: "medical" | "security" | "fan" | "volunteer" | "organizer" | "venue_operations" | "accessibility_coordinator" | "transportation_coordinator";
    note?: string | undefined;
}, {
    id: string;
    createdAt: string;
    recommendationId: string;
    outcome: "approved" | "rejected";
    actorRole: "medical" | "security" | "fan" | "volunteer" | "organizer" | "venue_operations" | "accessibility_coordinator" | "transportation_coordinator";
    note?: string | undefined;
}>;
export type Decision = z.infer<typeof DecisionSchema>;
export declare const HealthScoreSchema: z.ZodObject<{
    domains: z.ZodRecord<z.ZodEnum<["navigation", "crowd", "transport", "accessibility", "sustainability", "multilingual", "operations", "medical", "security"]>, z.ZodNumber>;
    overall: z.ZodNumber;
    trend: z.ZodEnum<["improving", "stable", "declining"]>;
    computedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    domains: Partial<Record<"navigation" | "crowd" | "transport" | "accessibility" | "sustainability" | "multilingual" | "operations" | "medical" | "security", number>>;
    overall: number;
    trend: "improving" | "stable" | "declining";
    computedAt: string;
}, {
    domains: Partial<Record<"navigation" | "crowd" | "transport" | "accessibility" | "sustainability" | "multilingual" | "operations" | "medical" | "security", number>>;
    overall: number;
    trend: "improving" | "stable" | "declining";
    computedAt: string;
}>;
export type HealthScore = z.infer<typeof HealthScoreSchema>;
export declare const MemoryEntrySchema: z.ZodObject<{
    id: z.ZodString;
    recommendationId: z.ZodString;
    situationSignature: z.ZodString;
    domain: z.ZodEnum<["navigation", "crowd", "transport", "accessibility", "sustainability", "multilingual", "operations", "medical", "security"]>;
    predictedMetrics: z.ZodRecord<z.ZodString, z.ZodNumber>;
    actualMetrics: z.ZodRecord<z.ZodString, z.ZodNumber>;
    predictionAccuracy: z.ZodNumber;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    domain: "navigation" | "crowd" | "transport" | "accessibility" | "sustainability" | "multilingual" | "operations" | "medical" | "security";
    id: string;
    createdAt: string;
    predictedMetrics: Record<string, number>;
    recommendationId: string;
    situationSignature: string;
    actualMetrics: Record<string, number>;
    predictionAccuracy: number;
}, {
    domain: "navigation" | "crowd" | "transport" | "accessibility" | "sustainability" | "multilingual" | "operations" | "medical" | "security";
    id: string;
    createdAt: string;
    predictedMetrics: Record<string, number>;
    recommendationId: string;
    situationSignature: string;
    actualMetrics: Record<string, number>;
    predictionAccuracy: number;
}>;
export type MemoryEntry = z.infer<typeof MemoryEntrySchema>;
export declare const AuditLogSchema: z.ZodObject<{
    id: z.ZodString;
    entityType: z.ZodEnum<["recommendation", "decision", "action", "event"]>;
    entityId: z.ZodString;
    action: z.ZodEnum<["created", "approved", "rejected", "executed", "expired"]>;
    actorRole: z.ZodOptional<z.ZodEnum<["fan", "volunteer", "security", "medical", "organizer", "venue_operations", "accessibility_coordinator", "transportation_coordinator"]>>;
    metadata: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    entityType: "recommendation" | "decision" | "action" | "event";
    action: "approved" | "rejected" | "executed" | "expired" | "created";
    entityId: string;
    metadata: Record<string, unknown>;
    actorRole?: "medical" | "security" | "fan" | "volunteer" | "organizer" | "venue_operations" | "accessibility_coordinator" | "transportation_coordinator" | undefined;
}, {
    id: string;
    createdAt: string;
    entityType: "recommendation" | "decision" | "action" | "event";
    action: "approved" | "rejected" | "executed" | "expired" | "created";
    entityId: string;
    metadata: Record<string, unknown>;
    actorRole?: "medical" | "security" | "fan" | "volunteer" | "organizer" | "venue_operations" | "accessibility_coordinator" | "transportation_coordinator" | undefined;
}>;
export type AuditLog = z.infer<typeof AuditLogSchema>;
export declare const ZoneMetricsSchema: z.ZodRecord<z.ZodString, z.ZodNumber>;
export declare const LiveStadiumStateSchema: z.ZodObject<{
    windowMinutes: z.ZodNumber;
    events: z.ZodArray<z.ZodObject<{
        domain: z.ZodEnum<["navigation", "crowd", "transport", "accessibility", "sustainability", "multilingual", "operations", "medical", "security"]>;
        zone: z.ZodString;
        type: z.ZodString;
        severity: z.ZodDefault<z.ZodEnum<["low", "medium", "high", "critical"]>>;
        payload: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    } & {
        id: z.ZodString;
        isOutcome: z.ZodDefault<z.ZodBoolean>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        domain: "navigation" | "crowd" | "transport" | "accessibility" | "sustainability" | "multilingual" | "operations" | "medical" | "security";
        zone: string;
        type: string;
        severity: "low" | "medium" | "high" | "critical";
        payload: Record<string, unknown>;
        id: string;
        isOutcome: boolean;
        createdAt: string;
    }, {
        domain: "navigation" | "crowd" | "transport" | "accessibility" | "sustainability" | "multilingual" | "operations" | "medical" | "security";
        zone: string;
        type: string;
        payload: Record<string, unknown>;
        id: string;
        createdAt: string;
        severity?: "low" | "medium" | "high" | "critical" | undefined;
        isOutcome?: boolean | undefined;
    }>, "many">;
    metrics: z.ZodObject<{
        zoneDensity: z.ZodRecord<z.ZodString, z.ZodNumber>;
        activeIncidents: z.ZodNumber;
        energyLoadPct: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        zoneDensity: Record<string, number>;
        activeIncidents: number;
        energyLoadPct: number;
    }, {
        zoneDensity: Record<string, number>;
        activeIncidents: number;
        energyLoadPct: number;
    }>;
    healthScore: z.ZodObject<{
        domains: z.ZodRecord<z.ZodEnum<["navigation", "crowd", "transport", "accessibility", "sustainability", "multilingual", "operations", "medical", "security"]>, z.ZodNumber>;
        overall: z.ZodNumber;
        trend: z.ZodEnum<["improving", "stable", "declining"]>;
        computedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        domains: Partial<Record<"navigation" | "crowd" | "transport" | "accessibility" | "sustainability" | "multilingual" | "operations" | "medical" | "security", number>>;
        overall: number;
        trend: "improving" | "stable" | "declining";
        computedAt: string;
    }, {
        domains: Partial<Record<"navigation" | "crowd" | "transport" | "accessibility" | "sustainability" | "multilingual" | "operations" | "medical" | "security", number>>;
        overall: number;
        trend: "improving" | "stable" | "declining";
        computedAt: string;
    }>;
}, "strip", z.ZodTypeAny, {
    windowMinutes: number;
    events: {
        domain: "navigation" | "crowd" | "transport" | "accessibility" | "sustainability" | "multilingual" | "operations" | "medical" | "security";
        zone: string;
        type: string;
        severity: "low" | "medium" | "high" | "critical";
        payload: Record<string, unknown>;
        id: string;
        isOutcome: boolean;
        createdAt: string;
    }[];
    metrics: {
        zoneDensity: Record<string, number>;
        activeIncidents: number;
        energyLoadPct: number;
    };
    healthScore: {
        domains: Partial<Record<"navigation" | "crowd" | "transport" | "accessibility" | "sustainability" | "multilingual" | "operations" | "medical" | "security", number>>;
        overall: number;
        trend: "improving" | "stable" | "declining";
        computedAt: string;
    };
}, {
    windowMinutes: number;
    events: {
        domain: "navigation" | "crowd" | "transport" | "accessibility" | "sustainability" | "multilingual" | "operations" | "medical" | "security";
        zone: string;
        type: string;
        payload: Record<string, unknown>;
        id: string;
        createdAt: string;
        severity?: "low" | "medium" | "high" | "critical" | undefined;
        isOutcome?: boolean | undefined;
    }[];
    metrics: {
        zoneDensity: Record<string, number>;
        activeIncidents: number;
        energyLoadPct: number;
    };
    healthScore: {
        domains: Partial<Record<"navigation" | "crowd" | "transport" | "accessibility" | "sustainability" | "multilingual" | "operations" | "medical" | "security", number>>;
        overall: number;
        trend: "improving" | "stable" | "declining";
        computedAt: string;
    };
}>;
export type LiveStadiumState = z.infer<typeof LiveStadiumStateSchema>;
export declare const ListRecommendationsQuerySchema: z.ZodObject<{
    role: z.ZodEnum<["fan", "volunteer", "security", "medical", "organizer", "venue_operations", "accessibility_coordinator", "transportation_coordinator"]>;
    domain: z.ZodOptional<z.ZodEnum<["navigation", "crowd", "transport", "accessibility", "sustainability", "multilingual", "operations", "medical", "security"]>>;
    status: z.ZodDefault<z.ZodOptional<z.ZodEnum<["proposed", "approved", "rejected", "executed", "expired"]>>>;
    lang: z.ZodDefault<z.ZodOptional<z.ZodEnum<["en", "es", "fr", "pt", "ar", "de"]>>>;
}, "strip", z.ZodTypeAny, {
    status: "proposed" | "approved" | "rejected" | "executed" | "expired";
    role: "medical" | "security" | "fan" | "volunteer" | "organizer" | "venue_operations" | "accessibility_coordinator" | "transportation_coordinator";
    lang: "en" | "es" | "fr" | "pt" | "ar" | "de";
    domain?: "navigation" | "crowd" | "transport" | "accessibility" | "sustainability" | "multilingual" | "operations" | "medical" | "security" | undefined;
}, {
    role: "medical" | "security" | "fan" | "volunteer" | "organizer" | "venue_operations" | "accessibility_coordinator" | "transportation_coordinator";
    domain?: "navigation" | "crowd" | "transport" | "accessibility" | "sustainability" | "multilingual" | "operations" | "medical" | "security" | undefined;
    status?: "proposed" | "approved" | "rejected" | "executed" | "expired" | undefined;
    lang?: "en" | "es" | "fr" | "pt" | "ar" | "de" | undefined;
}>;
export type ListRecommendationsQuery = z.infer<typeof ListRecommendationsQuerySchema>;
export declare const ListAuditQuerySchema: z.ZodObject<{
    entityType: z.ZodOptional<z.ZodEnum<["recommendation", "decision", "action", "event"]>>;
    entityId: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    entityType?: "recommendation" | "decision" | "action" | "event" | undefined;
    entityId?: string | undefined;
}, {
    entityType?: "recommendation" | "decision" | "action" | "event" | undefined;
    entityId?: string | undefined;
    limit?: number | undefined;
}>;
export type ListAuditQuery = z.infer<typeof ListAuditQuerySchema>;
export declare const ListMemoryQuerySchema: z.ZodObject<{
    domain: z.ZodOptional<z.ZodEnum<["navigation", "crowd", "transport", "accessibility", "sustainability", "multilingual", "operations", "medical", "security"]>>;
    limit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    domain?: "navigation" | "crowd" | "transport" | "accessibility" | "sustainability" | "multilingual" | "operations" | "medical" | "security" | undefined;
}, {
    domain?: "navigation" | "crowd" | "transport" | "accessibility" | "sustainability" | "multilingual" | "operations" | "medical" | "security" | undefined;
    limit?: number | undefined;
}>;
export type ListMemoryQuery = z.infer<typeof ListMemoryQuerySchema>;
export declare const IngestEventResponseSchema: z.ZodObject<{
    eventId: z.ZodString;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    createdAt: string;
    eventId: string;
}, {
    createdAt: string;
    eventId: string;
}>;
export type IngestEventResponse = z.infer<typeof IngestEventResponseSchema>;
export declare const CycleResponseSchema: z.ZodObject<{
    generated: z.ZodNumber;
    source: z.ZodEnum<["genai", "deterministic"]>;
    durationMs: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    source: "genai" | "deterministic";
    generated: number;
    durationMs: number;
}, {
    source: "genai" | "deterministic";
    generated: number;
    durationMs: number;
}>;
export type CycleResponse = z.infer<typeof CycleResponseSchema>;
export declare const DecisionResponseSchema: z.ZodObject<{
    recommendationId: z.ZodString;
    status: z.ZodEnum<["proposed", "approved", "rejected", "executed", "expired"]>;
    decisionId: z.ZodString;
    actionId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "proposed" | "approved" | "rejected" | "executed" | "expired";
    recommendationId: string;
    decisionId: string;
    actionId?: string | undefined;
}, {
    status: "proposed" | "approved" | "rejected" | "executed" | "expired";
    recommendationId: string;
    decisionId: string;
    actionId?: string | undefined;
}>;
export type DecisionResponse = z.infer<typeof DecisionResponseSchema>;
export declare const SSE_EVENT_TYPES: readonly ["recommendation.created", "event.ingested", "recommendation.updated", "cycle.completed", "health.updated", "memory.recorded"];
export type SseEventType = (typeof SSE_EVENT_TYPES)[number];
export declare const ErrorResponseSchema: z.ZodObject<{
    error: z.ZodObject<{
        code: z.ZodString;
        message: z.ZodString;
        details: z.ZodOptional<z.ZodUnknown>;
    }, "strip", z.ZodTypeAny, {
        code: string;
        message: string;
        details?: unknown;
    }, {
        code: string;
        message: string;
        details?: unknown;
    }>;
}, "strip", z.ZodTypeAny, {
    error: {
        code: string;
        message: string;
        details?: unknown;
    };
}, {
    error: {
        code: string;
        message: string;
        details?: unknown;
    };
}>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
//# sourceMappingURL=schemas.d.ts.map
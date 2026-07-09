// ============================================================
// Rules Engine — Deterministic Detectors
// Scans events against config-driven rules to produce signals.
// ALL thresholds from config/detection-rules.json.
// ============================================================

import type { OperationalEvent } from '@aegis/shared';
import type { DetectionRule, DetectionRulesConfig } from '../../infrastructure/config/config-loader.js';

export interface CandidateSignal {
  id: string;
  ruleId: string;
  domain: string;
  zone: string;
  type: string;
  severity: string;
  summary: string;
  evidenceEventIds: string[];
}

let signalCounter = 0;

/**
 * Scan events against all detection rules and produce candidate signals.
 * Pure function — no I/O, no side effects.
 */
export function detectSituations(
  events: OperationalEvent[],
  config: DetectionRulesConfig
): CandidateSignal[] {
  const signals: CandidateSignal[] = [];

  for (const rule of config.rules) {
    const ruleSignals = evaluateRule(rule, events);
    signals.push(...ruleSignals);
  }

  return signals;
}

function evaluateRule(
  rule: DetectionRule,
  events: OperationalEvent[]
): CandidateSignal[] {
  const signals: CandidateSignal[] = [];
  const domainEvents = events.filter((e) => e.domain === rule.domain);

  switch (rule.trigger) {
    case 'zone_density_above_threshold': {
      const threshold = rule.threshold ?? 0.85;
      const densityEvents = domainEvents.filter(
        (e) => e.type === 'density_reading'
      );
      const byZone = groupByZone(densityEvents);

      for (const [zone, zoneEvents] of Object.entries(byZone)) {
        const latest = zoneEvents[0];
        if (!latest) continue;
        const payload = safeParsePayload(latest.payload);
        const density = (payload['density'] as number) ?? 0;

        if (density > threshold) {
          signals.push(makeSignal(rule, zone, `Zone ${zone} density at ${density.toFixed(2)} (threshold: ${threshold})`, [latest.id]));
        }
      }
      break;
    }

    case 'ingress_rate_spike': {
      const multiplier = rule.multiplier ?? 2.0;
      const ingressEvents = domainEvents.filter(
        (e) => e.type === 'ingress_rate'
      );
      for (const event of ingressEvents) {
        const payload = safeParsePayload(event.payload);
        const rate = (payload['rate'] as number) ?? 0;
        const baseline = (payload['baseline'] as number) ?? 1;
        if (baseline > 0 && rate / baseline > multiplier) {
          signals.push(makeSignal(rule, event.zone, `Ingress rate ${(rate / baseline).toFixed(1)}x baseline at ${event.zone}`, [event.id]));
        }
      }
      break;
    }

    case 'gate_closed_adjacent_density_high': {
      const threshold = rule.threshold ?? 0.75;
      const closedGates = domainEvents.filter(
        (e) => e.type === 'gate_status' && safeParsePayload(e.payload)['status'] === 'closed'
      );
      const densityEvents = events.filter(
        (e) => e.domain === 'crowd' && e.type === 'density_reading'
      );

      for (const closed of closedGates) {
        const nearbyDensity = densityEvents.filter((de) => {
          const p = safeParsePayload(de.payload);
          return (p['density'] as number) > threshold;
        });
        if (nearbyDensity.length > 0) {
          const firstNearby = nearbyDensity[0]!;
          signals.push(makeSignal(rule, closed.zone, `Gate ${closed.zone} closed while adjacent zones have high density`, [closed.id, firstNearby.id]));
        }
      }
      break;
    }

    case 'incident_severity_above': {
      const minSev = rule.minimumSeverity ?? 'high';
      const sevOrder = ['low', 'medium', 'high', 'critical'];
      const minIdx = sevOrder.indexOf(minSev);

      const incidents = domainEvents.filter(
        (e) => e.type === 'medical_incident' || e.type === 'incident'
      );
      for (const inc of incidents) {
        if (sevOrder.indexOf(inc.severity) >= minIdx) {
          signals.push(makeSignal(rule, inc.zone, `${rule.domain} incident (${inc.severity}) at ${inc.zone}`, [inc.id]));
        }
      }
      break;
    }

    case 'crowd_incident_co_located': {
      const crowdEvents = events.filter(
        (e) => e.domain === 'crowd' && e.type === 'density_reading'
      );
      const incidents = domainEvents.filter(
        (e) => e.type === 'incident' || e.type === 'security_incident'
      );

      for (const inc of incidents) {
        const coLocated = crowdEvents.filter((ce) => ce.zone === inc.zone);
        if (coLocated.length > 0) {
          const firstCoLocated = coLocated[0]!;
          signals.push(makeSignal(rule, inc.zone, `Security incident co-located with crowd at ${inc.zone}`, [inc.id, firstCoLocated.id]));
        }
      }
      break;
    }

    case 'shuttle_delay_near_egress': {
      const delayThreshold = rule.delayThresholdMinutes ?? 10;
      const delays = domainEvents.filter(
        (e) => e.type === 'shuttle_delay'
      );
      for (const delay of delays) {
        const payload = safeParsePayload(delay.payload);
        const delayMin = (payload['delayMinutes'] as number) ?? 0;
        if (delayMin > delayThreshold) {
          signals.push(makeSignal(rule, delay.zone, `Shuttle delay of ${delayMin}min at ${delay.zone} (threshold: ${delayThreshold}min)`, [delay.id]));
        }
      }
      break;
    }

    case 'accessible_route_congested_or_queue': {
      const densityThreshold = rule.densityThreshold ?? 0.7;
      const queueThreshold = rule.queueThreshold ?? 5;

      for (const event of domainEvents) {
        const payload = safeParsePayload(event.payload);
        const density = (payload['density'] as number) ?? 0;
        const queue = (payload['queueLength'] as number) ?? 0;

        if (density > densityThreshold || queue > queueThreshold) {
          signals.push(makeSignal(rule, event.zone, `Accessibility issue at ${event.zone}: density=${density.toFixed(2)}, queue=${queue}`, [event.id]));
        }
      }
      break;
    }

    case 'energy_load_above': {
      const threshold = rule.threshold ?? 0.9;
      const energyEvents = domainEvents.filter(
        (e) => e.type === 'energy_reading'
      );
      for (const event of energyEvents) {
        const payload = safeParsePayload(event.payload);
        const load = (payload['loadPct'] as number) ?? 0;
        if (load > threshold) {
          signals.push(makeSignal(rule, event.zone, `Energy load at ${(load * 100).toFixed(0)}% (threshold: ${(threshold * 100).toFixed(0)}%)`, [event.id]));
        }
      }
      break;
    }

    case 'fan_alert_multi_language': {
      const alerts = domainEvents.filter(
        (e) => e.type === 'fan_alert' || e.type === 'broadcast_request'
      );
      for (const alert of alerts) {
        signals.push(makeSignal(rule, alert.zone, `Multilingual broadcast needed at ${alert.zone}`, [alert.id]));
      }
      break;
    }
  }

  return signals;
}

// ── Helpers ───────────────────────────────────────────────────

function makeSignal(
  rule: DetectionRule,
  zone: string,
  summary: string,
  evidenceEventIds: string[]
): CandidateSignal {
  signalCounter++;
  return {
    id: `sig_${Date.now()}_${signalCounter}`,
    ruleId: rule.id,
    domain: rule.domain,
    zone,
    type: rule.signalType,
    severity: rule.severity,
    summary,
    evidenceEventIds,
  };
}

function groupByZone(
  events: OperationalEvent[]
): Record<string, OperationalEvent[]> {
  const map: Record<string, OperationalEvent[]> = {};
  for (const e of events) {
    if (!map[e.zone]) map[e.zone] = [];
    map[e.zone]!.push(e);
  }
  return map;
}

function safeParsePayload(payload: string | Record<string, unknown>): Record<string, unknown> {
  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return payload;
}

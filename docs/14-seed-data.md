# 14 — Seed Data & Simulation

## Executive Summary

**WHY:** AEGIS uses simulated operational events instead of real IoT integration. The seed data and event simulator must be realistic enough to demonstrate cross-domain reasoning, explainability, and the full approval workflow.

---

## Venue Model

### MetLife Stadium (FIFA World Cup 2026 Venue)

```
Capacity: ~82,500
Gates: 20 (Gate-1 through Gate-20)
Zones:
  - gate-1 through gate-20        (ingress/egress)
  - concourse-north               (circulation)
  - concourse-south               (circulation)
  - concourse-east                (circulation)
  - concourse-west                (circulation)
  - concession-north-1            (food/beverage)
  - concession-south-1            (food/beverage)
  - medical-station-1             (medical)
  - medical-station-2             (medical)
  - security-post-north           (security)
  - security-post-south           (security)
  - accessible-entrance-1         (accessibility)
  - accessible-entrance-2         (accessibility)
  - transport-hub-east            (transportation)
  - transport-hub-west            (transportation)
  - parking-lot-a                 (transportation)
  - parking-lot-b                 (transportation)
  - field-level                   (operations)
  - vip-zone                      (operations)
  - energy-plant                  (sustainability)
  - waste-station-1               (sustainability)
```

---

## Match-Day Scenario Timeline

The seed data models a **USA vs. Brazil** group stage match. Events span the full match-day lifecycle:

### Phase 1: Pre-Match (T-120min to T-0)

| Time Offset | Domain | Zone | Event Type | Severity | Description |
|---|---|---|---|---|---|
| T-120 | operations | field-level | match_setup | low | Match setup confirmed: USA vs Brazil |
| T-90 | transport | transport-hub-east | shuttle_status | low | Shuttles running on schedule |
| T-75 | crowd | gate-7 | density_reading | medium | Early crowd buildup at Gate 7 |
| T-60 | accessibility | accessible-entrance-1 | assistance_request | medium | 3 wheelchair assistance requests queued |
| T-45 | crowd | gate-7 | density_reading | high | Gate 7 density at 0.87 |
| T-45 | crowd | gate-12 | density_reading | low | Gate 12 density at 0.22 |
| T-30 | transport | transport-hub-east | shuttle_delay | medium | Shuttle line B delayed 12 minutes |
| T-30 | sustainability | energy-plant | energy_load | medium | Energy load at 78% capacity |
| T-15 | security | gate-7 | crowd_behavior | medium | Crowd behavior elevated near Gate 7 |
| T-15 | crowd | gate-7 | density_reading | critical | Gate 7 density at 0.93 — crush risk |

### Phase 2: Match Active (T+0 to T+90)

| Time Offset | Domain | Zone | Event Type | Severity | Description |
|---|---|---|---|---|---|
| T+5 | crowd | concourse-north | density_reading | high | Concourse congestion from late arrivals |
| T+12 | medical | section-114 | medical_incident | high | Fan medical incident — suspected heat exhaustion |
| T+20 | sustainability | energy-plant | energy_load | high | Energy load at 91% — peak cooling demand |
| T+35 | multilingual | field-level | announcement_needed | medium | Safety announcement needed in 4 languages |
| T+45 | crowd | concourse-south | density_reading | high | Halftime rush to concessions |
| T+48 | accessibility | concourse-north | route_congestion | high | Accessible route blocked by crowd |
| T+60 | security | vip-zone | unauthorized_access | medium | Unauthorized access attempt at VIP |
| T+75 | transport | transport-hub-west | surge_prediction | medium | Post-match egress surge predicted in 15min |
| T+88 | crowd | gate-3 | density_reading | medium | Pre-egress buildup at Gate 3 |

### Phase 3: Post-Match Egress (T+90 to T+180)

| Time Offset | Domain | Zone | Event Type | Severity | Description |
|---|---|---|---|---|---|
| T+92 | crowd | gate-7 | density_reading | critical | Egress crush risk at Gate 7 |
| T+92 | crowd | gate-12 | density_reading | low | Gate 12 underutilized for egress |
| T+95 | transport | parking-lot-a | congestion | high | Parking lot A gridlocked |
| T+100 | accessibility | accessible-entrance-2 | assistance_queue | high | 8 wheelchair users waiting for assistance |
| T+110 | sustainability | waste-station-1 | waste_overflow | medium | Waste station 1 nearing capacity |
| T+120 | transport | transport-hub-east | shuttle_status | low | All shuttles dispatched; 15min wait |

---

## Expected Cross-Domain Situations (for Reasoning Validation)

The seed data is designed to trigger these cross-domain correlations:

| Situation | Domains | Evidence Events | Expected Recommendation |
|---|---|---|---|
| Gate 7 crush risk + Gate 12 available | crowd, navigation | density readings at both gates | Reroute crowd from Gate 7 to Gate 12 |
| Medical incident + congested accessible route | medical, accessibility | medical incident + route congestion | Clear accessible route priority; reroute medical |
| Shuttle delay + egress surge predicted | transport, crowd | shuttle delay + egress prediction | Stagger egress announcements; dispatch backup shuttles |
| Energy spike + sustainability target | sustainability, operations | energy load at 91% | Reduce non-essential lighting; defer systems |
| Halftime crowd + accessibility blockage | crowd, accessibility | concourse density + accessible route blocked | Redirect crowd flow; deploy volunteer assistance |

---

## Multi-Persona Event Cascade Scenarios

**WHY:** These demonstrate that a single operational event triggers role-specific recommendations across the entire organization — proving cross-domain intelligence.

### Cascade 1: Medical Incident at Section 114

**Trigger event:** `{ domain: "medical", zone: "section-114", type: "medical_incident", severity: "high" }`

| Target Role | Recommendation | Predicted Health Impact |
|---|---|---|
| Medical | Deploy nearest medical team via Route B (fastest clear route) | Medical: +8 |
| Security | Dispatch security to Section 114 for crowd control around incident | Security: +5 |
| Volunteer | Redirect volunteer V-23 to assist and manage bystanders | Operations: +3 |
| Accessibility Coordinator | Clear accessible route near Section 114 for medical equipment access | Accessibility: +6 |
| Fan (nearby sectors) | Safety notice: avoid Section 114 area, use Gate 9 for exit | Navigation: +4 |
| Transportation Coordinator | Pre-position ambulance at Transport Hub East | Transport: +3 |
| Organizer | Cross-domain situation summary: medical incident with 6 coordinated actions | Overall: +5 |

### Cascade 2: Gate 7 Crush Risk at Egress

**Trigger events:** `density_reading(gate-7, 0.93)` + `shuttle_delay(transport-hub-east, 12min)` + `route_congestion(accessible-entrance-1)`

| Target Role | Recommendation | Predicted Health Impact |
|---|---|---|
| Venue Operations | Reroute crowd from Gate 7 to Gates 9 and 12 | Crowd: +13 |
| Security | Deploy crowd control team to Gate 7 perimeter | Security: +4 |
| Transportation Coordinator | Stagger egress announcements; dispatch backup shuttles | Transport: +7 |
| Accessibility Coordinator | Open alternate accessible exit at Entrance 2 | Accessibility: +8 |
| Fan (Gate 7 area) | Multilingual alert: use Gate 9 or Gate 12 for faster exit | Navigation: +6 |
| Volunteer | Deploy to Gates 9 and 12 to assist redirected crowd | Operations: +3 |

### Cascade 3: Energy Spike + Sustainability Alert

**Trigger events:** `energy_load(energy-plant, 0.93)` + `waste_overflow(waste-station-1)`

| Target Role | Recommendation | Predicted Health Impact |
|---|---|---|
| Venue Operations | Reduce non-essential lighting in parking areas | Sustainability: +6 |
| Venue Operations | Dispatch waste management to Station 1 | Sustainability: +4 |
| Organizer | Sustainability alert: two concurrent environmental issues | Overall: +3 |

---

## Event Simulator

```typescript
// infrastructure/seed/event-simulator.ts

/**
 * The simulator emits events on a timer to demonstrate live reasoning.
 * 
 * Mode 1: REPLAY — replays seed events with compressed time.
 * Mode 2: RANDOM — generates plausible random events within scenario bounds.
 * 
 * Configurable:
 *   AEGIS_SIM_MODE = replay | random (default: replay)
 *   AEGIS_SIM_INTERVAL_MS = 5000 (emit every 5s)
 */

interface SimulatorConfig {
  mode: 'replay' | 'random';
  intervalMs: number;
  events: OperationalEventSeed[];
}
```

---

## Seed Data Format

```typescript
// infrastructure/seed/seed-data.ts
export const SEED_EVENTS: OperationalEventSeed[] = [
  {
    domain: 'crowd',
    zone: 'gate-7',
    type: 'density_reading',
    severity: 'high',
    payload: { density: 0.87, count: 3800, capacity: 4400 },
    offsetMinutes: -45,  // relative to match start
  },
  // ... 30-50 events covering all domains and phases
];
```

### Payload Schemas (per domain)

| Domain | Payload Fields |
|---|---|
| crowd | `{ density: float, count: int, capacity: int }` |
| medical | `{ incidentType: string, severity: string, patientCount: int }` |
| security | `{ alertType: string, personnelNeeded: int }` |
| transport | `{ vehicleType: string, delayMinutes: int, affectedPassengers: int }` |
| accessibility | `{ requestType: string, queueLength: int, waitMinutes: int }` |
| sustainability | `{ metric: string, currentValue: float, threshold: float, unit: string }` |
| navigation | `{ routeId: string, status: string, alternateRoutes: string[] }` |
| multilingual | `{ messageType: string, targetLanguages: string[], urgency: string }` |
| operations | `{ eventType: string, description: string }` |

---

## Seed Data Definition of Done

- [ ] Events cover all 9 domains.
- [ ] Events cover all 3 match phases (pre, active, post).
- [ ] At least 3 cross-domain situations are triggerable.
- [ ] At least 2 multi-persona cascade scenarios demonstrable.
- [ ] Each seed recommendation includes alternatives and predictions for testing.
- [ ] Seed file < 100KB.
- [ ] Simulator runs without errors.
- [ ] Deterministic reasoner produces valid recommendations from seed data.
- [ ] Outcome evaluation can measure prediction accuracy from seed scenario.

// ============================================================
// Seed Script — Populates the database with realistic events
// so the app looks alive from the moment a judge opens it.
// Run via: npx tsx apps/api/src/seed.ts
// ============================================================

import type { EventRepository } from './domain/ports/index.js';
import type { Domain, Severity } from '@aegis/shared';

interface SeedEvent {
  domain: Domain;
  zone: string;
  type: string;
  severity: Severity;
  payload: Record<string, unknown>;
}

const SEED_EVENTS: SeedEvent[] = [
  // Crowd density readings
  { domain: 'crowd', zone: 'gate-a', type: 'density_reading', severity: 'medium', payload: { density: 0.85, headcount: 4200, capacity: 5000, trend: 'increasing' } },
  { domain: 'crowd', zone: 'gate-b', type: 'density_reading', severity: 'low', payload: { density: 0.45, headcount: 1800, capacity: 4000, trend: 'stable' } },
  { domain: 'crowd', zone: 'gate-c', type: 'density_reading', severity: 'low', payload: { density: 0.30, headcount: 600, capacity: 2000, trend: 'decreasing' } },
  { domain: 'crowd', zone: 'gate-d', type: 'density_reading', severity: 'low', payload: { density: 0.55, headcount: 2200, capacity: 4000, trend: 'stable' } },
  { domain: 'crowd', zone: 'section-120', type: 'density_reading', severity: 'high', payload: { density: 0.92, headcount: 920, capacity: 1000, summary: 'Food court section at near capacity' } },
  { domain: 'crowd', zone: 'concourse-100', type: 'density_reading', severity: 'medium', payload: { density: 0.70, headcount: 5600, capacity: 8000, trend: 'increasing' } },

  // Security events
  { domain: 'security', zone: 'gate-a', type: 'incident', severity: 'medium', payload: { summary: 'Unauthorized vendor detected near Gate A', category: 'unauthorized_access', status: 'investigating' } },
  { domain: 'security', zone: 'parking-lot-g', type: 'incident', severity: 'low', payload: { summary: 'Minor vehicle fender-bender in Lot G', category: 'traffic', status: 'resolved' } },

  // Medical events
  { domain: 'medical', zone: 'section-108', type: 'medical_incident', severity: 'high', payload: { summary: 'Fan reported heat exhaustion symptoms in Section 108', category: 'heat_related', ageGroup: 'adult', status: 'treating' } },
  { domain: 'medical', zone: 'section-215', type: 'medical_incident', severity: 'medium', payload: { summary: 'Minor fall on stairs between Section 215-216', category: 'fall', ageGroup: 'senior', status: 'responding' } },

  // Transport events
  { domain: 'transport', zone: 'nj-transit', type: 'transit_update', severity: 'medium', payload: { summary: 'NJ Transit trains running 8-minute delays from Penn Station', line: 'Meadowlands', delay_minutes: 8 } },
  { domain: 'transport', zone: 'parking-lot-a', type: 'parking_status', severity: 'high', payload: { summary: 'Lot A is 95% full — directing overflow to Lot E', occupancy: 0.95, overflow: 'lot-e' } },
  { domain: 'transport', zone: 'rideshare-zone', type: 'rideshare_status', severity: 'low', payload: { summary: 'Rideshare pickup zone operating normally', avgWait: '6 minutes', surge: false } },

  // Sustainability
  { domain: 'sustainability', zone: 'stadium-wide', type: 'energy_reading', severity: 'low', payload: { loadPct: 72, renewablePct: 35, summary: 'Energy load at 72%, 35% from solar panels' } },
  { domain: 'sustainability', zone: 'waste-station-1', type: 'waste_reading', severity: 'medium', payload: { fillLevel: 0.80, recyclingRate: 0.62, summary: 'Waste station 1 at 80% capacity, recycling rate 62%' } },

  // Accessibility
  { domain: 'accessibility', zone: 'elevator-south', type: 'facility_status', severity: 'high', payload: { summary: 'South elevator temporarily out of service — repair crew dispatched', facility: 'elevator', status: 'out_of_service', eta_minutes: 25 } },
  { domain: 'accessibility', zone: 'gate-d', type: 'facility_status', severity: 'low', payload: { summary: 'All accessible ramps at Gate D operating normally', facility: 'ramp', status: 'operational' } },

  // Operations
  { domain: 'operations', zone: 'concessions', type: 'supply_alert', severity: 'medium', payload: { summary: 'Water bottle supply low at 100-level concessions — restocking in progress', item: 'water_bottles', remaining_pct: 15 } },
  { domain: 'operations', zone: 'section-120', type: 'queue_alert', severity: 'high', payload: { summary: 'International Food Court queue exceeds 15 minutes', avgWaitMinutes: 17, queueLength: 85 } },

  // Navigation
  { domain: 'navigation', zone: 'gate-a', type: 'congestion_alert', severity: 'medium', payload: { summary: 'Gate A entrance congested — consider Gate B or D for faster entry', avgEntryTime: '12 minutes' } },
];

export async function seedDatabase(eventRepo: EventRepository, prisma: any): Promise<number> {
  console.log('[SEED] Cleaning database for fresh demo data...');
  
  try {
    await prisma.event.deleteMany({});
    await prisma.recommendation.deleteMany({});
    await prisma.healthSnapshot.deleteMany({});
    console.log('[SEED] Database cleaned.');
  } catch (err) {
    console.log('[SEED] Could not clean DB:', err);
  }

  console.log(`[SEED] Inserting ${SEED_EVENTS.length} realistic stadium events...`);
  
  let count = 0;
  for (const event of SEED_EVENTS) {
    await eventRepo.create({
      domain: event.domain,
      zone: event.zone,
      type: event.type,
      severity: event.severity,
      payload: event.payload,
      isOutcome: false,
    });
    count++;
  }

  console.log(`[SEED] ✅ Inserted ${count} events. The stadium is now alive!`);
  return count;
}

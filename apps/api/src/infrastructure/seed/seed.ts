// ============================================================
// Seed Data — Match-day simulation for MetLife Stadium
// Populates realistic operational events across all 9 domains.
// Run with: npm run db:seed
// ============================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface SeedEvent {
  domain: string;
  zone: string;
  type: string;
  severity: string;
  payload: Record<string, unknown>;
  offsetMinutes: number; // minutes from match start
}

// ── Match-Day Timeline Events ─────────────────────────────────
// Phase 1: Pre-match (T-60 to T-0)
// Phase 2: Active match (T+0 to T+90)
// Phase 3: Post-match / Egress (T+90 to T+120)

const seedEvents: SeedEvent[] = [
  // ── PRE-MATCH: Ingress Phase ───────────────────────────────
  { domain: 'crowd', zone: 'gate-7', type: 'density_reading', severity: 'low', payload: { density: 0.45, count: 1800 }, offsetMinutes: -55 },
  { domain: 'crowd', zone: 'gate-1', type: 'density_reading', severity: 'low', payload: { density: 0.38, count: 1140 }, offsetMinutes: -50 },
  { domain: 'crowd', zone: 'gate-7', type: 'density_reading', severity: 'medium', payload: { density: 0.72, count: 2880 }, offsetMinutes: -40 },
  { domain: 'crowd', zone: 'gate-7', type: 'ingress_rate', severity: 'medium', payload: { rate: 450, baseline: 200 }, offsetMinutes: -35 },
  { domain: 'transport', zone: 'transport-hub-east', type: 'shuttle_delay', severity: 'low', payload: { delayMinutes: 5, shuttleId: 'S-12' }, offsetMinutes: -45 },
  { domain: 'accessibility', zone: 'accessible-entrance-1', type: 'assistance_request', severity: 'low', payload: { queueLength: 3, waitMinutes: 8 }, offsetMinutes: -42 },
  { domain: 'sustainability', zone: 'energy-plant', type: 'energy_reading', severity: 'low', payload: { loadPct: 0.65, kw: 4200 }, offsetMinutes: -50 },

  // ── Cascade Scenario 1: Gate 7 Crush Risk ──────────────────
  { domain: 'crowd', zone: 'gate-7', type: 'density_reading', severity: 'high', payload: { density: 0.91, count: 3640 }, offsetMinutes: -20 },
  { domain: 'crowd', zone: 'gate-7', type: 'ingress_rate', severity: 'high', payload: { rate: 520, baseline: 200 }, offsetMinutes: -18 },
  { domain: 'navigation', zone: 'gate-5', type: 'gate_status', severity: 'medium', payload: { status: 'closed', reason: 'maintenance' }, offsetMinutes: -19 },
  { domain: 'accessibility', zone: 'accessible-entrance-1', type: 'route_congestion', severity: 'high', payload: { density: 0.82, queueLength: 8, waitMinutes: 22 }, offsetMinutes: -17 },

  // ── ACTIVE MATCH ───────────────────────────────────────────
  { domain: 'crowd', zone: 'concourse-north', type: 'density_reading', severity: 'medium', payload: { density: 0.68, count: 8160 }, offsetMinutes: 15 },
  { domain: 'crowd', zone: 'concourse-east', type: 'density_reading', severity: 'low', payload: { density: 0.42, count: 4200 }, offsetMinutes: 20 },
  { domain: 'sustainability', zone: 'energy-plant', type: 'energy_reading', severity: 'medium', payload: { loadPct: 0.82, kw: 5300 }, offsetMinutes: 25 },

  // ── Cascade Scenario 2: Medical Incident at Section 114 ────
  { domain: 'medical', zone: 'section-114', type: 'medical_incident', severity: 'high', payload: { type: 'cardiac_event', respondersNeeded: 2, nearestStation: 'medical-station-1' }, offsetMinutes: 35 },
  { domain: 'crowd', zone: 'section-114', type: 'density_reading', severity: 'medium', payload: { density: 0.75, count: 3375 }, offsetMinutes: 36 },
  { domain: 'security', zone: 'section-114', type: 'security_incident', severity: 'medium', payload: { type: 'crowd_gathering', reason: 'medical_response' }, offsetMinutes: 37 },

  // ── Halftime Surge ─────────────────────────────────────────
  { domain: 'crowd', zone: 'concourse-north', type: 'density_reading', severity: 'high', payload: { density: 0.88, count: 10560 }, offsetMinutes: 45 },
  { domain: 'crowd', zone: 'concourse-south', type: 'density_reading', severity: 'medium', payload: { density: 0.71, count: 8520 }, offsetMinutes: 46 },
  { domain: 'sustainability', zone: 'energy-plant', type: 'energy_reading', severity: 'high', payload: { loadPct: 0.93, kw: 6000 }, offsetMinutes: 47 },
  { domain: 'sustainability', zone: 'waste-station-1', type: 'waste_level', severity: 'medium', payload: { fillPct: 0.85 }, offsetMinutes: 48 },
  { domain: 'accessibility', zone: 'concourse-north', type: 'route_congestion', severity: 'high', payload: { density: 0.88, queueLength: 12, waitMinutes: 35 }, offsetMinutes: 46 },

  // ── Multilingual Alert ─────────────────────────────────────
  { domain: 'multilingual', zone: 'concourse-north', type: 'fan_alert', severity: 'low', payload: { message: 'Please use alternate concourse routes during halftime', audiences: ['es', 'fr', 'pt', 'ar'] }, offsetMinutes: 47 },

  // ── POST-MATCH: Egress Phase ───────────────────────────────
  { domain: 'crowd', zone: 'gate-7', type: 'density_reading', severity: 'high', payload: { density: 0.93, count: 3720 }, offsetMinutes: 95 },
  { domain: 'crowd', zone: 'gate-9', type: 'density_reading', severity: 'medium', payload: { density: 0.62, count: 2170 }, offsetMinutes: 96 },
  { domain: 'transport', zone: 'transport-hub-east', type: 'shuttle_delay', severity: 'high', payload: { delayMinutes: 12, shuttleId: 'S-08', reason: 'traffic_congestion' }, offsetMinutes: 97 },
  { domain: 'transport', zone: 'transport-hub-west', type: 'shuttle_delay', severity: 'medium', payload: { delayMinutes: 7, shuttleId: 'S-15', reason: 'high_demand' }, offsetMinutes: 98 },
  { domain: 'accessibility', zone: 'accessible-entrance-2', type: 'assistance_request', severity: 'medium', payload: { queueLength: 6, waitMinutes: 18, type: 'wheelchair_assistance' }, offsetMinutes: 99 },

  // ── Cascade Scenario 3: Energy Spike ───────────────────────
  { domain: 'sustainability', zone: 'energy-plant', type: 'energy_reading', severity: 'high', payload: { loadPct: 0.94, kw: 6100 }, offsetMinutes: 100 },
  { domain: 'sustainability', zone: 'waste-station-1', type: 'waste_level', severity: 'high', payload: { fillPct: 0.92, overflow_risk: true }, offsetMinutes: 101 },

  // ── Late security incident ─────────────────────────────────
  { domain: 'security', zone: 'parking-b', type: 'incident', severity: 'medium', payload: { type: 'unauthorized_access', gate: 'gate-3' }, offsetMinutes: 105 },
];

async function seed(): Promise<void> {
  console.log('🌱 Seeding AEGIS database...\n');

  // Clear existing data
  await prisma.operationalMemory.deleteMany();
  await prisma.healthSnapshot.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.action.deleteMany();
  await prisma.decision.deleteMany();
  await prisma.recommendationLocalization.deleteMany();
  await prisma.recommendation.deleteMany();
  await prisma.situation.deleteMany();
  await prisma.operationalEvent.deleteMany();

  console.log('   Cleared existing data.');

  // Insert seed events with realistic timestamps
  const matchStartTime = new Date();
  matchStartTime.setMinutes(matchStartTime.getMinutes() - 30); // Match started 30min ago

  let count = 0;
  for (const seedEvent of seedEvents) {
    const eventTime = new Date(matchStartTime.getTime() + seedEvent.offsetMinutes * 60 * 1000);

    await prisma.operationalEvent.create({
      data: {
        domain: seedEvent.domain,
        zone: seedEvent.zone,
        type: seedEvent.type,
        severity: seedEvent.severity,
        payload: JSON.stringify(seedEvent.payload),
        isOutcome: false,
        createdAt: eventTime,
      },
    });
    count++;
  }

  console.log(`   ✅ Inserted ${count} operational events across all 9 domains.`);
  console.log('   📊 Covers: pre-match, active match, halftime, post-match phases.');
  console.log('   🔗 Includes 3 multi-persona cascade scenarios.');

  // Create initial health snapshot
  await prisma.healthSnapshot.create({
    data: {
      domains: JSON.stringify({
        navigation: 85,
        crowd: 62,
        transport: 74,
        accessibility: 71,
        sustainability: 68,
        multilingual: 95,
        operations: 88,
        medical: 78,
        security: 82,
      }),
      overall: 78,
      trend: 'declining',
    },
  });

  console.log('   ✅ Initial health score snapshot created.\n');
  console.log('🎯 Seed complete! Run the API to start reasoning over this data.\n');

  await prisma.$disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

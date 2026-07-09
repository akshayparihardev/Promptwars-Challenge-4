import { describe, it, expect } from 'vitest';
import { detectSituations } from '../src/domain/rules/rules-engine.js';
import type { DetectionRulesConfig } from '../src/infrastructure/config/config-loader.js';
import type { OperationalEvent } from '@aegis/shared';

describe('Rules Engine', () => {
  const config: DetectionRulesConfig = {
    rules: [
      {
        id: 'rule1',
        domain: 'crowd',
        name: 'High crowd',
        trigger: 'incident_severity_above',
        severity: 'high',
        signalType: 'overcrowding'
      },
      {
        id: 'rule2',
        domain: 'security',
        name: 'Gate breach',
        trigger: 'incident_severity_above',
        severity: 'critical',
        signalType: 'breach'
      }
    ]
  };

  it('should detect high severity events and convert them to signals', () => {
    const events = [
      { id: '1', domain: 'crowd', severity: 'high', zone: 'gate-a', type: 'incident', payload: { summary: 'A surge' } } as unknown as OperationalEvent,
      { id: '2', domain: 'crowd', severity: 'low', zone: 'gate-a', type: 'incident', payload: {} } as unknown as OperationalEvent,
    ];

    const signals = detectSituations(events, config);
    expect(signals.length).toBe(1);
    expect(signals[0].severity).toBe('high');
    expect(signals[0].domain).toBe('crowd');
  });

  it('should detect critical events across domains', () => {
    const events = [
      { id: '1', domain: 'security', severity: 'critical', zone: 'gate-b', type: 'incident', payload: { summary: 'Breach detected' } } as unknown as OperationalEvent,
    ];

    const signals = detectSituations(events, config);
    expect(signals.length).toBe(1);
    expect(signals[0].severity).toBe('critical');
    expect(signals[0].domain).toBe('security');
  });

  it('should return empty signals if no matching events', () => {
    const events = [
      { id: '1', domain: 'medical', severity: 'low', zone: 'gate-b', type: 'faint', payload: {} } as unknown as OperationalEvent,
    ];

    const signals = detectSituations(events, config);
    expect(signals.length).toBe(0);
  });
});

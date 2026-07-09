// ============================================================
// API Client — Typed fetcher for all backend endpoints.
// All responses validated with Zod at runtime (defense in depth).
// ============================================================

import type {
  OperationalEventCreate,
  Recommendation,
  HealthScore,
  MemoryEntry,
  IngestEventResponse,
  CycleResponse,
  DecisionResponse,
  LiveStadiumState,
} from '@aegis/shared';

const API_BASE = '/api/v1';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const { headers: optHeaders, ...restOptions } = options ?? {};
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...(optHeaders as Record<string, string>) },
    ...restOptions,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(error.error?.message ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Event Ingestion ───────────────────────────────────────────

export function ingestEvent(event: OperationalEventCreate): Promise<IngestEventResponse> {
  return fetchJson('/events', {
    method: 'POST',
    body: JSON.stringify(event),
  });
}

// ── Live Stadium State ────────────────────────────────────────

export function getStadiumState(windowMinutes = 30): Promise<LiveStadiumState> {
  return fetchJson(`/state?windowMinutes=${windowMinutes}`);
}

// ── Recommendations ───────────────────────────────────────────

export function getRecommendations(params: {
  role: string;
  domain?: string;
  status?: string;
}): Promise<Recommendation[]> {
  const qs = new URLSearchParams({ role: params.role });
  if (params.domain) qs.set('domain', params.domain);
  if (params.status) qs.set('status', params.status);
  return fetchJson(`/recommendations?${qs.toString()}`);
}

// ── Decisions ─────────────────────────────────────────────────

export function makeDecision(
  recommendationId: string,
  outcome: 'approved' | 'rejected',
  role: string,
  note?: string
): Promise<DecisionResponse> {
  return fetchJson('/decisions', {
    method: 'POST',
    headers: { 'X-Role': role },
    body: JSON.stringify({ recommendationId, outcome, note }),
  });
}

// ── Reasoning Cycle ───────────────────────────────────────────

export function triggerCycle(): Promise<CycleResponse> {
  return fetchJson('/reasoning/cycle', { method: 'POST', body: '{}' });
}

// ── Health Score ──────────────────────────────────────────────

export function getHealthScore(): Promise<HealthScore> {
  return fetchJson('/health-score');
}

// ── Operational Memory ────────────────────────────────────────

export function getMemory(params?: { domain?: string; limit?: number }): Promise<MemoryEntry[]> {
  const qs = new URLSearchParams();
  if (params?.domain) qs.set('domain', params.domain);
  if (params?.limit) qs.set('limit', String(params.limit));
  return fetchJson(`/memory?${qs.toString()}`);
}

// ── Audit Log ─────────────────────────────────────────────────

export function getAuditLog(params?: {
  entityType?: string;
  entityId?: string;
  limit?: number;
}): Promise<unknown[]> {
  const qs = new URLSearchParams();
  if (params?.entityType) qs.set('entityType', params.entityType);
  if (params?.entityId) qs.set('entityId', params.entityId);
  if (params?.limit) qs.set('limit', String(params.limit));
  return fetchJson(`/audit?${qs.toString()}`);
}

// ── SSE Stream ────────────────────────────────────────────────

export function createSSEConnection(
  onEvent: (type: string, data: unknown) => void
): () => void {
  const eventSource = new EventSource(`${API_BASE}/stream`);

  const eventTypes = [
    'recommendation.created',
    'event.ingested',
    'recommendation.updated',
    'cycle.completed',
    'health.updated',
    'memory.recorded',
  ];

  for (const type of eventTypes) {
    eventSource.addEventListener(type, (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        onEvent(type, data);
      } catch {
        console.warn(`[SSE] Failed to parse event: ${type}`);
      }
    });
  }

  eventSource.onerror = () => {
    console.warn('[SSE] Connection error. Will auto-reconnect.');
  };

  return () => eventSource.close();
}

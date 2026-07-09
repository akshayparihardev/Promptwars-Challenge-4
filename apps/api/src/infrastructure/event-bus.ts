// ============================================================
// Event Bus — In-process pub/sub for SSE broadcasting.
// No external dependencies (no Kafka/Redis/MQTT).
// ============================================================

import type { EventBus } from '../domain/ports/index.js';

export class InProcessEventBus implements EventBus {
  private handlers: Array<(event: string, data: unknown) => void> = [];

  emit(event: string, data: unknown): void {
    for (const handler of this.handlers) {
      try {
        handler(event, data);
      } catch (err) {
        console.error(`[EVENT_BUS] Handler error for event "${event}":`, err);
      }
    }
  }

  subscribe(handler: (event: string, data: unknown) => void): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }
}

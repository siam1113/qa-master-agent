import { randomUUID as uuid } from 'node:crypto';

export class ObservabilityService {
  constructor() {
    this.events = [];
    this.metrics = new Map();
  }

  event(category, message, metadata = {}) {
    const entry = { id: uuid(), timestamp: new Date().toISOString(), category, message, metadata };
    this.events.unshift(entry);
    this.events = this.events.slice(0, 500);
    this.increment(`events.${category}`);
    return entry;
  }

  increment(name, value = 1) {
    this.metrics.set(name, (this.metrics.get(name) || 0) + value);
  }

  snapshot() {
    return { events: this.events, metrics: Object.fromEntries(this.metrics.entries()) };
  }
}

export const observability = new ObservabilityService();

import { metrics, type Attributes } from '@opentelemetry/api';

const meter = metrics.getMeter('sva.monitoring');

const businessEventCounter = meter.createCounter('sva_business_events_total', {
  description: 'Counts domain-specific business events.'
});

const iamAuthorizeClientLatencyHistogram = meter.createHistogram('sva_monitoring_authorize_duration_ms', {
  description: 'Client-side latency distribution for authorize decision handling in milliseconds.',
  unit: 'ms',
});

export const recordBusinessEvent = (eventName: string, attributes: Attributes = {}): void => {
  businessEventCounter.add(1, {
    event: eventName,
    ...attributes
  });
};

export const recordIamAuthorizeDecisionLatency = (
  durationMs: number,
  attributes: Attributes = {}
): void => {
  iamAuthorizeClientLatencyHistogram.record(durationMs, attributes);
};

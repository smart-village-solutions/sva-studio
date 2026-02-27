import { metrics, type Attributes } from '@opentelemetry/api';

const meter = metrics.getMeter('sva.monitoring');

const businessEventCounter = meter.createCounter('sva_business_events_total', {
  description: 'Counts domain-specific business events.'
});

const iamAuthorizeLatencyHistogram = meter.createHistogram('sva_iam_authorize_duration_ms', {
  description: 'Latency distribution for IAM authorize decisions in milliseconds.',
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
  iamAuthorizeLatencyHistogram.record(durationMs, attributes);
};

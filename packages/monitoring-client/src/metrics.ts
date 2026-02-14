import { metrics, type Attributes } from '@opentelemetry/api';

const meter = metrics.getMeter('sva.monitoring');

const businessEventCounter = meter.createCounter('sva_business_events_total', {
  description: 'Counts domain-specific business events.'
});

export const recordBusinessEvent = (eventName: string, attributes: Attributes = {}): void => {
  businessEventCounter.add(1, {
    event: eventName,
    ...attributes
  });
};

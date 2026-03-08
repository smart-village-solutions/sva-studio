import { diag, DiagConsoleLogger, DiagLogLevel, metrics } from '@opentelemetry/api';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';

const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318';

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [SemanticResourceAttributes.SERVICE_NAME]: 'sva-monitoring-smoke',
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV ?? 'development'
  }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: `${otlpEndpoint}/v1/metrics`
    }),
    exportIntervalMillis: 1000
  })
});

await sdk.start();

const meter = metrics.getMeter('sva.monitoring.smoke');
const counter = meter.createCounter('sva_business_events_total', {
  description: 'Counts domain-specific business events.'
});

counter.add(1, {
  workspace_id: 'local-dev',
  component: 'monitoring-smoke',
  environment: 'development',
  level: 'info'
});

await new Promise((resolve) => setTimeout(resolve, 1500));
await sdk.shutdown();

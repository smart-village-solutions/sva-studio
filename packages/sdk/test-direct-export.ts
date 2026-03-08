import { logs } from '@opentelemetry/api-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { NodeSDK } from '@opentelemetry/sdk-node';

const sdk = new NodeSDK({
  logRecordProcessor: new BatchLogRecordProcessor(
    new OTLPLogExporter({
      url: 'http://localhost:4318/v1/logs',
    })
  ),
});

await sdk.start();
console.log('[TEST] SDK started');

const logger = logs.getLoggerProvider().getLogger('test-logger');

for (let index = 0; index < 3; index += 1) {
  logger.emit({
    severityNumber: 9,
    severityText: 'INFO',
    body: `Test Log ${index + 1} - Should appear in Loki`,
    attributes: {
      job: 'sva-studio',
      component: 'test-direct',
    },
  });
  console.log(`[TEST] Sent log ${index + 1}`);
}

console.log('[TEST] Logs sent, waiting for batch...');
await new Promise((resolve) => setTimeout(resolve, 2000));
await sdk.shutdown();
console.log('[TEST] SDK shutdown - COMPLETE');

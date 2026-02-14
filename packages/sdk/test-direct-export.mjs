import { NodeSDK } from '@opentelemetry/sdk-node';
import { logs } from '@opentelemetry/api-logs';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';

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

for (let i = 0; i < 3; i++) {
  logger.emit({
    severityNumber: 9,
    severityText: 'INFO',
    body: `Test Log ${i+1} - Should appear in Loki`,
    attributes: {
      job: 'sva-studio',
      component: 'test-direct',
    },
  });
  console.log(`[TEST] Sent log ${i+1}`);
}

console.log('[TEST] Logs sent, waiting for batch...');
await new Promise(r => setTimeout(r, 2000));
await sdk.shutdown();
console.log('[TEST] SDK shutdown - COMPLETE');

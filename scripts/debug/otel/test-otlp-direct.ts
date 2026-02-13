/**
 * Direkter OTLP HTTP Log Export Test
 * 
 * Sendet einen Test-Log direkt an den OTEL Collector ohne Winston.
 * So können wir testen, ob der Collector überhaupt erreichbar ist.
 */

import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { LoggerProvider, BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';

// Aktiviere Debug-Logging
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);

const endpoint = 'http://host.docker.internal:4318';

console.log('=== OTLP Direct Test ===');
console.log(`Endpoint: ${endpoint}`);

// Resource mit Service-Name
const resource = Resource.default().merge(
  new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'test-direct-otlp',
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: 'development'
  })
);

// OTLP Log Exporter
const logExporter = new OTLPLogExporter({
  url: `${endpoint}/v1/logs`,
  headers: {},
});

// Logger Provider mit Batch Processor
const loggerProvider = new LoggerProvider({
  resource,
});

const processor = new BatchLogRecordProcessor(logExporter, {
  maxQueueSize: 100,
  maxExportBatchSize: 10,
  scheduledDelayMillis: 500, // 500ms für schnelles Testen
  exportTimeoutMillis: 10000,
});

loggerProvider.addLogRecordProcessor(processor);

// Hole einen Logger
const logger = loggerProvider.getLogger('test-logger', '1.0.0');

console.log('✓ Logger Provider erstellt');
console.log('✓ Sende Test-Log...');

// Sende Test-Log
logger.emit({
  severityNumber: 9, // INFO
  severityText: 'INFO',
  body: 'Direct OTLP Test Log - Dies sollte in Loki erscheinen',
  attributes: {
    component: 'test-direct',
    environment: 'development',
    test_id: Date.now().toString(),
  },
});

console.log('✓ Test-Log gesendet');
console.log('→ Warte auf Batch Export (2 Sekunden)...');

// Warte auf Batch und dann flush
setTimeout(async () => {
  console.log('→ Force Flush...');
  await loggerProvider.forceFlush();
  console.log('✓ Flush complete');
  
  console.log('→ Shutdown...');
  await loggerProvider.shutdown();
  console.log('✓ Shutdown complete');
  
  console.log('\n=== Test abgeschlossen ===');
  console.log('Prüfe Loki mit: curl -s "http://localhost:3100/loki/api/v1/label/component/values" | jq .data');
  process.exit(0);
}, 2000);

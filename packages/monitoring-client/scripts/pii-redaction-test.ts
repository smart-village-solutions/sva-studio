import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

interface TestLogEntry {
  log: string;
  stream: 'stdout' | 'stderr';
  time: string;
  attrs: Record<string, string>;
}

interface LokiQueryResultEntry {
  stream?: Record<string, string>;
}

interface LokiQueryResponse {
  data?: {
    result?: LokiQueryResultEntry[];
  };
}

const LOG_FILE = '/tmp/pii-test-container.log';
const WORKSPACE_ID = 'pii-test-workspace';

async function main(): Promise<void> {
  console.log('[PII-Redaction-Test] Schreibe Test-Logs mit sensiblen Labels...');

  await mkdir(dirname(LOG_FILE), { recursive: true });

  const logStream = createWriteStream(LOG_FILE, { flags: 'a' });

  const testLogs: TestLogEntry[] = [
    {
      log: 'User login successful',
      stream: 'stdout',
      time: new Date().toISOString(),
      attrs: {
        workspace_id: WORKSPACE_ID,
        component: 'auth-service',
        environment: 'test',
        level: 'info',
        email: 'user@example.com',
        session_id: 'abc123-session-xyz',
        api_key: 'sk-12345678',
        user_token: 'bearer-xyz-sensitive',
      },
    },
    {
      log: 'Database query executed',
      stream: 'stdout',
      time: new Date().toISOString(),
      attrs: {
        workspace_id: WORKSPACE_ID,
        component: 'database',
        environment: 'test',
        level: 'debug',
        db_password: 'supersecret123',
        credit_card: '4111-1111-1111-1111',
      },
    },
  ];

  for (const entry of testLogs) {
    logStream.write(`${JSON.stringify(entry)}\n`);
  }

  logStream.end();

  console.log(`[PII-Redaction-Test] Logs geschrieben: ${LOG_FILE}`);
  console.log('[PII-Redaction-Test] Warte 10s für Promtail scrape...');

  await new Promise((resolve) => setTimeout(resolve, 10_000));

  console.log('[PII-Redaction-Test] Prüfe Loki Labels für workspace_id:', WORKSPACE_ID);

  const response = await fetch(
    `http://localhost:3100/loki/api/v1/query?query={workspace_id="${WORKSPACE_ID}"}&limit=1`
  );

  if (!response.ok) {
    console.error('[PII-Redaction-Test] Loki Query fehlgeschlagen:', response.status);
    process.exit(1);
  }

  const data = (await response.json()) as LokiQueryResponse;
  const results = data.data?.result ?? [];

  if (results.length === 0) {
    console.error('[PII-Redaction-Test] Keine Logs für workspace_id gefunden!');
    console.log('[PII-Redaction-Test] Hinweis: Promtail benötigt static_configs Pfad:', LOG_FILE);
    process.exit(1);
  }

  const labels = results[0]?.stream ?? {};
  const labelKeys = Object.keys(labels);

  console.log('[PII-Redaction-Test] Gefundene Labels:', labelKeys);

  const piiLabels = ['email', 'session_id', 'api_key', 'user_token', 'db_password', 'credit_card'];
  const foundPii = labelKeys.filter((key) => piiLabels.includes(key));

  if (foundPii.length > 0) {
    console.error('[PII-Redaction-Test] FEHLER: PII-Labels gefunden:', foundPii);
    console.error('[PII-Redaction-Test] Promtail labeldrop Regex funktioniert NICHT!');
    process.exit(1);
  }

  const requiredLabels = ['workspace_id', 'component', 'environment', 'level'];
  const missingLabels = requiredLabels.filter((key) => !labelKeys.includes(key));

  if (missingLabels.length > 0) {
    console.error('[PII-Redaction-Test] FEHLER: Erforderliche Labels fehlen:', missingLabels);
    process.exit(1);
  }

  console.log('[PII-Redaction-Test] SUCCESS: PII-Labels wurden korrekt entfernt!');
  console.log('[PII-Redaction-Test] Erlaubte Labels vorhanden:', labelKeys);
  process.exit(0);
}

void main().catch((error: unknown) => {
  console.error(
    '[PII-Redaction-Test] Unerwarteter Fehler:',
    error instanceof Error ? error.message : String(error)
  );
  process.exit(1);
});

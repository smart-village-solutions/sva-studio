#!/usr/bin/env node
import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import { join, dirname } from 'path';

/**
 * PII-Redaction Test: Validiert, dass sensible Labels von Promtail entfernt werden.
 *
 * Test-Ablauf:
 * 1. Schreibt Docker-Logs mit PII-Labels (email, token, session_id, api_key)
 * 2. Promtail scrapes Logs -> Loki
 * 3. Query: Loki Labels dürfen KEINE PII-Felder enthalten
 */

const LOG_FILE = '/tmp/pii-test-container.log';
const WORKSPACE_ID = 'pii-test-workspace';

async function main() {
  console.log('[PII-Redaction-Test] Schreibe Test-Logs mit sensiblen Labels...');

  // Sicherstellen, dass Verzeichnis existiert
  await mkdir(dirname(LOG_FILE), { recursive: true });

  const logStream = createWriteStream(LOG_FILE, { flags: 'a' });

  const testLogs = [
    {
      log: 'User login successful',
      stream: 'stdout',
      time: new Date().toISOString(),
      attrs: {
        workspace_id: WORKSPACE_ID,
        component: 'auth-service',
        environment: 'test',
        level: 'info',
        // Sensible Labels (sollen von Promtail entfernt werden):
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
        // Sensible Labels:
        db_password: 'supersecret123',
        credit_card: '4111-1111-1111-1111',
      },
    },
  ];

  for (const entry of testLogs) {
    logStream.write(JSON.stringify(entry) + '\n');
  }

  logStream.end();

  console.log(`[PII-Redaction-Test] Logs geschrieben: ${LOG_FILE}`);
  console.log('[PII-Redaction-Test] Warte 10s für Promtail scrape...');

  await new Promise((resolve) => setTimeout(resolve, 10000));

  console.log('[PII-Redaction-Test] Prüfe Loki Labels für workspace_id:', WORKSPACE_ID);

  // Loki Query: Welche Labels existieren für diese workspace_id?
  const response = await fetch(
    `http://localhost:3100/loki/api/v1/query?query={workspace_id="${WORKSPACE_ID}"}&limit=1`
  );

  if (!response.ok) {
    console.error('[PII-Redaction-Test] Loki Query fehlgeschlagen:', response.status);
    process.exit(1);
  }

  const data = await response.json();

  if (!data.data?.result?.length) {
    console.error('[PII-Redaction-Test] Keine Logs für workspace_id gefunden!');
    console.log('[PII-Redaction-Test] Hinweis: Promtail benötigt static_configs Pfad:', LOG_FILE);
    process.exit(1);
  }

  const labels = data.data.result[0].stream || {};
  const labelKeys = Object.keys(labels);

  console.log('[PII-Redaction-Test] Gefundene Labels:', labelKeys);

  // Validierung: PII-Labels dürfen NICHT vorhanden sein
  const piiLabels = [
    'email',
    'session_id',
    'api_key',
    'user_token',
    'db_password',
    'credit_card',
  ];
  const foundPii = labelKeys.filter((key) => piiLabels.includes(key));

  if (foundPii.length > 0) {
    console.error('[PII-Redaction-Test] ❌ FEHLER: PII-Labels gefunden:', foundPii);
    console.error('[PII-Redaction-Test] Promtail labeldrop Regex funktioniert NICHT!');
    process.exit(1);
  }

  // Validierung: Erlaubte Labels müssen vorhanden sein
  const requiredLabels = ['workspace_id', 'component', 'environment', 'level'];
  const missingLabels = requiredLabels.filter((key) => !labelKeys.includes(key));

  if (missingLabels.length > 0) {
    console.error('[PII-Redaction-Test] ❌ FEHLER: Erforderliche Labels fehlen:', missingLabels);
    process.exit(1);
  }

  console.log('[PII-Redaction-Test] ✅ SUCCESS: PII-Labels wurden korrekt entfernt!');
  console.log('[PII-Redaction-Test] Erlaubte Labels vorhanden:', labelKeys);
  process.exit(0);
}

main().catch((err) => {
  console.error('[PII-Redaction-Test] Unerwarteter Fehler:', err);
  process.exit(1);
});

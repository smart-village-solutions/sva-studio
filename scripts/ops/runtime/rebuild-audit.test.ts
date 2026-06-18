import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  appendRebuildAuditEvent,
  buildBootstrapLocalInstanceDbAuditDetails,
  buildDeleteLocalInstanceDbAuditDetails,
  buildLocalRuntimeAuditDetails,
  createLocalRuntimeAuditLogger,
  createRebuildAuditLogger,
  getRebuildAuditLogFile,
  resolveLocalRuntimeAuditReason,
  shouldAuditLocalRuntimeCommand,
} from './rebuild-audit.ts';

describe('createRebuildAuditLogger', () => {
  it('logs started and completed events with merged sanitized details', async () => {
    const events: unknown[] = [];
    const logger = createRebuildAuditLogger(
      {
        command: 'tsx scripts/ops/runtime-env.ts update local-keycloak',
        defaultDetails: {
          composeMode: 'with-monitoring',
          workerEnabled: true,
        },
        logFile: '/tmp/rebuild-events.jsonl',
        pid: 1234,
        profile: 'local-keycloak',
        reason: 'Lokale Aktualisierung startet Infra und App kontrolliert neu.',
        scope: 'local-runtime',
      },
      (_logFile, event) => {
        events.push(event);
      },
    );

    await expect(
      logger.run(
        'app-start',
        () => 'ok',
        {
          note: 'fresh-start',
        },
      ),
    ).resolves.toBe('ok');

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      command: 'tsx scripts/ops/runtime-env.ts update local-keycloak',
      details: {
        composeMode: 'with-monitoring',
        note: 'fresh-start',
        workerEnabled: true,
      },
      phase: 'app-start',
      pid: 1234,
      profile: 'local-keycloak',
      scope: 'local-runtime',
      status: 'started',
    });
    expect(events[1]).toMatchObject({
      phase: 'app-start',
      status: 'completed',
    });
  });

  it('logs failures with an error message', async () => {
    const events: unknown[] = [];
    const logger = createRebuildAuditLogger(
      {
        command: 'tsx scripts/ops/bootstrap-local-instance-db.ts',
        logFile: '/tmp/rebuild-events.jsonl',
        reason: 'Expliziter lokaler Datenbank-Bootstrap wurde angefordert.',
        scope: 'local-instance-db-bootstrap',
        targetInstanceId: 'hb-demo',
      },
      (_logFile, event) => {
        events.push(event);
      },
    );

    await expect(
      logger.run('recreate-database', () => {
        throw new Error('dropdb failed');
      }),
    ).rejects.toThrow('dropdb failed');

    expect(events).toHaveLength(2);
    expect(events[1]).toMatchObject({
      error: expect.stringContaining('dropdb failed'),
      phase: 'recreate-database',
      status: 'failed',
      targetInstanceId: 'hb-demo',
    });
  });
});

describe('appendRebuildAuditEvent', () => {
  it('writes JSONL entries to the canonical runtime audit file', () => {
    const tempDir = mkdtempSync(resolve(tmpdir(), 'rebuild-audit-'));
    const logFile = getRebuildAuditLogFile(tempDir);

    appendRebuildAuditEvent(logFile, {
      at: '2026-06-03T10:00:00.000Z',
      command: 'tsx scripts/ops/runtime-env.ts up local-keycloak',
      details: {
        composeMode: 'with-monitoring',
      },
      phase: 'infra-up',
      pid: 42,
      profile: 'local-keycloak',
      reason: 'Lokaler Start initialisiert Infra, Migration und Dev-Server.',
      scope: 'local-runtime',
      status: 'started',
    });

    const parsed = JSON.parse(readFileSync(logFile, 'utf8').trim()) as Record<string, unknown>;
    expect(parsed).toMatchObject({
      command: 'tsx scripts/ops/runtime-env.ts up local-keycloak',
      details: {
        composeMode: 'with-monitoring',
      },
      phase: 'infra-up',
      profile: 'local-keycloak',
      scope: 'local-runtime',
      status: 'started',
    });
  });
});

describe('audit detail builders', () => {
  it('builds safe bootstrap details without secrets', () => {
    expect(
      buildBootstrapLocalInstanceDbAuditDetails({
        createDb: true,
        importSchema: true,
        pageSize: 200,
        skipAppUserBootstrap: false,
        skipCatalogSync: false,
        skipKeycloakUserSync: false,
        sourceDbContainer: 'sva-studio-postgres',
        sourceDbName: 'sva_studio',
        sourceInstanceId: 'de-musterhausen',
        targetAppDbUser: 'sva_app',
        targetDbContainer: 'sva-studio-postgres-hb',
        targetDbName: 'sva_studio',
        targetDbUser: 'sva',
        targetRealm: 'hb-demo',
      }),
    ).toEqual({
      createDb: true,
      importSchema: true,
      pageSize: 200,
      skipAppUserBootstrap: false,
      skipCatalogSync: false,
      skipKeycloakUserSync: false,
      sourceDbContainer: 'sva-studio-postgres',
      sourceDbName: 'sva_studio',
      sourceInstanceId: 'de-musterhausen',
      targetAppDbUser: 'sva_app',
      targetDbContainer: 'sva-studio-postgres-hb',
      targetDbName: 'sva_studio',
      targetDbUser: 'sva',
      targetRealm: 'hb-demo',
    });
  });

  it('builds delete and local runtime audit details', () => {
    expect(
      buildDeleteLocalInstanceDbAuditDetails({
        dryRun: false,
        force: true,
        targetDbContainer: 'sva-studio-postgres-hb',
        targetDbName: 'sva_studio',
        targetDbUser: 'sva',
        yes: true,
      }),
    ).toEqual({
      dryRun: false,
      force: true,
      targetDbContainer: 'sva-studio-postgres-hb',
      targetDbName: 'sva_studio',
      targetDbUser: 'sva',
      yes: true,
    });

    expect(
      buildLocalRuntimeAuditDetails({
        authoritative: false,
        composeMode: 'with-monitoring',
        driftCheckEnabled: true,
        jsonOutput: false,
        workerEnabled: true,
      }),
    ).toEqual({
      authoritative: false,
      composeMode: 'with-monitoring',
      driftCheckEnabled: true,
      jsonOutput: false,
      workerEnabled: true,
    });
  });
});

describe('local runtime audit helpers', () => {
  it('detects which runtime commands should be audited', () => {
    expect(shouldAuditLocalRuntimeCommand('up')).toBe(true);
    expect(shouldAuditLocalRuntimeCommand('repair')).toBe(true);
    expect(shouldAuditLocalRuntimeCommand('status')).toBe(false);
  });

  it('creates a local runtime audit logger with the derived reason and details', async () => {
    const events: unknown[] = [];
    const logger = createLocalRuntimeAuditLogger(
      {
        authoritative: true,
        composeMode: 'base',
        driftCheckEnabled: false,
        gitSha: 'abc123',
        jsonOutput: true,
        logFile: '/tmp/rebuild-events.jsonl',
        runtimeCommand: 'repair',
        runtimeProfile: 'local-keycloak',
        workerEnabled: true,
      },
      (_logFile, event) => {
        events.push(event);
      },
    );

    await expect(logger.run('command', () => 'ok')).resolves.toBe('ok');

    expect(resolveLocalRuntimeAuditReason('repair')).toBe(
      'Lokaler Repair heilt Migration, Registry-Drift und Tenant-Secrets ohne kompletten Rebootstrap.',
    );
    expect(events[0]).toMatchObject({
      command: 'tsx scripts/ops/runtime-env.ts repair local-keycloak',
      details: {
        authoritative: true,
        composeMode: 'base',
        driftCheckEnabled: false,
        jsonOutput: true,
        workerEnabled: true,
      },
      gitSha: 'abc123',
      reason: 'Lokaler Repair heilt Migration, Registry-Drift und Tenant-Secrets ohne kompletten Rebootstrap.',
      scope: 'local-runtime',
      status: 'started',
    });
  });
});

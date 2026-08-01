#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import {
  buildQuantumDeployComposeDocument,
  type ComposeDocument,
} from '../ops/runtime/deploy-project.ts';

export type RestoreMaintenanceMode = 'running' | 'stopped';

export const renderRestoreStack = (source: string, mode: RestoreMaintenanceMode): string => {
  const document = JSON.parse(source) as ComposeDocument;
  const services = document.services;
  if (!services?.app || !services.provisioner || !services.postgres)
    throw new Error('Der Studio-Stack enthält nicht alle für den Restore erforderlichen Services.');
  const replicas = mode === 'stopped' ? 0 : 1;
  for (const serviceName of ['app', 'provisioner'] as const) {
    const service = services[serviceName] as Record<string, unknown>;
    const deploy = (service.deploy ?? {}) as Record<string, unknown>;
    service.deploy = { ...deploy, replicas };
  }
  const postgres = services.postgres as Record<string, unknown>;
  const postgresDeploy = (postgres.deploy ?? {}) as Record<string, unknown>;
  if (postgresDeploy.replicas !== 1)
    throw new Error(
      'Der Restore darf nur gegen einen laufenden einzelnen PostgreSQL-Service erfolgen.'
    );
  const normalized = buildQuantumDeployComposeDocument(document);
  return `${JSON.stringify({ ...normalized, version: '3.8' }, null, 2)}\n`;
};

const main = () => {
  const args = process.argv.slice(2);
  const inputPath = args[args.indexOf('--input') + 1];
  const outputPath = args[args.indexOf('--output') + 1];
  const mode = args[args.indexOf('--mode') + 1];
  if (!inputPath || !outputPath || (mode !== 'running' && mode !== 'stopped'))
    throw new Error(
      'Für --input, --output und --mode=running|stopped ist jeweils ein Wert erforderlich.'
    );
  writeFileSync(outputPath, renderRestoreStack(readFileSync(inputPath, 'utf8'), mode), 'utf8');
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

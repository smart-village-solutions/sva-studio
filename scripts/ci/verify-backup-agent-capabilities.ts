#!/usr/bin/env node

import { pathToFileURL } from 'node:url';

import { backupEnvironmentConfig, type BackupEnvironment } from './backup-agent-contract.ts';
import { PromoteContractError, redactPromoteFailure } from './promote-result.ts';

export type BackupAgentCapabilities = Readonly<{
  protocolVersions: readonly number[];
  agentRevision: string;
  databaseTargets: readonly string[];
  resultFields: readonly string[];
  wasteInventory: boolean;
}>;

const requiredResultFields = ['bytes', 'database', 'deployImageDigest', 'environment', 'objectKey', 'requestId', 'sha256', 'status', 'steps'];

export const validateBackupAgentCapabilities = (environment: BackupEnvironment, value: unknown, requireWaste: boolean): BackupAgentCapabilities => {
  const capabilities = value as Partial<BackupAgentCapabilities> | null;
  const compatible = capabilities
    && Array.isArray(capabilities.protocolVersions) && capabilities.protocolVersions.includes(2)
    && typeof capabilities.agentRevision === 'string' && capabilities.agentRevision.length > 0
    && Array.isArray(capabilities.databaseTargets) && capabilities.databaseTargets.includes('studio')
    && (!requireWaste || (capabilities.databaseTargets.includes('waste') && capabilities.wasteInventory === true))
    && Array.isArray(capabilities.resultFields) && requiredResultFields.every((field) => capabilities.resultFields?.includes(field));
  if (!compatible) throw new PromoteContractError({
    code: 'PROMOTE_BACKUP_AGENT_INCOMPATIBLE', environment, phase: 'backup-capabilities', retryable: false,
    summary: 'Der laufende Backup-Agent erfuellt den erforderlichen Consumer-Vertrag nicht.',
    nextAction: 'Zuerst einen kompatiblen Backup-Agenten ausrollen und dessen Capabilities live nachweisen.',
  });
  return capabilities as BackupAgentCapabilities;
};

const requestOidcToken = async () => {
  const requestUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL?.trim();
  const requestToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN?.trim();
  if (!requestUrl || !requestToken) throw new Error('GitHub OIDC ist nicht verfuegbar.');
  const url = new URL(requestUrl);
  url.searchParams.set('audience', 'studio-backup-agent');
  const response = await fetch(url, { headers: { authorization: `Bearer ${requestToken}` }, signal: AbortSignal.timeout(10_000) });
  const payload = await response.json() as { value?: unknown };
  if (!response.ok || typeof payload.value !== 'string') throw new Error('GitHub OIDC Token konnte nicht bezogen werden.');
  return payload.value;
};

const main = async () => {
  const environment = process.argv[2] as BackupEnvironment;
  if (environment !== 'staging' && environment !== 'prod') throw new Error('Environment muss staging oder prod sein.');
  const url = new URL(backupEnvironmentConfig(environment).endpoint.replace('/requests', '/capabilities'));
  url.searchParams.set('environment', environment);
  const response = await fetch(url, { headers: { authorization: `Bearer ${await requestOidcToken()}` }, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Capability-Endpoint antwortet mit HTTP ${response.status}.`);
  const capabilities = validateBackupAgentCapabilities(environment, await response.json(), process.env.WASTE_POSTGRES_BACKUP_ENABLED === 'true');
  process.stdout.write(`${JSON.stringify({ agentRevision: capabilities.agentRevision, databaseTargets: capabilities.databaseTargets, protocolVersions: capabilities.protocolVersions, wasteInventory: capabilities.wasteInventory })}\n`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((error: unknown) => {
  const failure = redactPromoteFailure(error, { environment: process.argv[2] === 'prod' ? 'prod' : 'staging', phase: 'backup-capabilities' });
  process.stderr.write(`${JSON.stringify(failure)}\n`);
  process.exitCode = 1;
});


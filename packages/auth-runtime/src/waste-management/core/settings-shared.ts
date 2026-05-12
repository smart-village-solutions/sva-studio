import { Pool } from 'pg';
import {
  buildWasteDatabaseUrlAad,
  buildWasteServiceRoleKeyAad,
  resolveWasteDataSource,
  runWasteConnectionCheck,
  type ResolvedWasteDataSource,
} from '@sva/server-runtime';
import type { WasteManagementConnectionCheckRecord, WasteManagementDataSourceRecord, WasteManagementSettingsRecord } from '@sva/core';
import { z } from 'zod';

import { wasteManagementSettingsSchema } from './schemas.js';
import type { WasteManagementHandlerDeps } from './types.js';

export const sanitizeWasteSettings = (
  record: WasteManagementDataSourceRecord | null | undefined
): WasteManagementSettingsRecord | null => {
  if (!record) {
    return null;
  }

  return {
    instanceId: record.instanceId,
    provider: record.provider,
    projectUrl: record.projectUrl,
    schemaName: record.schemaName,
    enabled: record.enabled,
    databaseUrlConfigured: record.databaseUrlConfigured,
    serviceRoleKeyConfigured: record.serviceRoleKeyConfigured,
    visibleStatus: record.visibleStatus,
    lastCheckedAt: record.lastCheckedAt,
    lastCheckStatus: record.lastCheckStatus,
    lastCheckErrorCode: record.lastCheckErrorCode,
    lastCheckErrorMessage: record.lastCheckErrorMessage,
    updatedAt: record.updatedAt,
  };
};

export const defaultRunConnectionProbe = async (dataSource: ResolvedWasteDataSource): Promise<void> => {
  const pool = new Pool({
    connectionString: dataSource.databaseUrl,
    max: 1,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 5_000,
  });

  try {
    const client = await pool.connect();
    try {
      await client.query('SELECT 1;');
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
};

export const buildSettingsRecord = async (
  deps: WasteManagementHandlerDeps,
  instanceId: string,
  payload: z.infer<typeof wasteManagementSettingsSchema>
): Promise<WasteManagementDataSourceRecord> => {
  const existing = (await deps.loadWasteDataSourceRecord?.(instanceId)) ?? null;
  const nextDatabaseUrlCiphertext = payload.databaseUrl?.trim()
    ? deps.protectSecret?.(payload.databaseUrl.trim(), buildWasteDatabaseUrlAad(instanceId))
    : existing?.databaseUrlCiphertext;
  const nextServiceRoleKeyCiphertext = payload.serviceRoleKey?.trim()
    ? deps.protectSecret?.(payload.serviceRoleKey.trim(), buildWasteServiceRoleKeyAad(instanceId))
    : existing?.serviceRoleKeyCiphertext;

  return {
    instanceId,
    provider: payload.provider,
    projectUrl: payload.projectUrl.trim(),
    schemaName: payload.schemaName?.trim() || 'public',
    enabled: payload.enabled,
    databaseUrlConfigured: Boolean(nextDatabaseUrlCiphertext),
    serviceRoleKeyConfigured: Boolean(nextServiceRoleKeyCiphertext),
    databaseUrlCiphertext: nextDatabaseUrlCiphertext ?? undefined,
    serviceRoleKeyCiphertext: nextServiceRoleKeyCiphertext ?? undefined,
    visibleStatus: nextDatabaseUrlCiphertext && nextServiceRoleKeyCiphertext ? 'unknown' : 'not_configured',
    lastCheckedAt: existing?.lastCheckedAt,
    lastCheckStatus: existing?.lastCheckStatus,
    lastCheckErrorCode: existing?.lastCheckErrorCode,
    lastCheckErrorMessage: existing?.lastCheckErrorMessage,
    updatedAt: existing?.updatedAt,
  };
};

const persistWasteConnectionState = async (
  deps: WasteManagementHandlerDeps,
  record: WasteManagementConnectionCheckRecord
): Promise<void> => {
  if (!deps.saveWasteConnectionCheck) {
    return;
  }

  await deps.saveWasteConnectionCheck(record);
};

export const updateWasteVisibleStatus = async (
  deps: WasteManagementHandlerDeps,
  instanceId: string,
  outcome: 'success' | 'revalidate'
): Promise<void> => {
  if (!deps.saveWasteConnectionCheck) {
    return;
  }

  if (outcome === 'success') {
    await persistWasteConnectionState(deps, {
      instanceId,
      checkedAt: new Date().toISOString(),
      checkStatus: 'succeeded',
      visibleStatus: 'ok',
    });
    return;
  }

  if (!deps.loadWasteDataSourceRecord || !deps.revealSecret) {
    return;
  }

  try {
    const dataSource = await resolveWasteDataSource({
      instanceId,
      loadRecord: deps.loadWasteDataSourceRecord,
      revealSecret: (ciphertext, aad) => deps.revealSecret?.(ciphertext, aad) ?? undefined,
    });
    const connectionCheck = await runWasteConnectionCheck({
      dataSource,
      probe: deps.runConnectionProbe ?? defaultRunConnectionProbe,
      now: () => new Date(),
    });
    await persistWasteConnectionState(deps, connectionCheck);
  } catch (error) {
    const errorCode =
      error instanceof Error && 'code' in error && typeof error.code === 'string' ? error.code : 'connection_failed';
    const errorMessage = error instanceof Error ? error.message : 'Connection-Check fehlgeschlagen.';
    await persistWasteConnectionState(deps, {
      instanceId,
      checkedAt: new Date().toISOString(),
      checkStatus: 'failed',
      visibleStatus: 'error',
      errorCode,
      errorMessage,
    });
  }
};

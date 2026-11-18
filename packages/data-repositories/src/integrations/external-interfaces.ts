import type {
  ExternalInterfaceConnectionCheckRecord,
  ExternalInterfaceRecord,
  ExternalInterfaceTypeDefinition,
} from '@sva/core';

import { externalInterfaceStatements } from './external-interfaces.statements.js';
import {
  mapInterfaceRow,
  mapTypeRow,
  type ExternalInterfaceRow,
  type ExternalInterfaceTypeRow,
} from './external-interfaces.shared.js';
import type { SqlExecutor } from '../iam/repositories/types.js';

export type ExternalInterfaceRepository = {
  listTypeDefinitions(): Promise<readonly ExternalInterfaceTypeDefinition[]>;
  upsertTypeDefinition(input: ExternalInterfaceTypeDefinition): Promise<void>;
  listByInstanceId(instanceId: string): Promise<readonly ExternalInterfaceRecord[]>;
  getById(instanceId: string, id: string): Promise<ExternalInterfaceRecord | null>;
  getByAlias(instanceId: string, typeKey: string, alias: string): Promise<ExternalInterfaceRecord | null>;
  getDefaultByTypeKey(instanceId: string, typeKey: string): Promise<ExternalInterfaceRecord | null>;
  upsert(input: ExternalInterfaceRecord): Promise<void>;
  deleteById(instanceId: string, id: string): Promise<boolean>;
  updateConnectionCheck(input: ExternalInterfaceConnectionCheckRecord): Promise<void>;
};

export const createExternalInterfaceRepository = (executor: SqlExecutor): ExternalInterfaceRepository => ({
  async listTypeDefinitions() {
    const result = await executor.execute<ExternalInterfaceTypeRow>(externalInterfaceStatements.listTypes());
    return result.rows.map(mapTypeRow);
  },
  async upsertTypeDefinition(input) {
    await executor.execute(externalInterfaceStatements.upsertType(input));
  },
  async listByInstanceId(instanceId) {
    const result = await executor.execute<ExternalInterfaceRow>(externalInterfaceStatements.listByInstance(instanceId));
    return result.rows.map(mapInterfaceRow);
  },
  async getById(instanceId, id) {
    const result = await executor.execute<ExternalInterfaceRow>(externalInterfaceStatements.getById(instanceId, id));
    return result.rows[0] ? mapInterfaceRow(result.rows[0]) : null;
  },
  async getByAlias(instanceId, typeKey, alias) {
    const result = await executor.execute<ExternalInterfaceRow>(
      externalInterfaceStatements.getByAlias(instanceId, typeKey, alias)
    );
    return result.rows[0] ? mapInterfaceRow(result.rows[0]) : null;
  },
  async getDefaultByTypeKey(instanceId, typeKey) {
    const result = await executor.execute<ExternalInterfaceRow>(
      externalInterfaceStatements.getDefault(instanceId, typeKey)
    );
    return result.rows[0] ? mapInterfaceRow(result.rows[0]) : null;
  },
  async upsert(input) {
    await executor.execute(externalInterfaceStatements.upsert(input));
  },
  async deleteById(instanceId, id) {
    const result = await executor.execute(externalInterfaceStatements.deleteById(instanceId, id));
    return result.rowCount > 0;
  },
  async updateConnectionCheck(input) {
    await executor.execute(externalInterfaceStatements.updateConnectionCheck(input));
  },
});

export { externalInterfaceStatements };

import type { IamSeedRepository, SqlExecutor } from './types';
import { iamSeedStatements } from './statements';

type SqlUuidArrayParameter = {
  readonly sqlType: 'uuid[]';
  readonly values: readonly string[];
};

const isSqlUuidArrayParameter = (value: unknown): value is SqlUuidArrayParameter =>
  typeof value === 'object' &&
  value !== null &&
  'sqlType' in value &&
  value.sqlType === 'uuid[]' &&
  'values' in value &&
  Array.isArray(value.values);

const normalizeStatement = <TStatement extends { values: readonly unknown[] }>(statement: TStatement): TStatement => ({
  ...statement,
  values: statement.values.map((value) => (isSqlUuidArrayParameter(value) ? value.values : value)),
});

export const createIamSeedRepository = (executor: SqlExecutor): IamSeedRepository => ({
  async upsertInstance(input) {
    await executor.execute(normalizeStatement(iamSeedStatements.upsertInstance(input)));
  },
  async upsertOrganization(input) {
    await executor.execute(normalizeStatement(iamSeedStatements.upsertOrganization(input)));
  },
  async upsertRole(input) {
    await executor.execute(normalizeStatement(iamSeedStatements.upsertRole(input)));
  },
  async upsertPermission(input) {
    await executor.execute(normalizeStatement(iamSeedStatements.upsertPermission(input)));
  },
  async upsertAccount(input) {
    await executor.execute(normalizeStatement(iamSeedStatements.upsertAccount(input)));
  },
  async upsertInstanceMembership(input) {
    await executor.execute(normalizeStatement(iamSeedStatements.upsertInstanceMembership(input)));
  },
  async assignAccountRole(input) {
    await executor.execute(normalizeStatement(iamSeedStatements.assignAccountRole(input)));
  },
  async assignAccountOrganization(input) {
    await executor.execute(normalizeStatement(iamSeedStatements.assignAccountOrganization(input)));
  },
  async assignRolePermission(input) {
    await executor.execute(normalizeStatement(iamSeedStatements.assignRolePermission(input)));
  },
});

import type { IamSeedRepository, SqlExecutor } from './types';
import { iamSeedStatements } from './statements';

export const createIamSeedRepository = (executor: SqlExecutor): IamSeedRepository => ({
  async upsertInstance(input) {
    await executor.execute(iamSeedStatements.upsertInstance(input));
  },
  async upsertOrganization(input) {
    await executor.execute(iamSeedStatements.upsertOrganization(input));
  },
  async upsertRole(input) {
    await executor.execute(iamSeedStatements.upsertRole(input));
  },
  async upsertPermission(input) {
    await executor.execute(iamSeedStatements.upsertPermission(input));
  },
  async upsertAccount(input) {
    await executor.execute(iamSeedStatements.upsertAccount(input));
  },
  async upsertInstanceMembership(input) {
    await executor.execute(iamSeedStatements.upsertInstanceMembership(input));
  },
  async assignAccountRole(input) {
    await executor.execute(iamSeedStatements.assignAccountRole(input));
  },
  async assignAccountOrganization(input) {
    await executor.execute(iamSeedStatements.assignAccountOrganization(input));
  },
  async assignRolePermission(input) {
    await executor.execute(iamSeedStatements.assignRolePermission(input));
  },
});

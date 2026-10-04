import { organizationStatements } from './statements-organization.js';
import { accessStatements } from './statements-access.js';
import { accountStatements } from './statements-account.js';

export const iamSeedStatements = {
  upsertInstance: organizationStatements.upsertInstance,
  upsertOrganization: organizationStatements.upsertOrganization,
  upsertRole: accessStatements.upsertRole,
  upsertGroup: accessStatements.upsertGroup,
  upsertGeoUnit: organizationStatements.upsertGeoUnit,
  upsertPermission: accessStatements.upsertPermission,
  upsertAccount: accountStatements.upsertAccount,
  upsertInstanceMembership: accountStatements.upsertInstanceMembership,
  assignAccountRole: accountStatements.assignAccountRole,
  assignGroupRole: accountStatements.assignGroupRole,
  assignAccountGroup: accountStatements.assignAccountGroup,
  assignAccountOrganization: accountStatements.assignAccountOrganization,
  assignRolePermission: accountStatements.assignRolePermission,
};

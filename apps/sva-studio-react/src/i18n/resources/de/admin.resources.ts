import { groupsAdminDEResources } from './admin/groups.resources.js';
import { iamAdminDEResources } from './admin/iam.resources.js';
import { instancesAdminDEResources } from './admin/instances.resources.js';
import { legalAcceptanceAdminDEResources } from './admin/legalAcceptance.resources.js';
import { legalTextsAdminDEResources } from './admin/legalTexts.resources.js';
import { organizationsAdminDEResources } from './admin/organizations.resources.js';
import { rolesAdminDEResources } from './admin/roles.resources.js';
import { sharedAdminDEResources } from './admin/shared.resources.js';
import { usersAdminDEResources } from './admin/users.resources.js';

export const adminDEResources = {
  groups: groupsAdminDEResources,
  iam: iamAdminDEResources,
  instances: instancesAdminDEResources,
  legalAcceptance: legalAcceptanceAdminDEResources,
  legalTexts: legalTextsAdminDEResources,
  organizations: organizationsAdminDEResources,
  roles: rolesAdminDEResources,
  shared: sharedAdminDEResources,
  users: usersAdminDEResources,
} as const;

import { groupsAdminENResources } from './admin/groups.resources.js';
import { iamAdminENResources } from './admin/iam.resources.js';
import { instancesAdminENResources } from './admin/instances.resources.js';
import { legalAcceptanceAdminENResources } from './admin/legalAcceptance.resources.js';
import { legalTextsAdminENResources } from './admin/legalTexts.resources.js';
import { organizationsAdminENResources } from './admin/organizations.resources.js';
import { rolesAdminENResources } from './admin/roles.resources.js';
import { sharedAdminENResources } from './admin/shared.resources.js';
import { usersAdminENResources } from './admin/users.resources.js';

export const adminENResources = {
  groups: groupsAdminENResources,
  iam: iamAdminENResources,
  instances: instancesAdminENResources,
  legalAcceptance: legalAcceptanceAdminENResources,
  legalTexts: legalTextsAdminENResources,
  organizations: organizationsAdminENResources,
  roles: rolesAdminENResources,
  shared: sharedAdminENResources,
  users: usersAdminENResources,
} as const;

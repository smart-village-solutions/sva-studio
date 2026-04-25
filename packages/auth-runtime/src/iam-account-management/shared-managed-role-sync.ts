import { createManagedRoleSync } from '@sva/iam-admin';

import { emitRoleAuditEvent, setRoleSyncState } from './shared-activity.js';
import { trackKeycloakCall } from './shared-observability.js';
import { withInstanceScopedDb } from './shared-runtime.js';
import { buildRoleAttributes } from './roles-handlers.shared.js';

export const { ensureManagedRealmRolesExist } = createManagedRoleSync({
  buildRoleAttributes,
  emitRoleAuditEvent,
  setRoleSyncState,
  trackKeycloakCall,
  withInstanceScopedDb,
});

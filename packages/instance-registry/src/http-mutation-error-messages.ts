import type { InstanceMutationErrorCode } from './mutation-errors.js';

export const mutationErrorMessages: Record<InstanceMutationErrorCode, string> = {
  tenant_admin_client_not_configured:
    'Für diese Instanz ist noch kein Tenant-Admin-Client hinterlegt.',
  tenant_admin_client_secret_missing:
    'Für diese Instanz ist noch kein Tenant-Admin-Client-Secret hinterlegt.',
  tenant_auth_client_secret_missing:
    'Für diese Instanz ist noch kein Tenant-Client-Secret hinterlegt.',
  idempotency_key_reuse: 'Idempotency-Key wurde bereits mit anderem Payload verwendet.',
  database_unavailable:
    'Die Instanzverwaltung konnte wegen eines Datenbank- oder Schemafehlers nicht abgeschlossen werden.',
  encryption_not_configured: 'Die Feldverschlüsselung für Tenant-Secrets ist nicht konfiguriert.',
  keycloak_unavailable: 'Keycloak konnte für diese Instanz nicht abgeglichen werden.',
  plugin_activation_state_conflict:
    'Der Plugin-Aktivierungszustand wurde gleichzeitig geändert. Bitte erneut versuchen.',
  internal_unclassified:
    'Die Instanzverwaltung konnte nicht abgeschlossen werden. Bitte die Request-ID für die Diagnose verwenden.',
};

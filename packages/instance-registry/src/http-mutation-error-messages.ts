import type { InstanceMutationErrorCode } from './mutation-errors.js';

export const mutationErrorMessages: Record<InstanceMutationErrorCode, string> = {
  tenant_admin_client_not_configured:
    'Für diese Instanz ist noch kein Tenant-Admin-Client hinterlegt.',
  tenant_admin_client_secret_missing:
    'Für diese Instanz ist noch kein Tenant-Admin-Client-Secret hinterlegt.',
  tenant_auth_client_secret_missing:
    'Für diese Instanz ist noch kein Tenant-Client-Secret hinterlegt.',
  idempotency_key_reuse: 'Idempotency-Key wurde bereits mit anderem Payload verwendet.',
  oidc_client_id_reserved:
    'Die OIDC-Client-ID ist für einen installierten Plugin-Vertrag reserviert.',
  tenant_hostname_reserved:
    'Der Hostname ist für den Studio-Root oder einen Infrastruktur-Dienst reserviert.',
  tenant_hostname_conflict: 'Der Hostname ist bereits einer anderen Studio-Instanz zugeordnet.',
  auth_realm_conflict: 'Der Keycloak-Realm ist bereits einer anderen Studio-Instanz zugeordnet.',
  instance_configuration_change_blocked:
    'Die Instanzkonfiguration kann während eines geplanten oder laufenden Provisionings nicht geändert werden. Bitte versuchen Sie es danach erneut.',
  provisioning_retry_mode_invalid:
    'Dieser Provisioning-Lauf kann in der aktuellen Umgebung nicht automatisch erneut gestartet werden.',
  provisioning_retry_instance_status_invalid:
    'Nur ein fehlgeschlagener automatisierter Mandanten-Provisioning-Lauf kann erneut gestartet werden.',
  provisioning_retry_not_safe:
    'Der fehlgeschlagene Schritt ist nicht eindeutig als sicher wiederholbar klassifiziert. Bitte die Run-ID für die Diagnose verwenden.',
  provisioning_retry_conflict:
    'Der Provisioning-Lauf wurde gleichzeitig geändert. Bitte laden Sie die Instanz neu und versuchen Sie es erneut.',
  database_unavailable:
    'Die Instanzverwaltung konnte wegen eines Datenbank- oder Schemafehlers nicht abgeschlossen werden.',
  encryption_not_configured: 'Die Feldverschlüsselung für Tenant-Secrets ist nicht konfiguriert.',
  keycloak_unavailable: 'Keycloak konnte für diese Instanz nicht abgeglichen werden.',
  keycloak_create_readiness_blocked:
    'Keycloak ist für die Tenant-Anlage aktuell nicht erreichbar oder der gewählte Realm ist nicht zulässig.',
  keycloak_plan_blocked:
    'Der aktuelle Keycloak-Plan enthält Blocker und kann nicht ausgeführt werden.',
  keycloak_plan_confirmation_missing:
    'Die ausdrückliche Bestätigung des aktuellen Keycloak-Plans fehlt.',
  keycloak_plan_fingerprint_stale:
    'Der bestätigte Keycloak-Plan ist nicht mehr aktuell. Bitte erneut prüfen und bestätigen.',
  activation_readiness_blocked:
    'Die Instanz erfüllt die aktuellen technischen Voraussetzungen für die Aktivierung noch nicht.',
  plugin_activation_state_conflict:
    'Der Plugin-Aktivierungszustand wurde gleichzeitig geändert. Bitte erneut versuchen.',
  internal_unclassified:
    'Die Instanzverwaltung konnte nicht abgeschlossen werden. Bitte die Request-ID für die Diagnose verwenden.',
};

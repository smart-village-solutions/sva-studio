export const keycloakPanelInstancesAdminDEResources = {
  title: 'Keycloak-Status und Bootstrap',
  subtitle: 'Abgleich von Realm, Client, Mapper und Tenant-Admin für die ausgewählte Instanz.',
  temporaryPassword: 'Temporäres Admin-Passwort',
  passwordHint:
    'Das Passwort wird nur für diesen Bootstrap verwendet und nicht in Studio gespeichert.',
  rotateClientSecret: 'Tenant-Client-Secret beim Reconcile erneut in Keycloak setzen',
  empty: 'Es liegen noch keine Keycloak-Statusdaten für diese Instanz vor.',
} as const;

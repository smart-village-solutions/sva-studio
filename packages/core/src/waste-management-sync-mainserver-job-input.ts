export type WasteManagementSyncMainserverJobInput = {
  readonly operation: 'sync-mainserver';
  readonly keycloakSubject?: string;
  readonly activeOrganizationId?: string;
};

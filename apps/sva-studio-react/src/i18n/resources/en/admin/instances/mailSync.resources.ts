export const mailSyncInstancesAdminENResources = {
  serverSaved: 'General template saved. Inheriting instances have been compared and synchronized.',
  remedy: 'Open invitation template and Keycloak comparison',
  title: 'Keycloak template synchronization',
  blocked: 'Invitation delivery is blocked until the invitation template is synchronized.',
  compare: 'Compare Studio and Keycloak',
  studio: 'Saved Studio version',
  keycloak: 'Current Keycloak version',
  unavailable: 'Keycloak is currently unavailable.',
  unsupported:
    'The Keycloak version cannot be imported without losing formatting. Review its HTML and explicitly transfer the desired Studio version.',
  adopt: 'Adopt Keycloak version',
  transfer: 'Transfer Studio version',
  adoptConfirm: 'Replace the saved Studio version with the displayed Keycloak version?',
  transferConfirm: 'Replace the displayed Keycloak messages with the Studio version?',
  open: 'Open / refresh Keycloak comparison',
  loadFailed: 'Could not load the comparison. Please try again.',
  conflict:
    'The version has changed or could not be confirmed. Reopen the comparison. Your draft is retained.',
  savedPending: 'Saved in Studio, but not synchronized. Please check the Keycloak comparison.',
  status: {
    unreviewed: 'Not yet reconciled',
    pending: 'Not synchronized',
    synced: 'Synchronized and confirmed by readback',
    failed: 'Synchronization not confirmed',
    drift: 'External changes detected',
  },
} as const;

export const flowInstancesAdminENResources = {
  realmModeTitle: 'Realm mode',
  realmModeSubtitle:
    'Choose whether Studio should create a new realm or reconcile an existing one.',
  realmModeNewLabel: 'New realm',
  realmModeExistingLabel: 'Existing realm',
  realmModeNew:
    'New realm: the provisioning run creates the realm and blocks when it already exists.',
  realmModeExisting:
    'Existing realm: the provisioning run expects the realm to exist and reports drift.',
  createHint:
    'Saving only stores the instance and desired registry state. Keycloak provisioning is triggered explicitly from the detail view.',
  preflightTitle: 'Preflight',
  preflightSubtitle:
    'Checks root-host access, technical Keycloak access, and the required bootstrap metadata.',
  preflightEmpty: 'No preflight data has been loaded for this instance yet.',
  previewTitle: 'Preview',
  previewSubtitle: 'Shows the planned create/update steps before the actual provisioning run.',
  previewEmpty: 'No provisioning preview has been generated for this instance yet.',
  executeTitle: 'Execute',
  executeSubtitle: 'Starts tenant provisioning explicitly and writes a visible operations log.',
  protocolTitle: 'Protocol',
  protocolSubtitle:
    'Persisted Keycloak provisioning runs with step status, result, and request id.',
  protocolEmpty: 'No Keycloak provisioning runs have been recorded for this instance yet.',
} as const;

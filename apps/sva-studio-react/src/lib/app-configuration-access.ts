export const appConfigurationReadAccess = {
  kind: 'tenant',
  moduleId: 'application-workspace',
  actions: { mode: 'allOf', values: ['application-workspace.settings.read'] },
} as const;

export const appConfigurationWriteAccess = {
  ...appConfigurationReadAccess,
  actions: {
    mode: 'allOf',
    values: ['application-workspace.settings.read', 'application-workspace.settings.update'],
  },
} as const;

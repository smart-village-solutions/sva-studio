export const resolvePluginAuthComposition = (_input: {
  pluginSources: readonly { pluginId: string }[];
  readConfiguredPluginTenantAccess: (typeof import('@sva/auth-runtime/server'))['readConfiguredPluginTenantAccess'];
}) => ({
  accountCreateContribution: undefined,
  pluginOidcClientRequirements: [],
});

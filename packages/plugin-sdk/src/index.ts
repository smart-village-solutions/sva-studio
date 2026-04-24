export const pluginSdkVersion = '0.0.1';

export type PluginSdkPackageRole = 'plugin-contracts' | 'admin-resources' | 'content-types' | 'plugin-i18n';

export const pluginSdkPackageRoles = [
  'plugin-contracts',
  'admin-resources',
  'content-types',
  'plugin-i18n',
] as const satisfies readonly PluginSdkPackageRole[];

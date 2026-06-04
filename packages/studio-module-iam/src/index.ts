export const studioModuleIamVersion = '0.0.1';

export type StudioModuleIamBootstrapRole = Readonly<{
  roleName: string;
  permissionIds: readonly string[];
}>;

export type StudioModuleIamSystemRole = Readonly<{
  roleName: string;
  permissionIds: readonly string[];
}>;

export type StudioModuleIamContract = Readonly<{
  moduleId: string;
  namespace: string;
  ownerPluginId: string;
  descriptionKey: string;
  permissionIds: readonly string[];
  tenantBootstrapRoles: readonly StudioModuleIamBootstrapRole[];
  rootSystemRoles: readonly StudioModuleIamSystemRole[];
  systemRoles?: readonly StudioModuleIamBootstrapRole[];
}>;

const createStandardContentBootstrapRoles = (pluginId: string): readonly StudioModuleIamBootstrapRole[] => [
  {
    roleName: 'system_admin',
    permissionIds: [`${pluginId}.read`, `${pluginId}.create`, `${pluginId}.update`, `${pluginId}.delete`],
  },
  {
    roleName: 'feature-manager',
    permissionIds: [`${pluginId}.read`, `${pluginId}.create`, `${pluginId}.update`, `${pluginId}.delete`],
  },
  { roleName: 'interface-manager', permissionIds: [`${pluginId}.read`] },
  { roleName: 'designer', permissionIds: [`${pluginId}.read`, `${pluginId}.update`] },
  { roleName: 'editor', permissionIds: [`${pluginId}.read`, `${pluginId}.create`, `${pluginId}.update`, `${pluginId}.delete`] },
  { roleName: 'moderator', permissionIds: [`${pluginId}.read`] },
];

const createStandardContentContract = (pluginId: string, descriptionKey: string): StudioModuleIamContract => {
  const tenantBootstrapRoles = createStandardContentBootstrapRoles(pluginId);

  return {
    moduleId: pluginId,
    namespace: pluginId,
    ownerPluginId: pluginId,
    descriptionKey,
    permissionIds: [`${pluginId}.read`, `${pluginId}.create`, `${pluginId}.update`, `${pluginId}.delete`],
    tenantBootstrapRoles,
    rootSystemRoles: [],
    systemRoles: tenantBootstrapRoles,
  };
};

const newsModuleIamContract = createStandardContentContract('news', 'plugins.news.description');
const eventsModuleIamContract = createStandardContentContract('events', 'plugins.events.description');
const poiModuleIamContract = createStandardContentContract('poi', 'plugins.poi.description');
const wasteManagementTenantBootstrapRoles: readonly StudioModuleIamBootstrapRole[] = [
  {
    roleName: 'system_admin',
    permissionIds: [
      'waste-management.read',
      'waste-management.master-data.manage',
      'waste-management.tours.manage',
      'waste-management.scheduling.manage',
      'waste-management.import.execute',
      'waste-management.seed.execute',
      'waste-management.reset.execute',
      'waste-management.settings.manage',
    ],
  },
  {
    roleName: 'feature-manager',
    permissionIds: [
      'waste-management.read',
      'waste-management.master-data.manage',
      'waste-management.tours.manage',
      'waste-management.scheduling.manage',
      'waste-management.import.execute',
      'waste-management.settings.manage',
    ],
  },
  {
    roleName: 'editor',
    permissionIds: [
      'waste-management.read',
      'waste-management.master-data.manage',
      'waste-management.tours.manage',
      'waste-management.scheduling.manage',
    ],
  },
  {
    roleName: 'designer',
    permissionIds: ['waste-management.read'],
  },
  {
    roleName: 'interface-manager',
    permissionIds: ['waste-management.read'],
  },
  {
    roleName: 'moderator',
    permissionIds: ['waste-management.read'],
  },
];

const wasteManagementModuleIamContract: StudioModuleIamContract = {
  moduleId: 'waste-management',
  namespace: 'waste-management',
  ownerPluginId: 'waste-management',
  descriptionKey: 'plugins.waste-management.description',
  permissionIds: [
    'waste-management.read',
    'waste-management.master-data.manage',
    'waste-management.tours.manage',
    'waste-management.scheduling.manage',
    'waste-management.import.execute',
    'waste-management.seed.execute',
    'waste-management.reset.execute',
    'waste-management.settings.manage',
  ],
  tenantBootstrapRoles: wasteManagementTenantBootstrapRoles,
  rootSystemRoles: [],
  systemRoles: wasteManagementTenantBootstrapRoles,
};
const mediaTenantBootstrapRoles: readonly StudioModuleIamBootstrapRole[] = [
  {
    roleName: 'system_admin',
    permissionIds: [
      'media.read',
      'media.create',
      'media.update',
      'media.reference.manage',
      'media.delete',
      'media.deliver.protected',
    ],
  },
  {
    roleName: 'editor',
    permissionIds: ['media.read', 'media.create', 'media.update', 'media.reference.manage'],
  },
];

const mediaModuleIamContract: StudioModuleIamContract = {
  moduleId: 'media',
  namespace: 'media',
  ownerPluginId: 'host',
  descriptionKey: 'host.media.description',
  permissionIds: [
    'media.read',
    'media.create',
    'media.update',
    'media.reference.manage',
    'media.delete',
    'media.deliver.protected',
  ],
  tenantBootstrapRoles: mediaTenantBootstrapRoles,
  rootSystemRoles: [],
  systemRoles: mediaTenantBootstrapRoles,
};

export const studioPluginModuleIamContracts = [
  newsModuleIamContract,
  eventsModuleIamContract,
  poiModuleIamContract,
  wasteManagementModuleIamContract,
] as const satisfies readonly StudioModuleIamContract[];

export const studioHostModuleIamContracts = [mediaModuleIamContract] as const satisfies readonly StudioModuleIamContract[];

export const studioModuleIamContracts = [
  ...studioPluginModuleIamContracts,
  ...studioHostModuleIamContracts,
] as const satisfies readonly StudioModuleIamContract[];

export const studioModuleIamRegistry = new Map(
  studioModuleIamContracts.map((contract) => [contract.moduleId, contract] as const)
) as ReadonlyMap<string, StudioModuleIamContract>;

export const getStudioModuleIamContract = (moduleId: string): StudioModuleIamContract | undefined =>
  studioModuleIamRegistry.get(moduleId);

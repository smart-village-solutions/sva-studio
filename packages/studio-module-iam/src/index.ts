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
];

const createSystemAdminSystemRoles = (
  roles: readonly StudioModuleIamBootstrapRole[]
): readonly StudioModuleIamSystemRole[] => roles.filter((role) => role.roleName === 'system_admin');

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
    systemRoles: createSystemAdminSystemRoles(tenantBootstrapRoles),
  };
};

const categoriesModuleIamContract = createStandardContentContract('categories', 'plugins.categories.description');
const newsModuleIamContract = createStandardContentContract('news', 'plugins.news.description');
const eventsModuleIamContract = createStandardContentContract('events', 'plugins.events.description');
const poiModuleIamContract = createStandardContentContract('poi', 'plugins.poi.description');
const genericItemsModuleIamContract = createStandardContentContract(
  'generic-items',
  'plugins.generic-items.description'
);
const surveysTenantBootstrapRoles: readonly StudioModuleIamBootstrapRole[] = [
  {
    roleName: 'system_admin',
    permissionIds: [
      'surveys.read',
      'surveys.create',
      'surveys.update',
      'surveys.delete',
      'surveys.moderate',
      'surveys.export',
    ],
  },
];

const surveysModuleIamContract: StudioModuleIamContract = {
  moduleId: 'surveys',
  namespace: 'surveys',
  ownerPluginId: 'surveys',
  descriptionKey: 'plugins.surveys.description',
  permissionIds: [
    'surveys.read',
    'surveys.create',
    'surveys.update',
    'surveys.delete',
    'surveys.moderate',
    'surveys.export',
  ],
  tenantBootstrapRoles: surveysTenantBootstrapRoles,
  rootSystemRoles: [],
  systemRoles: createSystemAdminSystemRoles(surveysTenantBootstrapRoles),
};

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
  systemRoles: createSystemAdminSystemRoles(wasteManagementTenantBootstrapRoles),
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
  systemRoles: createSystemAdminSystemRoles(mediaTenantBootstrapRoles),
};

export const studioPluginModuleIamContracts = [
  categoriesModuleIamContract,
  newsModuleIamContract,
  eventsModuleIamContract,
  poiModuleIamContract,
  genericItemsModuleIamContract,
  surveysModuleIamContract,
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

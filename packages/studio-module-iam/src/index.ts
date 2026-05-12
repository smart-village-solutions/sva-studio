export const studioModuleIamVersion = '0.0.1';

export type StudioModuleIamSystemRole = Readonly<{
  roleName: string;
  permissionIds: readonly string[];
}>;

export type StudioModuleIamContract = Readonly<{
  moduleId: string;
  namespace: string;
  ownerPluginId: string;
  permissionIds: readonly string[];
  systemRoles: readonly StudioModuleIamSystemRole[];
}>;

const createStandardContentSystemRoles = (pluginId: string): readonly StudioModuleIamSystemRole[] => [
  {
    roleName: 'system_admin',
    permissionIds: [`${pluginId}.read`, `${pluginId}.create`, `${pluginId}.update`, `${pluginId}.delete`],
  },
  { roleName: 'app_manager', permissionIds: [`${pluginId}.read`] },
  {
    roleName: 'feature-manager',
    permissionIds: [`${pluginId}.read`, `${pluginId}.create`, `${pluginId}.update`, `${pluginId}.delete`],
  },
  { roleName: 'interface-manager', permissionIds: [`${pluginId}.read`] },
  { roleName: 'designer', permissionIds: [`${pluginId}.read`, `${pluginId}.update`] },
  { roleName: 'editor', permissionIds: [`${pluginId}.read`, `${pluginId}.create`, `${pluginId}.update`, `${pluginId}.delete`] },
  { roleName: 'moderator', permissionIds: [`${pluginId}.read`] },
];

const createStandardContentContract = (pluginId: string): StudioModuleIamContract => ({
  moduleId: pluginId,
  namespace: pluginId,
  ownerPluginId: pluginId,
  permissionIds: [`${pluginId}.read`, `${pluginId}.create`, `${pluginId}.update`, `${pluginId}.delete`],
  systemRoles: createStandardContentSystemRoles(pluginId),
});

const newsModuleIamContract = createStandardContentContract('news');
const eventsModuleIamContract = createStandardContentContract('events');
const poiModuleIamContract = createStandardContentContract('poi');
const wasteManagementModuleIamContract: StudioModuleIamContract = {
  moduleId: 'waste-management',
  namespace: 'waste-management',
  ownerPluginId: 'waste-management',
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
  systemRoles: [
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
      roleName: 'app_manager',
      permissionIds: ['waste-management.read', 'waste-management.settings.manage'],
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
  ],
};
const mediaModuleIamContract: StudioModuleIamContract = {
  moduleId: 'media',
  namespace: 'media',
  ownerPluginId: 'host',
  permissionIds: [
    'media.read',
    'media.create',
    'media.update',
    'media.reference.manage',
    'media.delete',
    'media.deliver.protected',
  ],
  systemRoles: [
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
  ],
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

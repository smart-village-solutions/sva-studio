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
const mediaModuleIamContract: StudioModuleIamContract = {
  moduleId: 'media',
  namespace: 'media',
  ownerPluginId: 'host',
  permissionIds: [
    'media.read',
    'media.create',
    'media.update',
    'media.referenceManage',
    'media.delete',
    'media.deliverProtected',
  ],
  systemRoles: [
    {
      roleName: 'system_admin',
      permissionIds: [
        'media.read',
        'media.create',
        'media.update',
        'media.referenceManage',
        'media.delete',
        'media.deliverProtected',
      ],
    },
    {
      roleName: 'editor',
      permissionIds: ['media.read', 'media.create', 'media.update', 'media.referenceManage'],
    },
  ],
};

export const studioPluginModuleIamContracts = [
  newsModuleIamContract,
  eventsModuleIamContract,
  poiModuleIamContract,
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

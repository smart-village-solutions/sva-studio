import { definePluginAdminResources, type AdminResourceDefinition } from './admin-resources.js';
import { definePluginContentTypes, type ContentTypeDefinition } from './content-types.js';
import {
  definePluginActions,
  definePluginModuleIamContract,
  definePluginPermissions,
  type PluginActionDefinition,
  type PluginModuleIamContract,
  type PluginModuleIamSystemRoleDefinition,
  type PluginNavigationItem,
  type PluginPermissionDefinition,
} from './plugins.js';

export type StandardContentPluginActionName = 'create' | 'edit' | 'update' | 'delete';

export type StandardContentPluginActionIds<TPluginId extends string = string> = Readonly<{
  create: `${TPluginId}.create`;
  edit: `${TPluginId}.edit`;
  update: `${TPluginId}.update`;
  delete: `${TPluginId}.delete`;
}>;

export type StandardContentPluginActionOptions = Readonly<{
  legacyAliases?: Partial<Readonly<Record<StandardContentPluginActionName, readonly string[]>>>;
}>;

export type StandardContentAdminResourceOptions = Readonly<{
  pluginId: string;
  titleKey: string;
  contentType: string;
  listBindingKey: string;
  detailBindingKey: string;
  editorBindingKey: string;
  basePath?: string;
}>;

export type StandardContentPluginContributionOptions = StandardContentAdminResourceOptions &
  Readonly<{
    displayName: string;
    actionOptions?: StandardContentPluginActionOptions;
  }>;

const defaultPagination = {
  pageParam: 'page',
  pageSizeParam: 'pageSize',
  defaultPageSize: 25,
  pageSizeOptions: [25, 50, 100],
} as const;

export const createStandardContentPluginActionIds = <const TPluginId extends string>(
  pluginId: TPluginId
): StandardContentPluginActionIds<TPluginId> =>
  ({
    create: `${pluginId}.create`,
    edit: `${pluginId}.edit`,
    update: `${pluginId}.update`,
    delete: `${pluginId}.delete`,
  }) as const;

export const createStandardContentPluginPermissions = (pluginId: string): readonly PluginPermissionDefinition[] =>
  definePluginPermissions(pluginId, [
    { id: `${pluginId}.read`, titleKey: `${pluginId}.permissions.read` },
    { id: `${pluginId}.create`, titleKey: `${pluginId}.permissions.create` },
    { id: `${pluginId}.update`, titleKey: `${pluginId}.permissions.update` },
    { id: `${pluginId}.delete`, titleKey: `${pluginId}.permissions.delete` },
  ] as const);

export const createStandardContentPluginActions = (
  pluginId: string,
  options?: StandardContentPluginActionOptions
): readonly PluginActionDefinition[] => {
  const actionIds = createStandardContentPluginActionIds(pluginId);

  return definePluginActions(pluginId, [
    {
      id: actionIds.create,
      titleKey: `${pluginId}.actions.create`,
      requiredAction: `${pluginId}.create`,
      legacyAliases: options?.legacyAliases?.create,
    },
    {
      id: actionIds.edit,
      titleKey: `${pluginId}.actions.edit`,
      requiredAction: `${pluginId}.read`,
      legacyAliases: options?.legacyAliases?.edit,
    },
    {
      id: actionIds.update,
      titleKey: `${pluginId}.actions.update`,
      requiredAction: `${pluginId}.update`,
      legacyAliases: options?.legacyAliases?.update,
    },
    {
      id: actionIds.delete,
      titleKey: `${pluginId}.actions.delete`,
      requiredAction: `${pluginId}.delete`,
      legacyAliases: options?.legacyAliases?.delete,
    },
  ] as const);
};

export const createStandardContentPluginSystemRoles = (
  pluginId: string
): readonly PluginModuleIamSystemRoleDefinition[] => [
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

export const createStandardContentModuleIamContract = (pluginId: string): PluginModuleIamContract =>
  definePluginModuleIamContract(pluginId, {
    moduleId: pluginId,
    permissionIds: [`${pluginId}.read`, `${pluginId}.create`, `${pluginId}.update`, `${pluginId}.delete`],
    systemRoles: createStandardContentPluginSystemRoles(pluginId),
  });

export const createStandardContentAdminResource = (
  options: StandardContentAdminResourceOptions
): AdminResourceDefinition => ({
  resourceId: `${options.pluginId}.content`,
  basePath: options.basePath ?? options.pluginId,
  titleKey: options.titleKey,
  guard: 'content',
  moduleId: options.pluginId,
  views: {
    list: { bindingKey: 'content' },
    create: { bindingKey: 'contentCreate' },
    detail: { bindingKey: 'contentDetail' },
  },
  permissions: {
    list: [`${options.pluginId}.read`],
    create: [`${options.pluginId}.create`],
    detail: [`${options.pluginId}.read`],
  },
  capabilities: {
    list: {
      pagination: defaultPagination,
    },
  },
  contentUi: {
    contentType: options.contentType,
    bindings: {
      list: { bindingKey: options.listBindingKey },
      detail: { bindingKey: options.detailBindingKey },
      editor: { bindingKey: options.editorBindingKey },
    },
  },
});

export const createStandardContentTypeDefinition = (
  pluginId: string,
  contentType: string,
  displayName: string
): readonly ContentTypeDefinition[] => definePluginContentTypes(pluginId, [{ contentType, displayName }] as const);

export const createStandardContentPluginContribution = (options: StandardContentPluginContributionOptions): Readonly<{
  navigation: readonly PluginNavigationItem[];
  actions: readonly PluginActionDefinition[];
  permissions: readonly PluginPermissionDefinition[];
  moduleIam: PluginModuleIamContract;
  contentTypes: readonly ContentTypeDefinition[];
  adminResources: readonly AdminResourceDefinition[];
}> => ({
  navigation: [
    {
      id: `${options.pluginId}.navigation`,
      to: `/admin/${options.basePath ?? options.pluginId}`,
      titleKey: options.titleKey,
      section: 'dataManagement',
      requiredAction: `${options.pluginId}.read`,
    },
  ],
  actions: createStandardContentPluginActions(options.pluginId, options.actionOptions),
  permissions: createStandardContentPluginPermissions(options.pluginId),
  moduleIam: createStandardContentModuleIamContract(options.pluginId),
  contentTypes: createStandardContentTypeDefinition(options.pluginId, options.contentType, options.displayName),
  adminResources: definePluginAdminResources(options.pluginId, [createStandardContentAdminResource(options)]),
});

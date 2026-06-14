export const instanceModulesInstancesAdminENResources = {
  title: 'Instance modules',
  subtitle: 'Assign and revoke modules per instance and rebuild the matching IAM baseline.',
  empty: 'Select an instance to manage module assignments.',
  instanceSelect: {
    label: 'Select instance',
    hint: 'Module management always operates on one concrete instance.',
    placeholder: 'Select an instance',
  },
  assigned: {
    title: 'Assigned modules',
    subtitle: 'These modules are currently active for the selected instance.',
    empty: 'No modules are currently assigned to this instance.',
  },
  available: {
    title: 'Available modules',
    subtitle: 'These modules can be assigned to the selected instance.',
    empty: 'All known modules are already assigned to this instance.',
  },
  detail: {
    title: 'Module IAM baseline',
    subtitle: 'Shows all globally known modules with an active or inactive tenant status.',
    table: {
      module: 'Module',
      status: 'Status',
      description: 'Description',
    },
    status: {
      active: 'Active',
      inactive: 'Inactive',
    },
    descriptionFallback: 'No module description available.',
  },
  guidance: {
    title: 'Release semantics',
    subtitle:
      'Modules enable business areas. Roles and direct permissions control which actions are allowed inside those areas.',
    moduleTitle: 'Modules enable areas',
    moduleBody:
      'Assigning a module enables a business area for the instance. Visibility and routing follow module assignment plus the matching read permission.',
    roleTitle: 'Roles grant permissions',
    roleBody:
      'Roles bundle permissions such as read, create, or update. The listed module permissions come directly from the canonical module contract.',
  },
  module: {
    permissions: 'Permissions: {{value}}',
    roles: 'Protected system roles: {{value}}',
  },
  actions: {
    assign: 'Assign module',
    revoke: 'Revoke module',
    seedIamBaseline: 'Rebuild IAM baseline',
    bootstrapAdminStructure: 'Initialize tenant admin structure',
  },
  confirmRevoke: {
    title: 'Really revoke module?',
    description:
      'Module {{moduleId}} will be revoked from instance {{instanceId}}. Related permissions and IAM baseline data will be removed.',
    confirm: 'Revoke module',
    cancel: 'Cancel',
  },
  confirmBootstrap: {
    title: 'Really initialize the tenant admin structure?',
    description:
      'For instance {{instanceId}}, `system_admin` and the IAM baseline for the currently assigned modules will be synchronized. No additional legacy default roles are created.',
    confirm: 'Initialize tenant admin structure',
    cancel: 'Cancel',
  },
} as const;

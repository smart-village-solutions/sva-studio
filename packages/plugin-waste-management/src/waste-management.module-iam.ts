import { definePluginModuleIamContract } from '@sva/plugin-sdk';

export const wasteManagementModuleIam = definePluginModuleIamContract('waste-management', {
  moduleId: 'waste-management',
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
  ],
});

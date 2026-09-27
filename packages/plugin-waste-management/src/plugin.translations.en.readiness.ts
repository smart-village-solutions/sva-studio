export const wasteManagementPluginTranslationsENReadiness = {
  readiness: {
    provisioning: 'Domain provisioning',
    managedInterface: 'Managed database interface',
    iamSchema: 'Waste data source table',
    iamSchemaBlocked:
      'The iam.instance_waste_data_sources table is missing. Check migration 0065_iam_instance_waste_data_sources.sql.',
    unavailable: 'Waste readiness could not be checked. Please try again.',
    provisioningBlocked: 'Waste domain provisioning has not completed successfully.',
    managedInterfaceBlocked: 'The managed Waste database interface is not ready.',
  },
} as const;

export const wasteManagementPluginTranslationsDEReadiness = {
  readiness: {
    provisioning: 'Fachprovisionierung',
    managedInterface: 'Verwaltete Datenbankschnittstelle',
    iamSchema: 'Waste-Datenquellentabelle',
    iamSchemaBlocked:
      'Die Tabelle iam.instance_waste_data_sources fehlt. Migration 0065_iam_instance_waste_data_sources.sql prüfen.',
    unavailable: 'Die Waste-Bereitschaft konnte nicht geprüft werden. Bitte erneut versuchen.',
    provisioningBlocked: 'Die Waste-Fachprovisionierung ist nicht vollständig abgeschlossen.',
    managedInterfaceBlocked:
      'Die verwaltete Waste-Datenbankschnittstelle ist nicht betriebsbereit.',
  },
} as const;

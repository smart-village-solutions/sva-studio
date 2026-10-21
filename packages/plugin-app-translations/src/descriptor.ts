/** Host-owned registration; no editor, provider or remote publication is exposed here. */
import {
  definePluginActions,
  definePluginPermissions,
  definePluginModuleIamContract,
  type PluginDescriptor,
} from '@sva/plugin-sdk';

export const APP_TRANSLATIONS_LIFECYCLE_JOB = 'app-translations.lifecycle';
const tenantPermissionIds = [
  'app-translations.catalog.read',
  'app-translations.catalog.write',
  'app-translations.catalog.publish',
] as const;
const permissions = definePluginPermissions(
  'app-translations',
  tenantPermissionIds.map((id) => ({
    id,
    titleKey: `appTranslations.permissions.${id.split('.').slice(1).join('.')}`,
  }))
);
const actions = definePluginActions(
  'app-translations',
  permissions.map(({ id, titleKey }) => ({
    id,
    titleKey,
    accessRequirement: {
      kind: 'tenant' as const,
      moduleId: 'app-translations',
      actions: { mode: 'allOf' as const, values: [id] },
    },
  }))
);
export const appTranslationsPlugin: PluginDescriptor = {
  id: 'app-translations',
  displayName: 'Mehrsprachigkeit',
  routes: [],
  navigation: [],
  permissions,
  actions,
  moduleIam: definePluginModuleIamContract('app-translations', {
    moduleId: 'app-translations',
    permissionIds: tenantPermissionIds,
    systemRoles: [{ roleName: 'system_admin', permissionIds: tenantPermissionIds }],
  }),
  jobTypes: [
    {
      jobTypeId: APP_TRANSLATIONS_LIFECYCLE_JOB,
      queue: 'plugin-operations',
      displayName: 'Mehrsprachigkeit',
      descriptionKey: 'appTranslations.readiness.local',
      startPolicy: 'dedicated',
    },
  ],
  tenantLifecycle: {
    contractVersion: 1,
    operations: (['provision', 'reconcile', 'readiness', 'suspend', 'reactivate'] as const).map(
      (operation) => ({
        operation,
        jobTypeId: APP_TRANSLATIONS_LIFECYCLE_JOB,
      })
    ),
    readinessChecks: [
      {
        checkId: 'app-translations.schema',
        titleKey: 'appTranslations.readiness.schema',
        required: true,
        repairOperation: 'reconcile',
      },
      {
        checkId: 'app-translations.provider',
        titleKey: 'appTranslations.readiness.provider',
        required: false,
      },
    ],
  },
  contentHistory: { mode: 'none', reasonCode: 'infrastructure_only' },
  translations: {
    de: {
      appTranslations: {
        permissions: {
          catalog: {
            read: 'Kataloge lesen',
            write: 'Katalogentwürfe bearbeiten',
            publish: 'Katalogsätze vorbereiten',
          },
        },
        readiness: {
          local: 'Lokale Katalogbasis prüfen — App-Integration noch nicht verfügbar',
          schema: 'Lokale Katalogbasis',
          provider: 'Zentraler DeepL-Zugang konfiguriert',
          remoteUnavailable: 'Remote-Lifecycle noch nicht verfügbar',
        },
      },
    },
    en: {
      appTranslations: {
        permissions: {
          catalog: {
            read: 'Read catalogs',
            write: 'Edit catalog drafts',
            publish: 'Prepare catalog sets',
          },
        },
        readiness: {
          local: 'Check local catalog basis — app integration is not available yet',
          schema: 'Local catalog basis',
          provider: 'Central DeepL credential configured',
          remoteUnavailable: 'Remote lifecycle is not available yet',
        },
      },
    },
  },
};

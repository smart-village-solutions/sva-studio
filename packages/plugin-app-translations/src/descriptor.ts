import { germanTranslations } from './descriptor.de.js';
import { englishTranslations } from './descriptor.en.js';
import {
  definePluginActions,
  definePluginPermissions,
  definePluginModuleIamContract,
  type PluginDescriptor,
} from '@sva/plugin-sdk';
/** Metadata stays server-safe; browser views are connected by the browser entry. */

export const APP_TRANSLATIONS_CATALOG_JOB = 'app-translations.catalog-translate';
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
  routes: [
    {
      id: 'app-translations.catalogs',
      path: '/plugins/app-translations',
      documentation: { kind: 'page', id: 'app-translations.catalogs', pageType: 'overview' },
      actionId: 'app-translations.catalog.read',
      accessRequirement: {
        kind: 'tenant',
        moduleId: 'app-translations',
        actions: { mode: 'allOf', values: ['app-translations.catalog.read'] },
      },
    },
  ],
  navigation: [
    {
      id: 'app-translations.navigation',
      to: '/plugins/app-translations',
      titleKey: 'appTranslations.ui.title',
      section: 'applications',
      requiredAction: 'app-translations.catalog.read',
      accessRequirement: {
        kind: 'tenant',
        moduleId: 'app-translations',
        actions: { mode: 'allOf', values: ['app-translations.catalog.read'] },
      },
    },
  ],
  permissions,
  actions,
  moduleIam: definePluginModuleIamContract('app-translations', {
    moduleId: 'app-translations',
    permissionIds: tenantPermissionIds,
    systemRoles: [{ roleName: 'system_admin', permissionIds: tenantPermissionIds }],
  }),
  jobTypes: [
    {
      jobTypeId: APP_TRANSLATIONS_CATALOG_JOB,
      supportsCancellation: true,
      queue: 'app-translations',
      displayName: 'DeepL',
      descriptionKey: 'appTranslations.ui.translateMissing',
      startPolicy: 'dedicated',
    },
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
      {
        checkId: 'app-translations.service',
        titleKey: 'appTranslations.readiness.service',
        required: false,
        repairOperation: 'reconcile',
      },
    ],
  },
  contentHistory: { mode: 'none', reasonCode: 'infrastructure_only' },
  translations: { de: germanTranslations, en: englishTranslations },
};

import { corePermissionCatalog } from '@sva/core';
import { translatePluginKey } from '@sva/plugin-sdk';

import { t } from '../i18n';
import { studioBuildTimeRegistry } from './plugins';

const HOST_PERMISSION_TITLE_KEYS = {
  'iam.user.read': 'permissionDenial.titles.iamUserRead',
  'iam.user.write': 'permissionDenial.titles.iamUserWrite',
  'iam.role.read': 'permissionDenial.titles.iamRoleRead',
  'iam.role.write': 'permissionDenial.titles.iamRoleWrite',
  'iam.org.read': 'permissionDenial.titles.iamOrgRead',
  'iam.org.write': 'permissionDenial.titles.iamOrgWrite',
  'iam.legalText.read': 'permissionDenial.titles.iamLegalTextRead',
  'iam.legalText.write': 'permissionDenial.titles.iamLegalTextWrite',
  'iam.governance.read': 'permissionDenial.titles.iamGovernanceRead',
  'iam.governance.write': 'permissionDenial.titles.iamGovernanceWrite',
  'iam.governance.export': 'permissionDenial.titles.iamGovernanceExport',
  'iam.dsr.read': 'permissionDenial.titles.iamDsrRead',
  'iam.dsr.write': 'permissionDenial.titles.iamDsrWrite',
  'iam.dsr.export': 'permissionDenial.titles.iamDsrExport',
  'iam.deletionRules.read': 'permissionDenial.titles.iamDeletionRulesRead',
  'iam.deletionRules.write': 'permissionDenial.titles.iamDeletionRulesWrite',
  'iam.monitoring.read': 'permissionDenial.titles.iamMonitoringRead',
  'iam.monitoring.write': 'permissionDenial.titles.iamMonitoringWrite',
  'iam.accounts.delete': 'permissionDenial.titles.iamAccountsDelete',
  'experimental.read': 'permissionDenial.titles.experimentalRead',
  'app.read': 'permissionDenial.titles.appRead',
  'cockpit.read': 'permissionDenial.titles.cockpitRead',
  'content.read': 'permissionDenial.titles.contentRead',
  'content.create': 'permissionDenial.titles.contentCreate',
  'content.updateMetadata': 'permissionDenial.titles.contentUpdateMetadata',
  'content.updatePayload': 'permissionDenial.titles.contentUpdatePayload',
  'content.changeStatus': 'permissionDenial.titles.contentChangeStatus',
  'content.publish': 'permissionDenial.titles.contentPublish',
  'content.archive': 'permissionDenial.titles.contentArchive',
  'content.restore': 'permissionDenial.titles.contentRestore',
  'content.readHistory': 'permissionDenial.titles.contentReadHistory',
  'content.manageRevisions': 'permissionDenial.titles.contentManageRevisions',
  'content.delete': 'permissionDenial.titles.contentDelete',
  'integration.manage': 'permissionDenial.titles.integrationManage',
  'feature.toggle': 'permissionDenial.titles.featureToggle',
  'instance.registry.manage': 'permissionDenial.titles.instanceRegistryManage',
  'media.read': 'permissionDenial.titles.mediaRead',
  'media.create': 'permissionDenial.titles.mediaCreate',
  'media.update': 'permissionDenial.titles.mediaUpdate',
  'media.reference.manage': 'permissionDenial.titles.mediaReferenceManage',
  'media.delete': 'permissionDenial.titles.mediaDelete',
  'media.deliver.protected': 'permissionDenial.titles.mediaDeliverProtected',
} as const satisfies Readonly<Record<string, string>>;

const corePermissionIds = new Set(corePermissionCatalog.map((permission) => permission.key));

export const resolvePermissionTitle = (permissionId: string): string | undefined => {
  const pluginPermission = studioBuildTimeRegistry.pluginPermissionRegistry.get(permissionId);
  if (pluginPermission) {
    const prefix = `${pluginPermission.ownerPluginId}.`;
    const localTitleKey = pluginPermission.titleKey.startsWith(prefix)
      ? pluginPermission.titleKey.slice(prefix.length)
      : pluginPermission.titleKey;
    const translated = translatePluginKey(pluginPermission.ownerPluginId, localTitleKey);
    if (translated !== pluginPermission.titleKey) {
      return translated;
    }
    const action = [...studioBuildTimeRegistry.pluginActionRegistry.values()].find(
      (candidate) => candidate.requiredAction === permissionId
    );
    if (action) {
      const actionPrefix = `${action.ownerPluginId}.`;
      const localActionTitleKey = action.titleKey.startsWith(actionPrefix)
        ? action.titleKey.slice(actionPrefix.length)
        : action.titleKey;
      const actionTitle = translatePluginKey(action.ownerPluginId, localActionTitleKey);
      if (actionTitle !== action.titleKey) {
        return actionTitle;
      }
    }
    const operation = permissionId.slice(permissionId.lastIndexOf('.') + 1);
    const supportedOperation = ['read', 'create', 'update', 'delete', 'manage', 'export'].find(
      (candidate) => candidate === operation
    );
    const plugin = studioBuildTimeRegistry.pluginRegistry.get(pluginPermission.ownerPluginId);
    return supportedOperation && plugin
      ? t(`permissionDenial.pluginActions.${supportedOperation}`, { plugin: plugin.displayName })
      : undefined;
  }

  const titleKey = HOST_PERMISSION_TITLE_KEYS[permissionId as keyof typeof HOST_PERMISSION_TITLE_KEYS];
  if (!titleKey) {
    return undefined;
  }
  const translated = t(titleKey);
  return translated === titleKey ? undefined : translated;
};

export const hostPermissionTitleCoverage = {
  catalogPermissionIds: [...corePermissionIds],
  translatedPermissionIds: Object.keys(HOST_PERMISSION_TITLE_KEYS),
} as const;

export const registeredPluginPermissionIds = [
  ...studioBuildTimeRegistry.pluginPermissionRegistry.keys(),
] as const;

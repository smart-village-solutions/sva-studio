import type { IamDeletionContentStrategy, IamTenantDeletionRulesOverview } from '@sva/core';

import { createOperationLogger } from '../../lib/browser-operation-logging';

import { type IamCockpitTabKey } from '../../lib/iam-viewer-access';

import { formatEditorDateTime } from '../../lib/editor-date-time';

import { t } from '../../i18n';

import { type IamPermissionsQuery } from './-iam.models';

export type IamApiErrorPayload = {
  error: string;
};

export type IamViewerPageProps = {
  readonly activeTab: IamCockpitTabKey;
};

export const FILTER_REQUEST_DEBOUNCE_MS = 300;

export const iamViewerLogger = createOperationLogger('iam-viewer-page', 'debug');

export const buildPermissionsPath = (query: IamPermissionsQuery) => {
  const searchParams = new URLSearchParams();
  searchParams.set('instanceId', query.instanceId);
  if (query.organizationId) {
    searchParams.set('organizationId', query.organizationId);
  }
  if (query.actingAsUserId) {
    searchParams.set('actingAsUserId', query.actingAsUserId);
  }
  return `/iam/me/permissions?${searchParams.toString()}`;
};

export const buildGovernanceComplianceExportPath = (input: { instanceId: string }) => {
  const searchParams = new URLSearchParams();
  searchParams.set('instanceId', input.instanceId);
  searchParams.set('format', 'csv');

  return `/iam/governance/compliance/export?${searchParams.toString()}`;
};

export const formatDateTime = (value?: string) => {
  if (!value) {
    return '—';
  }
  return formatEditorDateTime(value) ?? value;
};

export const governanceTypeOptions = [
  'permission_change',
  'delegation',
  'impersonation',
  'legal_acceptance',
] as const;

export const dsrTypeOptions = [
  'request',
  'export_job',
  'legal_hold',
  'profile_correction',
  'recipient_notification',
] as const;

export const dsrStatusOptions = [
  'queued',
  'in_progress',
  'completed',
  'blocked',
  'failed',
] as const;

export const mapDeletionContentStrategyKey = (strategy: IamDeletionContentStrategy) => {
  switch (strategy) {
    case 'with_owner_lifecycle':
      return 'admin.iam.deletionRules.strategies.with_owner_lifecycle';
    case 'retain':
    default:
      return 'admin.iam.deletionRules.strategies.retain';
  }
};

export const deletionContentStrategyOptions: readonly IamDeletionContentStrategy[] = [
  'retain',
  'with_owner_lifecycle',
] as const;

export const getTabId = (tab: IamCockpitTabKey) => `iam-tab-${tab}`;

export const getTabPanelId = (tab: IamCockpitTabKey) => `iam-panel-${tab}`;

export const isAbortError = (error: unknown) =>
  (error instanceof DOMException || error instanceof Error) && error.name === 'AbortError';

export const buildSelectOptions = (values: readonly (string | null | undefined)[]) =>
  [...new Set(values.map((value) => value?.trim() ?? '').filter((value) => value.length > 0))].sort(
    (left, right) => left.localeCompare(right)
  );

export type DeletionRulesDraft = {
  deactivateAfterDays: string;
  pseudonymizeAfterDays: string;
  deleteAfterDays: string;
  defaultContentStrategy: IamDeletionContentStrategy;
  allowContentPreferenceOverride: boolean;
};

export type ActiveTabHelp = {
  title: string;
  description: string;
  options: readonly string[];
};

export const createDeletionRulesDraft = (
  rules: IamTenantDeletionRulesOverview
): DeletionRulesDraft => ({
  deactivateAfterDays: String(rules.deactivateAfterDays),
  pseudonymizeAfterDays: String(rules.pseudonymizeAfterDays),
  deleteAfterDays: String(rules.deleteAfterDays),
  defaultContentStrategy: rules.defaultContentStrategy,
  allowContentPreferenceOverride: rules.allowContentPreferenceOverride,
});

export const getActiveTabHelp = (activeTab: IamCockpitTabKey): ActiveTabHelp => {
  switch (activeTab) {
    case 'rights':
      return {
        title: t('admin.iam.tabHelp.rights.title'),
        description: t('admin.iam.tabHelp.rights.description'),
        options: [
          t('admin.iam.tabHelp.rights.options.first'),
          t('admin.iam.tabHelp.rights.options.second'),
          t('admin.iam.tabHelp.rights.options.third'),
        ],
      };
    case 'governance':
      return {
        title: t('admin.iam.tabHelp.governance.title'),
        description: t('admin.iam.tabHelp.governance.description'),
        options: [
          t('admin.iam.tabHelp.governance.options.first'),
          t('admin.iam.tabHelp.governance.options.second'),
          t('admin.iam.tabHelp.governance.options.third'),
        ],
      };
    case 'dsr':
      return {
        title: t('admin.iam.tabHelp.dsr.title'),
        description: t('admin.iam.tabHelp.dsr.description'),
        options: [
          t('admin.iam.tabHelp.dsr.options.first'),
          t('admin.iam.tabHelp.dsr.options.second'),
          t('admin.iam.tabHelp.dsr.options.third'),
        ],
      };
    case 'deletion-rules':
      return {
        title: t('admin.iam.tabHelp.deletionRules.title'),
        description: t('admin.iam.tabHelp.deletionRules.description'),
        options: [
          t('admin.iam.tabHelp.deletionRules.options.first'),
          t('admin.iam.tabHelp.deletionRules.options.second'),
          t('admin.iam.tabHelp.deletionRules.options.third'),
        ],
      };
  }
};

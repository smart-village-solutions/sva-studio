import type { UseFormReturn } from 'react-hook-form';
import type { AccountInvitationTemplateSaveResult } from './-account-invitation-template-card';
import type React from 'react';
import { t } from '../../../i18n';
import type { StudioSaveStatus } from '@sva/studio-ui-react';

import { formatEditorDateTime } from '../../../lib/editor-date-time';

import type { IamHttpError } from '../../../lib/iam-api';
import type {
  DetailFormValues,
  DetailWorkflowAction,
  InstanceConfigurationAssessment,
  InstanceDetailCockpitModel,
  SelectedInstance,
} from './-instances-shared-types';

export const INSTANCE_STATUS_LABELS = {
  requested: 'admin.instances.status.requested',
  validated: 'admin.instances.status.validated',
  provisioning: 'admin.instances.status.provisioning',
  active: 'admin.instances.status.active',
  failed: 'admin.instances.status.failed',
  suspended: 'admin.instances.status.suspended',
  archived: 'admin.instances.status.archived',
} as const;

export type WorkspaceTabKey = 'betrieb' | 'doctor' | 'einstellungen';
export type WorkspaceSectionCommonProps = {
  readonly selectedInstance: SelectedInstance;
  readonly detailFormValues: DetailFormValues;
  readonly statusLoading: boolean;
};

export type ConfigurationSectionProps = WorkspaceSectionCommonProps & {
  readonly form?: UseFormReturn<DetailFormValues>;
  readonly saving?: boolean;
  readonly configurationAssessment: InstanceConfigurationAssessment | null;
  readonly tenantSecretUserInputRequired: boolean;
  readonly setDetailFormValues: React.Dispatch<React.SetStateAction<DetailFormValues | null>>;
  readonly onUpdateSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  readonly saveStatus?: StudioSaveStatus;
  readonly onSaveAccountInvitationTemplate?: (
    template: Omit<NonNullable<SelectedInstance['accountInvitationTemplate']>, 'revision'> | null
  ) => Promise<AccountInvitationTemplateSaveResult>;
};

export type HistorySectionProps = {
  readonly selectedInstance: SelectedInstance;
  readonly onLoadProvisioningRun: (runId: string) => Promise<unknown>;
};

export type CockpitSectionProps = {
  readonly tenantAdminPasswordInput?: React.ReactNode;
  readonly selectedInstance: SelectedInstance;
  readonly configurationAssessment: InstanceConfigurationAssessment | null;
  readonly cockpitModel: InstanceDetailCockpitModel;
  readonly mutationError: IamHttpError | null;
  readonly onRunDetailAction: (action: DetailWorkflowAction) => Promise<void>;
  readonly statusLoading: boolean;
};

export const formatDateTime = (value?: string) => {
  if (!value) {
    return '—';
  }
  return formatEditorDateTime(value) ?? value;
};

export const TenantIamStatusBadge = ({
  status,
}: {
  status?: 'ready' | 'degraded' | 'blocked' | 'unknown';
}) => {
  const tone =
    status === 'ready'
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200'
      : status === 'blocked'
        ? 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-200'
        : status === 'degraded'
          ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200'
          : 'bg-muted text-muted-foreground';

  return (
    <span className={`rounded-full px-2 py-1 text-xs font-medium ${tone}`}>
      {t(`admin.instances.cockpit.overall.${status ?? 'unknown'}`)}
    </span>
  );
};

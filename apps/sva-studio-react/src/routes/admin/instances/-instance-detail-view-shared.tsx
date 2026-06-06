import React from 'react';

import { Label } from '../../../components/ui/label';
import { formatEditorDateTime } from '../../../lib/editor-date-time';
import { FieldHelp } from './-field-help';
import { INSTANCE_FIELD_HELP } from './-instance-form-models';

import type { IamTenantIamStatus } from '@sva/core';
import type { IamHttpError } from '../../../lib/iam-api';
import type {
  DetailFormValues,
  DetailWorkflowAction,
  InstanceConfigurationAssessment,
  InstanceDetailCockpitModel,
  SelectedInstance,
  SetupWorkflowStep,
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

export const COCKPIT_STATUS_STYLES = {
  ready: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-900',
  degraded: 'border-amber-500/30 bg-amber-500/10 text-amber-950',
  blocked: 'border-red-500/30 bg-red-500/10 text-red-900',
  unknown: 'border-slate-400/30 bg-slate-500/10 text-slate-900',
} as const;

export const TENANT_IAM_AXIS_TITLE_KEYS = {
  configuration: 'admin.instances.tenantIam.axes.configuration',
  access: 'admin.instances.tenantIam.axes.access',
  reconcile: 'admin.instances.tenantIam.axes.reconcile',
} as const;

export type WorkspaceTabKey = 'betrieb' | 'doctor' | 'einstellungen';
export type ProvisioningIntent = 'provision' | 'provision_admin_client' | 'reset_tenant_admin' | 'rotate_client_secret';
export type WorkflowAction = NonNullable<SetupWorkflowStep['action']>;

export type WorkspaceSectionCommonProps = {
  readonly selectedInstance: SelectedInstance;
  readonly detailFormValues: DetailFormValues;
  readonly statusLoading: boolean;
};

export type ConfigurationSectionProps = WorkspaceSectionCommonProps & {
  readonly configurationAssessment: InstanceConfigurationAssessment | null;
  readonly tenantSecretUserInputRequired: boolean;
  readonly setDetailFormValues: React.Dispatch<React.SetStateAction<DetailFormValues | null>>;
  readonly onUpdateSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
};

export type OperationsSectionProps = WorkspaceSectionCommonProps & {
  readonly effectiveTenantIamStatus: IamTenantIamStatus | undefined;
  readonly mutationError: IamHttpError | null;
  readonly setDetailFormValues: React.Dispatch<React.SetStateAction<DetailFormValues | null>>;
  readonly onTriggerWorkflowAction: (action: WorkflowAction) => Promise<void>;
  readonly onExecuteProvisioning: (intent: ProvisioningIntent) => Promise<void>;
  readonly onSeedIamBaseline: () => Promise<void>;
};

export type HistorySectionProps = {
  readonly selectedInstance: SelectedInstance;
  readonly onLoadProvisioningRun: (runId: string) => Promise<unknown>;
};

export type CockpitSectionProps = {
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

export const FormLabelWithHelp = ({
  htmlFor,
  label,
  helpKey,
}: {
  htmlFor: string;
  label: string;
  helpKey: keyof typeof INSTANCE_FIELD_HELP;
}) => {
  const help = INSTANCE_FIELD_HELP[helpKey];
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      <FieldHelp {...help} />
    </div>
  );
};

export const TenantIamStatusBadge = ({ status }: { status?: 'ready' | 'degraded' | 'blocked' | 'unknown' }) => {
  const tone =
    status === 'ready'
      ? 'bg-emerald-100 text-emerald-800'
      : status === 'blocked'
        ? 'bg-red-100 text-red-800'
        : status === 'degraded'
          ? 'bg-amber-100 text-amber-900'
          : 'bg-muted text-muted-foreground';

  return <span className={`rounded-full px-2 py-1 text-xs font-medium ${tone}`}>{status ?? 'unknown'}</span>;
};

import { Badge } from '../../../components/ui/badge';
import { t } from '../../../i18n';
import type {
  InstanceConfigurationOverallStatus,
  WorkflowStepState,
} from './-instances-shared-types';

const CONFIGURATION_STATUS_LABELS = {
  complete: 'admin.instances.configuration.overall.complete',
  degraded: 'admin.instances.configuration.overall.degraded',
  incomplete: 'admin.instances.configuration.overall.incomplete',
  unknown: 'admin.instances.configuration.overall.unknown',
} as const satisfies Record<InstanceConfigurationOverallStatus, string>;

const translateConfigurationStatus = (status: InstanceConfigurationOverallStatus) =>
  t(CONFIGURATION_STATUS_LABELS[status]);

export const KeycloakStatusBadge = ({ ready }: { ready: boolean }) => (
  <Badge variant={ready ? 'secondary' : 'outline'}>
    {ready ? t('admin.instances.keycloakStatus.ok') : t('admin.instances.keycloakStatus.missing')}
  </Badge>
);

export const ConfigurationStatusBadge = ({ status }: { status: InstanceConfigurationOverallStatus }) => {
  const variant = status === 'complete' ? 'secondary' : 'outline';
  return <Badge variant={variant}>{translateConfigurationStatus(status)}</Badge>;
};

export const WorkflowStatusBadge = ({ status }: { status: WorkflowStepState }) => {
  const labelMap: Record<WorkflowStepState, string> = {
    done: t('admin.instances.workflow.badges.done'),
    current: t('admin.instances.workflow.badges.current'),
    blocked: t('admin.instances.workflow.badges.blocked'),
    pending: t('admin.instances.workflow.badges.pending'),
  };
  return <Badge variant={status === 'done' ? 'secondary' : 'outline'}>{labelMap[status]}</Badge>;
};

export const ProvisioningStepBadge = ({
  status,
}: {
  status: 'pending' | 'running' | 'done' | 'failed' | 'skipped' | 'unchanged';
}) => {
  const ready = status === 'done' || status === 'skipped' || status === 'unchanged';
  return <Badge variant={ready ? 'secondary' : 'outline'}>{status}</Badge>;
};

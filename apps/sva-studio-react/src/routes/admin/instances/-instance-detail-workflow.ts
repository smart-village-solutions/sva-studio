import { t } from '../../../i18n';
import type { IamHttpError } from '../../../lib/iam-api';

import type { InstanceSetupStatusItem, SetupWorkflowStep } from './-instances-shared-types';
import type { IamInstanceDetail } from './-instance-detail-shared';
import { buildSetupWorkflowSteps } from './-instance-detail-workflow-helpers';

export const getSetupWorkflowSteps = (
  instance: IamInstanceDetail,
  mutationError: IamHttpError | null
): readonly SetupWorkflowStep[] => buildSetupWorkflowSteps(instance, mutationError);

export const hasInstanceAdminBootstrapCompleted = (instance: IamInstanceDetail): boolean =>
  instance.auditEvents.some((event) => event.eventType === 'instance_admin_bootstrapped');

export const getInstanceSetupStatusItems = (instance: IamInstanceDetail): readonly InstanceSetupStatusItem[] => {
  const adminStructureCompleted = hasInstanceAdminBootstrapCompleted(instance);

  return [
    {
      key: 'activation',
      title: t('admin.instances.setup.status.activationTitle'),
      description:
        instance.status === 'active'
          ? t('admin.instances.setup.status.activationDone')
          : t('admin.instances.setup.status.activationPending'),
      status: instance.status === 'active' ? 'done' : 'current',
    },
    {
      key: 'adminStructure',
      title: t('admin.instances.setup.status.adminStructureTitle'),
      description: adminStructureCompleted
        ? t('admin.instances.setup.status.adminStructureDone')
        : t('admin.instances.setup.status.adminStructurePending'),
      status: adminStructureCompleted ? 'done' : 'current',
    },
  ];
};

export const isInstanceSetupComplete = (instance: IamInstanceDetail): boolean =>
  instance.status === 'active' && hasInstanceAdminBootstrapCompleted(instance);

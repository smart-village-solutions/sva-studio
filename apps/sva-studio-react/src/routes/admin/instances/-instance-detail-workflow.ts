import type { IamHttpError } from '../../../lib/iam-api';

import type { SetupWorkflowStep } from './-instances-shared-types';
import type { IamInstanceDetail } from './-instance-detail-shared';
import { buildSetupWorkflowSteps } from './-instance-detail-workflow-helpers';

export const getSetupWorkflowSteps = (
  instance: IamInstanceDetail,
  mutationError: IamHttpError | null
): readonly SetupWorkflowStep[] => buildSetupWorkflowSteps(instance, mutationError);

import { InstanceModulesWorkspace } from '../modules/-instance-modules-workspace';

import type { IamHttpError } from '../../../lib/iam-api';
import type { SelectedInstance } from './-instances-shared-types';

type InstanceDetailBetriebSectionProps = {
  readonly selectedInstance: SelectedInstance;
  readonly statusLoading: boolean;
  readonly mutationError: IamHttpError | null;
  readonly onAssignModule: (instanceId: string, moduleId: string) => Promise<unknown>;
  readonly onRevokeModule: (instanceId: string, moduleId: string) => Promise<unknown>;
  readonly onSeedIamBaseline: (instanceId: string) => Promise<unknown>;
  readonly onBootstrapAdminStructure: (instanceId: string, moduleIds: readonly string[]) => Promise<unknown>;
};

export const InstanceDetailBetriebSection = ({
  selectedInstance,
  statusLoading,
  mutationError,
  onAssignModule,
  onRevokeModule,
  onSeedIamBaseline,
  onBootstrapAdminStructure,
}: InstanceDetailBetriebSectionProps) => (
  <InstanceModulesWorkspace
    selectedInstance={selectedInstance}
    statusLoading={statusLoading}
    mutationError={mutationError}
    emptyState=""
    onAssignModule={onAssignModule}
    onRevokeModule={onRevokeModule}
    onSeedIamBaseline={onSeedIamBaseline}
    onBootstrapAdminStructure={onBootstrapAdminStructure}
    showBootstrapAction={false}
  />
);

import { InstanceModulesWorkspace } from '../modules/-instance-modules-workspace';

import type { usePluginTenantReadiness } from '../../../hooks/use-plugin-tenant-readiness';
import type { IamHttpError } from '../../../lib/iam-api';
import type { SelectedInstance } from './-instances-shared-types';

type InstanceDetailBetriebSectionProps = {
  readonly selectedInstance: SelectedInstance;
  readonly statusLoading: boolean;
  readonly mutationError: IamHttpError | null;
  readonly pluginReadiness: ReturnType<typeof usePluginTenantReadiness>;
  readonly onAssignModule: (instanceId: string, moduleId: string) => Promise<unknown>;
  readonly onRevokeModule: (instanceId: string, moduleId: string) => Promise<unknown>;
  readonly onSeedIamBaseline: (instanceId: string) => Promise<unknown>;
  readonly onBootstrapAdminStructure: (
    instanceId: string,
    moduleIds: readonly string[]
  ) => Promise<unknown>;
};

export const InstanceDetailBetriebSection = ({
  selectedInstance,
  statusLoading,
  mutationError,
  pluginReadiness,
  onAssignModule,
  onRevokeModule,
  onSeedIamBaseline,
  onBootstrapAdminStructure,
}: InstanceDetailBetriebSectionProps) => {
  return (
    <>
      <InstanceModulesWorkspace
        selectedInstance={selectedInstance}
        pluginReadiness={pluginReadiness}
        showMutationError={false}
        statusLoading={statusLoading}
        mutationError={mutationError}
        emptyState=""
        onAssignModule={onAssignModule}
        onRevokeModule={onRevokeModule}
        onSeedIamBaseline={onSeedIamBaseline}
        onBootstrapAdminStructure={onBootstrapAdminStructure}
        showBootstrapAction={false}
      />
    </>
  );
};

import type { InstanceAuditRun } from '@sva/core';
import React from 'react';

import {
  asIamError,
  getInstanceAuditRun,
  getSingleInstanceAuditRun,
  type IamHttpError,
} from '../lib/iam-api';

export const useInstanceAudit = (
  refreshSession: () => Promise<unknown>,
  setMutationError: React.Dispatch<React.SetStateAction<IamHttpError | null>>
) => {
  const [instancesAuditRun, setInstancesAuditRun] = React.useState<InstanceAuditRun | null>(null);
  const [instanceAuditRun, setInstanceAuditRun] = React.useState<InstanceAuditRun | null>(null);
  const [auditLoading, setAuditLoading] = React.useState(false);
  const pendingAuditRequestsRef = React.useRef(0);
  const currentDetailInstanceIdRef = React.useRef<string | null>(null);
  const latestInstanceAuditRequestRef = React.useRef(0);

  const beginAuditRequest = React.useCallback(() => {
    pendingAuditRequestsRef.current += 1;
    setAuditLoading(true);
  }, []);

  const endAuditRequest = React.useCallback(() => {
    pendingAuditRequestsRef.current = Math.max(0, pendingAuditRequestsRef.current - 1);
    setAuditLoading(pendingAuditRequestsRef.current > 0);
  }, []);

  const refreshInstanceAudit = React.useCallback(
    async (instanceId: string) => {
      beginAuditRequest();
      if (currentDetailInstanceIdRef.current === null) {
        currentDetailInstanceIdRef.current = instanceId;
      }
      const requestToken = latestInstanceAuditRequestRef.current + 1;
      latestInstanceAuditRequestRef.current = requestToken;
      try {
        const response = await getSingleInstanceAuditRun(instanceId);
        const targetInstanceIds = response.data.targetInstanceIds ?? [instanceId];
        const isLatestRequest = latestInstanceAuditRequestRef.current === requestToken;
        const targetsRequestedInstance =
          targetInstanceIds.length === 0 || targetInstanceIds.includes(instanceId);
        const matchesCurrentDetail =
          currentDetailInstanceIdRef.current === null ||
          currentDetailInstanceIdRef.current === instanceId;
        if (isLatestRequest && matchesCurrentDetail && targetsRequestedInstance) {
          setInstanceAuditRun(response.data);
        }
        return response.data;
      } catch (cause) {
        const resolvedError = asIamError(cause);
        if (resolvedError.status === 401) {
          await refreshSession();
        }
        setMutationError((current) => current ?? resolvedError);
        return null;
      } finally {
        endAuditRequest();
      }
    },
    [beginAuditRequest, endAuditRequest, refreshSession, setMutationError]
  );

  const refreshInstancesAudit = React.useCallback(
    async (input?: { includeOnlyActive?: boolean; instanceIds?: readonly string[] }) => {
      beginAuditRequest();
      try {
        const response = await getInstanceAuditRun({
          includeOnlyActive: input?.includeOnlyActive ?? true,
          instanceIds: input?.instanceIds,
        });
        setInstancesAuditRun(response.data);
        return response.data;
      } catch (cause) {
        const resolvedError = asIamError(cause);
        if (resolvedError.status === 401) {
          await refreshSession();
        }
        setMutationError((current) => current ?? resolvedError);
        return null;
      } finally {
        endAuditRequest();
      }
    },
    [beginAuditRequest, endAuditRequest, refreshSession, setMutationError]
  );

  return {
    instancesAuditRun,
    instanceAuditRun,
    auditLoading,
    currentDetailInstanceIdRef,
    setInstanceAuditRun,
    refreshInstanceAudit,
    refreshInstancesAudit,
  };
};

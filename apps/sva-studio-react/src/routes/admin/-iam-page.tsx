import type {
  AuthorizeResponse,
  EffectivePermission,
  IamDeletionContentStrategy,
  IamDsrCaseListItem,
  IamGovernanceCaseListItem,
  IamTenantDeletionRulesOverview,
} from '@sva/core';
import { StudioDataTable, type StudioColumnDef } from '@sva/studio-ui-react';
import { useNavigate } from '@tanstack/react-router';
import React from 'react';

import { createStudioDataTableLabels } from '../../components/studio-data-table-labels';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Checkbox } from '../../components/ui/checkbox';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select } from '../../components/ui/select';
import {
  fetchWithRequestTimeout,
  getAdminDeletionRules,
  listAdminDsrCases,
  listGovernanceCases,
  saveAdminDeletionRules,
  type DsrAdminCasesQuery,
  type GovernanceCasesQuery,
} from '../../lib/iam-api';
import {
  createOperationLogger,
  logBrowserOperationAbort,
  logBrowserOperationFailure,
  logBrowserOperationStart,
  logBrowserOperationSuccess,
} from '../../lib/browser-operation-logging';
import {
  getAllowedIamCockpitTabs,
  hasGovernanceComplianceExportRole,
  hasIamCockpitAccessRole,
  isIamCockpitEnabled,
  type IamCockpitTabKey,
} from '../../lib/iam-viewer-access';
import { formatEditorDateTime } from '../../lib/editor-date-time';
import { t } from '../../i18n';
import { useAuth } from '../../providers/auth-provider';
import {
  filterPermissions,
  formatGovernanceTitle,
  formatPermissionAreaLabel,
  formatPermissionSourceKindLabels,
  formatPermissionSourceKinds,
  getFirstAllowedTab,
  mapAuthorizeDecision,
  mapDsrCanonicalStatusToTranslationKey,
  mapDsrStatusToTranslationKey,
  mapDsrStatusTone,
  mapDsrTypeToTranslationKey,
  mapGovernanceTypeToTranslationKey,
  mapIamTabToTranslationKey,
  type AuthorizeDecisionViewModel,
  type IamPermissionsQuery,
  type IamPermissionsResponse,
} from './-iam.models';

type IamApiErrorPayload = {
  error: string;
};

type IamViewerPageProps = {
  readonly activeTab: IamCockpitTabKey;
};

const FILTER_REQUEST_DEBOUNCE_MS = 300;
const iamViewerLogger = createOperationLogger('iam-viewer-page', 'debug');

const buildPermissionsPath = (query: IamPermissionsQuery) => {
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

const buildGovernanceComplianceExportPath = (input: {
  instanceId: string;
}) => {
  const searchParams = new URLSearchParams();
  searchParams.set('instanceId', input.instanceId);
  searchParams.set('format', 'csv');

  return `/iam/governance/compliance/export?${searchParams.toString()}`;
};

const formatDateTime = (value?: string) => {
  if (!value) {
    return '—';
  }
  return formatEditorDateTime(value) ?? value;
};

const formatObjectEntries = (value: Readonly<Record<string, unknown>> | undefined) => {
  if (!value || Object.keys(value).length === 0) {
    return '—';
  }
  return Object.entries(value)
    .map(([key, entry]) => `${key}: ${String(entry)}`)
    .join(', ');
};

const governanceTypeOptions = [
  'permission_change',
  'delegation',
  'impersonation',
  'legal_acceptance',
 ] as const;

const dsrTypeOptions = [
  'request',
  'export_job',
  'legal_hold',
  'profile_correction',
  'recipient_notification',
 ] as const;

const dsrStatusOptions = [
  'queued',
  'in_progress',
  'completed',
  'blocked',
  'failed',
 ] as const;

const mapDeletionContentStrategyKey = (strategy: IamDeletionContentStrategy) => {
  switch (strategy) {
    case 'with_owner_lifecycle':
      return 'admin.iam.deletionRules.strategies.with_owner_lifecycle';
    case 'retain':
    default:
      return 'admin.iam.deletionRules.strategies.retain';
  }
};

const deletionContentStrategyOptions: readonly IamDeletionContentStrategy[] = [
  'retain',
  'with_owner_lifecycle',
] as const;

const getTabId = (tab: IamCockpitTabKey) => `iam-tab-${tab}`;
const getTabPanelId = (tab: IamCockpitTabKey) => `iam-panel-${tab}`;

const isAbortError = (error: unknown) =>
  (error instanceof DOMException || error instanceof Error) && error.name === 'AbortError';

const PermissionTable = ({
  permissions,
}: Readonly<{
  permissions: readonly EffectivePermission[];
}>) => {
  if (permissions.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('admin.iam.rights.empty')}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-left text-xs sm:text-sm" aria-label={t('admin.iam.rights.tableAriaLabel')}>
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="py-2 pr-4 font-semibold">{t('admin.iam.rights.columns.action')}</th>
            <th className="py-2 pr-4 font-semibold">{t('admin.iam.rights.columns.area')}</th>
            <th className="py-2 pr-4 font-semibold">{t('admin.iam.rights.columns.resourceType')}</th>
            <th className="py-2 pr-4 font-semibold">{t('admin.iam.rights.columns.resourceId')}</th>
            <th className="py-2 pr-4 font-semibold">{t('admin.iam.rights.columns.organization')}</th>
            <th className="py-2 pr-4 font-semibold">{t('admin.iam.rights.columns.effect')}</th>
            <th className="py-2 pr-4 font-semibold">{t('admin.iam.rights.columns.scope')}</th>
            <th className="py-2 font-semibold">{t('admin.iam.rights.columns.sourceRoles')}</th>
            <th className="py-2 font-semibold">{t('admin.iam.rights.columns.sourceGroups')}</th>
            <th className="py-2 font-semibold">{t('admin.iam.rights.columns.origin')}</th>
          </tr>
        </thead>
        <tbody>
          {permissions.map((permission, index) => (
            <tr
              key={`${permission.action}-${permission.resourceType}-${permission.resourceId ?? 'none'}-${index}`}
              className="border-b border-border align-top text-foreground"
            >
              <td className="py-2 pr-4">{permission.action}</td>
              <td className="py-2 pr-4">{formatPermissionAreaLabel(permission)}</td>
              <td className="py-2 pr-4">{permission.resourceType}</td>
              <td className="py-2 pr-4">{permission.resourceId ?? '—'}</td>
              <td className="py-2 pr-4">{permission.organizationId ?? t('admin.iam.rights.noOrganization')}</td>
              <td className="py-2 pr-4">{permission.effect ?? '—'}</td>
              <td className="py-2 pr-4">{formatObjectEntries(permission.scope)}</td>
              <td className="py-2">{(permission.sourceRoleIds ?? []).length > 0 ? (permission.sourceRoleIds ?? []).join(', ') : '—'}</td>
              <td className="py-2">{(permission.sourceGroupIds ?? []).length > 0 ? (permission.sourceGroupIds ?? []).join(', ') : '—'}</td>
              <td className="py-2">{formatPermissionSourceKinds(permission)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const StatusBadge = ({ label, tone }: Readonly<{ label: string; tone: string }>) => (
  <Badge className={tone} variant="outline">
    {label}
  </Badge>
);

export function IamViewerPage({ activeTab }: IamViewerPageProps) {
  const navigate = useNavigate();
  const { user, isLoading: isLoadingUser, error: authError, invalidatePermissions } = useAuth();
  const tabButtonRefs = React.useRef<Partial<Record<IamCockpitTabKey, HTMLButtonElement | null>>>({});
  const shouldFocusActiveTabRef = React.useRef(false);

  const [instanceId, setInstanceId] = React.useState('');
  const [organizationId, setOrganizationId] = React.useState('');
  const [actingAsUserId, setActingAsUserId] = React.useState('');
  const [queryText, setQueryText] = React.useState('');
  const [selectedOrganizationIds, setSelectedOrganizationIds] = React.useState<string[]>([]);

  const [permissions, setPermissions] = React.useState<readonly EffectivePermission[]>([]);
  const [permissionSubject, setPermissionSubject] = React.useState<IamPermissionsResponse['subject'] | null>(null);
  const [isLoadingPermissions, setIsLoadingPermissions] = React.useState(false);
  const [permissionsError, setPermissionsError] = React.useState<string | null>(null);

  const [authorizeAction, setAuthorizeAction] = React.useState('content.read');
  const [authorizeResourceType, setAuthorizeResourceType] = React.useState('content');
  const [authorizeResourceId, setAuthorizeResourceId] = React.useState('');
  const [authorizeOrganizationId, setAuthorizeOrganizationId] = React.useState('');
  const [authorizeDecision, setAuthorizeDecision] = React.useState<AuthorizeDecisionViewModel | null>(null);
  const [authorizeError, setAuthorizeError] = React.useState<string | null>(null);
  const [isAuthorizing, setIsAuthorizing] = React.useState(false);

  const [governanceItems, setGovernanceItems] = React.useState<readonly IamGovernanceCaseListItem[]>([]);
  const [governanceError, setGovernanceError] = React.useState<string | null>(null);
  const [governanceQuery, setGovernanceQuery] = React.useState<GovernanceCasesQuery>({
    page: 1,
    pageSize: 12,
    search: '',
  });
  const [isLoadingGovernance, setIsLoadingGovernance] = React.useState(false);

  const [dsrItems, setDsrItems] = React.useState<readonly IamDsrCaseListItem[]>([]);
  const [dsrError, setDsrError] = React.useState<string | null>(null);
  const [dsrQuery, setDsrQuery] = React.useState<DsrAdminCasesQuery>({
    page: 1,
    pageSize: 12,
    search: '',
  });
  const [isLoadingDsr, setIsLoadingDsr] = React.useState(false);
  const [deletionRules, setDeletionRules] = React.useState<IamTenantDeletionRulesOverview | null>(null);
  const [deletionRulesDraft, setDeletionRulesDraft] = React.useState<{
    deactivateAfterDays: string;
    pseudonymizeAfterDays: string;
    deleteAfterDays: string;
    defaultContentStrategy: IamDeletionContentStrategy;
    allowContentPreferenceOverride: boolean;
  } | null>(null);
  const [deletionRulesError, setDeletionRulesError] = React.useState<string | null>(null);
  const [isLoadingDeletionRules, setIsLoadingDeletionRules] = React.useState(false);
  const [isSavingDeletionRules, setIsSavingDeletionRules] = React.useState(false);

  const cockpitEnabled = isIamCockpitEnabled();
  const canAccessCockpit = hasIamCockpitAccessRole(user);
  const canExportGovernanceCompliance = hasGovernanceComplianceExportRole(user);
  const allowedTabs = React.useMemo(() => getAllowedIamCockpitTabs(user), [user]);
  const studioDataTableLabels = React.useMemo(() => createStudioDataTableLabels(), []);
  const governanceRequestQuery = React.useMemo(
    () => ({ ...governanceQuery, search: governanceQuery.search?.trim() ?? '' }),
    [governanceQuery]
  );
  const dsrRequestQuery = React.useMemo(() => ({ ...dsrQuery, search: dsrQuery.search?.trim() ?? '' }), [dsrQuery]);

  const navigateToTab = React.useCallback(
    (tab: IamCockpitTabKey, focusActiveTab = false) => {
      shouldFocusActiveTabRef.current = focusActiveTab;
      void navigate({ to: '/admin/iam', search: { tab } });
    },
    [navigate]
  );

  React.useEffect(() => {
    setInstanceId(user?.instanceId ?? '');
  }, [user?.instanceId]);

  React.useEffect(() => {
    if (allowedTabs.length === 0) {
      return;
    }
    if (!allowedTabs.includes(activeTab)) {
      shouldFocusActiveTabRef.current = false;
      void navigate({ to: '/admin/iam', search: { tab: getFirstAllowedTab(allowedTabs) }, replace: true });
    }
  }, [activeTab, allowedTabs, navigate]);

  React.useEffect(() => {
    if (!shouldFocusActiveTabRef.current) {
      return;
    }
    const activeButton = tabButtonRefs.current[activeTab];
    if (!activeButton) {
      return;
    }
    shouldFocusActiveTabRef.current = false;
    activeButton.focus();
  }, [activeTab, allowedTabs]);

  React.useEffect(() => {
    if (!cockpitEnabled || !canAccessCockpit || !instanceId || activeTab !== 'rights' || !allowedTabs.includes('rights')) {
      return;
    }

    let active = true;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      logBrowserOperationStart(iamViewerLogger, 'iam_permissions_load_started', {
        operation: 'load_permissions',
        instance_id: instanceId,
        organization_id: organizationId.trim() || undefined,
        acting_as_user_id: actingAsUserId.trim() || undefined,
      });
      setIsLoadingPermissions(true);
      setPermissionsError(null);

      try {
        const response = await fetchWithRequestTimeout(
          buildPermissionsPath({
            instanceId,
            organizationId: organizationId.trim() || undefined,
            actingAsUserId: actingAsUserId.trim() || undefined,
          }),
          undefined,
          {
            signal: controller.signal,
            timeoutMs: 10_000,
          }
        );

        if (!active || controller.signal.aborted) {
          return;
        }

        if (!response.ok) {
          if (response.status === 403) {
            await invalidatePermissions();
            iamViewerLogger.info('permission_invalidated_after_403', {
              operation: 'load_permissions',
              status: response.status,
            });
          }
          const payload = (await response.json().catch(() => null)) as IamApiErrorPayload | null;
          setPermissions([]);
          setPermissionSubject(null);
          setPermissionsError(payload?.error ?? `http_${response.status}`);
          logBrowserOperationFailure(iamViewerLogger, 'iam_permissions_load_failed', new Error(payload?.error ?? `http_${response.status}`), {
            operation: 'load_permissions',
            instance_id: instanceId,
            status: response.status,
          });
          return;
        }

        const payload = (await response.json()) as IamPermissionsResponse;
        setPermissions(payload.permissions);
        setPermissionSubject(payload.subject);
        logBrowserOperationSuccess(
          iamViewerLogger,
          'iam_permissions_load_succeeded',
          {
            operation: 'load_permissions',
            instance_id: instanceId,
            permission_count: payload.permissions.length,
          },
          'debug'
        );
      } catch (error) {
        if (!active || controller.signal.aborted) {
          logBrowserOperationAbort(iamViewerLogger, 'iam_permissions_load_aborted', {
            operation: 'load_permissions',
            instance_id: instanceId,
          });
          return;
        }
        setPermissions([]);
        setPermissionSubject(null);
        setPermissionsError(error instanceof Error ? error.message : String(error));
        logBrowserOperationFailure(iamViewerLogger, 'iam_permissions_load_failed', error, {
          operation: 'load_permissions',
          instance_id: instanceId,
        });
      } finally {
        if (active) {
          setIsLoadingPermissions(false);
        }
      }
    }, 300);

    return () => {
      active = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [actingAsUserId, activeTab, allowedTabs, canAccessCockpit, cockpitEnabled, instanceId, invalidatePermissions, organizationId]);

  React.useEffect(() => {
    if (!cockpitEnabled || !canAccessCockpit || activeTab !== 'governance' || !allowedTabs.includes('governance')) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      logBrowserOperationStart(iamViewerLogger, 'iam_governance_load_started', {
        operation: 'list_governance_cases',
      });
      setIsLoadingGovernance(true);
      setGovernanceError(null);

      void listGovernanceCases(governanceRequestQuery, { signal: controller.signal })
        .then((response) => {
          if (controller.signal.aborted) {
            return;
          }
          setGovernanceItems(response.data);
          logBrowserOperationSuccess(
            iamViewerLogger,
            'iam_governance_load_succeeded',
            {
              operation: 'list_governance_cases',
              item_count: response.data.length,
            },
            'debug'
          );
        })
        .catch((error) => {
          if (isAbortError(error) || controller.signal.aborted) {
            logBrowserOperationAbort(iamViewerLogger, 'iam_governance_load_aborted', {
              operation: 'list_governance_cases',
            });
            return;
          }
          setGovernanceItems([]);
          setGovernanceError(error instanceof Error ? error.message : String(error));
          logBrowserOperationFailure(iamViewerLogger, 'iam_governance_load_failed', error, {
            operation: 'list_governance_cases',
          });
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsLoadingGovernance(false);
          }
        });
    }, FILTER_REQUEST_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [activeTab, allowedTabs, canAccessCockpit, cockpitEnabled, governanceRequestQuery]);

  React.useEffect(() => {
    if (!cockpitEnabled || !canAccessCockpit || activeTab !== 'dsr' || !allowedTabs.includes('dsr')) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      logBrowserOperationStart(iamViewerLogger, 'iam_dsr_load_started', {
        operation: 'list_admin_dsr_cases',
      });
      setIsLoadingDsr(true);
      setDsrError(null);

      void listAdminDsrCases(dsrRequestQuery, { signal: controller.signal })
        .then((response) => {
          if (controller.signal.aborted) {
            return;
          }
          setDsrItems(response.data);
          logBrowserOperationSuccess(
            iamViewerLogger,
            'iam_dsr_load_succeeded',
            {
              operation: 'list_admin_dsr_cases',
              item_count: response.data.length,
            },
            'debug'
          );
        })
        .catch((error) => {
          if (isAbortError(error) || controller.signal.aborted) {
            logBrowserOperationAbort(iamViewerLogger, 'iam_dsr_load_aborted', {
              operation: 'list_admin_dsr_cases',
            });
            return;
          }
          setDsrItems([]);
          setDsrError(error instanceof Error ? error.message : String(error));
          logBrowserOperationFailure(iamViewerLogger, 'iam_dsr_load_failed', error, {
            operation: 'list_admin_dsr_cases',
          });
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsLoadingDsr(false);
          }
        });
    }, FILTER_REQUEST_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [activeTab, allowedTabs, canAccessCockpit, cockpitEnabled, dsrRequestQuery]);

  React.useEffect(() => {
    if (!cockpitEnabled || !canAccessCockpit || activeTab !== 'deletion-rules' || !allowedTabs.includes('deletion-rules')) {
      return;
    }
    if (!instanceId) {
      setDeletionRules(null);
      setDeletionRulesDraft(null);
      setDeletionRulesError(t('admin.iam.deletionRules.messages.instanceMissing'));
      return;
    }

    const controller = new AbortController();
    setIsLoadingDeletionRules(true);
    setDeletionRulesError(null);

    void getAdminDeletionRules(instanceId)
      .then((response) => {
        if (controller.signal.aborted) {
          return;
        }
        setDeletionRules(response);
        setDeletionRulesDraft({
          deactivateAfterDays: String(response.deactivateAfterDays),
          pseudonymizeAfterDays: String(response.pseudonymizeAfterDays),
          deleteAfterDays: String(response.deleteAfterDays),
          defaultContentStrategy: response.defaultContentStrategy,
          allowContentPreferenceOverride: response.allowContentPreferenceOverride,
        });
      })
      .catch((error) => {
        if (isAbortError(error) || controller.signal.aborted) {
          return;
        }
        setDeletionRules(null);
        setDeletionRulesDraft(null);
        setDeletionRulesError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoadingDeletionRules(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [activeTab, allowedTabs, canAccessCockpit, cockpitEnabled, instanceId]);

  const handleDeletionRulesSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!instanceId || !deletionRulesDraft) {
      setDeletionRulesError(t('admin.iam.deletionRules.messages.instanceMissing'));
      return;
    }

    setIsSavingDeletionRules(true);
    setDeletionRulesError(null);

    try {
      const response = await saveAdminDeletionRules({
        instanceId,
        deactivateAfterDays: Number(deletionRulesDraft.deactivateAfterDays),
        pseudonymizeAfterDays: Number(deletionRulesDraft.pseudonymizeAfterDays),
        deleteAfterDays: Number(deletionRulesDraft.deleteAfterDays),
        defaultContentStrategy: deletionRulesDraft.defaultContentStrategy,
        allowContentPreferenceOverride: deletionRulesDraft.allowContentPreferenceOverride,
      });
      setDeletionRules(response);
      setDeletionRulesDraft({
        deactivateAfterDays: String(response.deactivateAfterDays),
        pseudonymizeAfterDays: String(response.pseudonymizeAfterDays),
        deleteAfterDays: String(response.deleteAfterDays),
        defaultContentStrategy: response.defaultContentStrategy,
        allowContentPreferenceOverride: response.allowContentPreferenceOverride,
      });
    } catch (error) {
      setDeletionRulesError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSavingDeletionRules(false);
    }
  };

  const filteredPermissions = React.useMemo(
    () =>
      filterPermissions(permissions, {
        query: queryText,
        organizationIds: selectedOrganizationIds,
      }),
    [permissions, queryText, selectedOrganizationIds]
  );

  const organizationOptions = React.useMemo(() => {
    const organizationIds = new Set<string>();
    for (const permission of permissions) {
      organizationIds.add(permission.organizationId ?? '');
    }
    return [...organizationIds];
  }, [permissions]);

  const handleOrganizationFilterToggle = (organizationValue: string) => {
    setSelectedOrganizationIds((current) =>
      current.includes(organizationValue)
        ? current.filter((entry) => entry !== organizationValue)
        : [...current, organizationValue]
    );
  };

  const handleAuthorizeSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!instanceId) {
      setAuthorizeError(t('admin.iam.rights.authorize.instanceRequired'));
      return;
    }

    setIsAuthorizing(true);
    setAuthorizeError(null);
    logBrowserOperationStart(iamViewerLogger, 'iam_authorize_started', {
      operation: 'authorize',
      instance_id: instanceId,
      resource_type: authorizeResourceType.trim(),
    });

    try {
      const response = await fetchWithRequestTimeout('/iam/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceId,
          action: authorizeAction.trim(),
          resource: {
            type: authorizeResourceType.trim(),
            id: authorizeResourceId.trim() || undefined,
            organizationId: authorizeOrganizationId.trim() || organizationId.trim() || undefined,
          },
          context: {
            organizationId: authorizeOrganizationId.trim() || organizationId.trim() || undefined,
            actingAsUserId: actingAsUserId.trim() || undefined,
            requestId: `iam-viewer-${Date.now()}`,
          },
        }),
      }, {
        timeoutMs: 10_000,
      });

      if (!response.ok) {
        if (response.status === 403) {
          await invalidatePermissions();
          iamViewerLogger.info('permission_invalidated_after_403', {
            operation: 'authorize',
            status: response.status,
          });
        }
        const payload = (await response.json().catch(() => null)) as IamApiErrorPayload | null;
        setAuthorizeDecision(null);
        setAuthorizeError(payload?.error ?? `http_${response.status}`);
        logBrowserOperationFailure(iamViewerLogger, 'iam_authorize_failed', new Error(payload?.error ?? `http_${response.status}`), {
          operation: 'authorize',
          instance_id: instanceId,
          status: response.status,
        });
        return;
      }

      const payload = (await response.json()) as AuthorizeResponse;
      setAuthorizeDecision(mapAuthorizeDecision(payload));
      logBrowserOperationSuccess(iamViewerLogger, 'iam_authorize_succeeded', {
        operation: 'authorize',
        instance_id: instanceId,
        allowed: payload.allowed,
      });
    } catch (error) {
      setAuthorizeDecision(null);
      setAuthorizeError(error instanceof Error ? error.message : String(error));
      logBrowserOperationFailure(iamViewerLogger, 'iam_authorize_failed', error, {
        operation: 'authorize',
        instance_id: instanceId,
      });
    } finally {
      setIsAuthorizing(false);
    }
  };

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, tabIndex: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      return;
    }

    event.preventDefault();
    if (event.key === 'Home') {
      navigateToTab(allowedTabs[0] ?? 'rights', true);
      return;
    }
    if (event.key === 'End') {
      navigateToTab(allowedTabs[allowedTabs.length - 1] ?? 'rights', true);
      return;
    }

    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (tabIndex + direction + allowedTabs.length) % allowedTabs.length;
    navigateToTab(allowedTabs[nextIndex] ?? 'rights', true);
  };

  const governanceColumns = React.useMemo<readonly StudioColumnDef<IamGovernanceCaseListItem>[]>(() => [
    {
      id: 'case',
      header: t('admin.iam.governance.columns.case'),
      cell: (item) => (
        <div className="space-y-1">
          <a className="font-semibold text-foreground underline-offset-4 hover:underline" href={`/admin/iam/governance/${item.id}`}>
            {formatGovernanceTitle(item)}
          </a>
          <p className="text-xs text-muted-foreground">{item.summary}</p>
        </div>
      ),
    },
    {
      id: 'status',
      header: t('admin.iam.governance.columns.status'),
      cell: (item) => <StatusBadge label={item.status} tone="border-secondary/40 bg-secondary/10 text-secondary" />,
    },
    {
      id: 'actors',
      header: t('admin.iam.governance.columns.actors'),
      cell: (item) => [item.actorDisplayName, item.targetDisplayName].filter(Boolean).join(' -> ') || '—',
    },
    {
      id: 'ticket',
      header: t('admin.iam.governance.columns.ticket'),
      cell: (item) => item.ticketId ?? '—',
    },
    {
      id: 'createdAt',
      header: t('admin.iam.governance.columns.createdAt'),
      cell: (item) => formatDateTime(item.createdAt),
      sortable: true,
      sortValue: (item) => item.createdAt,
    },
    {
      id: 'updatedAt',
      header: t('admin.iam.governance.columns.updatedAt'),
      cell: (item) => formatDateTime(item.updatedAt ?? item.resolvedAt),
      sortable: true,
      sortValue: (item) => item.updatedAt ?? item.resolvedAt ?? item.createdAt,
    },
  ], []);

  const dsrColumns = React.useMemo<readonly StudioColumnDef<IamDsrCaseListItem>[]>(() => [
    {
      id: 'case',
      header: t('admin.iam.dsr.columns.case'),
      cell: (item) => (
        <div className="space-y-1">
          <a className="font-semibold text-foreground underline-offset-4 hover:underline" href={`/admin/iam/dsr/${item.id}`}>
            {item.title}
          </a>
          <p className="text-xs text-muted-foreground">{item.summary}</p>
        </div>
      ),
    },
    {
      id: 'status',
      header: t('admin.iam.dsr.columns.status'),
      cell: (item) => <StatusBadge label={t(mapDsrStatusToTranslationKey(item))} tone={mapDsrStatusTone(item)} />,
    },
    {
      id: 'people',
      header: t('admin.iam.dsr.columns.people'),
      cell: (item) => [item.targetDisplayName, item.requesterDisplayName ?? item.actorDisplayName].filter(Boolean).join(' / ') || '—',
    },
    {
      id: 'blocker',
      header: t('admin.iam.dsr.columns.blocker'),
      cell: (item) => item.blockedReason ?? '—',
    },
    {
      id: 'createdAt',
      header: t('admin.iam.dsr.columns.createdAt'),
      cell: (item) => formatDateTime(item.createdAt),
      sortable: true,
      sortValue: (item) => item.createdAt,
    },
    {
      id: 'completedAt',
      header: t('admin.iam.dsr.columns.completedAt'),
      cell: (item) => formatDateTime(item.completedAt),
      sortable: true,
      sortValue: (item) => item.completedAt ?? item.createdAt,
    },
  ], []);

  if (isLoadingUser) {
    return <p className="text-sm text-muted-foreground">{t('admin.iam.messages.initializing')}</p>;
  }

  if (authError) {
    return (
      <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
        <AlertDescription>{authError.message}</AlertDescription>
      </Alert>
    );
  }

  if (!cockpitEnabled) {
    return (
      <Alert className="border-secondary/40 bg-secondary/10 text-secondary">
        <AlertDescription>{t('admin.iam.messages.disabled')}</AlertDescription>
      </Alert>
    );
  }

  if (!canAccessCockpit || allowedTabs.length === 0) {
    return (
      <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
        <AlertDescription>{t('admin.iam.messages.forbidden')}</AlertDescription>
      </Alert>
    );
  }

  return (
    <section className="space-y-5">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-foreground">{t('admin.iam.page.title')}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">{t('admin.iam.page.subtitle')}</p>
      </header>

      <Card className="flex flex-wrap gap-2 p-2" role="tablist" aria-label={t('admin.iam.tabs.ariaLabel')}>
        {allowedTabs.map((tab, tabIndex) => {
          const selected = tab === activeTab;
          return (
            <Button
              key={tab}
              ref={(element) => {
                tabButtonRefs.current[tab] = element;
              }}
              type="button"
              id={getTabId(tab)}
              role="tab"
              tabIndex={selected ? 0 : -1}
              aria-controls={getTabPanelId(tab)}
              aria-selected={selected}
              className={selected ? 'font-semibold' : 'text-muted-foreground'}
              onClick={() => navigateToTab(tab)}
              onKeyDown={(event) => handleTabKeyDown(event, tabIndex)}
              variant={selected ? 'default' : 'ghost'}
            >
              {t(mapIamTabToTranslationKey(tab))}
            </Button>
          );
        })}
      </Card>

      {activeTab === 'rights' ? (
        <div
          id={getTabPanelId('rights')}
          role="tabpanel"
          aria-labelledby={getTabId('rights')}
          className="space-y-4"
        >
          <Card className="grid gap-3 p-4 lg:grid-cols-4">
            <div className="grid gap-1 text-xs uppercase tracking-wide text-muted-foreground">
              <Label htmlFor="iam-organization-filter">{t('admin.iam.rights.filters.organization')}</Label>
              <Input
                id="iam-organization-filter"
                value={organizationId}
                onChange={(event) => setOrganizationId(event.target.value)}
              />
            </div>
            <div className="grid gap-1 text-xs uppercase tracking-wide text-muted-foreground">
              <Label htmlFor="iam-acting-as-filter">{t('admin.iam.rights.filters.actingAs')}</Label>
              <Input
                id="iam-acting-as-filter"
                value={actingAsUserId}
                onChange={(event) => setActingAsUserId(event.target.value)}
              />
            </div>
            <div className="grid gap-1 text-xs uppercase tracking-wide text-muted-foreground">
              <Label htmlFor="iam-query-filter">{t('admin.iam.rights.filters.search')}</Label>
              <Input
                id="iam-query-filter"
                value={queryText}
                onChange={(event) => setQueryText(event.target.value)}
              />
            </div>
            <Card className="bg-background px-3 py-2 shadow-none">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('admin.iam.rights.subject.title')}</p>
              <p>{permissionSubject ? permissionSubject.effectiveUserId : '—'}</p>
              <p className="text-xs text-muted-foreground">
                {permissionSubject?.isImpersonating
                  ? t('admin.iam.rights.subject.impersonating', { actor: permissionSubject.actorUserId })
                  : t('admin.iam.rights.subject.self')}
              </p>
            </Card>
          </Card>

          {organizationOptions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {organizationOptions.map((organizationValue) => (
                <Button
                  key={organizationValue || 'no-organization'}
                  type="button"
                  className={`rounded-full text-xs ${
                    selectedOrganizationIds.includes(organizationValue)
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground'
                  }`}
                  onClick={() => handleOrganizationFilterToggle(organizationValue)}
                  size="sm"
                  variant="outline"
                >
                  {organizationValue || t('admin.iam.rights.noOrganization')}
                </Button>
              ))}
            </div>
          ) : null}

          {permissionsError ? (
            <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
              <AlertDescription>{t('admin.iam.rights.messages.error', { value: permissionsError })}</AlertDescription>
            </Alert>
          ) : null}

          <Card aria-busy={isLoadingPermissions} className="p-4">
            <PermissionTable permissions={filteredPermissions} />
          </Card>

          <Card>
            <form onSubmit={handleAuthorizeSubmit} className="grid gap-3 p-4 lg:grid-cols-4">
            <div className="grid gap-1 text-xs uppercase tracking-wide text-muted-foreground">
              <Label htmlFor="iam-authorize-action">{t('admin.iam.rights.authorize.action')}</Label>
              <Input
                id="iam-authorize-action"
                value={authorizeAction}
                onChange={(event) => setAuthorizeAction(event.target.value)}
              />
            </div>
            <div className="grid gap-1 text-xs uppercase tracking-wide text-muted-foreground">
              <Label htmlFor="iam-authorize-resource-type">{t('admin.iam.rights.authorize.resourceType')}</Label>
              <Input
                id="iam-authorize-resource-type"
                value={authorizeResourceType}
                onChange={(event) => setAuthorizeResourceType(event.target.value)}
              />
            </div>
            <div className="grid gap-1 text-xs uppercase tracking-wide text-muted-foreground">
              <Label htmlFor="iam-authorize-resource-id">{t('admin.iam.rights.authorize.resourceId')}</Label>
              <Input
                id="iam-authorize-resource-id"
                value={authorizeResourceId}
                onChange={(event) => setAuthorizeResourceId(event.target.value)}
              />
            </div>
            <div className="grid gap-1 text-xs uppercase tracking-wide text-muted-foreground">
              <Label htmlFor="iam-authorize-organization-id">{t('admin.iam.rights.authorize.organizationId')}</Label>
              <Input
                id="iam-authorize-organization-id"
                value={authorizeOrganizationId}
                onChange={(event) => setAuthorizeOrganizationId(event.target.value)}
              />
            </div>
            <div className="lg:col-span-4 flex items-center gap-3">
              <Button type="submit" disabled={isAuthorizing}>
                {isAuthorizing ? t('admin.iam.rights.authorize.running') : t('admin.iam.rights.authorize.run')}
              </Button>
              {authorizeError ? <p className="text-sm text-destructive">{authorizeError}</p> : null}
            </div>
            {authorizeDecision ? (
              <Card className="lg:col-span-4 bg-background p-3 shadow-none">
                <p className="font-semibold text-foreground">
                  {authorizeDecision.allowed ? t('admin.iam.rights.authorize.allowed') : t('admin.iam.rights.authorize.denied')}
                </p>
                <dl className="mt-3 grid gap-2 text-sm">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">{t('admin.iam.rights.authorize.summary.action')}</dt>
                    <dd className="text-foreground">{authorizeAction.trim() || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">{t('admin.iam.rights.authorize.summary.resource')}</dt>
                    <dd className="text-foreground">
                      {[authorizeResourceType.trim(), authorizeResourceId.trim()].filter(Boolean).join(' / ') || '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">{t('admin.iam.rights.authorize.summary.organization')}</dt>
                    <dd className="text-foreground">{authorizeOrganizationId.trim() || organizationId.trim() || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">{t('admin.iam.rights.authorize.summary.cause')}</dt>
                    <dd className="text-foreground">{authorizeDecision.reasonCode ?? authorizeDecision.reason}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">{t('admin.iam.rights.authorize.summary.origin')}</dt>
                    <dd className="text-foreground">
                      {authorizeDecision.provenance?.sourceKinds && authorizeDecision.provenance.sourceKinds.length > 0
                        ? formatPermissionSourceKindLabels(authorizeDecision.provenance.sourceKinds)
                        : authorizeDecision.matchedPermissions && authorizeDecision.matchedPermissions.length > 0
                          ? formatPermissionSourceKindLabels([
                              ...new Set(authorizeDecision.matchedPermissions.map((permission) => permission.source)),
                            ] as readonly string[])
                          : '—'}
                    </dd>
                  </div>
                </dl>
                {authorizeDecision.diagnostics ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {formatObjectEntries(authorizeDecision.diagnostics)}
                  </p>
                ) : null}
              </Card>
            ) : null}
            </form>
          </Card>
        </div>
      ) : null}

      {activeTab === 'governance' ? (
        <div
          id={getTabPanelId('governance')}
          role="tabpanel"
          aria-labelledby={getTabId('governance')}
          className="space-y-4"
        >
          <Card className="grid gap-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">{t('admin.iam.governance.messages.exportHint')}</p>
              {instanceId && canExportGovernanceCompliance ? (
                <Button asChild size="sm" variant="outline">
                  <a href={buildGovernanceComplianceExportPath({ instanceId })}>
                    {t('admin.iam.governance.actions.exportCsv')}
                  </a>
                </Button>
              ) : null}
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="grid gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                <Label htmlFor="iam-governance-search">{t('admin.iam.governance.filters.search')}</Label>
                <Input
                  id="iam-governance-search"
                  value={governanceQuery.search ?? ''}
                  onChange={(event) => setGovernanceQuery((current) => ({ ...current, page: 1, search: event.target.value }))}
                />
              </div>
              <div className="grid gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                <Label htmlFor="iam-governance-type">{t('admin.iam.governance.filters.type')}</Label>
                <Select
                  id="iam-governance-type"
                  value={governanceQuery.type ?? ''}
                  onChange={(event) =>
                    setGovernanceQuery((current) => ({
                      ...current,
                      page: 1,
                      type: (event.target.value || undefined) as GovernanceCasesQuery['type'],
                    }))
                  }
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                >
                  <option value="">{t('admin.iam.shared.all')}</option>
                  {governanceTypeOptions.map((option) => (
                    <option key={option} value={option}>
                      {t(mapGovernanceTypeToTranslationKey(option))}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                <Label htmlFor="iam-governance-status">{t('admin.iam.governance.filters.status')}</Label>
                <Input
                  id="iam-governance-status"
                  value={governanceQuery.status ?? ''}
                  onChange={(event) => setGovernanceQuery((current) => ({ ...current, page: 1, status: event.target.value || undefined }))}
                />
              </div>
            </div>
          </Card>
          {governanceError ? (
            <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
              <AlertDescription>{governanceError}</AlertDescription>
            </Alert>
          ) : null}
          <StudioDataTable
            ariaLabel={t('admin.iam.governance.tableAriaLabel')}
            labels={studioDataTableLabels}
            caption={t('admin.iam.governance.tableCaption')}
            data={governanceItems}
            columns={governanceColumns}
            getRowId={(item) => item.id}
            selectionMode="none"
            isLoading={isLoadingGovernance}
            loadingState={t('admin.iam.governance.messages.loading')}
            emptyState={<p className="text-sm text-muted-foreground">{t('admin.iam.governance.messages.empty')}</p>}
          />
        </div>
      ) : null}

      {activeTab === 'dsr' ? (
        <div
          id={getTabPanelId('dsr')}
          role="tabpanel"
          aria-labelledby={getTabId('dsr')}
          className="space-y-4"
        >
          <Card className="grid gap-3 p-4 md:grid-cols-3">
              <div className="grid gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                <Label htmlFor="iam-dsr-search">{t('admin.iam.dsr.filters.search')}</Label>
                <Input
                  id="iam-dsr-search"
                  value={dsrQuery.search ?? ''}
                  onChange={(event) => setDsrQuery((current) => ({ ...current, page: 1, search: event.target.value }))}
                />
              </div>
              <div className="grid gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                <Label htmlFor="iam-dsr-type">{t('admin.iam.dsr.filters.type')}</Label>
                <Select
                  id="iam-dsr-type"
                  value={dsrQuery.type ?? ''}
                  onChange={(event) =>
                    setDsrQuery((current) => ({
                      ...current,
                      page: 1,
                      type: (event.target.value || undefined) as DsrAdminCasesQuery['type'],
                    }))
                  }
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                >
                  <option value="">{t('admin.iam.shared.all')}</option>
                  {dsrTypeOptions.map((option) => (
                    <option key={option} value={option}>
                      {t(mapDsrTypeToTranslationKey(option))}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                <Label htmlFor="iam-dsr-status">{t('admin.iam.dsr.filters.status')}</Label>
                <Select
                  id="iam-dsr-status"
                  value={dsrQuery.status ?? ''}
                  onChange={(event) =>
                    setDsrQuery((current) => ({
                      ...current,
                      page: 1,
                      status: (event.target.value || undefined) as DsrAdminCasesQuery['status'],
                    }))
                  }
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                >
                  <option value="">{t('admin.iam.shared.all')}</option>
                  {dsrStatusOptions.map((option) => (
                    <option key={option} value={option}>
                      {t(mapDsrCanonicalStatusToTranslationKey(option))}
                    </option>
                  ))}
                </Select>
              </div>
          </Card>
          {dsrError ? (
            <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
              <AlertDescription>{dsrError}</AlertDescription>
            </Alert>
          ) : null}
          <StudioDataTable
            ariaLabel={t('admin.iam.dsr.tableAriaLabel')}
            labels={studioDataTableLabels}
            caption={t('admin.iam.dsr.tableCaption')}
            data={dsrItems}
            columns={dsrColumns}
            getRowId={(item) => item.id}
            selectionMode="none"
            isLoading={isLoadingDsr}
            loadingState={t('admin.iam.dsr.messages.loading')}
            emptyState={<p className="text-sm text-muted-foreground">{t('admin.iam.dsr.messages.empty')}</p>}
          />
        </div>
      ) : null}

      {activeTab === 'deletion-rules' ? (
        <div
          id={getTabPanelId('deletion-rules')}
          role="tabpanel"
          aria-labelledby={getTabId('deletion-rules')}
          className="space-y-4"
        >
          <Card>
            <CardHeader className="p-4 pb-0">
              <CardTitle>{t('admin.iam.deletionRules.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4 pt-0">
              <p className="text-sm text-muted-foreground">{t('admin.iam.deletionRules.subtitle')}</p>

              {deletionRulesError ? (
                <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
                  <AlertDescription>{deletionRulesError}</AlertDescription>
                </Alert>
              ) : null}

              {isLoadingDeletionRules || !deletionRulesDraft ? (
                <p className="text-sm text-muted-foreground">{t('admin.iam.deletionRules.messages.loading')}</p>
              ) : (
                <form className="grid gap-4 md:grid-cols-2" onSubmit={handleDeletionRulesSave}>
                  <div className="grid gap-1">
                    <Label htmlFor="deletion-rules-deactivate">{t('admin.iam.deletionRules.fields.deactivateAfterDays')}</Label>
                    <Input
                      id="deletion-rules-deactivate"
                      inputMode="numeric"
                      value={deletionRulesDraft.deactivateAfterDays}
                      onChange={(event) =>
                        setDeletionRulesDraft((current) =>
                          current ? { ...current, deactivateAfterDays: event.target.value } : current
                        )
                      }
                      disabled={!deletionRules?.canEdit || isSavingDeletionRules}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="deletion-rules-pseudonymize">{t('admin.iam.deletionRules.fields.pseudonymizeAfterDays')}</Label>
                    <Input
                      id="deletion-rules-pseudonymize"
                      inputMode="numeric"
                      value={deletionRulesDraft.pseudonymizeAfterDays}
                      onChange={(event) =>
                        setDeletionRulesDraft((current) =>
                          current ? { ...current, pseudonymizeAfterDays: event.target.value } : current
                        )
                      }
                      disabled={!deletionRules?.canEdit || isSavingDeletionRules}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="deletion-rules-delete">{t('admin.iam.deletionRules.fields.deleteAfterDays')}</Label>
                    <Input
                      id="deletion-rules-delete"
                      inputMode="numeric"
                      value={deletionRulesDraft.deleteAfterDays}
                      onChange={(event) =>
                        setDeletionRulesDraft((current) =>
                          current ? { ...current, deleteAfterDays: event.target.value } : current
                        )
                      }
                      disabled={!deletionRules?.canEdit || isSavingDeletionRules}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="deletion-rules-strategy">{t('admin.iam.deletionRules.fields.defaultContentStrategy')}</Label>
                    <Select
                      id="deletion-rules-strategy"
                      value={deletionRulesDraft.defaultContentStrategy}
                      onChange={(event) =>
                        setDeletionRulesDraft((current) =>
                          current
                            ? {
                                ...current,
                                defaultContentStrategy: event.target.value as IamDeletionContentStrategy,
                              }
                            : current
                        )
                      }
                      disabled={!deletionRules?.canEdit || isSavingDeletionRules}
                    >
                      {deletionContentStrategyOptions.map((option) => (
                        <option key={option} value={option}>
                          {t(mapDeletionContentStrategyKey(option))}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="md:col-span-2 flex items-start gap-3 rounded-lg border border-border p-3">
                    <Checkbox
                      id="deletion-rules-allow-override"
                      checked={deletionRulesDraft.allowContentPreferenceOverride}
                      onChange={(event) => {
                        const nextChecked = event.currentTarget.checked;
                        setDeletionRulesDraft((current) =>
                          current
                            ? {
                                ...current,
                                allowContentPreferenceOverride: nextChecked,
                              }
                            : current
                        );
                      }}
                      disabled={!deletionRules?.canEdit || isSavingDeletionRules}
                    />
                    <div className="grid gap-1">
                      <Label htmlFor="deletion-rules-allow-override">
                        {t('admin.iam.deletionRules.fields.allowContentPreferenceOverride')}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {t('admin.iam.deletionRules.fields.allowContentPreferenceOverrideHint')}
                      </p>
                    </div>
                  </div>
                  <div className="md:col-span-2 flex items-center gap-3">
                    <Button type="submit" disabled={!deletionRules?.canEdit || isSavingDeletionRules}>
                      {isSavingDeletionRules
                        ? t('admin.iam.deletionRules.actions.saving')
                        : t('admin.iam.deletionRules.actions.save')}
                    </Button>
                    {!deletionRules?.canEdit ? (
                      <p className="text-sm text-muted-foreground">{t('admin.iam.deletionRules.messages.readOnly')}</p>
                    ) : null}
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </section>
  );
}

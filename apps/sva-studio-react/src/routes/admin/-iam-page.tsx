import type {
  IamDeletionContentStrategy,
  IamDsrCaseListItem,
  IamGovernanceCaseListItem,
  IamTenantDeletionRulesOverview,
} from '@sva/core';
import type { AuthorizeResponse, EffectivePermission } from '@sva/iam-core';
import { StudioDataTable, type StudioColumnDef } from '@sva/studio-ui-react';
import { useNavigate } from '@tanstack/react-router';
import React from 'react';

import { StudioFilterSurface } from '../../components/StudioFilterSurface';
import { StudioSummaryCard } from '../../components/StudioSummaryCard';
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

const buildSelectOptions = (values: readonly (string | null | undefined)[]) =>
  [...new Set(values.map((value) => value?.trim() ?? '').filter((value) => value.length > 0))].sort((left, right) =>
    left.localeCompare(right)
  );

const formatSourceRoles = (permission: EffectivePermission) =>
  (permission.sourceRoleIds ?? []).length > 0 ? (permission.sourceRoleIds ?? []).join(', ') : '—';

const formatSourceGroups = (permission: EffectivePermission) => {
  if (permission.groupName && permission.groupName.trim().length > 0) {
    return permission.groupName;
  }
  return (permission.sourceGroupIds ?? []).length > 0 ? (permission.sourceGroupIds ?? []).join(', ') : '—';
};

const formatGovernanceActors = (item: IamGovernanceCaseListItem) =>
  [item.actorDisplayName ?? item.actorAccountId, item.targetDisplayName ?? item.targetAccountId].filter(Boolean).join(' -> ') || '—';

const formatDsrPeople = (item: IamDsrCaseListItem) =>
  [
    item.targetDisplayName ?? item.targetAccountId,
    item.requesterDisplayName ?? item.requesterAccountId ?? item.actorDisplayName ?? item.actorAccountId,
  ]
    .filter(Boolean)
    .join(' / ') || '—';

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
              <td className="py-2 pr-4">{formatObjectEntries(permission.scope)}</td>
              <td className="py-2">{formatSourceRoles(permission)}</td>
              <td className="py-2">{formatSourceGroups(permission)}</td>
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

type DeletionRulesDraft = {
  deactivateAfterDays: string;
  pseudonymizeAfterDays: string;
  deleteAfterDays: string;
  defaultContentStrategy: IamDeletionContentStrategy;
  allowContentPreferenceOverride: boolean;
};

type ActiveTabHelp = {
  title: string;
  description: string;
  options: readonly string[];
};

const createDeletionRulesDraft = (rules: IamTenantDeletionRulesOverview): DeletionRulesDraft => ({
  deactivateAfterDays: String(rules.deactivateAfterDays),
  pseudonymizeAfterDays: String(rules.pseudonymizeAfterDays),
  deleteAfterDays: String(rules.deleteAfterDays),
  defaultContentStrategy: rules.defaultContentStrategy,
  allowContentPreferenceOverride: rules.allowContentPreferenceOverride,
});

const getActiveTabHelp = (activeTab: IamCockpitTabKey): ActiveTabHelp => {
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

const buildGovernanceColumns = (): readonly StudioColumnDef<IamGovernanceCaseListItem>[] => [
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
    cell: (item) => formatGovernanceActors(item),
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
];

const buildDsrColumns = (): readonly StudioColumnDef<IamDsrCaseListItem>[] => [
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
    cell: (item) => formatDsrPeople(item),
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
];

const useIamTabNavigation = (activeTab: IamCockpitTabKey, allowedTabs: readonly IamCockpitTabKey[]) => {
  const navigate = useNavigate();
  const tabButtonRefs = React.useRef<Partial<Record<IamCockpitTabKey, HTMLButtonElement | null>>>({});
  const shouldFocusActiveTabRef = React.useRef(false);

  const navigateToTab = React.useCallback(
    (tab: IamCockpitTabKey, focusActiveTab = false) => {
      shouldFocusActiveTabRef.current = focusActiveTab;
      Promise.resolve(navigate({ to: '/admin/iam', search: { tab } })).catch(() => undefined);
    },
    [navigate]
  );

  React.useEffect(() => {
    if (allowedTabs.length === 0 || allowedTabs.includes(activeTab)) {
      return;
    }
    shouldFocusActiveTabRef.current = false;
    Promise.resolve(
      navigate({ to: '/admin/iam', search: { tab: getFirstAllowedTab(allowedTabs) }, replace: true })
    ).catch(() => undefined);
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
  }, [activeTab]);

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

  return {
    handleTabKeyDown,
    navigateToTab,
    tabButtonRefs,
  };
};

const useRightsTabState = ({
  activeTab,
  allowedTabs,
  canAccessCockpit,
  cockpitEnabled,
  instanceId,
  invalidatePermissions,
}: Readonly<{
  activeTab: IamCockpitTabKey;
  allowedTabs: readonly IamCockpitTabKey[];
  canAccessCockpit: boolean;
  cockpitEnabled: boolean;
  instanceId: string;
  invalidatePermissions: () => Promise<void>;
}>) => {
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
    }, FILTER_REQUEST_DEBOUNCE_MS);

    return () => {
      active = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [actingAsUserId, activeTab, allowedTabs, canAccessCockpit, cockpitEnabled, instanceId, invalidatePermissions, organizationId]);

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
  const organizationSelectOptions = React.useMemo(
    () => buildSelectOptions([...organizationOptions, organizationId, authorizeOrganizationId]),
    [authorizeOrganizationId, organizationId, organizationOptions]
  );

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

  return {
    actingAsUserId,
    authorizeAction,
    authorizeDecision,
    authorizeError,
    authorizeOrganizationId,
    authorizeResourceId,
    authorizeResourceType,
    filteredPermissions,
    handleAuthorizeSubmit,
    handleOrganizationFilterToggle,
    isAuthorizing,
    isLoadingPermissions,
    organizationId,
    organizationOptions,
    organizationSelectOptions,
    permissionSubject,
    permissionsError,
    queryText,
    selectedOrganizationIds,
    setActingAsUserId,
    setAuthorizeAction,
    setAuthorizeOrganizationId,
    setAuthorizeResourceId,
    setAuthorizeResourceType,
    setOrganizationId,
    setQueryText,
  };
};

const useGovernanceTabState = ({
  activeTab,
  allowedTabs,
  canAccessCockpit,
  cockpitEnabled,
}: Readonly<{
  activeTab: IamCockpitTabKey;
  allowedTabs: readonly IamCockpitTabKey[];
  canAccessCockpit: boolean;
  cockpitEnabled: boolean;
}>) => {
  const [items, setItems] = React.useState<readonly IamGovernanceCaseListItem[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState<GovernanceCasesQuery>({
    page: 1,
    pageSize: 12,
    search: '',
  });
  const [isLoading, setIsLoading] = React.useState(false);
  const requestQuery = React.useMemo(() => ({ ...query, search: query.search?.trim() ?? '' }), [query]);

  React.useEffect(() => {
    if (!cockpitEnabled || !canAccessCockpit || activeTab !== 'governance' || !allowedTabs.includes('governance')) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      logBrowserOperationStart(iamViewerLogger, 'iam_governance_load_started', {
        operation: 'list_governance_cases',
      });
      setIsLoading(true);
      setError(null);

      listGovernanceCases(requestQuery, { signal: controller.signal })
        .then((response) => {
          if (controller.signal.aborted) {
            return;
          }
          setItems(response.data);
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
        .catch((nextError) => {
          if (isAbortError(nextError) || controller.signal.aborted) {
            logBrowserOperationAbort(iamViewerLogger, 'iam_governance_load_aborted', {
              operation: 'list_governance_cases',
            });
            return;
          }
          setItems([]);
          setError(nextError instanceof Error ? nextError.message : String(nextError));
          logBrowserOperationFailure(iamViewerLogger, 'iam_governance_load_failed', nextError, {
            operation: 'list_governance_cases',
          });
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsLoading(false);
          }
        });
    }, FILTER_REQUEST_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [activeTab, allowedTabs, canAccessCockpit, cockpitEnabled, requestQuery]);

  const statusOptions = React.useMemo(
    () => buildSelectOptions([...items.map((item) => item.status), query.status]),
    [items, query.status]
  );

  return {
    error,
    isLoading,
    items,
    query,
    setQuery,
    statusOptions,
  };
};

const useDsrTabState = ({
  activeTab,
  allowedTabs,
  canAccessCockpit,
  cockpitEnabled,
}: Readonly<{
  activeTab: IamCockpitTabKey;
  allowedTabs: readonly IamCockpitTabKey[];
  canAccessCockpit: boolean;
  cockpitEnabled: boolean;
}>) => {
  const [items, setItems] = React.useState<readonly IamDsrCaseListItem[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState<DsrAdminCasesQuery>({
    page: 1,
    pageSize: 12,
    search: '',
  });
  const [isLoading, setIsLoading] = React.useState(false);
  const requestQuery = React.useMemo(() => ({ ...query, search: query.search?.trim() ?? '' }), [query]);

  React.useEffect(() => {
    if (!cockpitEnabled || !canAccessCockpit || activeTab !== 'dsr' || !allowedTabs.includes('dsr')) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      logBrowserOperationStart(iamViewerLogger, 'iam_dsr_load_started', {
        operation: 'list_admin_dsr_cases',
      });
      setIsLoading(true);
      setError(null);

      listAdminDsrCases(requestQuery, { signal: controller.signal })
        .then((response) => {
          if (controller.signal.aborted) {
            return;
          }
          setItems(response.data);
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
        .catch((nextError) => {
          if (isAbortError(nextError) || controller.signal.aborted) {
            logBrowserOperationAbort(iamViewerLogger, 'iam_dsr_load_aborted', {
              operation: 'list_admin_dsr_cases',
            });
            return;
          }
          setItems([]);
          setError(nextError instanceof Error ? nextError.message : String(nextError));
          logBrowserOperationFailure(iamViewerLogger, 'iam_dsr_load_failed', nextError, {
            operation: 'list_admin_dsr_cases',
          });
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsLoading(false);
          }
        });
    }, FILTER_REQUEST_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [activeTab, allowedTabs, canAccessCockpit, cockpitEnabled, requestQuery]);

  return {
    error,
    isLoading,
    items,
    query,
    setQuery,
  };
};

const useDeletionRulesTabState = ({
  activeTab,
  allowedTabs,
  canAccessCockpit,
  cockpitEnabled,
  instanceId,
}: Readonly<{
  activeTab: IamCockpitTabKey;
  allowedTabs: readonly IamCockpitTabKey[];
  canAccessCockpit: boolean;
  cockpitEnabled: boolean;
  instanceId: string;
}>) => {
  const [deletionRules, setDeletionRules] = React.useState<IamTenantDeletionRulesOverview | null>(null);
  const [draft, setDraft] = React.useState<DeletionRulesDraft | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (!cockpitEnabled || !canAccessCockpit || activeTab !== 'deletion-rules' || !allowedTabs.includes('deletion-rules')) {
      return;
    }
    if (!instanceId) {
      setDeletionRules(null);
      setDraft(null);
      setError(t('admin.iam.deletionRules.messages.instanceMissing'));
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    getAdminDeletionRules(instanceId)
      .then((response) => {
        if (controller.signal.aborted) {
          return;
        }
        setDeletionRules(response);
        setDraft(createDeletionRulesDraft(response));
      })
      .catch((nextError) => {
        if (isAbortError(nextError) || controller.signal.aborted) {
          return;
        }
        setDeletionRules(null);
        setDraft(null);
        setError(nextError instanceof Error ? nextError.message : String(nextError));
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [activeTab, allowedTabs, canAccessCockpit, cockpitEnabled, instanceId]);

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!instanceId || !draft) {
      setError(t('admin.iam.deletionRules.messages.instanceMissing'));
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await saveAdminDeletionRules({
        instanceId,
        deactivateAfterDays: Number(draft.deactivateAfterDays),
        pseudonymizeAfterDays: Number(draft.pseudonymizeAfterDays),
        deleteAfterDays: Number(draft.deleteAfterDays),
        defaultContentStrategy: draft.defaultContentStrategy,
        allowContentPreferenceOverride: draft.allowContentPreferenceOverride,
      });
      setDeletionRules(response);
      setDraft(createDeletionRulesDraft(response));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setIsSaving(false);
    }
  };

  return {
    deletionRules,
    draft,
    error,
    handleSave,
    isLoading,
    isSaving,
    setDraft,
  };
};

const ActiveTabHelpCard = ({ activeTab }: Readonly<{ activeTab: IamCockpitTabKey }>) => {
  const activeTabHelp = React.useMemo(() => getActiveTabHelp(activeTab), [activeTab]);

  return (
    <Card className="border-border/80 bg-white p-4 shadow-sm">
      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">{activeTabHelp.title}</p>
        <p className="text-sm text-muted-foreground">{activeTabHelp.description}</p>
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('admin.iam.tabHelp.optionsLabel')}
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {activeTabHelp.options.map((option) => (
              <li key={option}>{option}</li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
};

const RightsTabPanel = ({
  panelId,
  labelledBy,
  state,
}: Readonly<{
  panelId: string;
  labelledBy: string;
  state: ReturnType<typeof useRightsTabState>;
}>) => (
  <div id={panelId} role="tabpanel" aria-labelledby={labelledBy} className="space-y-4">
    <StudioFilterSurface className="grid gap-3 lg:grid-cols-4">
      <div className="grid gap-1 text-xs uppercase tracking-wide text-muted-foreground">
        <Label htmlFor="iam-organization-filter">{t('admin.iam.rights.filters.organization')}</Label>
        <Select
          id="iam-organization-filter"
          value={state.organizationId}
          onChange={(event) => state.setOrganizationId(event.target.value)}
        >
          <option value="">{t('admin.iam.shared.all')}</option>
          {state.organizationSelectOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid gap-1 text-xs uppercase tracking-wide text-muted-foreground">
        <Label htmlFor="iam-acting-as-filter">{t('admin.iam.rights.filters.actingAs')}</Label>
        <Input
          id="iam-acting-as-filter"
          value={state.actingAsUserId}
          onChange={(event) => state.setActingAsUserId(event.target.value)}
        />
      </div>
      <div className="grid gap-1 text-xs uppercase tracking-wide text-muted-foreground">
        <Label htmlFor="iam-query-filter">{t('admin.iam.rights.filters.search')}</Label>
        <Input id="iam-query-filter" value={state.queryText} onChange={(event) => state.setQueryText(event.target.value)} />
      </div>
      <StudioSummaryCard
        eyebrow={t('admin.iam.rights.subject.title')}
        value={state.permissionSubject ? state.permissionSubject.effectiveUserId : '—'}
        valueClassName="text-lg"
      >
        <p className="text-xs text-muted-foreground">
          {state.permissionSubject?.isImpersonating
            ? t('admin.iam.rights.subject.impersonating', { actor: state.permissionSubject.actorUserId })
            : t('admin.iam.rights.subject.self')}
        </p>
      </StudioSummaryCard>
    </StudioFilterSurface>

    {state.organizationOptions.length > 0 ? (
      <div className="flex flex-wrap gap-2">
        {state.organizationOptions.map((organizationValue) => (
          <Button
            key={organizationValue || 'no-organization'}
            type="button"
            className={`rounded-full text-xs ${
              state.selectedOrganizationIds.includes(organizationValue)
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground'
            }`}
            onClick={() => state.handleOrganizationFilterToggle(organizationValue)}
            size="sm"
            variant="outline"
          >
            {organizationValue || t('admin.iam.rights.noOrganization')}
          </Button>
        ))}
      </div>
    ) : null}

    {state.permissionsError ? (
      <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
        <AlertDescription>{t('admin.iam.rights.messages.error', { value: state.permissionsError })}</AlertDescription>
      </Alert>
    ) : null}

    <Card aria-busy={state.isLoadingPermissions} className="p-4">
      <PermissionTable permissions={state.filteredPermissions} />
    </Card>

    <StudioFilterSurface>
      <form onSubmit={state.handleAuthorizeSubmit} className="grid gap-3 lg:grid-cols-4">
        <div className="grid gap-1 text-xs uppercase tracking-wide text-muted-foreground">
          <Label htmlFor="iam-authorize-action">{t('admin.iam.rights.authorize.action')}</Label>
          <Input
            id="iam-authorize-action"
            value={state.authorizeAction}
            onChange={(event) => state.setAuthorizeAction(event.target.value)}
          />
        </div>
        <div className="grid gap-1 text-xs uppercase tracking-wide text-muted-foreground">
          <Label htmlFor="iam-authorize-resource-type">{t('admin.iam.rights.authorize.resourceType')}</Label>
          <Input
            id="iam-authorize-resource-type"
            value={state.authorizeResourceType}
            onChange={(event) => state.setAuthorizeResourceType(event.target.value)}
          />
        </div>
        <div className="grid gap-1 text-xs uppercase tracking-wide text-muted-foreground">
          <Label htmlFor="iam-authorize-resource-id">{t('admin.iam.rights.authorize.resourceId')}</Label>
          <Input
            id="iam-authorize-resource-id"
            value={state.authorizeResourceId}
            onChange={(event) => state.setAuthorizeResourceId(event.target.value)}
          />
        </div>
        <div className="grid gap-1 text-xs uppercase tracking-wide text-muted-foreground">
          <Label htmlFor="iam-authorize-organization-id">{t('admin.iam.rights.authorize.organizationId')}</Label>
          <Select
            id="iam-authorize-organization-id"
            value={state.authorizeOrganizationId}
            onChange={(event) => state.setAuthorizeOrganizationId(event.target.value)}
          >
            <option value="">{t('admin.iam.shared.all')}</option>
            {state.organizationSelectOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </div>
        <div className="lg:col-span-4 flex items-center gap-3">
          <Button type="submit" disabled={state.isAuthorizing}>
            {state.isAuthorizing ? t('admin.iam.rights.authorize.running') : t('admin.iam.rights.authorize.run')}
          </Button>
          {state.authorizeError ? <p className="text-sm text-destructive">{state.authorizeError}</p> : null}
        </div>
        {state.authorizeDecision ? (
          <Card className="lg:col-span-4 bg-background p-3 shadow-none">
            <p className="font-semibold text-foreground">
              {state.authorizeDecision.allowed
                ? t('admin.iam.rights.authorize.allowed')
                : t('admin.iam.rights.authorize.denied')}
            </p>
            <dl className="mt-3 grid gap-2 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t('admin.iam.rights.authorize.summary.action')}
                </dt>
                <dd className="text-foreground">{state.authorizeAction.trim() || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t('admin.iam.rights.authorize.summary.resource')}
                </dt>
                <dd className="text-foreground">
                  {[state.authorizeResourceType.trim(), state.authorizeResourceId.trim()].filter(Boolean).join(' / ') || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t('admin.iam.rights.authorize.summary.organization')}
                </dt>
                <dd className="text-foreground">
                  {state.authorizeOrganizationId.trim() || state.organizationId.trim() || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t('admin.iam.rights.authorize.summary.cause')}
                </dt>
                <dd className="text-foreground">
                  {state.authorizeDecision.reasonCode ?? state.authorizeDecision.reason}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t('admin.iam.rights.authorize.summary.origin')}
                </dt>
                <dd className="text-foreground">
                  {state.authorizeDecision.provenance?.sourceKinds && state.authorizeDecision.provenance.sourceKinds.length > 0
                    ? formatPermissionSourceKindLabels(state.authorizeDecision.provenance.sourceKinds)
                    : state.authorizeDecision.matchedPermissions && state.authorizeDecision.matchedPermissions.length > 0
                      ? formatPermissionSourceKindLabels(
                          [...new Set(state.authorizeDecision.matchedPermissions.map((permission) => permission.source))] as readonly string[]
                        )
                      : '—'}
                </dd>
              </div>
            </dl>
            {state.authorizeDecision.diagnostics ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {formatObjectEntries(state.authorizeDecision.diagnostics)}
              </p>
            ) : null}
          </Card>
        ) : null}
      </form>
    </StudioFilterSurface>
  </div>
);

const GovernanceTabPanel = ({
  canExportGovernanceCompliance,
  instanceId,
  panelId,
  labelledBy,
  state,
  columns,
  labels,
}: Readonly<{
  canExportGovernanceCompliance: boolean;
  instanceId: string;
  panelId: string;
  labelledBy: string;
  state: ReturnType<typeof useGovernanceTabState>;
  columns: readonly StudioColumnDef<IamGovernanceCaseListItem>[];
  labels: ReturnType<typeof createStudioDataTableLabels>;
}>) => (
  <div id={panelId} role="tabpanel" aria-labelledby={labelledBy} className="space-y-4">
    <StudioFilterSurface className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t('admin.iam.governance.messages.exportHint')}</p>
        {instanceId && canExportGovernanceCompliance ? (
          <Button asChild size="sm" variant="outline">
            <a href={buildGovernanceComplianceExportPath({ instanceId })}>{t('admin.iam.governance.actions.exportCsv')}</a>
          </Button>
        ) : null}
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="grid gap-1 text-xs uppercase tracking-wide text-muted-foreground">
          <Label htmlFor="iam-governance-search">{t('admin.iam.governance.filters.search')}</Label>
          <Input
            id="iam-governance-search"
            value={state.query.search ?? ''}
            onChange={(event) => state.setQuery((current) => ({ ...current, page: 1, search: event.target.value }))}
          />
        </div>
        <div className="grid gap-1 text-xs uppercase tracking-wide text-muted-foreground">
          <Label htmlFor="iam-governance-type">{t('admin.iam.governance.filters.type')}</Label>
          <Select
            id="iam-governance-type"
            value={state.query.type ?? ''}
            onChange={(event) =>
              state.setQuery((current) => ({
                ...current,
                page: 1,
                type: (event.target.value || undefined) as GovernanceCasesQuery['type'],
              }))
            }
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
          <Select
            id="iam-governance-status"
            value={state.query.status ?? ''}
            onChange={(event) =>
              state.setQuery((current) => ({
                ...current,
                page: 1,
                status: event.target.value || undefined,
              }))
            }
          >
            <option value="">{t('admin.iam.shared.all')}</option>
            {state.statusOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </div>
      </div>
    </StudioFilterSurface>
    {state.error ? (
      <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
        <AlertDescription>{state.error}</AlertDescription>
      </Alert>
    ) : null}
    <StudioDataTable
      ariaLabel={t('admin.iam.governance.tableAriaLabel')}
      labels={labels}
      caption={t('admin.iam.governance.tableCaption')}
      data={state.items}
      columns={columns}
      getRowId={(item) => item.id}
      selectionMode="none"
      isLoading={state.isLoading}
      loadingState={t('admin.iam.governance.messages.loading')}
      emptyState={<p className="text-sm text-muted-foreground">{t('admin.iam.governance.messages.empty')}</p>}
    />
  </div>
);

const DsrTabPanel = ({
  panelId,
  labelledBy,
  state,
  columns,
  labels,
}: Readonly<{
  panelId: string;
  labelledBy: string;
  state: ReturnType<typeof useDsrTabState>;
  columns: readonly StudioColumnDef<IamDsrCaseListItem>[];
  labels: ReturnType<typeof createStudioDataTableLabels>;
}>) => (
  <div id={panelId} role="tabpanel" aria-labelledby={labelledBy} className="space-y-4">
    <StudioFilterSurface className="grid gap-3 md:grid-cols-3">
      <div className="grid gap-1 text-xs uppercase tracking-wide text-muted-foreground">
        <Label htmlFor="iam-dsr-search">{t('admin.iam.dsr.filters.search')}</Label>
        <Input
          id="iam-dsr-search"
          value={state.query.search ?? ''}
          onChange={(event) => state.setQuery((current) => ({ ...current, page: 1, search: event.target.value }))}
        />
      </div>
      <div className="grid gap-1 text-xs uppercase tracking-wide text-muted-foreground">
        <Label htmlFor="iam-dsr-type">{t('admin.iam.dsr.filters.type')}</Label>
        <Select
          id="iam-dsr-type"
          value={state.query.type ?? ''}
          onChange={(event) =>
            state.setQuery((current) => ({
              ...current,
              page: 1,
              type: (event.target.value || undefined) as DsrAdminCasesQuery['type'],
            }))
          }
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
          value={state.query.status ?? ''}
          onChange={(event) =>
            state.setQuery((current) => ({
              ...current,
              page: 1,
              status: (event.target.value || undefined) as DsrAdminCasesQuery['status'],
            }))
          }
        >
          <option value="">{t('admin.iam.shared.all')}</option>
          {dsrStatusOptions.map((option) => (
            <option key={option} value={option}>
              {t(mapDsrCanonicalStatusToTranslationKey(option))}
            </option>
          ))}
        </Select>
      </div>
    </StudioFilterSurface>
    {state.error ? (
      <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
        <AlertDescription>{state.error}</AlertDescription>
      </Alert>
    ) : null}
    <StudioDataTable
      ariaLabel={t('admin.iam.dsr.tableAriaLabel')}
      labels={labels}
      caption={t('admin.iam.dsr.tableCaption')}
      data={state.items}
      columns={columns}
      getRowId={(item) => item.id}
      selectionMode="none"
      isLoading={state.isLoading}
      loadingState={t('admin.iam.dsr.messages.loading')}
      emptyState={<p className="text-sm text-muted-foreground">{t('admin.iam.dsr.messages.empty')}</p>}
    />
  </div>
);

const DeletionRulesTabPanel = ({
  panelId,
  labelledBy,
  state,
}: Readonly<{
  panelId: string;
  labelledBy: string;
  state: ReturnType<typeof useDeletionRulesTabState>;
}>) => (
  <div id={panelId} role="tabpanel" aria-labelledby={labelledBy} className="space-y-4">
    <Card>
      <CardHeader className="p-4 pb-0">
        <CardTitle>{t('admin.iam.deletionRules.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-4 pt-0">
        <p className="text-sm text-muted-foreground">{t('admin.iam.deletionRules.subtitle')}</p>

        {state.error ? (
          <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}

        {state.isLoading || !state.draft ? (
          <p className="text-sm text-muted-foreground">{t('admin.iam.deletionRules.messages.loading')}</p>
        ) : (
          <form className="grid gap-4 md:grid-cols-2" onSubmit={state.handleSave}>
            <div className="grid gap-1">
              <Label htmlFor="deletion-rules-deactivate">{t('admin.iam.deletionRules.fields.deactivateAfterDays')}</Label>
              <Input
                id="deletion-rules-deactivate"
                inputMode="numeric"
                value={state.draft.deactivateAfterDays}
                onChange={(event) =>
                  state.setDraft((current) => (current ? { ...current, deactivateAfterDays: event.target.value } : current))
                }
                disabled={!state.deletionRules?.canEdit || state.isSaving}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="deletion-rules-pseudonymize">{t('admin.iam.deletionRules.fields.pseudonymizeAfterDays')}</Label>
              <Input
                id="deletion-rules-pseudonymize"
                inputMode="numeric"
                value={state.draft.pseudonymizeAfterDays}
                onChange={(event) =>
                  state.setDraft((current) => (current ? { ...current, pseudonymizeAfterDays: event.target.value } : current))
                }
                disabled={!state.deletionRules?.canEdit || state.isSaving}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="deletion-rules-delete">{t('admin.iam.deletionRules.fields.deleteAfterDays')}</Label>
              <Input
                id="deletion-rules-delete"
                inputMode="numeric"
                value={state.draft.deleteAfterDays}
                onChange={(event) =>
                  state.setDraft((current) => (current ? { ...current, deleteAfterDays: event.target.value } : current))
                }
                disabled={!state.deletionRules?.canEdit || state.isSaving}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="deletion-rules-strategy">{t('admin.iam.deletionRules.fields.defaultContentStrategy')}</Label>
              <Select
                id="deletion-rules-strategy"
                value={state.draft.defaultContentStrategy}
                onChange={(event) =>
                  state.setDraft((current) =>
                    current
                      ? {
                          ...current,
                          defaultContentStrategy: event.target.value as IamDeletionContentStrategy,
                        }
                      : current
                  )
                }
                disabled={!state.deletionRules?.canEdit || state.isSaving}
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
                checked={state.draft.allowContentPreferenceOverride}
                onChange={(event) => {
                  const nextChecked = event.currentTarget.checked;
                  state.setDraft((current) =>
                    current
                      ? {
                          ...current,
                          allowContentPreferenceOverride: nextChecked,
                        }
                      : current
                  );
                }}
                disabled={!state.deletionRules?.canEdit || state.isSaving}
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
              <Button type="submit" disabled={!state.deletionRules?.canEdit || state.isSaving}>
                {state.isSaving ? t('admin.iam.deletionRules.actions.saving') : t('admin.iam.deletionRules.actions.save')}
              </Button>
              {!state.deletionRules?.canEdit ? (
                <p className="text-sm text-muted-foreground">{t('admin.iam.deletionRules.messages.readOnly')}</p>
              ) : null}
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  </div>
);

export function IamViewerPage({ activeTab }: IamViewerPageProps) {
  const { user, isLoading: isLoadingUser, error: authError, invalidatePermissions } = useAuth();
  const instanceId = user?.instanceId ?? '';
  const cockpitEnabled = isIamCockpitEnabled();
  const canAccessCockpit = hasIamCockpitAccessRole(user);
  const canExportGovernanceCompliance = hasGovernanceComplianceExportRole(user);
  const allowedTabs = React.useMemo(() => getAllowedIamCockpitTabs(user), [user]);
  const studioDataTableLabels = React.useMemo(() => createStudioDataTableLabels(), []);
  const { handleTabKeyDown, navigateToTab, tabButtonRefs } = useIamTabNavigation(activeTab, allowedTabs);
  const rightsTabState = useRightsTabState({
    activeTab,
    allowedTabs,
    canAccessCockpit,
    cockpitEnabled,
    instanceId,
    invalidatePermissions,
  });
  const governanceTabState = useGovernanceTabState({
    activeTab,
    allowedTabs,
    canAccessCockpit,
    cockpitEnabled,
  });
  const dsrTabState = useDsrTabState({
    activeTab,
    allowedTabs,
    canAccessCockpit,
    cockpitEnabled,
  });
  const deletionRulesTabState = useDeletionRulesTabState({
    activeTab,
    allowedTabs,
    canAccessCockpit,
    cockpitEnabled,
    instanceId,
  });
  const governanceColumns = React.useMemo(buildGovernanceColumns, []);
  const dsrColumns = React.useMemo(buildDsrColumns, []);

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

      <ActiveTabHelpCard activeTab={activeTab} />

      {activeTab === 'rights' ? (
        <RightsTabPanel
          panelId={getTabPanelId('rights')}
          labelledBy={getTabId('rights')}
          state={rightsTabState}
        />
      ) : null}

      {activeTab === 'governance' ? (
        <GovernanceTabPanel
          canExportGovernanceCompliance={canExportGovernanceCompliance}
          instanceId={instanceId}
          panelId={getTabPanelId('governance')}
          labelledBy={getTabId('governance')}
          state={governanceTabState}
          columns={governanceColumns}
          labels={studioDataTableLabels}
        />
      ) : null}

      {activeTab === 'dsr' ? (
        <DsrTabPanel
          panelId={getTabPanelId('dsr')}
          labelledBy={getTabId('dsr')}
          state={dsrTabState}
          columns={dsrColumns}
          labels={studioDataTableLabels}
        />
      ) : null}

      {activeTab === 'deletion-rules' ? (
        <DeletionRulesTabPanel
          panelId={getTabPanelId('deletion-rules')}
          labelledBy={getTabId('deletion-rules')}
          state={deletionRulesTabState}
        />
      ) : null}
    </section>
  );
}

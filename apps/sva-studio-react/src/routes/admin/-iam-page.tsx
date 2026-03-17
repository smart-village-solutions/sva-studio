import type { AuthorizeResponse, EffectivePermission, IamDsrCaseListItem, IamGovernanceCaseListItem } from '@sva/core';
import { useNavigate } from '@tanstack/react-router';
import React from 'react';

import { Alert, AlertDescription } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select } from '../../components/ui/select';
import {
  listAdminDsrCases,
  listGovernanceCases,
  type DsrAdminCasesQuery,
  type GovernanceCasesQuery,
} from '../../lib/iam-api';
import {
  getAllowedIamCockpitTabs,
  hasIamCockpitAccessRole,
  isIamCockpitEnabled,
  type IamCockpitTabKey,
} from '../../lib/iam-viewer-access';
import { t } from '../../i18n';
import { useAuth } from '../../providers/auth-provider';
import {
  filterPermissions,
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

const formatDateTime = (value?: string) => {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
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
            <th className="py-2 pr-4 font-semibold">{t('admin.iam.rights.columns.resourceType')}</th>
            <th className="py-2 pr-4 font-semibold">{t('admin.iam.rights.columns.resourceId')}</th>
            <th className="py-2 pr-4 font-semibold">{t('admin.iam.rights.columns.organization')}</th>
            <th className="py-2 pr-4 font-semibold">{t('admin.iam.rights.columns.effect')}</th>
            <th className="py-2 pr-4 font-semibold">{t('admin.iam.rights.columns.scope')}</th>
            <th className="py-2 font-semibold">{t('admin.iam.rights.columns.sourceRoles')}</th>
            <th className="py-2 font-semibold">{t('admin.iam.rights.columns.sourceGroups')}</th>
          </tr>
        </thead>
        <tbody>
          {permissions.map((permission, index) => (
            <tr
              key={`${permission.action}-${permission.resourceType}-${permission.resourceId ?? 'none'}-${index}`}
              className="border-b border-border align-top text-foreground"
            >
              <td className="py-2 pr-4">{permission.action}</td>
              <td className="py-2 pr-4">{permission.resourceType}</td>
              <td className="py-2 pr-4">{permission.resourceId ?? '—'}</td>
              <td className="py-2 pr-4">{permission.organizationId ?? t('admin.iam.rights.noOrganization')}</td>
              <td className="py-2 pr-4">{permission.effect ?? '—'}</td>
              <td className="py-2 pr-4">{formatObjectEntries(permission.scope)}</td>
              <td className="py-2">{permission.sourceRoleIds.length > 0 ? permission.sourceRoleIds.join(', ') : '—'}</td>
              <td className="py-2">{permission.sourceGroupIds.length > 0 ? permission.sourceGroupIds.join(', ') : '—'}</td>
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

const CaseList = ({
  items,
  selectedId,
  onSelect,
  renderStatus,
}: Readonly<{
  items: readonly (IamGovernanceCaseListItem | IamDsrCaseListItem)[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  renderStatus: (item: IamGovernanceCaseListItem | IamDsrCaseListItem) => React.ReactNode;
}>) => {
  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <Button
          key={item.id}
          type="button"
          className={`rounded-xl border p-4 text-left transition ${
            item.id === selectedId ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted/50'
          }`}
          onClick={() => onSelect(item.id)}
          variant="ghost"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">{item.title}</p>
              <p className="text-xs text-muted-foreground">{item.summary}</p>
            </div>
            {renderStatus(item)}
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span>{t('admin.iam.shared.createdAt', { value: formatDateTime(item.createdAt) })}</span>
            {'type' in item ? <span>{t('admin.iam.shared.type', { value: item.type })}</span> : null}
            {'ticketId' in item && item.ticketId ? <span>{t('admin.iam.shared.ticket', { value: item.ticketId })}</span> : null}
            {'targetDisplayName' in item && item.targetDisplayName ? (
              <span>{t('admin.iam.shared.target', { value: item.targetDisplayName })}</span>
            ) : null}
          </div>
        </Button>
      ))}
    </div>
  );
};

const GovernanceDetail = ({ item }: Readonly<{ item: IamGovernanceCaseListItem | null }>) => {
  if (!item) {
    return <p className="text-sm text-muted-foreground">{t('admin.iam.shared.selectPrompt')}</p>;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>{item.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
      <dl className="grid gap-2 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">{t('admin.iam.shared.status')}</dt>
          <dd className="text-foreground">{item.status}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">{t('admin.iam.shared.actor')}</dt>
          <dd className="text-foreground">{item.actorDisplayName ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">{t('admin.iam.shared.targetLabel')}</dt>
          <dd className="text-foreground">{item.targetDisplayName ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">{t('admin.iam.shared.meta')}</dt>
          <dd className="text-foreground">{formatObjectEntries(item.metadata)}</dd>
        </div>
      </dl>
      </CardContent>
    </Card>
  );
};

const DsrDetail = ({ item }: Readonly<{ item: IamDsrCaseListItem | null }>) => {
  if (!item) {
    return <p className="text-sm text-muted-foreground">{t('admin.iam.shared.selectPrompt')}</p>;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>{item.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
      <dl className="grid gap-2 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">{t('admin.iam.shared.status')}</dt>
          <dd className="text-foreground">{item.rawStatus}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">{t('admin.iam.shared.targetLabel')}</dt>
          <dd className="text-foreground">{item.targetDisplayName ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">{t('admin.iam.shared.requester')}</dt>
          <dd className="text-foreground">{item.requesterDisplayName ?? item.actorDisplayName ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">{t('admin.iam.shared.meta')}</dt>
          <dd className="text-foreground">{formatObjectEntries(item.metadata)}</dd>
        </div>
      </dl>
      </CardContent>
    </Card>
  );
};

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
  const [selectedGovernanceId, setSelectedGovernanceId] = React.useState<string | null>(null);

  const [dsrItems, setDsrItems] = React.useState<readonly IamDsrCaseListItem[]>([]);
  const [dsrError, setDsrError] = React.useState<string | null>(null);
  const [dsrQuery, setDsrQuery] = React.useState<DsrAdminCasesQuery>({
    page: 1,
    pageSize: 12,
    search: '',
  });
  const [isLoadingDsr, setIsLoadingDsr] = React.useState(false);
  const [selectedDsrId, setSelectedDsrId] = React.useState<string | null>(null);

  const cockpitEnabled = isIamCockpitEnabled();
  const canAccessCockpit = hasIamCockpitAccessRole(user);
  const allowedTabs = React.useMemo(() => getAllowedIamCockpitTabs(user), [user]);
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
    if (!cockpitEnabled || !canAccessCockpit || !instanceId || activeTab !== 'rights') {
      return;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      setIsLoadingPermissions(true);
      setPermissionsError(null);

      try {
        const response = await fetch(
          buildPermissionsPath({
            instanceId,
            organizationId: organizationId.trim() || undefined,
            actingAsUserId: actingAsUserId.trim() || undefined,
          }),
          { credentials: 'include' }
        );

        if (!active) {
          return;
        }

        if (!response.ok) {
          if (response.status === 403) {
            await invalidatePermissions();
          }
          const payload = (await response.json().catch(() => null)) as IamApiErrorPayload | null;
          setPermissions([]);
          setPermissionSubject(null);
          setPermissionsError(payload?.error ?? `http_${response.status}`);
          return;
        }

        const payload = (await response.json()) as IamPermissionsResponse;
        setPermissions(payload.permissions);
        setPermissionSubject(payload.subject);
      } catch (error) {
        if (!active) {
          return;
        }
        setPermissions([]);
        setPermissionSubject(null);
        setPermissionsError(error instanceof Error ? error.message : String(error));
      } finally {
        if (active) {
          setIsLoadingPermissions(false);
        }
      }
    }, 300);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [actingAsUserId, activeTab, canAccessCockpit, cockpitEnabled, instanceId, invalidatePermissions, organizationId]);

  React.useEffect(() => {
    if (!cockpitEnabled || !canAccessCockpit || activeTab !== 'governance') {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setIsLoadingGovernance(true);
      setGovernanceError(null);

      void listGovernanceCases(governanceRequestQuery, { signal: controller.signal })
        .then((response) => {
          if (controller.signal.aborted) {
            return;
          }
          setGovernanceItems(response.data);
          setSelectedGovernanceId((current) =>
            response.data.some((item) => item.id === current) ? current : (response.data[0]?.id ?? null)
          );
        })
        .catch((error) => {
          if (isAbortError(error) || controller.signal.aborted) {
            return;
          }
          setGovernanceItems([]);
          setGovernanceError(error instanceof Error ? error.message : String(error));
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
  }, [activeTab, canAccessCockpit, cockpitEnabled, governanceRequestQuery]);

  React.useEffect(() => {
    if (!cockpitEnabled || !canAccessCockpit || activeTab !== 'dsr') {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setIsLoadingDsr(true);
      setDsrError(null);

      void listAdminDsrCases(dsrRequestQuery, { signal: controller.signal })
        .then((response) => {
          if (controller.signal.aborted) {
            return;
          }
          setDsrItems(response.data);
          setSelectedDsrId((current) =>
            response.data.some((item) => item.id === current) ? current : (response.data[0]?.id ?? null)
          );
        })
        .catch((error) => {
          if (isAbortError(error) || controller.signal.aborted) {
            return;
          }
          setDsrItems([]);
          setDsrError(error instanceof Error ? error.message : String(error));
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
  }, [activeTab, canAccessCockpit, cockpitEnabled, dsrRequestQuery]);

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

    try {
      const response = await fetch('/iam/authorize', {
        method: 'POST',
        credentials: 'include',
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
      });

      if (!response.ok) {
        if (response.status === 403) {
          await invalidatePermissions();
        }
        const payload = (await response.json().catch(() => null)) as IamApiErrorPayload | null;
        setAuthorizeDecision(null);
        setAuthorizeError(payload?.error ?? `http_${response.status}`);
        return;
      }

      const payload = (await response.json()) as AuthorizeResponse;
      setAuthorizeDecision(mapAuthorizeDecision(payload));
    } catch (error) {
      setAuthorizeDecision(null);
      setAuthorizeError(error instanceof Error ? error.message : String(error));
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

  const activeGovernanceItem = governanceItems.find((item) => item.id === selectedGovernanceId) ?? null;
  const activeDsrItem = dsrItems.find((item) => item.id === selectedDsrId) ?? null;

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
                <p className="text-muted-foreground">{authorizeDecision.reasonCode ?? authorizeDecision.reason}</p>
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
          className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(20rem,1fr)]"
        >
          <div className="space-y-4">
            <Card className="grid gap-3 p-4 md:grid-cols-3">
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
            </Card>
            {governanceError ? (
              <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
                <AlertDescription>{governanceError}</AlertDescription>
              </Alert>
            ) : null}
            {isLoadingGovernance ? (
              <p className="text-sm text-muted-foreground">{t('admin.iam.governance.messages.loading')}</p>
            ) : governanceItems.length === 0 ? (
              <Card className="border-dashed p-6 text-sm text-muted-foreground shadow-none">
                {t('admin.iam.governance.messages.empty')}
              </Card>
            ) : (
              <CaseList
                items={governanceItems}
                selectedId={selectedGovernanceId}
                onSelect={setSelectedGovernanceId}
                renderStatus={(item) => (
                  <StatusBadge
                    label={(item as IamGovernanceCaseListItem).status}
                    tone="border-secondary/40 bg-secondary/10 text-secondary"
                  />
                )}
              />
            )}
          </div>
          <GovernanceDetail item={activeGovernanceItem} />
        </div>
      ) : null}

      {activeTab === 'dsr' ? (
        <div
          id={getTabPanelId('dsr')}
          role="tabpanel"
          aria-labelledby={getTabId('dsr')}
          className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(20rem,1fr)]"
        >
          <div className="space-y-4">
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
            {isLoadingDsr ? (
              <p className="text-sm text-muted-foreground">{t('admin.iam.dsr.messages.loading')}</p>
            ) : dsrItems.length === 0 ? (
              <Card className="border-dashed p-6 text-sm text-muted-foreground shadow-none">
                {t('admin.iam.dsr.messages.empty')}
              </Card>
            ) : (
              <CaseList
                items={dsrItems}
                selectedId={selectedDsrId}
                onSelect={setSelectedDsrId}
                renderStatus={(item) => (
                  <StatusBadge
                    label={t(mapDsrStatusToTranslationKey(item as IamDsrCaseListItem))}
                    tone={mapDsrStatusTone(item as IamDsrCaseListItem)}
                  />
                )}
              />
            )}
          </div>
          <DsrDetail item={activeDsrItem} />
        </div>
      ) : null}
    </section>
  );
}

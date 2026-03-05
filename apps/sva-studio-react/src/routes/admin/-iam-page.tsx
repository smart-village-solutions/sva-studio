import type { AuthorizeResponse, EffectivePermission } from '@sva/core';
import React from 'react';

import { hasIamViewerAdminRole, isIamViewerEnabled } from '../../lib/iam-viewer-access';
import { useAuth } from '../../providers/auth-provider';
import {
  filterPermissions,
  mapAuthorizeDecision,
  type AuthorizeDecisionViewModel,
  type IamPermissionsQuery,
  type IamPermissionsResponse,
} from './-iam.models';

type IamApiErrorPayload = {
  error: string;
};

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

const formatOrganizationLabel = (organizationId: string) => {
  if (!organizationId) {
    return 'Keine Organisation';
  }
  return organizationId;
};

const PermissionTable = ({
  permissions,
}: Readonly<{
  permissions: readonly EffectivePermission[];
}>) => {
  if (permissions.length === 0) {
    return <p className="text-sm text-slate-400">Keine Berechtigungen gefunden.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-left text-xs sm:text-sm">
        <thead>
          <tr className="border-b border-slate-800 text-slate-300">
            <th className="py-2 pr-4 font-semibold">Action</th>
            <th className="py-2 pr-4 font-semibold">Resource Type</th>
            <th className="py-2 pr-4 font-semibold">Organization</th>
            <th className="py-2 font-semibold">Source Roles</th>
          </tr>
        </thead>
        <tbody>
          {permissions.map((permission, index) => (
            <tr
              key={`${permission.action}-${permission.resourceType}-${permission.organizationId ?? 'none'}-${index}`}
              className="border-b border-slate-900 align-top text-slate-200"
            >
              <td className="py-2 pr-4">{permission.action}</td>
              <td className="py-2 pr-4">{permission.resourceType}</td>
              <td className="py-2 pr-4">{formatOrganizationLabel(permission.organizationId ?? '')}</td>
              <td className="py-2">
                {permission.sourceRoleIds.length > 0 ? permission.sourceRoleIds.join(', ') : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export function IamViewerPage() {
  const { user, isLoading: isLoadingUser, error: authError, invalidatePermissions } = useAuth();

  const [instanceId, setInstanceId] = React.useState('');
  const [organizationId, setOrganizationId] = React.useState('');
  const [actingAsUserId, setActingAsUserId] = React.useState('');
  const [queryText, setQueryText] = React.useState('');
  const [selectedOrganizationIds, setSelectedOrganizationIds] = React.useState<string[]>([]);

  const [permissions, setPermissions] = React.useState<readonly EffectivePermission[]>([]);
  const [isLoadingPermissions, setIsLoadingPermissions] = React.useState(false);
  const [permissionsError, setPermissionsError] = React.useState<string | null>(null);

  const [authorizeAction, setAuthorizeAction] = React.useState('content.read');
  const [authorizeResourceType, setAuthorizeResourceType] = React.useState('content');
  const [authorizeResourceId, setAuthorizeResourceId] = React.useState('');
  const [authorizeOrganizationId, setAuthorizeOrganizationId] = React.useState('');
  const [authorizeDecision, setAuthorizeDecision] = React.useState<AuthorizeDecisionViewModel | null>(null);
  const [authorizeError, setAuthorizeError] = React.useState<string | null>(null);
  const [isAuthorizing, setIsAuthorizing] = React.useState(false);

  const iamViewerFeatureFlag = isIamViewerEnabled();
  const isAuthorizedAdmin = hasIamViewerAdminRole(user);
  const canAccessViewer = iamViewerFeatureFlag && isAuthorizedAdmin;

  React.useEffect(() => {
    setInstanceId(user?.instanceId ?? '');
  }, [user?.instanceId]);

  React.useEffect(() => {
    if (!canAccessViewer || !instanceId) {
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
            if (!active) {
              return;
            }
          }
          const payload = (await response.json().catch(() => null)) as IamApiErrorPayload | null;
          setPermissions([]);
          setPermissionsError(payload?.error ?? `http_${response.status}`);
          return;
        }

        const payload = (await response.json()) as IamPermissionsResponse;
        setPermissions(payload.permissions);
      } catch (error) {
        if (!active) {
          return;
        }
        setPermissions([]);
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
  }, [actingAsUserId, canAccessViewer, instanceId, invalidatePermissions, organizationId]);

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
      setAuthorizeError('instanceId fehlt.');
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

  if (isLoadingUser) {
    return <p className="text-sm text-slate-300">IAM-Viewer wird initialisiert ...</p>;
  }

  if (authError) {
    return (
      <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200" role="alert">
        {authError.message}
      </div>
    );
  }

  if (!iamViewerFeatureFlag) {
    return (
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
        IAM-Viewer ist deaktiviert. Setze <code>VITE_ENABLE_IAM_ADMIN_VIEWER=true</code>.
      </div>
    );
  }

  if (!isAuthorizedAdmin) {
    return (
      <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200" role="alert">
        Zugriff verweigert: Admin-Rolle erforderlich.
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-100">IAM Rechte-Matrix-Viewer</h1>
        <p className="text-sm text-slate-300">Read-only Analyse von effektiven Berechtigungen und Authorize-Entscheidungen.</p>
      </header>

      <div className="sticky top-2 z-20 rounded-xl border border-slate-800 bg-slate-950/95 p-4 shadow-lg shadow-slate-950/40 backdrop-blur">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs text-slate-300">
            Instance ID
            <input
              className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
              value={instanceId}
              onChange={(event) => setInstanceId(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-300">
            Organization ID (optional)
            <input
              className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
              value={organizationId}
              onChange={(event) => setOrganizationId(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-300">
            actingAsUserId (optional)
            <input
              className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
              value={actingAsUserId}
              onChange={(event) => setActingAsUserId(event.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.3fr_1fr]">
        <article className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">Scope</h2>
          <dl className="space-y-1 text-sm text-slate-300">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-400">Actor</dt>
              <dd className="text-right">{user?.id ?? '-'}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-400">Effective Subject</dt>
              <dd className="text-right">{actingAsUserId.trim() || user?.id || '-'}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-400">Mode</dt>
              <dd className="text-right">{actingAsUserId.trim() ? 'Impersonation' : 'Self'}</dd>
            </div>
          </dl>
          {permissionsError ? (
            <p className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200" role="alert">
              Fehler beim Laden der Berechtigungen: {permissionsError}
            </p>
          ) : null}
        </article>

        <article className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">Effektive Berechtigungen</h2>
            {isLoadingPermissions ? <span className="text-xs text-slate-400">Lade ...</span> : null}
          </div>
          <label className="flex flex-col gap-1 text-xs text-slate-300">
            Filter (Action / Resource / Organization)
            <input
              className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
              value={queryText}
              onChange={(event) => setQueryText(event.target.value)}
            />
          </label>
          {organizationOptions.length > 0 ? (
            <fieldset className="space-y-2">
              <legend className="text-xs text-slate-400">Organization-Filter</legend>
              <div className="flex flex-wrap gap-2">
                {organizationOptions.map((organizationValue) => {
                  const checked = selectedOrganizationIds.includes(organizationValue);
                  return (
                    <label
                      key={`org-filter-${organizationValue || 'none'}`}
                      className="inline-flex items-center gap-2 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleOrganizationFilterToggle(organizationValue)}
                      />
                      {formatOrganizationLabel(organizationValue)}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ) : null}
          <PermissionTable permissions={filteredPermissions} />
        </article>

        <article className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">Authorize-Simulator</h2>
          <form className="space-y-2" onSubmit={handleAuthorizeSubmit}>
            <label className="flex flex-col gap-1 text-xs text-slate-300">
              Action
              <input
                required
                className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                value={authorizeAction}
                onChange={(event) => setAuthorizeAction(event.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-300">
              Resource Type
              <input
                required
                className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                value={authorizeResourceType}
                onChange={(event) => setAuthorizeResourceType(event.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-300">
              Resource ID (optional)
              <input
                className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                value={authorizeResourceId}
                onChange={(event) => setAuthorizeResourceId(event.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-300">
              Organization ID (optional)
              <input
                className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                value={authorizeOrganizationId}
                onChange={(event) => setAuthorizeOrganizationId(event.target.value)}
              />
            </label>
            <button
              type="submit"
              disabled={isAuthorizing}
              className="rounded border border-slate-700 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isAuthorizing ? 'Prüfe ...' : 'Authorize prüfen'}
            </button>
          </form>

          <div aria-live="polite" className="space-y-2">
            {authorizeError ? (
              <p className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200" role="alert">
                Authorize-Fehler: {authorizeError}
              </p>
            ) : null}

            {authorizeDecision ? (
              <div className="rounded border border-slate-700 bg-slate-950/80 p-3">
                <p
                  className={`inline-flex rounded px-2 py-1 text-xs font-semibold ${
                    authorizeDecision.allowed ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
                  }`}
                >
                  {authorizeDecision.allowed ? 'ALLOWED' : 'DENIED'}
                </p>
                <p className="mt-2 text-xs text-slate-300">Reason: {authorizeDecision.reason}</p>
                {authorizeDecision.reasonCode ? (
                  <p className="text-xs text-slate-400">Reason Code: {authorizeDecision.reasonCode}</p>
                ) : null}
                {authorizeDecision.evaluatedAt ? (
                  <p className="text-xs text-slate-500">Evaluated: {authorizeDecision.evaluatedAt}</p>
                ) : null}
                {authorizeDecision.diagnostics ? (
                  <details className="mt-2 text-xs text-slate-300">
                    <summary className="cursor-pointer">Diagnostics</summary>
                    <pre className="mt-2 overflow-x-auto rounded bg-slate-900 p-2 text-[11px] text-slate-200">
                      {JSON.stringify(authorizeDecision.diagnostics, null, 2)}
                    </pre>
                  </details>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-slate-400">Noch keine Authorize-Entscheidung ausgeführt.</p>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}

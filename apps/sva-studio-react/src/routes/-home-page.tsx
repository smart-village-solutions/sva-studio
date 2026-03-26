import React from 'react';
import { useAuth } from '../providers/auth-provider';

type AuthorizeDecision = {
  allowed: boolean;
  reason: string;
};

// TODO: i18n — Labels in dieser Datei lokalisieren (betrifft gesamte HomePage, nicht nur getAuthorizeLabel)
const getAuthorizeLabel = (loading: boolean, decision: AuthorizeDecision | null): string => {
  if (loading) {
    return 'Berechtigung wird geprüft ...';
  }
  if (!decision) {
    return 'Keine Authorize-Entscheidung verfügbar.';
  }
  return decision.allowed
    ? `Erlaubt (${decision.reason})`
    : `Verweigert (${decision.reason})`;
};

export const HomePage = () => {
  const { user, isLoading, error, invalidatePermissions } = useAuth();
  const [authStateError, setAuthStateError] = React.useState<string | null>(null);
  const [routeError, setRouteError] = React.useState<string | null>(null);
  const [authorizeLoading, setAuthorizeLoading] = React.useState(false);
  const [authorizeDecision, setAuthorizeDecision] = React.useState<AuthorizeDecision | null>(null);

  React.useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const authState = search.get('auth');
    const routeErrorCode = search.get('error');
    if (authState === 'error') {
      setAuthStateError('Login fehlgeschlagen. Bitte erneut versuchen.');
    } else if (authState === 'state-expired') {
      setAuthStateError('Login abgebrochen oder abgelaufen. Bitte erneut anmelden.');
    } else {
      setAuthStateError(null);
    }

    if (routeErrorCode === 'auth.insufficientRole') {
      setRouteError('Keine Berechtigung für diese Seite. Bitte wenden Sie sich an die Administration.');
    } else {
      setRouteError(null);
    }
  }, []);

  React.useEffect(() => {
    if (!user?.instanceId) {
      setAuthorizeDecision(null);
      setAuthorizeLoading(false);
      return;
    }

    let active = true;
    const loadAuthorizeDecision = async () => {
      setAuthorizeLoading(true);
      try {
        const authorizeResponse = await fetch('/iam/authorize', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instanceId: user.instanceId,
            action: 'content.read',
            resource: {
              type: 'content',
              id: 'home-dashboard',
            },
            context: {
              requestId: `home-${Date.now()}`,
            },
          }),
        });

        if (!active) {
          return;
        }

        if (authorizeResponse.ok) {
          const decision = (await authorizeResponse.json()) as AuthorizeDecision;
          setAuthorizeDecision(decision);
          return;
        }

        if (authorizeResponse.status === 403) {
          await invalidatePermissions();
          if (!active) {
            return;
          }
        }

        setAuthorizeDecision({
          allowed: false,
          reason: `authorize_http_${authorizeResponse.status}`,
        });
      } catch (cause) {
        if (!active) {
          return;
        }
        setAuthorizeDecision({
          allowed: false,
          reason: cause instanceof Error ? cause.message : String(cause),
        });
      } finally {
        if (active) {
          setAuthorizeLoading(false);
        }
      }
    };

    void loadAuthorizeDecision();
    return () => {
      active = false;
    };
  }, [invalidatePermissions, user?.instanceId]);

  const normalizedRoles = React.useMemo(
    () => new Set((user?.roles ?? []).map((role) => role.trim().toLowerCase())),
    [user?.roles]
  );
  const hasRole = (...roles: string[]) => roles.some((role) => normalizedRoles.has(role.trim().toLowerCase()));
  const authError = authStateError ?? routeError ?? (error ? 'Fehler beim Laden der Session. Bitte erneut anmelden.' : null);

  return (
    <div className="min-h-full bg-background text-foreground">
      <header className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-6 pb-8 pt-10 text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">SVA Studio</h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Smart Village App Self-Service Plattform für Inhalte, Module und Erweiterungen.
        </p>
      </header>
      <section className="mx-auto max-w-5xl px-6 pb-16">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-shell">
          <div className="flex flex-col gap-2">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Demo Session</p>
            {isLoading ? (
              <p className="text-muted-foreground">Lade Session ...</p>
            ) : user ? (
              <div className="flex flex-col gap-1 text-foreground">
                <span className="text-lg font-semibold">{user.id}</span>
                {user.instanceId ? <span className="text-sm text-muted-foreground">Instanz: {user.instanceId}</span> : null}
                <span className="text-sm text-muted-foreground">Rollen: {user.roles.join(', ') || 'keine'}</span>
              </div>
            ) : (
              <p className="text-muted-foreground">Nicht eingeloggt.</p>
            )}
          </div>
          {authError ? (
            <div className="mt-4 rounded-lg border border-secondary/40 bg-secondary/10 px-4 py-3 text-sm text-secondary">
              {authError}
            </div>
          ) : null}
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-background p-4">
              <p className="text-sm font-semibold text-foreground">Admin-Bereich</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {hasRole('admin', 'system_admin')
                  ? 'Admin-Rolle erkannt: Administrationsfunktionen sichtbar.'
                  : 'Nur sichtbar mit Rolle: admin.'}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-background p-4">
              <p className="text-sm font-semibold text-foreground">Editor-Bereich</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {hasRole('editor')
                  ? 'Editor-Rolle erkannt: Redaktionsfunktionen sichtbar.'
                  : 'Nur sichtbar mit Rolle: editor.'}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-background p-4 md:col-span-2">
              <p className="text-sm font-semibold text-foreground">IAM-Authorize (Modulpfad)</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {getAuthorizeLabel(authorizeLoading, authorizeDecision)}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

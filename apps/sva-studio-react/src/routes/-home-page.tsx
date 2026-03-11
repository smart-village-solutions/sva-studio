import React from 'react';
import { useAuth } from '../providers/auth-provider';

export const HomePage = () => {
  const { user, isLoading, error } = useAuth();
  const [authStateError, setAuthStateError] = React.useState<string | null>(null);
  const [routeError, setRouteError] = React.useState<string | null>(null);

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
                <span className="text-lg font-semibold">{user.name}</span>
                {user.email ? <span className="text-sm text-muted-foreground">{user.email}</span> : null}
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
          </div>
        </div>
      </section>
    </div>
  );
};

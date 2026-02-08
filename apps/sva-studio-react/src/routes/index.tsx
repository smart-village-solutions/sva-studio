import { createFileRoute } from '@tanstack/react-router';
import React from 'react';

type AuthUser = {
  name: string;
  email?: string;
  roles: string[];
};

type LogLevel = 'info' | 'warn' | 'error';

const logAuth = (level: LogLevel, message: string, meta: Record<string, unknown> = {}) => {
  if (!import.meta.env.DEV) {
    return;
  }

  const payload = { component: 'auth', ...meta };

  if (level === 'error') {
    console.error(message, payload);
    return;
  }

  if (level === 'warn') {
    console.warn(message, payload);
    return;
  }

  console.info(message, payload);
};

export const HomePage = () => {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [authError, setAuthError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    const search = new URLSearchParams(window.location.search);
    const authState = search.get('auth');
    if (authState === 'error') {
      setAuthError('Login fehlgeschlagen. Bitte erneut versuchen.');
    } else if (authState === 'state-expired') {
      setAuthError('Login abgebrochen oder abgelaufen. Bitte erneut anmelden.');
    } else {
      setAuthError(null);
    }
    const loadUser = async () => {
      try {
        logAuth('info', 'Loading user via /auth/me', {
          route: 'home',
          auth_state: authState ?? 'none'
        });
        const response = await fetch('/auth/me', { credentials: 'include' });

        if (!active) return;

        if (!response.ok) {
          logAuth('warn', 'Auth response not OK', {
            route: 'home',
            status: response.status,
            auth_state: authState ?? 'none'
          });
          setUser(null);
          if (authState === 'ok') {
            setAuthError(
              'Login erfolgreich, aber Session konnte nicht geladen werden. ' +
              'BEKANNTES PROBLEM: TanStack Router blockiert Set-Cookie Headers. ' +
              'Lösung wird mit Redis Session Store implementiert.'
            );
          }
          return;
        }

        const payload = (await response.json()) as { user: AuthUser };
        if (active) {
          setUser(payload.user);
          logAuth('info', 'User loaded', {
            route: 'home',
            has_user: Boolean(payload.user),
            roles_count: payload.user.roles.length
          });
        }
      } catch (error) {
        if (active) {
          setUser(null);
          logAuth('error', 'Failed to load session', {
            route: 'home',
            error_message: error instanceof Error ? error.message : String(error)
          });
          setAuthError('Fehler beim Laden der Session. Bitte erneut anmelden.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadUser();
    return () => {
      active = false;
    };
  }, []);

  const hasRole = (role: string) => user?.roles.includes(role) ?? false;

  return (
    <div className="min-h-full bg-slate-950 text-slate-100">
      <header className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-6 pb-8 pt-10 text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">SVA Studio</h1>
        <p className="max-w-2xl text-lg text-slate-300">
          Smart Village App Self-Service Plattform für Inhalte, Module und Erweiterungen.
        </p>
      </header>
      <section className="mx-auto max-w-5xl px-6 pb-16">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <div className="flex flex-col gap-2">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Demo Session</p>
            {loading ? (
              <p className="text-slate-300">Lade Session ...</p>
            ) : user ? (
              <div className="flex flex-col gap-1 text-slate-200">
                <span className="text-lg font-semibold">{user.name}</span>
                {user.email ? <span className="text-sm text-slate-400">{user.email}</span> : null}
                <span className="text-sm text-slate-400">Rollen: {user.roles.join(', ') || 'keine'}</span>
              </div>
            ) : (
              <p className="text-slate-300">Nicht eingeloggt.</p>
            )}
          </div>
          {authError ? (
            <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              {authError}
            </div>
          ) : null}
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-sm font-semibold text-slate-200">Admin-Bereich</p>
              <p className="mt-2 text-sm text-slate-400">
                {hasRole('admin')
                  ? 'Admin-Rolle erkannt: Administrationsfunktionen sichtbar.'
                  : 'Nur sichtbar mit Rolle: admin.'}
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-sm font-semibold text-slate-200">Editor-Bereich</p>
              <p className="mt-2 text-sm text-slate-400">
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

export const Route = createFileRoute('/')({ component: HomePage });

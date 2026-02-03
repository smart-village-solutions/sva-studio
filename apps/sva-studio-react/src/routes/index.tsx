import { createFileRoute } from '@tanstack/react-router';
import React from 'react';

type AuthUser = {
  name: string;
  email?: string;
  roles: string[];
};

export const HomePage = () => {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    const loadUser = async () => {
      try {
        const response = await fetch('/auth/me', { credentials: 'include' });
        if (!response.ok) {
          if (active) {
            setUser(null);
          }
          return;
        }
        const payload = (await response.json()) as { user: AuthUser };
        if (active) {
          setUser(payload.user);
        }
      } catch {
        if (active) {
          setUser(null);
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

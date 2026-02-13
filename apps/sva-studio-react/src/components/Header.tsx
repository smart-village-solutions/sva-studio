import { Link } from '@tanstack/react-router';
import React from 'react';

type AuthUser = {
  name: string;
  email?: string;
  roles: string[];
};

export default function Header() {
  const [user, setUser] = React.useState<AuthUser | null>(null);

  React.useEffect(() => {
    let active = true;
    const loadUser = async () => {
      try {
        const response = await fetch('/auth/me', { credentials: 'include' });
        if (!response.ok) {
          // Log auth check failure (non-blocking, expected for non-authenticated users)
          if (import.meta.env.DEV) {
            console.info('[Header] Auth check failed', {
              component: 'Header',
              endpoint: '/auth/me',
              status: response.status,
              auth_state: 'unauthenticated',
            });
          }
          if (active) setUser(null);
          return;
        }
        const payload = (await response.json()) as { user: AuthUser };
        if (active) setUser(payload.user);
      } catch (err) {
        // Log unexpected errors (network issues, JSON parse errors, etc.)
        if (import.meta.env.DEV) {
          console.error('[Header] Auth check error', {
            component: 'Header',
            endpoint: '/auth/me',
            error: err instanceof Error ? err.message : String(err),
            error_type: err instanceof Error ? err.constructor.name : typeof err,
          });
        }
        if (active) setUser(null);
      }
    };

    loadUser();
    return () => {
      active = false;
    };
  }, []);

  return (
    <header className="border-b border-slate-800/70 bg-slate-950/80 backdrop-blur">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4 text-sm text-slate-200">
        <Link className="font-semibold tracking-wide text-slate-100" to="/">
          SVA Studio
        </Link>
        <div className="flex items-center gap-4 text-slate-300">
          <Link className="transition hover:text-white" to="/">
            Home
          </Link>
          <Link className="transition hover:text-white" to="/demo">
            Demos
          </Link>
          <Link className="transition hover:text-white" to="/plugins/example">
            Plugin Example
          </Link>
          {!user ? (
            <Link
              className="ml-2 rounded border border-emerald-800/50 bg-emerald-500/10 px-4 py-1 font-semibold text-emerald-400 transition hover:border-emerald-500 hover:bg-emerald-500/20"
              to="/auth/login"
              reloadDocument
            >
              Login
            </Link>
          ) : null}
          <form action="/auth/logout" method="post" className="ml-2">
            <button
              type="submit"
              className="rounded border border-red-800/50 bg-red-500/10 px-4 py-1 font-semibold text-red-400 transition hover:border-red-500 hover:bg-red-500/20"
            >
              Logout
            </button>
          </form>
        </div>
      </nav>
    </header>
  );
}

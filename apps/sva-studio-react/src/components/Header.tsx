/**
 * Header-Komponente der App-Shell mit Hauptnavigation und Auth-Aktion.
 *
 * Die Komponente zeigt abhängig vom Auth-Status eine Login- oder Logout-Aktion
 * und unterstützt einen optionalen Loading-Zustand für Skeleton-Rendering.
 */
import { Link } from '@tanstack/react-router';
import React from 'react';

type AuthUser = {
  id?: string;
  name: string;
  email?: string;
  roles: string[];
};

type HeaderProps = Readonly<{
  isLoading?: boolean;
}>;

const logHeaderInDev = (
  level: 'info' | 'error',
  message: string,
  payload: Record<string, unknown>
) => {
  if (!import.meta.env.DEV) {
    return;
  }

  if (level === 'error') {
    console.error(message, payload);
    return;
  }

  console.info(message, payload);
};

const isIamViewerEnabled = () =>
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_IAM_ADMIN_VIEWER === 'true';
const ADMIN_ROLES = new Set(['admin', 'iam_admin', 'system_admin', 'support_admin']);
const isAdminUser = (user: AuthUser | null | undefined) =>
  Boolean(user && user.roles.some((role) => ADMIN_ROLES.has(role)));

/**
 * Rendert die Kopfzeile inklusive Navigation und Auth-Aktion.
 *
 * @param props - Konfiguration des Header-Verhaltens.
 * @param props.isLoading - Aktiviert Skeleton-Darstellung und unterdrückt Auth-Request.
 */
export default function Header({ isLoading = false }: HeaderProps) {
  const [user, setUser] = React.useState<AuthUser | null | undefined>(undefined);

  React.useEffect(() => {
    if (isLoading) {
      return;
    }

    let active = true;
    /**
     * Lädt den aktuellen Benutzer über `/auth/me` und aktualisiert den lokalen Zustand.
     */
    const loadUser = async () => {
      try {
        const response = await fetch('/auth/me', { credentials: 'include' });
        if (!response.ok) {
          logHeaderInDev('info', '[Header] Auth check failed', {
            component: 'Header',
            endpoint: '/auth/me',
            status: response.status,
            auth_state: 'unauthenticated',
          });
          if (active) setUser(null);
          return;
        }
        const payload = (await response.json()) as { user: AuthUser };
        if (active) setUser(payload.user);
      } catch (err) {
        logHeaderInDev('error', '[Header] Auth check error', {
          component: 'Header',
          endpoint: '/auth/me',
          error: err instanceof Error ? err.message : String(err),
          error_type: err instanceof Error ? err.constructor.name : typeof err,
        });
        if (active) setUser(null);
      }
    };

    loadUser();
    return () => {
      active = false;
    };
  }, [isLoading]);

  let authAction: React.ReactNode = null;

  if (isLoading || user === undefined) {
    authAction = (
      <>
        <span role="status" aria-live="polite" className="sr-only">
          Authentifizierungsstatus wird geladen.
        </span>
        <span aria-hidden="true" className="ml-2 h-8 w-20 animate-pulse rounded-md bg-slate-800" />
      </>
    );
  } else if (user === null) {
    authAction = (
      <Link
        className="ml-2 rounded border border-emerald-800/50 bg-emerald-500/10 px-4 py-1 font-semibold text-emerald-400 transition hover:border-emerald-500 hover:bg-emerald-500/20"
        to="/auth/login"
        reloadDocument
      >
        Login
      </Link>
    );
  } else if (user) {
    authAction = (
      <form action="/auth/logout" method="post" className="ml-2">
        <button
          type="submit"
          className="rounded border border-red-800/50 bg-red-500/10 px-4 py-1 font-semibold text-red-400 transition hover:border-red-500 hover:bg-red-500/20"
        >
          Logout
        </button>
      </form>
    );
  }

  return (
    <header className="border-b border-slate-800/70 bg-slate-950/80 backdrop-blur">
      <nav
        aria-label="Hauptnavigation"
        className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-4 text-sm text-slate-200 sm:px-6"
      >
        <Link className="font-semibold tracking-wide text-slate-100" to="/">
          SVA Studio
        </Link>
        <div className="flex flex-wrap items-center gap-3 text-slate-300 sm:gap-4">
          <Link className="transition hover:text-white" to="/">
            Startseite
          </Link>
          <Link className="transition hover:text-white" to="/demo">
            Demos
          </Link>
          <Link className="transition hover:text-white" to="/plugins/example">
            Plugin-Beispiel
          </Link>
          {isIamViewerEnabled() && isAdminUser(user) ? (
            <Link className="transition hover:text-white" to="/admin/iam">
              IAM-Viewer
            </Link>
          ) : null}
          {authAction}
        </div>
      </nav>
    </header>
  );
}

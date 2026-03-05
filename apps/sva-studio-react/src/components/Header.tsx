/**
 * Header-Komponente der App-Shell mit Hauptnavigation und Auth-Aktion.
 *
 * Die Komponente zeigt abhängig vom Auth-Status eine Login- oder Logout-Aktion
 * und unterstützt einen optionalen Loading-Zustand für Skeleton-Rendering.
 */
import { Link } from '@tanstack/react-router';
import React from 'react';

import { hasIamAdminRole, hasSystemAdminRole, isIamAdminEnabled, isIamUiEnabled } from '../lib/iam-admin-access';
import { hasIamViewerAdminRole, isIamViewerEnabled } from '../lib/iam-viewer-access';
import { useAuth } from '../providers/auth-provider';

type HeaderProps = Readonly<{
  isLoading?: boolean;
}>;

/**
 * Rendert die Kopfzeile inklusive Navigation und Auth-Aktion.
 *
 * @param props - Konfiguration des Header-Verhaltens.
 * @param props.isLoading - Aktiviert Skeleton-Darstellung während Router-Navigation.
 */
export default function Header({ isLoading = false }: HeaderProps) {
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const canAccessAccount = isAuthenticated && isIamUiEnabled();
  const canAccessAdminUsers = isAuthenticated && isIamAdminEnabled() && hasIamAdminRole(user);
  const canAccessAdminRoles = canAccessAdminUsers && hasSystemAdminRole(user);

  let authAction: React.ReactNode = null;

  if (isLoading || isAuthLoading) {
    authAction = (
      <>
        <span role="status" aria-live="polite" className="sr-only">
          Authentifizierungsstatus wird geladen.
        </span>
        <span aria-hidden="true" className="ml-2 h-8 w-20 animate-pulse rounded-md bg-slate-800" />
      </>
    );
  } else if (!isAuthenticated) {
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
          {canAccessAccount ? (
            <Link className="transition hover:text-white" to="/account">
              Konto
            </Link>
          ) : null}
          {canAccessAdminUsers ? (
            <Link className="transition hover:text-white" to="/admin/users">
              Benutzer
            </Link>
          ) : null}
          {canAccessAdminRoles ? (
            <Link className="transition hover:text-white" to="/admin/roles">
              Rollen
            </Link>
          ) : null}
          {isIamViewerEnabled() && hasIamViewerAdminRole(user) ? (
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

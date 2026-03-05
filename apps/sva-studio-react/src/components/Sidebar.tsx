/**
 * Sidebar der App-Shell mit primären Navigationszielen.
 *
 * Die Komponente unterstützt einen Loading-Zustand, in dem Navigations-Skeletons
 * statt interaktiver Links gerendert werden.
 */
import { Link } from '@tanstack/react-router';

import { hasIamAdminRole, hasSystemAdminRole, isIamAdminEnabled, isIamUiEnabled } from '../lib/iam-admin-access';
import { useAuth } from '../providers/auth-provider';

type SidebarProps = Readonly<{
  isLoading?: boolean;
}>;

const sidebarSkeletonKeys = ['sidebar-skeleton-a', 'sidebar-skeleton-b', 'sidebar-skeleton-c', 'sidebar-skeleton-d'];

/**
 * Rendert die Seitenleiste inklusive Navigation oder Skeleton-Platzhaltern.
 *
 * @param props - Konfiguration der Sidebar.
 * @param props.isLoading - Steuert, ob Navigations-Skeletons angezeigt werden.
 */
export default function Sidebar({ isLoading = false }: SidebarProps) {
  const { user, isAuthenticated } = useAuth();
  const canAccessAccount = isAuthenticated && isIamUiEnabled();
  const canAccessAdminUsers = isAuthenticated && isIamAdminEnabled() && hasIamAdminRole(user);
  const canAccessAdminRoles = canAccessAdminUsers && hasSystemAdminRole(user);

  const sidebarLinks: Array<{ to: string; label: string }> = [
    { to: '/', label: 'Übersicht' },
    { to: '/demo', label: 'Demos' },
    { to: '/plugins/example', label: 'Plugin-Beispiel' },
    ...(canAccessAccount ? [{ to: '/account', label: 'Mein Konto' }] : []),
    ...(canAccessAdminUsers ? [{ to: '/admin/users', label: 'Benutzerverwaltung' }] : []),
    ...(canAccessAdminRoles ? [{ to: '/admin/roles', label: 'Rollenverwaltung' }] : []),
    { to: '/admin/api/phase1-test', label: 'Admin-API-Test' },
  ];

  return (
    <aside
      aria-label="Seitenleiste"
      className="w-full border-b border-slate-800/70 bg-slate-950/80 lg:w-64 lg:border-b-0 lg:border-r"
    >
      <div className="px-4 py-4">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Navigation</p>
        <nav aria-label="Bereichsnavigation" className="mt-3">
          {isLoading ? (
            <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
              {sidebarSkeletonKeys.map((key) => (
                <li key={key} className="shrink-0 lg:shrink">
                  <span
                    aria-hidden="true"
                    className="block h-9 w-28 animate-pulse rounded-md border border-slate-800 bg-slate-900 lg:w-full"
                  />
                </li>
              ))}
            </ul>
          ) : (
            <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
              {sidebarLinks.map((item) => (
                <li key={item.to} className="shrink-0 lg:shrink">
                  <Link
                    to={item.to}
                    className="block rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-300 transition hover:border-slate-600 hover:text-white"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </nav>
      </div>
    </aside>
  );
}

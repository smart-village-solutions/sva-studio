import type { RootRoute } from '@tanstack/react-router';
import { Link, Outlet, createRoute } from '@tanstack/react-router';
import { createServerFn, useServerFn } from '@tanstack/react-start';
import React from 'react';

import { AccountProfilePage } from './account/-account-profile-page';
import { Phase1TestPage } from './admin/api/-phase1-test-page';
import { IamViewerPage } from './admin/-iam-page';
import { OrganizationsPage } from './admin/organizations/-organizations-page';
import { RolesPage } from './admin/roles/-roles-page';
import { UserEditPage } from './admin/users/-user-edit-page';
import { UserListPage } from './admin/users/-user-list-page';
import { HomePage } from './-home-page';
import { InterfacesPage } from './interfaces/-interfaces-page';

const DemoSectionLayout = () => (
  <div className="flex flex-col gap-4 text-foreground">
    <Outlet />
  </div>
);

const demoNames = ['Aria', 'Jona', 'Mika', 'Lea', 'Noah'];

const getNames = createServerFn().handler(async () => {
  return demoNames;
});

const submitGreeting = createServerFn({ method: 'POST' })
  .inputValidator((data: { name?: string }) => data)
  .handler(async ({ data }) => {
    const name = data?.name?.trim() || 'Welt';
    return {
      message: `Hallo ${name}!`,
      serverTime: new Date().toISOString(),
    };
  });

const getPunkSongs = () => {
  return [
    { title: 'Holiday in Cambodia', artist: 'Dead Kennedys' },
    { title: 'Rise Above', artist: 'Black Flag' },
    { title: 'Anarchy in the U.K.', artist: 'Sex Pistols' },
  ];
};

const DemoLayout = () => {
  return (
    <div className="flex flex-col gap-6 text-foreground">
      <Outlet />
    </div>
  );
};

const DemoHome = () => {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-2xl font-semibold">TanStack Start Demos</h2>
      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
        <span className="rounded-full border border-border bg-card px-4 py-2 text-xs shadow-shell">Nx Monorepo</span>
        <span className="rounded-full border border-border bg-card px-4 py-2 text-xs shadow-shell">
          TanStack Start
        </span>
        <span className="rounded-full border border-border bg-card px-4 py-2 text-xs shadow-shell">
          Core + Plugins
        </span>
      </div>
      <div className="flex flex-wrap text-sm text-muted-foreground">
        <a
          className="text-sm font-semibold text-primary hover:opacity-80"
          href="https://tanstack.com/start"
          target="_blank"
          rel="noopener noreferrer"
        >
          ☛ TanStack Start Docs
        </a>
      </div>
      <p className="text-muted-foreground">
        Diese Routen entsprechen den Standard-Demos aus dem Start-Template.
      </p>
      <div className="flex flex-wrap gap-3 text-sm text-foreground">
        <Link
          className="rounded border border-border bg-card px-3 py-2 transition hover:bg-muted"
          to="/demo/start/server-funcs"
        >
          Server Functions
        </Link>
        <Link
          className="rounded border border-border bg-card px-3 py-2 transition hover:bg-muted"
          to="/demo/start/api-request"
        >
          API Request
        </Link>
        <Link
          className="rounded border border-border bg-card px-3 py-2 transition hover:bg-muted"
          to="/demo/start/ssr"
        >
          SSR Demos
        </Link>
        <Link
          className="rounded border border-border bg-card px-3 py-2 transition hover:bg-muted"
          to="/demo/api/names"
        >
          API Names
        </Link>
      </div>
    </div>
  );
};

const StartLayout = DemoSectionLayout;

const StartHome = () => {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-2xl font-semibold">Start Demos</h2>
      <p className="text-muted-foreground">Ursprüngliche TanStack Start Beispiele.</p>
    </div>
  );
};

const ServerFuncsDemo = () => {
  const [isHydrated, setIsHydrated] = React.useState(false);
  const [result, setResult] = React.useState<null | {
    message: string;
    serverTime: string;
  }>(null);
  const [loading, setLoading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const runServerFn = useServerFn(submitGreeting);

  React.useEffect(() => {
    setIsHydrated(true);
  }, []);

  const handleRunServerFn = async () => {
    const submittedName = inputRef.current?.value ?? '';
    setLoading(true);
    try {
      const response = await runServerFn({ data: { name: submittedName } });
      setResult(response);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 text-foreground">
      <div className="flex flex-col gap-2">
        <Link
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          to="/demo/start"
        >
          ← Zurück
        </Link>
        <h2 className="text-2xl font-semibold">Server Functions</h2>
        <p className="text-muted-foreground">
          Dieses Beispiel ruft eine serverseitige Funktion auf und liefert eine Antwort zurück.
        </p>
      </div>
      {isHydrated ? (
        <div className="flex flex-col gap-3">
          <input
            className="rounded border border-border bg-background px-4 py-2 text-foreground"
            defaultValue=""
            name="name"
            placeholder="Dein Name"
            ref={inputRef}
          />
          <button
            type="button"
            className="w-fit rounded border border-primary/40 bg-primary/15 px-4 py-2 text-sm font-semibold text-primary"
            disabled={loading}
            onClick={() => {
              void handleRunServerFn();
            }}
          >
            {loading ? 'Sende...' : 'Server Function ausführen'}
          </button>
        </div>
      ) : (
        <div
          aria-hidden="true"
          className="h-20 animate-pulse rounded border border-border bg-card/70"
        />
      )}
      {result ? (
        <div className="rounded border border-border bg-card p-4 shadow-shell">
          <p className="font-semibold text-primary">{result.message}</p>
          <p className="text-sm text-muted-foreground">Serverzeit: {result.serverTime}</p>
        </div>
      ) : null}
    </div>
  );
};

const ApiRequestDemo = () => {
  const [names, setNames] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);
  const runServerFn = useServerFn(getNames);

  const handleLoad = async () => {
    setLoading(true);
    try {
      const response = await runServerFn();
      setNames(response);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 text-foreground">
      <div className="flex flex-col gap-2">
        <Link
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          to="/demo/start"
        >
          ← Zurück
        </Link>
        <h2 className="text-2xl font-semibold">API Request</h2>
        <p className="text-muted-foreground">
          Diese Demo laedt Daten ueber eine serverseitige API-Funktion.
        </p>
      </div>
      <button
        className="w-fit rounded border border-border bg-card px-4 py-2 text-sm text-foreground transition hover:bg-muted"
        onClick={handleLoad}
      >
        {loading ? 'Lade...' : 'Namen laden'}
      </button>
      <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
        {names.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
    </div>
  );
};

const SsrLayout = DemoSectionLayout;

const SsrHome = () => {
  return (
    <div className="flex flex-col gap-4">
      <Link
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        to="/demo/start"
      >
        ← Zurück
      </Link>
      <h2 className="text-2xl font-semibold">SSR Demos</h2>
      <div className="flex flex-wrap gap-3 text-sm text-foreground">
        <Link className="rounded border border-border bg-card px-3 py-2 transition hover:bg-muted" to="/demo/start/ssr/spa-mode">
          SPA Mode
        </Link>
        <Link className="rounded border border-border bg-card px-3 py-2 transition hover:bg-muted" to="/demo/start/ssr/full-ssr">
          Full SSR
        </Link>
        <Link className="rounded border border-border bg-card px-3 py-2 transition hover:bg-muted" to="/demo/start/ssr/data-only">
          Data Only
        </Link>
      </div>
    </div>
  );
};

const SsrSpaMode = () => {
  return (
    <div className="flex flex-col gap-2 text-foreground">
      <Link className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground" to="..">
        ← Zurück
      </Link>
      <h2 className="text-2xl font-semibold">SSR: SPA Mode</h2>
      <p className="text-muted-foreground">Route ohne Loader (nur Client-Render).</p>
    </div>
  );
};

const SsrFull = ({ songs }: { songs: ReturnType<typeof getPunkSongs> }) => {
  return (
    <div className="flex flex-col gap-2 text-foreground">
      <Link className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground" to="..">
        ← Zurück
      </Link>
      <h2 className="text-2xl font-semibold">SSR: Full SSR</h2>
      <p className="text-muted-foreground">Daten werden serverseitig geladen.</p>
      <ul className="mt-4 list-disc space-y-2 pl-6 text-muted-foreground">
        {songs.map((song) => (
          <li key={song.title}>
            {song.title} – {song.artist}
          </li>
        ))}
      </ul>
    </div>
  );
};

const SsrDataOnly = ({ songs }: { songs: ReturnType<typeof getPunkSongs> }) => {
  return (
    <div className="flex flex-col gap-2 text-foreground">
      <Link className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground" to="..">
        ← Zurück
      </Link>
      <h2 className="text-2xl font-semibold">SSR: Data Only</h2>
      <p className="text-muted-foreground">Nur Daten-Loader, keine Side Effects.</p>
      <pre className="mt-4 whitespace-pre-wrap rounded border border-border bg-card p-4 text-xs text-muted-foreground shadow-shell">
        {JSON.stringify(songs, null, 2)}
      </pre>
    </div>
  );
};

const ApiLayout = DemoSectionLayout;

const ApiHome = () => {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-2xl font-semibold">API Demo</h2>
      <p className="text-muted-foreground">Beispiel-Route fuer API Endpoints.</p>
    </div>
  );
};

const ApiNames = ({ names }: { names: string[] }) => {
  return (
    <div className="flex flex-col gap-4 text-foreground">
      <Link
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        to="/demo/api"
      >
        ← Zurück
      </Link>
      <h2 className="text-2xl font-semibold">API Names</h2>
      <ul className="mt-4 list-disc space-y-2 pl-6 text-muted-foreground">
        {names.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
    </div>
  );
};

type AccountUiGuardKey = 'account' | 'adminUsers' | 'adminUserDetail' | 'adminOrganizations' | 'adminRoles';

let accountUiGuardsPromise: Promise<typeof import('@sva/routing')> | null = null;

const getAccountUiGuards = async () => {
  accountUiGuardsPromise ??= import('@sva/routing');
  return accountUiGuardsPromise;
};

const runAccountUiGuard = async (guardKey: AccountUiGuardKey, options: unknown) => {
  const routing = await getAccountUiGuards();
  // Guard-Signatur variiert je nach guardKey — TypeScript kann die Beziehung
  // zwischen Key und Options-Typ nicht statisch auflösen. Runtime-sicher,
  // da guardKey und options immer paarweise aus derselben Factory kommen.
  return routing.accountUiRouteGuards[guardKey](options as never);
};

export const homeRouteFactory = (rootRoute: RootRoute) =>
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: HomePage,
  });

export const runtimeCoreRouteFactories = [
  (rootRoute: RootRoute) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/account',
      beforeLoad: (options) => runAccountUiGuard('account', options),
      component: AccountProfilePage,
    }),
  (rootRoute: RootRoute) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/interfaces',
      component: InterfacesPage,
    }),
  (rootRoute: RootRoute) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/admin/users',
      beforeLoad: (options) => runAccountUiGuard('adminUsers', options),
      component: UserListPage,
    }),
  (rootRoute: RootRoute) => {
    const userEditRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/admin/users/$userId',
      beforeLoad: (options) => runAccountUiGuard('adminUserDetail', options),
      component: () => <UserEditPage userId={userEditRoute.useParams().userId} />,
    });
    return userEditRoute;
  },
  (rootRoute: RootRoute) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/admin/organizations',
      beforeLoad: (options) => runAccountUiGuard('adminOrganizations', options),
      component: OrganizationsPage,
    }),
  (rootRoute: RootRoute) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/admin/roles',
      beforeLoad: (options) => runAccountUiGuard('adminRoles', options),
      component: RolesPage,
    }),
  (rootRoute: RootRoute) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/admin/iam',
      component: IamViewerPage,
    }),
  (rootRoute: RootRoute) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/admin/api/phase1-test',
      component: Phase1TestPage,
    }),
  (rootRoute: RootRoute) => {
    const demoRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/demo',
      component: DemoLayout,
    });

    const demoHomeRoute = createRoute({
      getParentRoute: () => demoRoute,
      path: '/',
      component: DemoHome,
    });

    const startRoute = createRoute({
      getParentRoute: () => demoRoute,
      path: 'start',
      component: StartLayout,
    });

    const startHomeRoute = createRoute({
      getParentRoute: () => startRoute,
      path: '/',
      component: StartHome,
    });

    const serverFuncsRoute = createRoute({
      getParentRoute: () => startRoute,
      path: 'server-funcs',
      component: ServerFuncsDemo,
    });

    const apiRequestRoute = createRoute({
      getParentRoute: () => startRoute,
      path: 'api-request',
      component: ApiRequestDemo,
    });

    const ssrRoute = createRoute({
      getParentRoute: () => startRoute,
      path: 'ssr',
      component: SsrLayout,
    });

    const ssrHomeRoute = createRoute({
      getParentRoute: () => ssrRoute,
      path: '/',
      component: SsrHome,
    });

    const ssrSpaModeRoute = createRoute({
      getParentRoute: () => ssrRoute,
      path: 'spa-mode',
      component: SsrSpaMode,
    });

    const ssrFullRoute = createRoute({
      getParentRoute: () => ssrRoute,
      path: 'full-ssr',
      loader: async () => getPunkSongs(),
      component: () => <SsrFull songs={ssrFullRoute.useLoaderData()} />,
    });

    const ssrDataOnlyRoute = createRoute({
      getParentRoute: () => ssrRoute,
      path: 'data-only',
      loader: async () => getPunkSongs(),
      component: () => <SsrDataOnly songs={ssrDataOnlyRoute.useLoaderData()} />,
    });

    const apiRoute = createRoute({
      getParentRoute: () => demoRoute,
      path: 'api',
      component: ApiLayout,
    });

    const apiHomeRoute = createRoute({
      getParentRoute: () => apiRoute,
      path: '/',
      component: ApiHome,
    });

    const apiNamesRoute = createRoute({
      getParentRoute: () => apiRoute,
      path: 'names',
      loader: async () => getNames(),
      component: () => <ApiNames names={apiNamesRoute.useLoaderData()} />,
    });

    const startRouteTree = startRoute.addChildren([
      startHomeRoute,
      serverFuncsRoute,
      apiRequestRoute,
      ssrRoute.addChildren([ssrHomeRoute, ssrSpaModeRoute, ssrFullRoute, ssrDataOnlyRoute]),
    ]);

    const apiRouteTree = apiRoute.addChildren([apiHomeRoute, apiNamesRoute]);

    return demoRoute.addChildren([demoHomeRoute, startRouteTree, apiRouteTree]);
  },
] as const;

export const coreRouteFactoriesBase = [homeRouteFactory, ...runtimeCoreRouteFactories] as const;
export const coreRouteFactories = coreRouteFactoriesBase;

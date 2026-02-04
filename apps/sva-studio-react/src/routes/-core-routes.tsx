import type { RootRoute } from '@tanstack/react-router';
import { Link, Outlet, createRoute } from '@tanstack/react-router';
import { createServerFn, useServerFn } from '@tanstack/react-start';
import React from 'react';

import { HomePage } from './index';

const demoNames = ['Aria', 'Jona', 'Mika', 'Lea', 'Noah'];

const getNames = createServerFn().handler(async () => {
  return demoNames;
});

const submitGreeting = createServerFn({ method: 'POST' }).handler(async ({ data }) => {
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
    <div className="flex flex-col gap-6 text-slate-100">
      <Outlet />
    </div>
  );
};

const DemoHome = () => {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-2xl font-semibold">TanStack Start Demos</h2>
      <p className="text-slate-300">
        Diese Routen entsprechen den Standard-Demos aus dem Start-Template.
      </p>
      <div className="flex flex-wrap gap-3 text-sm text-slate-300">
        <Link className="rounded border border-slate-800 px-3 py-2" to="/demo/start/server-funcs">
          Server Functions
        </Link>
        <Link className="rounded border border-slate-800 px-3 py-2" to="/demo/start/api-request">
          API Request
        </Link>
        <Link className="rounded border border-slate-800 px-3 py-2" to="/demo/start/ssr">
          SSR Demos
        </Link>
        <Link className="rounded border border-slate-800 px-3 py-2" to="/demo/api/names">
          API Names
        </Link>
      </div>
    </div>
  );
};

const StartLayout = () => {
  return (
    <div className="flex flex-col gap-4 text-slate-100">
      <Outlet />
    </div>
  );
};

const StartHome = () => {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-2xl font-semibold">Start Demos</h2>
      <p className="text-slate-300">Ursprüngliche TanStack Start Beispiele.</p>
    </div>
  );
};

const ServerFuncsDemo = () => {
  const [name, setName] = React.useState('');
  const [result, setResult] = React.useState<null | {
    message: string;
    serverTime: string;
  }>(null);
  const [loading, setLoading] = React.useState(false);

  const runServerFn = useServerFn(submitGreeting);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await runServerFn({ data: { name } });
      setResult(response);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 text-slate-100">
      <div className="flex flex-col gap-2">
        <Link
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200"
          to="../.."
        >
          ← Zurück
        </Link>
        <h2 className="text-2xl font-semibold">Server Functions</h2>
        <p className="text-slate-300">
          Dieses Beispiel ruft eine serverseitige Funktion auf und liefert eine Antwort zurück.
        </p>
      </div>
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <input
          className="rounded border border-slate-800 bg-slate-900 px-4 py-2 text-slate-100"
          placeholder="Dein Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <button
          type="submit"
          className="w-fit rounded bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-900"
          disabled={loading}
        >
          {loading ? 'Sende...' : 'Server Function ausführen'}
        </button>
      </form>
      {result ? (
        <div className="rounded border border-slate-800 bg-slate-900/60 p-4">
          <p className="font-semibold text-emerald-300">{result.message}</p>
          <p className="text-sm text-slate-400">Serverzeit: {result.serverTime}</p>
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
    <div className="flex flex-col gap-6 text-slate-100">
      <div className="flex flex-col gap-2">
        <Link
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200"
          to="../.."
        >
          ← Zurück
        </Link>
        <h2 className="text-2xl font-semibold">API Request</h2>
        <p className="text-slate-300">
          Diese Demo laedt Daten ueber eine serverseitige API-Funktion.
        </p>
      </div>
      <button
        className="w-fit rounded border border-slate-800 px-4 py-2 text-sm text-slate-200"
        onClick={handleLoad}
      >
        {loading ? 'Lade...' : 'Namen laden'}
      </button>
      <ul className="list-disc space-y-2 pl-6 text-slate-300">
        {names.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
    </div>
  );
};

const SsrLayout = () => {
  return (
    <div className="flex flex-col gap-4 text-slate-100">
      <Outlet />
    </div>
  );
};

const SsrHome = () => {
  return (
    <div className="flex flex-col gap-4">
      <Link
        className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200"
        to="../.."
      >
        ← Zurück
      </Link>
      <h2 className="text-2xl font-semibold">SSR Demos</h2>
      <div className="flex flex-wrap gap-3 text-sm text-slate-300">
        <Link className="rounded border border-slate-800 px-3 py-2" to="/demo/start/ssr/spa-mode">
          SPA Mode
        </Link>
        <Link className="rounded border border-slate-800 px-3 py-2" to="/demo/start/ssr/full-ssr">
          Full SSR
        </Link>
        <Link className="rounded border border-slate-800 px-3 py-2" to="/demo/start/ssr/data-only">
          Data Only
        </Link>
      </div>
    </div>
  );
};

const SsrSpaMode = () => {
  return (
    <div className="flex flex-col gap-2 text-slate-100">
      <Link className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200" to="..">
        ← Zurück
      </Link>
      <h2 className="text-2xl font-semibold">SSR: SPA Mode</h2>
      <p className="text-slate-300">Route ohne Loader (nur Client-Render).</p>
    </div>
  );
};

const SsrFull = ({ songs }: { songs: ReturnType<typeof getPunkSongs> }) => {
  return (
    <div className="flex flex-col gap-2 text-slate-100">
      <Link className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200" to="..">
        ← Zurück
      </Link>
      <h2 className="text-2xl font-semibold">SSR: Full SSR</h2>
      <p className="text-slate-300">Daten werden serverseitig geladen.</p>
      <ul className="mt-4 list-disc space-y-2 pl-6 text-slate-300">
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
    <div className="flex flex-col gap-2 text-slate-100">
      <Link className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200" to="..">
        ← Zurück
      </Link>
      <h2 className="text-2xl font-semibold">SSR: Data Only</h2>
      <p className="text-slate-300">Nur Daten-Loader, keine Side Effects.</p>
      <pre className="mt-4 whitespace-pre-wrap rounded border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-300">
        {JSON.stringify(songs, null, 2)}
      </pre>
    </div>
  );
};

const ApiLayout = () => {
  return (
    <div className="flex flex-col gap-4 text-slate-100">
      <Outlet />
    </div>
  );
};

const ApiHome = () => {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-2xl font-semibold">API Demo</h2>
      <p className="text-slate-300">Beispiel-Route fuer API Endpoints.</p>
    </div>
  );
};

const ApiNames = ({ names }: { names: string[] }) => {
  return (
    <div className="flex flex-col gap-4 text-slate-100">
      <Link
        className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200"
        to="../.."
      >
        ← Zurück
      </Link>
      <h2 className="text-2xl font-semibold">API Names</h2>
      <ul className="mt-4 list-disc space-y-2 pl-6 text-slate-300">
        {names.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
    </div>
  );
};

export const coreRouteFactories = [
  (rootRoute: RootRoute) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: HomePage,
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
];

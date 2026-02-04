import { createFileRoute } from '@tanstack/react-router';

export const HomePage = () => {
  return (
    <div className="min-h-full bg-slate-950 text-slate-100">
      <header className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-6 py-20 text-center">
        <img
          src="/tanstack-circle-logo.png"
          className="h-16 w-16 rounded-full border border-slate-800 bg-slate-900 p-2"
          alt="SVA Studio"
        />
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">SVA Studio</h1>
        <p className="max-w-2xl text-lg text-slate-300">
          Smart Village App Self-Service Plattform für Inhalte, Module und Erweiterungen.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-slate-400">
          <span className="rounded-full border border-slate-800 px-4 py-2">Nx Monorepo</span>
          <span className="rounded-full border border-slate-800 px-4 py-2">TanStack Start</span>
          <span className="rounded-full border border-slate-800 px-4 py-2">Core + Plugins</span>
        </div>
        <a
          className="rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-emerald-300"
          href="https://tanstack.com/start"
          target="_blank"
          rel="noopener noreferrer"
        >
          TanStack Start Docs
        </a>
      </header>
    </div>
  );
};

export const Route = createFileRoute('/')({ component: HomePage });

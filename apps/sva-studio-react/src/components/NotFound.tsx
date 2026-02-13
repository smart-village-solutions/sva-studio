import { Link } from '@tanstack/react-router';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <h1 className="mb-4 text-6xl font-bold text-slate-300">404</h1>
      <h2 className="mb-6 text-2xl font-semibold text-slate-400">
        Seite nicht gefunden
      </h2>
      <p className="mb-8 text-slate-500">
        Die angeforderte Seite existiert nicht oder wurde verschoben.
      </p>
      <Link
        to="/"
        className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700"
      >
        Zur Startseite
      </Link>
    </div>
  );
}

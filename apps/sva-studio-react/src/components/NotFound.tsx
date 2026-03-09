import { Link } from '@tanstack/react-router';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <h1 className="mb-4 text-6xl font-bold text-foreground">404</h1>
      <h2 className="mb-6 text-2xl font-semibold text-muted-foreground">
        Seite nicht gefunden
      </h2>
      <p className="mb-8 text-muted-foreground">
        Die angeforderte Seite existiert nicht oder wurde verschoben.
      </p>
      <Link
        to="/"
        className="rounded-lg border border-primary/40 bg-primary px-6 py-3 font-medium text-primary-foreground transition hover:opacity-90"
      >
        Zur Startseite
      </Link>
    </div>
  );
}

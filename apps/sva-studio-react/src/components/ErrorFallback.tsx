import { Link, useRouter } from '@tanstack/react-router';
import type { ErrorComponentProps } from '@tanstack/react-router';

/**
 * Globaler Error-Fallback für nicht abgefangene Fehler in der Route-Hierarchie.
 *
 * Zeigt eine benutzerfreundliche Fehlermeldung und bietet Optionen zur Wiederherstellung.
 * Technische Details werden NICHT an den Benutzer weitergegeben.
 */
export default function ErrorFallback({ error, reset }: Readonly<ErrorComponentProps>) {
  const router = useRouter();

  const handleRetry = () => {
    reset();
    router.invalidate();
  };

  // Fehler nur in Development loggen; in Produktion wird der Fehler
  // über das zentrale Error-Tracking (OTel/SDK) erfasst.
  if (import.meta.env.DEV && error) {
    console.error('[ErrorFallback]', error);
  }

  return (
    <div
      role="alert"
      className="flex min-h-[60vh] flex-col items-center justify-center text-center"
    >
      <h1 className="mb-4 text-6xl font-bold text-destructive">Fehler</h1>
      <h2 className="mb-6 text-2xl font-semibold text-muted-foreground">
        Ein unerwarteter Fehler ist aufgetreten
      </h2>
      <p className="mb-8 text-muted-foreground">
        Bitte versuchen Sie es erneut oder kehren Sie zur Startseite zurück.
      </p>
      <div className="flex gap-4">
        <button
          type="button"
          onClick={handleRetry}
          className="rounded-lg border border-primary/40 bg-primary px-6 py-3 font-medium text-primary-foreground transition hover:opacity-90"
        >
          Erneut versuchen
        </button>
        <Link
          to="/"
          className="rounded-lg border border-border bg-background px-6 py-3 font-medium text-foreground transition hover:bg-muted"
        >
          Zur Startseite
        </Link>
      </div>
    </div>
  );
}

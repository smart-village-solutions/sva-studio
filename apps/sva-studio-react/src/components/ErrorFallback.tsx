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
      <h1 className="mb-4 text-6xl font-bold text-red-400">Fehler</h1>
      <h2 className="mb-6 text-2xl font-semibold text-slate-400">
        Ein unerwarteter Fehler ist aufgetreten
      </h2>
      <p className="mb-8 text-slate-500">
        Bitte versuchen Sie es erneut oder kehren Sie zur Startseite zurück.
      </p>
      <div className="flex gap-4">
        <button
          type="button"
          onClick={handleRetry}
          className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700"
        >
          Erneut versuchen
        </button>
        <Link
          to="/"
          className="rounded-lg border border-slate-600 px-6 py-3 font-medium text-slate-300 transition-colors hover:bg-slate-800"
        >
          Zur Startseite
        </Link>
      </div>
    </div>
  );
}

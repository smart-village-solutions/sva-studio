/**
 * In-Flight-Deduplizierung für /auth/me-Anfragen.
 *
 * AuthProvider und Router-Guards feuern /auth/me oft gleichzeitig beim
 * ersten Render. Dieses Modul stellt sicher, dass parallele Aufrufe nur
 * einen einzigen Netzwerk-Request auslösen. Nach Auflösung des Promises
 * wird der In-Flight-Zustand geleert, sodass sequenzielle Folgeaufrufe
 * (z. B. nach SSO-Recovery) stets einen frischen Request erhalten.
 *
 * Scope: Browser-Modul-Singleton. Serverseitig wird jede Anfrage per
 * TanStack-Start-Request-Kontext isoliert – keine Deduplizierung nötig.
 */

export type AuthMeResult = {
  readonly ok: boolean;
  readonly status: number;
  readonly payload: unknown;
};

type FetchFn = () => Promise<Response>;

let inFlight: Promise<AuthMeResult> | null = null;

/**
 * Führt einen /auth/me-Fetch durch. Parallele Aufrufe teilen sich ein
 * gemeinsames Promise – `fetchFn` wird nur einmal aufgerufen.
 */
export const fetchAuthMeSingleFlight = (fetchFn: FetchFn): Promise<AuthMeResult> => {
  if (inFlight !== null) {
    return inFlight;
  }

  inFlight = fetchFn()
    .then(async (response): Promise<AuthMeResult> => {
      const payload = response.ok ? ((await response.json()) as unknown) : null;
      return { ok: response.ok, status: response.status, payload };
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
};

/**
 * Setzt den In-Flight-Zustand zurück.
 * Ausschließlich für Tests – nicht im Produktionscode verwenden.
 */
export const _resetAuthMeSingleFlight = (): void => {
  inFlight = null;
};

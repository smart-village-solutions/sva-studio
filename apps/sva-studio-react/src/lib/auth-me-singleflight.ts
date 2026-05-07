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

import type { IamHttpError } from './iam-api';
import { readIamErrorResponse } from './iam-api';

export type AuthMeResult = {
  readonly error?: IamHttpError;
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
      if (response.ok) {
        return {
          ok: true,
          status: response.status,
          payload: (await response.json()) as unknown,
        };
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        const error = await readIamErrorResponse(response);
        return {
          error,
          ok: false,
          payload: null,
          status: response.status,
        };
      }

      return { ok: false, status: response.status, payload: null };
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

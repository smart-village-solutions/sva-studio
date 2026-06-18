import { MainserverUserProvisioningError } from './mainserver-user-provisioning-error.js';

export type MainserverErrorPayload = {
  readonly code?: string;
  readonly message?: string;
  readonly retryable?: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isAbortError = (error: unknown): boolean =>
  error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError');

export const fetchMainserverUpstream = async (input: {
  readonly fetchImpl: typeof fetch;
  readonly url: string;
  readonly init: RequestInit;
  readonly signal: AbortSignal;
  readonly timeoutMessage: string;
}): Promise<Response> => {
  try {
    return await input.fetchImpl(input.url, {
      ...input.init,
      redirect: 'manual',
      signal: input.signal,
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new MainserverUserProvisioningError({
        code: 'upstream_timeout',
        message: input.timeoutMessage,
        statusCode: 504,
        retryable: true,
      });
    }

    throw error;
  }
};

export const parseMainserverJsonBody = async <T>(
  response: Response,
  invalidResponseMessage: string
): Promise<T> => {
  try {
    return (await response.json()) as T;
  } catch {
    throw new MainserverUserProvisioningError({
      code: 'invalid_response',
      message: invalidResponseMessage,
      statusCode: 502,
    });
  }
};

export const readMainserverErrorPayload = async (
  response: Response,
  invalidResponseMessage: string
): Promise<MainserverErrorPayload> => {
  const payload = await parseMainserverJsonBody<unknown>(response, invalidResponseMessage).catch(() => null);
  if (!isRecord(payload)) {
    return {};
  }

  return {
    code: typeof payload.code === 'string' ? payload.code : undefined,
    message: typeof payload.message === 'string' ? payload.message : undefined,
    retryable: typeof payload.retryable === 'boolean' ? payload.retryable : undefined,
  };
};

export const createProvisioningErrorFromResponse = async (
  response: Response
): Promise<never> => {
  const errorPayload = await readMainserverErrorPayload(
    response,
    'Ungültige Antwort des SVA-Mainserver-Provisionings.'
  );

  throw new MainserverUserProvisioningError({
    code: errorPayload.code ?? 'mainserver_user_provisioning_failed',
    message: errorPayload.message ?? `Mainserver-Benutzer-Provisioning fehlgeschlagen (${response.status}).`,
    statusCode: response.status,
    retryable: errorPayload.retryable ?? response.status >= 500,
  });
};

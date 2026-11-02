export type ParsedValue<T> = T | Response;

export type RouteMatch<ContentKind extends string> =
  | { readonly kind: 'collection'; readonly contentKind: ContentKind }
  | { readonly kind: 'item'; readonly contentKind: ContentKind; readonly itemId: string };

export const json = (body: unknown, status = 200): Response =>
  Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
    },
  });

export const errorJson = (
  status: number,
  error: string,
  message: string,
  details?: unknown
): Response => {
  const response = json({ error, message, ...(details === undefined ? {} : { details }) }, status);
  // These host-only validations run before any provider mutation. Generic 4xx
  // and provider errors can follow a partial write and must remain ambiguous.
  if (
    (status === 400 && error === 'invalid_request') ||
    (status === 403 && error === 'csrf_validation_failed') ||
    (status === 409 && error === 'stale_mainserver_context')
  ) {
    response.headers.set('X-SVA-Mutation-Outcome', 'not_applied');
  }
  return response;
};

const decodePathSegment = (value: string): string | null => {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
};

export const matchRequestRoute = <ContentKind extends string>(
  request: Request,
  collectionPath: string,
  contentKind: ContentKind
): RouteMatch<ContentKind> | null => {
  const pathname = new URL(request.url).pathname;
  if (pathname === collectionPath) {
    return { kind: 'collection', contentKind };
  }

  const prefix = `${collectionPath}/`;
  if (pathname.startsWith(prefix)) {
    const itemId = decodePathSegment(pathname.slice(prefix.length));
    if (itemId !== null && itemId.length > 0 && itemId.includes('/') === false) {
      return { kind: 'item', contentKind, itemId };
    }
  }

  return null;
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && Array.isArray(value) === false;

export const isResponse = <T>(value: ParsedValue<T>): value is Response =>
  value instanceof Response;

export const readString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

export const isTimeOfDay = (value: string): boolean => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);

export const readBoolean = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined;

export const readNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

export const parseJsonObjectBody = async (
  request: Request,
  message: string
): Promise<Record<string, unknown> | Response> => {
  const body = (await request.json().catch(() => null)) as unknown;
  return isRecord(body) ? body : errorJson(400, 'invalid_request', message);
};

export const createApiErrorResponse = (
  status: number,
  code: string,
  message: string,
  requestId?: string,
  details?: unknown,
) =>
  new Response(JSON.stringify({ error: { code, message, ...(details ? { details } : {}) }, requestId }), {
    status,
    headers: { 'content-type': 'application/json' },
  });

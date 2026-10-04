export const INVALID_REQUEST_MESSAGE = 'Ungültige Anfrage.';

export const jsonResponse = (payload: unknown, status = 200): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
  });

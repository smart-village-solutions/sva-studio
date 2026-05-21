import { HttpResponse, http, type RequestHandler } from 'msw';

export { HttpResponse, http };

export const studioMswHandlers: RequestHandler[] = [
  http.get('https://studio.test/health', () => {
    return HttpResponse.json({ status: 'base' }, { status: 200 });
  }),
];

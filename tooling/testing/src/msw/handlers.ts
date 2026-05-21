import { HttpResponse, http, type RequestHandler } from 'msw';

export { HttpResponse, http };

const studioMswHandlers: readonly RequestHandler[] = Object.freeze([
  http.get('https://studio.test/health', () => {
    return HttpResponse.json({ status: 'base' }, { status: 200 });
  }),
]);

export const getStudioMswHandlers = (): readonly RequestHandler[] => {
  return [...studioMswHandlers];
};

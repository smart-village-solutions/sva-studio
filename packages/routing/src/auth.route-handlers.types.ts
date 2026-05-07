import { authRoutePaths } from './auth.routes.js';

export type AuthHandlers = {
  GET?: (ctx: { request: Request }) => Promise<Response> | Response;
  POST?: (ctx: { request: Request }) => Promise<Response> | Response;
  PUT?: (ctx: { request: Request }) => Promise<Response> | Response;
  PATCH?: (ctx: { request: Request }) => Promise<Response> | Response;
  DELETE?: (ctx: { request: Request }) => Promise<Response> | Response;
};

export type AuthRoutePath = (typeof authRoutePaths)[number];

export type RouteGuardLogger = {
  warn: (message: string, meta: Record<string, unknown>) => void;
};

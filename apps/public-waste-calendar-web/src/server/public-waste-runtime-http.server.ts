import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { type PublicWasteBootstrapState } from '../lib/public-waste-bootstrap.server.js';
import { resolvePublicWasteReadApiRoute } from '../lib/public-waste-api-routing.js';
import {
  handlePublicWasteCalendarRequest,
  handlePublicWasteIcalRequest,
  handlePublicWasteLocationsRequest,
  handlePublicWastePdfRequest,
  handlePublicWasteRegionsRequest,
  handlePublicWasteReminderSignupRequest,
  handlePublicWasteSelectionRequest,
} from '../lib/public-waste-endpoints.server.js';
import type {
  PublicWasteRuntimeRepository,
  PublicWastePdfStaticConfig,
  PublicWastePdfStaticConfigLoaderOptions,
  PublicWasteBrandingImageLoader,
  PublicWasteReminderSignupSubmitter,
} from './public-waste-runtime.js';

const staticMimeTypes: Readonly<Record<string, string>> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
};

export const jsonResponse = (payload: unknown, status = 200): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
  });

export const isPublicWasteApiPath = (pathname: string): boolean =>
  resolvePublicWasteReadApiRoute(pathname) !== null ||
  pathname.startsWith('/api/public-waste/reminder-signups');

// Only the existing public API, never confirmation/unsubscribe pages, is exposed.
export const isPublicWasteCorsApiPath = (pathname: string): boolean =>
  resolvePublicWasteReadApiRoute(pathname) !== null ||
  pathname === '/api/public-waste/reminder-signups';

export const withPublicWasteCors = (response: Response): Response => {
  response.headers.set('access-control-allow-origin', '*');
  response.headers.set('access-control-expose-headers', 'Content-Disposition');
  return response;
};

export const createPublicWastePreflightResponse = (pathname: string): Response =>
  withPublicWasteCors(
    new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-methods':
          pathname === '/api/public-waste/reminder-signups' ? 'POST' : 'GET, HEAD',
        'access-control-allow-headers': 'Content-Type',
      },
    })
  );

export const createInvalidConfigResponse = (bootstrapState: PublicWasteBootstrapState): Response =>
  jsonResponse(
    {
      error: bootstrapState.status === 'error' ? bootstrapState.reason : 'invalid_config',
      message:
        bootstrapState.status === 'error' ? bootstrapState.message : 'Konfiguration ist ungültig.',
    },
    500
  );

export const createMethodNotAllowedResponse = (): Response =>
  new Response('Method Not Allowed', {
    status: 405,
    headers: {
      allow: 'GET, HEAD, POST',
      'content-type': 'text/plain; charset=utf-8',
    },
  });

export const toHeadResponse = (response: Response): Response =>
  new Response(null, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
const resolveStaticAssetPath = (assetsDir: string, pathname: string): string => {
  const relativePath =
    pathname === '/' || extname(pathname).length === 0 ? '/index.html' : pathname;
  const normalizedPath = relativePath.replace(/\\/g, '/');
  const absolutePath = resolve(assetsDir, `.${normalizedPath}`);
  const rootPath = resolve(assetsDir);

  if (absolutePath !== rootPath && !absolutePath.startsWith(`${rootPath}${sep}`)) {
    throw new Error('invalid_public_waste_asset_path');
  }

  return absolutePath;
};

export const serveStaticAsset = async (input: {
  readonly assetsDir: string;
  readonly pathname: string;
  readonly method: string;
}): Promise<Response> => {
  const filePath = resolveStaticAssetPath(input.assetsDir, input.pathname);

  try {
    const body = input.method === 'HEAD' ? null : await readFile(filePath);
    const response = new Response(body, {
      status: 200,
      headers: {
        'content-type': staticMimeTypes[extname(filePath)] ?? 'application/octet-stream',
      },
    });
    return ['.js', '.css'].includes(extname(filePath)) ? withPublicWasteCors(response) : response;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return new Response('Not Found', {
        status: 404,
        headers: {
          'content-type': 'text/plain; charset=utf-8',
        },
      });
    }

    throw error;
  }
};

export const dispatchPublicWasteApiRequest = async (input: {
  readonly request: Request;
  readonly pathname: string;
  readonly repository: PublicWasteRuntimeRepository;
  readonly bootstrapState: Extract<PublicWasteBootstrapState, { status: 'ready' }>;
  readonly loadPdfStaticConfig?: (
    instanceId: string,
    options?: PublicWastePdfStaticConfigLoaderOptions
  ) => Promise<PublicWastePdfStaticConfig>;
  readonly loadBrandingImage?: PublicWasteBrandingImageLoader;
  readonly submitReminderSignup?: PublicWasteReminderSignupSubmitter;
}): Promise<Response> => {
  const readApiRoute = resolvePublicWasteReadApiRoute(input.pathname);

  if (readApiRoute === 'locations') {
    return handlePublicWasteLocationsRequest({
      repository: input.repository,
    });
  }

  if (readApiRoute === 'regions') {
    return handlePublicWasteRegionsRequest({
      repository: input.repository,
    });
  }

  if (readApiRoute === 'selection') {
    return handlePublicWasteSelectionRequest({
      repository: input.repository,
      request: input.request,
    });
  }

  if (readApiRoute === 'calendar') {
    return handlePublicWasteCalendarRequest({
      repository: input.repository,
      request: input.request,
      reminderConfig: input.bootstrapState.config.emailReminderConfig,
    });
  }

  if (readApiRoute === 'pdf') {
    return handlePublicWastePdfRequest({
      repository: input.repository,
      request: input.request,
      loadPdfStaticConfig: async () =>
        await (input.loadPdfStaticConfig?.(input.bootstrapState.config.instanceId, {
          getDatabaseUrl: () => input.bootstrapState.config.database.databaseUrl,
          getSchemaName: () => input.bootstrapState.config.database.schemaName,
        }) ?? {}),
      loadBrandingImage: input.loadBrandingImage,
    });
  }

  if (input.pathname.startsWith('/api/public-waste/reminder-signups')) {
    return handlePublicWasteReminderSignupRequest({
      repository: input.repository,
      request: input.request,
      reminderConfig: input.bootstrapState.config.emailReminderConfig,
      submitReminderSignup: input.submitReminderSignup,
    });
  }

  if (readApiRoute === 'ical') {
    return handlePublicWasteIcalRequest({
      repository: input.repository,
      request: input.request,
    });
  }

  return new Response('Not Found', { status: 404 });
};

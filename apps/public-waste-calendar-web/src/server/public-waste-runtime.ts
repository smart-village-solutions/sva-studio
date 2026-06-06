import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { Pool } from 'pg';

import {
  readPublicWasteBootstrapStateFromEnvironment,
  type PublicWasteBootstrapState,
} from '../lib/public-waste-bootstrap.server.js';
import { type PublicWasteConfig } from '../lib/public-waste-config.server.js';
import {
  handlePublicWasteCalendarRequest,
  handlePublicWasteIcalRequest,
  handlePublicWasteSelectionRequest,
} from '../lib/public-waste-endpoints.server.js';
import { createPublicWasteRepository, type PublicWasteRepository } from '../lib/public-waste-repository.server.js';

export const PUBLIC_WASTE_RUNTIME_APP_NAME = 'public-waste-calendar-web';

type PublicWasteRuntimeRepository = Pick<
  PublicWasteRepository,
  'listSelectionOptions' | 'loadCalendarEntries' | 'loadSelectionSummary'
>;

type RepositoryHandle = {
  readonly repository: PublicWasteRuntimeRepository;
  readonly dispose: () => Promise<void>;
};

type RepositoryFactory = (config: PublicWasteConfig) => Promise<RepositoryHandle> | RepositoryHandle;

export type PublicWasteRuntime = {
  readonly bootstrapState: PublicWasteBootstrapState;
  handle: (request: Request) => Promise<Response>;
  dispose: () => Promise<void>;
};

const publicWasteApiPrefixes = [
  '/api/public-waste/selection',
  '/api/public-waste/calendar',
  '/api/public-waste/ical',
] as const;

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

const jsonResponse = (payload: unknown, status = 200): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
  });

const createRepositoryHandle = async (config: PublicWasteConfig): Promise<RepositoryHandle> => {
  const pool = new Pool({
    connectionString: config.supabase.databaseUrl,
    max: 4,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 5_000,
  });

  return {
    repository: createPublicWasteRepository({
      schemaName: config.supabase.schemaName,
      execute: async <TRow = Record<string, unknown>>(input: {
        readonly text: string;
        readonly values?: readonly unknown[];
      }) => {
        const result = await pool.query(input.text, input.values ? [...input.values] : undefined);
        return {
          rowCount: result.rowCount ?? 0,
          rows: result.rows as readonly TRow[],
        };
      },
    }),
    dispose: async () => {
      await pool.end();
    },
  };
};

const isPublicWasteApiPath = (pathname: string): boolean =>
  publicWasteApiPrefixes.some((prefix) => pathname.startsWith(prefix));

const createInvalidConfigResponse = (bootstrapState: PublicWasteBootstrapState): Response =>
  jsonResponse(
    {
      error: bootstrapState.status === 'error' ? bootstrapState.reason : 'invalid_config',
      message: bootstrapState.status === 'error' ? bootstrapState.message : 'Konfiguration ist ungültig.',
    },
    500
  );

const createMethodNotAllowedResponse = (): Response =>
  new Response('Method Not Allowed', {
    status: 405,
    headers: {
      allow: 'GET, HEAD',
      'content-type': 'text/plain; charset=utf-8',
    },
  });

const toHeadResponse = (response: Response): Response =>
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

const serveStaticAsset = async (input: {
  readonly assetsDir: string;
  readonly pathname: string;
  readonly method: string;
}): Promise<Response> => {
  const filePath = resolveStaticAssetPath(input.assetsDir, input.pathname);

  try {
    const body = input.method === 'HEAD' ? null : await readFile(filePath);
    return new Response(body, {
      status: 200,
      headers: {
        'content-type': staticMimeTypes[extname(filePath)] ?? 'application/octet-stream',
      },
    });
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

export const createPublicWasteRuntime = async (input: {
  readonly assetsDir: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly createRepository?: RepositoryFactory;
}): Promise<PublicWasteRuntime> => {
  const bootstrapState = readPublicWasteBootstrapStateFromEnvironment({
    env: input.env,
  });
  const repositoryHandle =
    bootstrapState.status === 'ready'
      ? await (input.createRepository ?? createRepositoryHandle)(bootstrapState.config)
      : null;

  return {
    bootstrapState,
    async handle(request) {
      const url = new URL(request.url);
      const method = request.method.toUpperCase();

      if (method !== 'GET' && method !== 'HEAD') {
        return createMethodNotAllowedResponse();
      }

      if (url.pathname === '/health/live') {
        const response = jsonResponse({
          status: 'ok',
          app: PUBLIC_WASTE_RUNTIME_APP_NAME,
          instanceId: bootstrapState.status === 'ready' ? bootstrapState.config.instanceId : null,
        });

        return method === 'HEAD' ? toHeadResponse(response) : response;
      }

      if (isPublicWasteApiPath(url.pathname)) {
        if (bootstrapState.status !== 'ready' || !repositoryHandle) {
          return createInvalidConfigResponse(bootstrapState);
        }

        let response: Response;
        if (url.pathname.startsWith('/api/public-waste/selection')) {
          response = await handlePublicWasteSelectionRequest({
            repository: repositoryHandle.repository,
            request,
          });
        } else if (url.pathname.startsWith('/api/public-waste/calendar')) {
          response = await handlePublicWasteCalendarRequest({
            repository: repositoryHandle.repository,
            request,
            pdfUrlTemplate: bootstrapState.config.pdf.urlTemplate,
          });
        } else {
          response = await handlePublicWasteIcalRequest({
            repository: repositoryHandle.repository,
            request,
          });
        }

        return method === 'HEAD' ? toHeadResponse(response) : response;
      }

      return serveStaticAsset({
        assetsDir: input.assetsDir,
        pathname: url.pathname,
        method,
      });
    },
    async dispose() {
      await repositoryHandle?.dispose();
    },
  };
};

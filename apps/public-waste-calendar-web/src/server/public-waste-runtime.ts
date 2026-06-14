import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { Pool } from 'pg';
import type { WasteManagementEmailReminderConfig } from '@sva/core';
import { createWasteEmailReminderRepository } from '@sva/data-repositories';
import type { PublicWasteReminderSignupRequest, PublicWasteReminderSignupResponse } from '../lib/public-waste-contract.js';

import {
  readPublicWasteBootstrapStateFromEnvironment,
  type PublicWasteBootstrapState,
} from '../lib/public-waste-bootstrap.server.js';
import { type PublicWasteConfig } from '../lib/public-waste-config.server.js';
import {
  handlePublicWasteCalendarRequest,
  handlePublicWasteIcalRequest,
  handlePublicWastePdfRequest,
  handlePublicWasteReminderSignupRequest,
  handlePublicWasteSelectionRequest,
} from '../lib/public-waste-endpoints.server.js';
import type { WasteCalendarPdfBrandingImage } from '@sva/core/waste-output';
import { createPublicWasteRepository, type PublicWasteRepository } from '../lib/public-waste-repository.server.js';
import {
  createPublicWasteReminderPageHandler,
  createPublicWasteReminderSignupRateLimitConsumer,
  createPublicWasteReminderSignupSubmitter,
} from './public-waste-email-reminders.server.js';

export const PUBLIC_WASTE_RUNTIME_APP_NAME = 'public-waste-calendar-web';

type PublicWasteRuntimeRepository = Pick<
  PublicWasteRepository,
  'listSelectionOptions' | 'loadCalendarEntries' | 'loadSelectionSummary' | 'loadReminderSignupOptions'
>;

type RepositoryHandle = {
  readonly repository: PublicWasteRuntimeRepository;
  readonly pool: Pool;
  readonly schemaName: string;
  readonly dispose: () => Promise<void>;
};

type RepositoryFactory = (config: PublicWasteConfig) => Promise<RepositoryHandle> | RepositoryHandle;
type PublicWastePdfStaticConfig = { readonly brandingAssetUrl?: string; readonly contactBlock?: string };
type PublicWasteBrandingImageLoader = (input: {
  readonly assetUrl: string;
  readonly requestUrl: string;
}) => Promise<WasteCalendarPdfBrandingImage | undefined>;
type PublicWasteReminderSignupSubmitter = (input: {
  readonly request: Request;
  readonly payload: PublicWasteReminderSignupRequest;
  readonly reminderConfig: WasteManagementEmailReminderConfig;
  readonly repository: Pick<PublicWasteRepository, 'loadSelectionSummary'>;
}) => Promise<PublicWasteReminderSignupResponse>;
type PublicWasteReminderPageHandler = (input: {
  readonly request: Request;
  readonly pathname: string;
  readonly reminderConfig: WasteManagementEmailReminderConfig;
}) => Promise<Response | null>;
export type PublicWasteRuntime = {
  readonly bootstrapState: PublicWasteBootstrapState;
  handle: (request: Request) => Promise<Response>;
  dispose: () => Promise<void>;
};

const publicWasteApiPrefixes = [
  '/api/public-waste/selection',
  '/api/public-waste/calendar',
  '/api/public-waste/pdf',
  '/api/public-waste/ical',
  '/api/public-waste/reminder-signups',
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

const schemaIdentifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;

const quoteIdentifier = (value: string): string => {
  if (!schemaIdentifierPattern.test(value)) {
    throw new Error(`invalid_waste_schema:${value}`);
  }
  return `"${value}"`;
};

const createRepositoryHandle = async (config: PublicWasteConfig): Promise<RepositoryHandle> => {
  const pool = new Pool({
    connectionString: config.supabase.databaseUrl,
    max: 4,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 5_000,
  });

  return {
    pool,
    schemaName: config.supabase.schemaName,
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

const createDefaultReminderSignupSubmitter = (input: {
  readonly repositoryHandle: RepositoryHandle;
}): PublicWasteReminderSignupSubmitter => {
  const consumeRateLimit = createPublicWasteReminderSignupRateLimitConsumer();
  return createPublicWasteReminderSignupSubmitter({
    countExistingSubscriptions: async (payload) => {
      const executor = createReminderRepositoryExecutor({
        pool: input.repositoryHandle.pool,
        schemaName: input.repositoryHandle.schemaName,
      });
      return await executor.executeWithinTransaction(
        async (repository) => await repository.countSubscriptionsForEmailLocation(payload)
      );
    },
    consumeRateLimit,
    persistPendingSignup: async (signup) => {
      const client = await input.repositoryHandle.pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`SET LOCAL search_path TO ${quoteIdentifier(input.repositoryHandle.schemaName)}, public`);
        const repository = createWasteEmailReminderRepository({
          execute: async <TRow = Record<string, unknown>>(statement: {
            readonly text: string;
            readonly values?: readonly unknown[];
          }) => {
            const result = await client.query(statement.text, statement.values ? [...statement.values] : undefined);
            return {
              rowCount: result.rowCount ?? 0,
              rows: result.rows as readonly TRow[],
            };
          },
        });
        await repository.createPendingSignup(signup);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  });
};

const createReminderRepositoryExecutor = (input: { readonly pool: Pool; readonly schemaName: string }) => ({
  async executeWithinTransaction<TResult>(
    callback: (repository: ReturnType<typeof createWasteEmailReminderRepository>) => Promise<TResult>
  ): Promise<TResult> {
    const client = await input.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL search_path TO ${quoteIdentifier(input.schemaName)}, public`);
      const repository = createWasteEmailReminderRepository({
        execute: async <TRow = Record<string, unknown>>(statement: {
          readonly text: string;
          readonly values?: readonly unknown[];
        }) => {
          const result = await client.query(statement.text, statement.values ? [...statement.values] : undefined);
          return {
            rowCount: result.rowCount ?? 0,
            rows: result.rows as readonly TRow[],
          };
        },
      });
      const result = await callback(repository);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },
});

const createDefaultReminderPageHandler = (input: {
  readonly repositoryHandle: RepositoryHandle;
}): PublicWasteReminderPageHandler => {
  const executor = createReminderRepositoryExecutor({
    pool: input.repositoryHandle.pool,
    schemaName: input.repositoryHandle.schemaName,
  });
  return createPublicWasteReminderPageHandler({
    activateByDoiTokenHash: async (payload) =>
      await executor.executeWithinTransaction(async (repository) => await repository.activateByDoiTokenHash(payload)),
    unsubscribeByTokenHash: async (payload) =>
      await executor.executeWithinTransaction(async (repository) => await repository.unsubscribeByTokenHash(payload)),
  });
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

const createMethodNotAllowedResponse = (): Response => new Response('Method Not Allowed', {
  status: 405,
  headers: {
    allow: 'GET, HEAD, POST',
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
  const relativePath = pathname === '/' || extname(pathname).length === 0 ? '/index.html' : pathname;
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

const dispatchPublicWasteApiRequest = async (input: {
  readonly request: Request;
  readonly pathname: string;
  readonly repository: PublicWasteRuntimeRepository;
  readonly bootstrapState: Extract<PublicWasteBootstrapState, { status: 'ready' }>;
  readonly loadPdfStaticConfig?: (instanceId: string) => Promise<PublicWastePdfStaticConfig>;
  readonly loadBrandingImage?: PublicWasteBrandingImageLoader;
  readonly submitReminderSignup?: PublicWasteReminderSignupSubmitter;
}): Promise<Response> => {
  if (input.pathname.startsWith('/api/public-waste/selection')) {
    return handlePublicWasteSelectionRequest({
      repository: input.repository,
      request: input.request,
    });
  }

  if (input.pathname.startsWith('/api/public-waste/calendar')) {
    return handlePublicWasteCalendarRequest({
      repository: input.repository,
      request: input.request,
      reminderConfig: input.bootstrapState.config.emailReminderConfig,
    });
  }

  if (input.pathname.startsWith('/api/public-waste/pdf')) {
    return handlePublicWastePdfRequest({
      repository: input.repository,
      request: input.request,
      loadPdfStaticConfig: async () =>
        await (input.loadPdfStaticConfig?.(input.bootstrapState.config.instanceId) ?? {}),
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

  return handlePublicWasteIcalRequest({
    repository: input.repository,
    request: input.request,
  });
};

export const createPublicWasteRuntime = async (input: {
  readonly assetsDir: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly createRepository?: RepositoryFactory;
  readonly loadPdfStaticConfig?: (instanceId: string) => Promise<PublicWastePdfStaticConfig>;
  readonly loadBrandingImage?: PublicWasteBrandingImageLoader;
  readonly submitReminderSignup?: PublicWasteReminderSignupSubmitter;
}): Promise<PublicWasteRuntime> => {
  const bootstrapState = readPublicWasteBootstrapStateFromEnvironment({
    env: input.env,
  });
  const repositoryHandle =
    bootstrapState.status === 'ready'
      ? await (input.createRepository ?? createRepositoryHandle)(bootstrapState.config)
      : null;
  const submitReminderSignup =
    input.submitReminderSignup ?? (repositoryHandle ? createDefaultReminderSignupSubmitter({ repositoryHandle }) : undefined);
  const reminderPageHandler =
    bootstrapState.status === 'ready' && bootstrapState.config.emailReminderConfig && repositoryHandle
      ? createDefaultReminderPageHandler({ repositoryHandle })
      : null;

  return {
    bootstrapState,
    async handle(request) {
      const url = new URL(request.url);
      const method = request.method.toUpperCase();

      const allowsPost = url.pathname.startsWith('/api/public-waste/reminder-signups');
      if (method !== 'GET' && method !== 'HEAD' && !(allowsPost && method === 'POST')) {
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

        const response = await dispatchPublicWasteApiRequest({
          request,
          pathname: url.pathname,
          repository: repositoryHandle.repository,
          bootstrapState,
          loadPdfStaticConfig: input.loadPdfStaticConfig,
          loadBrandingImage: input.loadBrandingImage,
          submitReminderSignup,
        });

        return method === 'HEAD' ? toHeadResponse(response) : response;
      }

      if (bootstrapState.status === 'ready' && bootstrapState.config.emailReminderConfig && reminderPageHandler) {
        const response = await reminderPageHandler({
          request,
          pathname: url.pathname,
          reminderConfig: bootstrapState.config.emailReminderConfig,
        });
        if (response) {
          return method === 'HEAD' ? toHeadResponse(response) : response;
        }
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

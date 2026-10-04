import { Pool } from 'pg';
import type { WasteManagementEmailReminderConfig } from '@sva/waste-management-contracts';
import type {
  PublicWasteReminderSignupRequest,
  PublicWasteReminderSignupResponse,
} from '../lib/public-waste-contract.js';
import {
  readPublicWasteBootstrapStateFromEnvironment,
  type PublicWasteBootstrapState,
} from '../lib/public-waste-bootstrap.server.js';
import { type PublicWasteConfig } from '../lib/public-waste-config.server.js';
import type { WasteCalendarPdfBrandingImage } from '@sva/waste-management-contracts';
import { type PublicWasteRepository } from '../lib/public-waste-repository.server.js';
import { createRepositoryHandle } from './public-waste-runtime-repository.server.js';
import {
  createDefaultReminderSignupSubmitter,
  createDefaultReminderPageHandler,
} from './public-waste-runtime-reminders.server.js';
import {
  jsonResponse,
  isPublicWasteApiPath,
  createInvalidConfigResponse,
  createMethodNotAllowedResponse,
  toHeadResponse,
  serveStaticAsset,
  dispatchPublicWasteApiRequest,
} from './public-waste-runtime-http.server.js';

export const PUBLIC_WASTE_RUNTIME_APP_NAME = 'public-waste-calendar-web';

export type PublicWasteRuntimeRepository = Pick<
  PublicWasteRepository,
  | 'listPublicLocations'
  | 'listPublicRegions'
  | 'listSelectionOptions'
  | 'loadCalendarEntries'
  | 'loadSelectionSummary'
  | 'loadReminderOptions'
>;

export type RepositoryHandle = {
  readonly repository: PublicWasteRuntimeRepository;
  readonly pool: Pool;
  readonly schemaName: string;
  readonly dispose: () => Promise<void>;
};

export type RepositoryFactory = (
  config: PublicWasteConfig
) => Promise<RepositoryHandle> | RepositoryHandle;
export type PublicWastePdfStaticConfig = {
  readonly brandingAssetUrl?: string;
  readonly contactBlock?: string;
};
export type PublicWastePdfStaticConfigLoaderOptions = {
  readonly getDatabaseUrl?: () => string | undefined;
  readonly getSchemaName?: () => string | undefined;
};
export type PublicWasteBrandingImageLoader = (input: {
  readonly assetUrl: string;
  readonly requestUrl: string;
}) => Promise<WasteCalendarPdfBrandingImage | undefined>;
export type PublicWasteReminderSignupSubmitter = (input: {
  readonly request: Request;
  readonly payload: PublicWasteReminderSignupRequest;
  readonly reminderConfig: WasteManagementEmailReminderConfig;
  readonly repository: Pick<PublicWasteRepository, 'loadSelectionSummary'>;
}) => Promise<PublicWasteReminderSignupResponse>;
export type PublicWasteReminderPageHandler = (input: {
  readonly request: Request;
  readonly pathname: string;
  readonly reminderConfig: WasteManagementEmailReminderConfig;
  readonly unsubscribeTokenSecret: string;
}) => Promise<Response | null>;
export type PublicWasteRuntime = {
  readonly bootstrapState: PublicWasteBootstrapState;
  handle: (request: Request) => Promise<Response>;
  dispose: () => Promise<void>;
};

export const createPublicWasteRuntime = async (input: {
  readonly assetsDir: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly createRepository?: RepositoryFactory;
  readonly loadPdfStaticConfig?: (
    instanceId: string,
    options?: PublicWastePdfStaticConfigLoaderOptions
  ) => Promise<PublicWastePdfStaticConfig>;
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
    input.submitReminderSignup ??
    (repositoryHandle ? createDefaultReminderSignupSubmitter({ repositoryHandle }) : undefined);
  const reminderPageHandler =
    bootstrapState.status === 'ready' &&
    bootstrapState.config.emailReminderConfig &&
    repositoryHandle
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

      if (
        bootstrapState.status === 'ready' &&
        bootstrapState.config.emailReminderConfig &&
        reminderPageHandler
      ) {
        const response = await reminderPageHandler({
          request,
          pathname: url.pathname,
          reminderConfig: bootstrapState.config.emailReminderConfig,
          unsubscribeTokenSecret:
            bootstrapState.config.emailReminderSigningSecret ??
            bootstrapState.config.database.databaseUrl,
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

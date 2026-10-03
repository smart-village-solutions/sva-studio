import { wasteManagementCoreHandlers } from './handlers.js';
import type {
  AuthenticatedRequestContext,
  WasteAuditEvent,
  WasteManagementHandlerDeps,
} from './handlers/types.js';
import type { WasteServerLoaders } from './server-loaders.js';

export type WasteServerHandlerInput = {
  readonly host: WasteManagementHandlerDeps & {
    readonly emitAuditEvent: (
      event: WasteAuditEvent & {
        actorUserId?: string;
        actorEmail?: string;
        actorDisplayName?: string;
      }
    ) => Promise<void>;
  };
  readonly withAuthenticatedHandler: (
    request: Request,
    handler: (request: Request, ctx: AuthenticatedRequestContext) => Promise<Response>
  ) => Promise<Response>;
  readonly loaders: WasteServerLoaders;
};

export const createWasteServerHandlerDeps = (input: WasteServerHandlerInput) => {
  const host = input.host;
  return {
    ...wasteManagementCoreHandlers,
    ...input.loaders.wasteManagementOverviewLoaders,
    ...input.loaders.wasteManagementEntityLoaders,
    ...input.loaders.wasteManagementEntitySavers,
    withAuthenticatedWasteManagementHandler: input.withAuthenticatedHandler,
    bindWasteAuditActor: (ctx: AuthenticatedRequestContext) => ({
      ...host,
      emitAuditEvent: (event: Parameters<typeof host.emitAuditEvent>[0]) =>
        host.emitAuditEvent({
          ...event,
          actorUserId: ctx.user.id,
          actorEmail: ctx.user.email,
          actorDisplayName: ctx.user.displayName,
        }),
    }),
  };
};

export type WasteServerHandlerDeps = ReturnType<typeof createWasteServerHandlerDeps>;

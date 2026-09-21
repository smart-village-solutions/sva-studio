import { listQuerySchema, realmCatalogQuerySchema } from './http-contracts.js';
import {
  readExistingInstanceIdOrError,
  type InstanceRegistryHttpDeps,
} from './http-instance-shared.js';

export const createListInstancesHandler =
  <TContext>(deps: InstanceRegistryHttpDeps<TContext>) =>
  async (request: Request, ctx: TContext): Promise<Response> => {
    const accessError = deps.ensurePlatformAccess(request, ctx);
    if (accessError) {
      return accessError;
    }

    const url = new URL(request.url);
    const parsed = listQuerySchema.safeParse({
      search: url.searchParams.get('search') ?? undefined,
      status: url.searchParams.get('status') ?? undefined,
    });

    if (!parsed.success) {
      return deps.createApiError(
        400,
        'invalid_request',
        'Ungültige Filter für die Instanzverwaltung.',
        deps.getRequestId()
      );
    }

    const enriched = await deps.withRegistryService((service) =>
      service.listInstances(parsed.data)
    );
    return deps.jsonResponse(
      200,
      deps.asApiList(
        enriched,
        { page: 1, pageSize: enriched.length, total: enriched.length },
        deps.getRequestId()
      )
    );
  };

export const createGetInstanceHandler =
  <TContext>(deps: InstanceRegistryHttpDeps<TContext>) =>
  async (request: Request, ctx: TContext): Promise<Response> => {
    const accessError = deps.ensurePlatformAccess(request, ctx);
    if (accessError) {
      return accessError;
    }

    const instanceId = readExistingInstanceIdOrError(deps, request);
    if (instanceId instanceof Response) {
      return instanceId;
    }

    const instance = await deps.withRegistryService((service) =>
      service.getInstanceDetail(instanceId)
    );
    if (!instance) {
      return deps.createApiError(
        404,
        'not_found',
        'Instanz wurde nicht gefunden.',
        deps.getRequestId()
      );
    }

    return deps.jsonResponse(200, deps.asApiItem(instance, deps.getRequestId()));
  };

export const createListRealmCatalogHttpHandler =
  <TContext>(deps: InstanceRegistryHttpDeps<TContext>) =>
  async (request: Request, ctx: TContext): Promise<Response> => {
    const accessError = deps.ensurePlatformAccess(request, ctx);
    if (accessError) return accessError;
    const url = new URL(request.url);
    const parsed = realmCatalogQuerySchema.safeParse({
      search: url.searchParams.get('search') ?? undefined,
      page: url.searchParams.get('page') ?? undefined,
      pageSize: url.searchParams.get('pageSize') ?? undefined,
    });
    if (!parsed.success) {
      return deps.createApiError(
        400,
        'invalid_request',
        'Ungültige Realm-Katalog-Filter.',
        deps.getRequestId()
      );
    }
    const catalog = await deps.withRegistryService((service) =>
      service.listRealmCatalog(parsed.data)
    );
    return deps.jsonResponse(200, { ...catalog, requestId: deps.getRequestId() });
  };

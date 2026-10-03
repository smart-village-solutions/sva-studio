import { json, matchRequestRoute, type RouteMatch } from './content-route-core.js';

const SOURCE_SYSTEM = 'mainserver';
const SOURCE_ENTITY_TYPE = 'GenericItem';
const PROJECTS_COLLECTION_PATH = '/api/v1/mainserver/projects';

export type ProjectRoute = RouteMatch<'projects'>;

export const matchProjectRoute = (request: Request): ProjectRoute | null =>
  matchRequestRoute(request, PROJECTS_COLLECTION_PATH, 'projects');

export const projectSourceReferenceInput = (instanceId: string) => ({
  instanceId,
  sourceSystem: SOURCE_SYSTEM,
  sourceEntityType: SOURCE_ENTITY_TYPE,
});

export const projectMutationJson = (
  body: unknown,
  providerEntityId: string,
  status = 200
): Response => {
  const response = json(body, status);
  response.headers.set('X-SVA-Mainserver-Entity-Id', providerEntityId);
  return response;
};

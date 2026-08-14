import { json } from './content-route-core.js';

const SOURCE_SYSTEM = 'mainserver';
const SOURCE_ENTITY_TYPE = 'GenericItem';

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

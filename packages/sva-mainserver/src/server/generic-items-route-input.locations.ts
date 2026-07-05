import type { SvaMainserverLocationInput } from '../types.js';
import { errorJson, isRecord } from './content-route-core.js';
import { parseLocation } from './content-route-parsers.js';

export const parseLocations = (value: unknown): readonly SvaMainserverLocationInput[] | undefined | Response => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    return errorJson(400, 'invalid_request', 'Orte müssen als Liste gesendet werden.');
  }

  const locations: SvaMainserverLocationInput[] = [];
  for (const item of value) {
    if (!isRecord(item)) {
      return errorJson(400, 'invalid_request', 'Orte müssen Objekte sein.');
    }

    const parsed = parseLocation(item);
    if (parsed instanceof Response) {
      return parsed;
    }
    if (parsed && Object.keys(parsed).length > 0) {
      locations.push(parsed);
    }
  }

  return locations;
};

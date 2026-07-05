import type { SvaMainserverLocationInput } from '../types.js';
import { errorJson, isRecord, readNumber, readString } from './content-route-core.js';

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

    const location = {
      ...(readString(item.name) ? { name: readString(item.name) } : {}),
      ...(readString(item.department) ? { department: readString(item.department) } : {}),
      ...(readString(item.district) ? { district: readString(item.district) } : {}),
      ...(readString(item.regionName) ? { regionName: readString(item.regionName) } : {}),
      ...(readString(item.state) ? { state: readString(item.state) } : {}),
      ...(isRecord(item.geoLocation)
        ? {
            geoLocation: {
              ...(readNumber(item.geoLocation.latitude) !== undefined
                ? { latitude: readNumber(item.geoLocation.latitude) }
                : {}),
              ...(readNumber(item.geoLocation.longitude) !== undefined
                ? { longitude: readNumber(item.geoLocation.longitude) }
                : {}),
            },
          }
        : {}),
    };

    if (Object.keys(location).length > 0) {
      locations.push(location);
    }
  }

  return locations;
};

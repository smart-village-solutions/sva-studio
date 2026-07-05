import type { SvaMainserverAccessibilityInformationInput } from '../types.js';
import { errorJson } from './content-route-core.js';
import { parseAccessibilityInformation } from './content-route-parsers.js';

export const parseAccessibilityInformations = (
  value: unknown
): readonly SvaMainserverAccessibilityInformationInput[] | undefined | Response => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    return errorJson(400, 'invalid_request', 'Barrierefreiheitsinformationen müssen als Liste gesendet werden.');
  }

  const items: SvaMainserverAccessibilityInformationInput[] = [];
  for (const item of value) {
    const parsed = parseAccessibilityInformation(item);
    if (parsed instanceof Response) {
      return parsed;
    }
    if (parsed) {
      items.push(parsed);
    }
  }

  return items;
};

import type { SvaMainserverContactInput } from '../types.js';
import { errorJson } from './content-route-core.js';
import { parseContact } from './content-route-parsers.js';

export const parseContactList = (value: unknown): readonly SvaMainserverContactInput[] | undefined | Response => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    return errorJson(400, 'invalid_request', 'Kontakte müssen als Liste gesendet werden.');
  }

  const contacts: SvaMainserverContactInput[] = [];
  for (const item of value) {
    const parsed = parseContact(item);
    if (parsed instanceof Response) {
      return parsed;
    }
    if (parsed) {
      contacts.push(parsed);
    }
  }

  return contacts;
};

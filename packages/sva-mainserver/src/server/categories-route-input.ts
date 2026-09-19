import type { SvaMainserverSaveCategoryInput } from '../types.js';
import { errorJson, parseJsonObjectBody } from './content-route-core.js';

const stringOrNull = (value: unknown, field: string): string | null | Response => {
  if (value === null) return null;
  if (typeof value !== 'string')
    return errorJson(400, 'category_management_invalid_request', `${field} ist ungültig.`);
  return value.trim() || null;
};

const hasInvalidSaveFields = (input: {
  name: string;
  active: unknown;
  parentId: string | null | Response;
  iconName: string | null | Response;
  email: string | null | Response;
  position: unknown;
  dataTypes: unknown;
}): boolean =>
  !input.name ||
  typeof input.active !== 'boolean' ||
  input.parentId instanceof Response ||
  input.iconName instanceof Response ||
  input.email instanceof Response ||
  (input.position !== null &&
    (typeof input.position !== 'number' ||
      !Number.isInteger(input.position) ||
      input.position < 0)) ||
  !Array.isArray(input.dataTypes) ||
  input.dataTypes.some((entry) => typeof entry !== 'string' || !entry.trim());

export const parseCategorySaveInput = async (
  request: Request,
  id?: string
): Promise<SvaMainserverSaveCategoryInput | Response> => {
  const body = await parseJsonObjectBody(request, 'Kategorienanfrage muss ein Objekt enthalten.');
  if (body instanceof Response) return body;
  if ((id && body.id !== undefined && body.id !== id) || (!id && body.id !== undefined))
    return errorJson(
      400,
      'category_management_invalid_request',
      'Die Kategorien-ID darf nicht manipuliert werden.'
    );
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const active = body.active === undefined && !id ? true : body.active;
  const parentId = stringOrNull(body.parentId ?? null, 'parentId');
  const iconName = stringOrNull(body.iconName ?? null, 'iconName');
  const email = stringOrNull(body.email ?? null, 'email');
  const position = body.position === undefined || body.position === null ? null : body.position;
  const dataTypes = body.dataTypes;
  if (hasInvalidSaveFields({ name, active, parentId, iconName, email, position, dataTypes }))
    return errorJson(
      400,
      'category_management_invalid_request',
      'Die Kategorienfelder sind ungültig.'
    );
  if (typeof email === 'string' && email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email))
    return errorJson(
      400,
      'category_management_invalid_request',
      'Die E-Mail-Adresse ist ungültig.'
    );
  return {
    ...(id ? { id } : {}),
    name,
    active: active as boolean,
    parentId: parentId as string | null,
    position: position as number | null,
    iconName: iconName as string | null,
    email: email as string | null,
    dataTypes: [...new Set((dataTypes as string[]).map((entry) => entry.trim()))],
  };
};

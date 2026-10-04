import type { SvaMainserverNewsPayload, SvaMainserverWasteLocationKey } from '../types.js';
import { errorJson, isRecord, readString } from './content-route-core.js';

const wasteLocationKeyFields = new Set(['street', 'zip', 'city']);
const maxWasteLocationKeys = 10_000;
const maxWasteLocationStreetLength = 255;
const maxWasteLocationZipLength = 16;
const maxWasteLocationCityLength = 255;

export const parseNewsPayload = (
  value: unknown
): SvaMainserverNewsPayload | undefined | Response => {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    return errorJson(400, 'invalid_request', 'Das Feld "payload" muss als Objekt gesendet werden.');
  }

  if (!('wasteLocationKeys' in value)) return undefined;
  if (!Array.isArray(value.wasteLocationKeys)) {
    return errorJson(
      400,
      'invalid_request',
      'Das Feld "payload.wasteLocationKeys" muss als Liste gesendet werden.'
    );
  }
  if (value.wasteLocationKeys.length > maxWasteLocationKeys) {
    return errorJson(
      400,
      'invalid_request',
      `Das Feld "payload.wasteLocationKeys" darf höchstens ${maxWasteLocationKeys} Einträge enthalten.`
    );
  }

  const uniqueKeys = new Map<string, SvaMainserverWasteLocationKey>();
  for (const entry of value.wasteLocationKeys) {
    if (
      !isRecord(entry) ||
      Object.keys(entry).some((field) => !wasteLocationKeyFields.has(field))
    ) {
      return errorJson(
        400,
        'invalid_request',
        'Jeder Abholortschlüssel muss ausschließlich street, zip und city enthalten.'
      );
    }
    const street = readString(entry.street);
    const zip = readString(entry.zip);
    const city = readString(entry.city);
    if (
      !street ||
      !zip ||
      !city ||
      street.length > maxWasteLocationStreetLength ||
      zip.length > maxWasteLocationZipLength ||
      city.length > maxWasteLocationCityLength
    ) {
      return errorJson(
        400,
        'invalid_request',
        'Abholortschlüssel benötigen gültige Werte für street, zip und city.'
      );
    }
    const key = { street, zip, city };
    uniqueKeys.set(JSON.stringify([street, zip, city]), key);
  }

  return uniqueKeys.size > 0 ? { wasteLocationKeys: [...uniqueKeys.values()] } : {};
};

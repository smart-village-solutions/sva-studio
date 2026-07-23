import type { SvaMainserverDateInput } from '../types.js';
import { errorJson, isRecord, isTimeOfDay, readBoolean, readString } from './content-route-core.js';

export const parseDates = (value: unknown): readonly SvaMainserverDateInput[] | Response | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    return errorJson(400, 'invalid_request', 'Termine müssen als Liste gesendet werden.');
  }

  const dates: SvaMainserverDateInput[] = [];
  for (const item of value) {
    if (!isRecord(item)) {
      return errorJson(400, 'invalid_request', 'Termin-Einträge müssen Objekte sein.');
    }
    const timeStart = readString(item.timeStart);
    const timeEnd = readString(item.timeEnd);
    if ((timeStart && !isTimeOfDay(timeStart)) || (timeEnd && !isTimeOfDay(timeEnd))) {
      return errorJson(400, 'invalid_request', 'Termine müssen Uhrzeiten im Format HH:MM enthalten.');
    }
    const date = {
      ...(readString(item.weekday) ? { weekday: readString(item.weekday) } : {}),
      ...(readString(item.dateStart) ? { dateStart: readString(item.dateStart) } : {}),
      ...(readString(item.dateEnd) ? { dateEnd: readString(item.dateEnd) } : {}),
      ...(timeStart ? { timeStart } : {}),
      ...(timeEnd ? { timeEnd } : {}),
      ...(readString(item.timeDescription) ? { timeDescription: readString(item.timeDescription) } : {}),
      ...(readBoolean(item.useOnlyTimeDescription) !== undefined
        ? { useOnlyTimeDescription: readBoolean(item.useOnlyTimeDescription) }
        : {}),
    };
    if (Object.keys(date).length > 0) {
      dates.push(date);
    }
  }

  return dates;
};

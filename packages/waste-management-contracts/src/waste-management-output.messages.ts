import {
  translateResource,
  type TranslationResourceKey,
  type TranslationResourceNode,
  type TranslationVariables,
} from '@sva/core';

import { wasteCalendarPdfGerman } from './waste-management-output.de.resources.js';

export type WasteCalendarPdfHoliday = keyof typeof wasteCalendarPdfGerman.pdf.holidays;
type WasteCalendarPdfTranslationKey = TranslationResourceKey<typeof wasteCalendarPdfGerman>;

export const createWasteCalendarPdfTranslator =
  (overrides?: TranslationResourceNode) =>
  (key: WasteCalendarPdfTranslationKey, variables?: TranslationVariables): string =>
    translateResource(overrides, wasteCalendarPdfGerman, key, variables);

export type WasteCalendarPdfTranslator = ReturnType<typeof createWasteCalendarPdfTranslator>;

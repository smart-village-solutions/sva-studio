import {
  formatDateTimeInEditorTimeZone,
  formatTechnicalDateTimeInEditorTimeZone,
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from '@sva/plugin-sdk';

import { getActiveLocale, type SupportedLocale } from '../i18n';

type ParsedOptionalEditorDateTime =
  | Readonly<{ kind: 'empty' }>
  | Readonly<{ kind: 'invalid' }>
  | Readonly<{ kind: 'value'; value: string }>;

export const toEditorDateTimeLocale = (locale: SupportedLocale = getActiveLocale()): string => {
  return locale === 'en' ? 'en-GB' : 'de-DE';
};

export const formatEditorDateTime = (value?: string): string | undefined => {
  return formatDateTimeInEditorTimeZone(value, toEditorDateTimeLocale());
};

export const formatTechnicalEditorDateTime = (value?: string): string | undefined => {
  return formatTechnicalDateTimeInEditorTimeZone(value, toEditorDateTimeLocale());
};

export const parseOptionalEditorDateTime = (value: string, referenceValue?: string): ParsedOptionalEditorDateTime => {
  const trimmed = value.trim();
  if (!trimmed) {
    return { kind: 'empty' };
  }

  const isoValue = fromDatetimeLocalValue(trimmed, referenceValue);
  return isoValue ? { kind: 'value', value: isoValue } : { kind: 'invalid' };
};

export { toDatetimeLocalValue };

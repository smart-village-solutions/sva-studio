/** Narrow browser contract for temporal controls; no host operations or UI dependency. */
import { usePluginTranslation } from './plugin-translations.js';

export {
  formatCalendarDate,
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
  isCalendarDate,
  isInstant,
  resolveEditorLocale,
} from './content-ui-utils.js';

export const useTemporalTranslation = () => usePluginTranslation('shared');

import type { Translator } from './categories.page-support.js';
import type { CategoryDataTypeOption } from './categories.types.js';

const selectableDataTypeOptions = (
  options: readonly CategoryDataTypeOption[],
  pt: Translator
): readonly CategoryDataTypeOption[] => {
  const legacy: readonly CategoryDataTypeOption[] = [
    { value: 'event_record', label: pt('dataTypes.eventRecord') },
    { value: 'news_item', label: pt('dataTypes.newsItem') },
    { value: 'point_of_interest', label: pt('dataTypes.pointOfInterest') },
    { value: 'tour', label: pt('dataTypes.tour') },
  ];
  return [...new Map([...options, ...legacy].map((option) => [option.value, option])).values()];
};

export type DataTypeCatalog = Readonly<{
  /** Localized label for a stored identifier; unknown identifiers stay visible with a fallback. */
  label: (value: string) => string;
  /** Selectable options plus any already assigned identifiers missing from the catalog. */
  optionsFor: (assigned: readonly string[]) => readonly CategoryDataTypeOption[];
}>;

export const createDataTypeCatalog = (
  options: readonly CategoryDataTypeOption[],
  pt: Translator
): DataTypeCatalog => {
  const selectable = selectableDataTypeOptions(options, pt);
  const labels = new Map(selectable.map((option) => [option.value, option.label]));
  const label = (value: string) => labels.get(value) ?? pt('values.unavailableType', { value });
  return {
    label,
    optionsFor: (assigned) => [
      ...selectable,
      ...assigned
        .filter((value) => !labels.has(value))
        .map((value) => ({ value, label: label(value) })),
    ],
  };
};

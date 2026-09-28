export const sortWasteAnnualItems = <T>(
  items: readonly T[],
  key: (item: T) => string
): readonly T[] => [...items].sort((left, right) => key(left).localeCompare(key(right)));

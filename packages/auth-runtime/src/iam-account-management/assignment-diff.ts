const dedupe = (values: readonly string[]): readonly string[] => [...new Set(values)];

const sortValues = (values: readonly string[]): readonly string[] => [...values].sort((left, right) => left.localeCompare(right));

export type AssignmentDiff = {
  readonly keepIds: readonly string[];
  readonly insertIds: readonly string[];
  readonly deleteIds: readonly string[];
};

export const diffAssignments = (
  existingIds: readonly string[],
  nextIds: readonly string[]
): AssignmentDiff => {
  const existing = new Set(dedupe(existingIds));
  const next = new Set(dedupe(nextIds));

  const keepIds = [...existing].filter((id) => next.has(id));
  const insertIds = [...next].filter((id) => !existing.has(id));
  const deleteIds = [...existing].filter((id) => !next.has(id));

  return {
    keepIds: sortValues(keepIds),
    insertIds: sortValues(insertIds),
    deleteIds: sortValues(deleteIds),
  };
};

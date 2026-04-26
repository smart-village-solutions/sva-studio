import type { ContentRow, UpdateContentInput } from './repository-types.js';
import { resolveContentChangedFields } from './repository-state-changes.js';
import { validateNextContentState } from './repository-state-validation.js';
import { resolveNextContentStateValues, type NextContentStateValues } from './repository-state-values.js';

export type NextContentState = NextContentStateValues & {
  changedFields: string[];
};

export const resolveNextContentState = (current: ContentRow, input: UpdateContentInput): NextContentState => {
  const next = resolveNextContentStateValues(current, input);
  validateNextContentState(next);
  return {
    ...next,
    changedFields: resolveContentChangedFields(current, next),
  };
};

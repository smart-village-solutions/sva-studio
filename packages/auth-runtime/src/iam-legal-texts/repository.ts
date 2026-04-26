import {
  createLegalTextRepository,
  type DeleteLegalTextInput,
  LegalTextDeleteConflictError,
} from '@sva/iam-governance/legal-text-repository';
import type {
  CreateLegalTextInput,
  UpdateLegalTextInput,
} from '@sva/iam-governance/legal-text-repository-shared';

import { emitActivityLog, withInstanceScopedDb } from '../iam-account-management/shared.js';

const legalTextRepository = createLegalTextRepository({
  withInstanceScopedDb,
  emitActivityLog,
});

export { LegalTextDeleteConflictError };

export type { CreateLegalTextInput, DeleteLegalTextInput, UpdateLegalTextInput };

export const loadLegalTextListItems = legalTextRepository.loadLegalTextListItems;
export const loadLegalTextById = legalTextRepository.loadLegalTextById;
export const loadPendingLegalTexts = legalTextRepository.loadPendingLegalTexts;
export const createLegalTextVersion = legalTextRepository.createLegalTextVersion;
export const updateLegalTextVersion = legalTextRepository.updateLegalTextVersion;
export const deleteLegalTextVersion = legalTextRepository.deleteLegalTextVersion;

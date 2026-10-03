import type { MediaContentSaveOperationRecord } from './model-types.js';
import type { SqlExecutor } from '../iam/repositories/types.js';
import type { MediaRepository } from './repository-types.js';
import type { MediaContentSaveOperationRow } from './rows.js';
import { mapContentSaveOperationRow } from './rows.js';
import {
  markContentSaveOperationContentSavedStatement,
  markContentSaveOperationSavingContentStatement,
  markContentSaveOperationOutcomeUnknownStatement,
} from './content-save-transition-statements.js';
import {
  createContentSaveOperationStatement,
  getContentSaveOperationStatement,
  lockOpenContentSaveOperationForUploadStatement,
  replaceContentSaveOperationReferencesStatement,
} from './content-save-start-statements.js';

export const createContentSaveMethods = (
  executor: SqlExecutor
): Pick<
  MediaRepository,
  | 'createContentSaveOperation'
  | 'getContentSaveOperation'
  | 'lockOpenContentSaveOperationForUpload'
  | 'replaceContentSaveOperationReferences'
  | 'markContentSaveOperationContentSaved'
  | 'markContentSaveOperationSavingContent'
  | 'markContentSaveOperationOutcomeUnknown'
> => ({
  async createContentSaveOperation(input: MediaContentSaveOperationRecord) {
    const result = await executor.execute<MediaContentSaveOperationRow>(
      createContentSaveOperationStatement(input)
    );
    const operation = result.rows[0];
    if (!operation) throw new Error('Failed to create media content save operation.');
    return mapContentSaveOperationRow(operation);
  },
  async getContentSaveOperation(input: Parameters<MediaRepository['getContentSaveOperation']>[0]) {
    const result = await executor.execute<MediaContentSaveOperationRow>(
      getContentSaveOperationStatement(input)
    );
    return result.rows[0] ? mapContentSaveOperationRow(result.rows[0]) : null;
  },
  async lockOpenContentSaveOperationForUpload(
    input: Parameters<MediaRepository['lockOpenContentSaveOperationForUpload']>[0]
  ) {
    const result = await executor.execute<{ readonly open: boolean }>(
      lockOpenContentSaveOperationForUploadStatement(input)
    );
    return result.rows[0]?.open === true;
  },
  async replaceContentSaveOperationReferences(
    input: Parameters<MediaRepository['replaceContentSaveOperationReferences']>[0]
  ) {
    const result = await executor.execute<{ readonly successful: boolean }>(
      replaceContentSaveOperationReferencesStatement(input)
    );
    return result.rows[0]?.successful ?? false;
  },
  async markContentSaveOperationContentSaved(
    input: Parameters<MediaRepository['markContentSaveOperationContentSaved']>[0]
  ) {
    const result = await executor.execute(markContentSaveOperationContentSavedStatement(input));
    return result.rowCount > 0;
  },
  async markContentSaveOperationSavingContent(
    input: Parameters<MediaRepository['markContentSaveOperationSavingContent']>[0]
  ) {
    const result = await executor.execute(markContentSaveOperationSavingContentStatement(input));
    return result.rowCount > 0;
  },
  async markContentSaveOperationOutcomeUnknown(
    input: Parameters<MediaRepository['markContentSaveOperationOutcomeUnknown']>[0]
  ) {
    const result = await executor.execute(markContentSaveOperationOutcomeUnknownStatement(input));
    return result.rowCount > 0;
  },
});

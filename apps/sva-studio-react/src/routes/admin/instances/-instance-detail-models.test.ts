import { describe, expect, it } from 'vitest';

import {
  buildExistingRealmOperationsModel,
  buildHistoryWorkspaceModel,
  buildNewRealmOperationsModel,
  buildOperationsPrimaryAction,
  getOperationsActionLabel,
  getOperationsEvidenceSourceLabel,
} from './-instance-detail-models';
import { OperationsStepStatusBadge } from './-instance-status-badges';

describe('instance detail split module exports', () => {
  it('exposes the operations and history builders through the split models entry', () => {
    expect(buildNewRealmOperationsModel).toBeTypeOf('function');
    expect(buildExistingRealmOperationsModel).toBeTypeOf('function');
    expect(buildOperationsPrimaryAction).toBeTypeOf('function');
    expect(buildHistoryWorkspaceModel).toBeTypeOf('function');
    expect(getOperationsActionLabel).toBeTypeOf('function');
    expect(getOperationsEvidenceSourceLabel).toBeTypeOf('function');
  });

  it('exposes the operations status badge through the shared badge module', () => {
    expect(OperationsStepStatusBadge).toBeTypeOf('function');
  });
});

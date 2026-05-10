import { describe, expect, it } from 'vitest';

import { WasteManagementApiError } from '../src/waste-management.api.shared.js';
import { createWasteToolErrorMessage } from '../src/waste-management.tools.messages.js';

describe('waste-management.tools.messages', () => {
  const pt = (key: string) => key;

  it('maps forbidden and invalid import requests to dedicated messages', () => {
    expect(createWasteToolErrorMessage({ action: 'import', error: new WasteManagementApiError('forbidden'), pt })).toBe(
      'tools.messages.forbidden'
    );
    expect(createWasteToolErrorMessage({ action: 'import', error: new WasteManagementApiError('invalid_request'), pt })).toBe(
      'tools.messages.importValidationError'
    );
  });

  it('maps reset validation errors and falls back for unknown failures', () => {
    expect(createWasteToolErrorMessage({ action: 'reset', error: new WasteManagementApiError('invalid_request'), pt })).toBe(
      'tools.messages.resetValidationError'
    );
    expect(createWasteToolErrorMessage({ action: 'migration', error: { code: 'boom' }, pt })).toBe(
      'tools.messages.jobStartError'
    );
  });
});

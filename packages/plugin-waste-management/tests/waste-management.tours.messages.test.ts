import { describe, expect, it, vi } from 'vitest';

import { WasteManagementApiError } from '../src/waste-management.api.shared.js';
import { setTourDeleteErrorMessage } from '../src/waste-management.tours.messages.js';

describe('waste-management tour delete messages', () => {
  it('maps forbidden, conflict, and fallback delete errors to translated status messages', () => {
    const setMessage = vi.fn();
    const state = { setMessage } as never;
    const pt = (key: string) => `translated:${key}`;

    setTourDeleteErrorMessage(state, pt, new WasteManagementApiError('forbidden'));
    setTourDeleteErrorMessage(state, pt, new WasteManagementApiError('invalid_request'));
    setTourDeleteErrorMessage(state, pt, new Error('unexpected'));

    expect(setMessage).toHaveBeenNthCalledWith(1, {
      kind: 'error',
      text: 'translated:tours.messages.deleteForbidden',
    });
    expect(setMessage).toHaveBeenNthCalledWith(2, {
      kind: 'error',
      text: 'translated:tours.messages.deleteConflict',
    });
    expect(setMessage).toHaveBeenNthCalledWith(3, {
      kind: 'error',
      text: 'translated:tours.messages.deleteError',
    });
  });
});

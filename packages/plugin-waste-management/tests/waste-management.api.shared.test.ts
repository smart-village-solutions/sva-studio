import { afterEach, describe, expect, it } from 'vitest';

import { appendWasteManagementDebugLog } from '../src/waste-management.api.shared.js';

type WasteManagementDebugGlobal = typeof globalThis & {
  __wasteManagementDebug?: unknown[];
  window?: unknown;
};

const debugGlobal = globalThis as WasteManagementDebugGlobal;
const originalWindow = debugGlobal.window;

describe('waste-management.api.shared debug logging', () => {
  afterEach(() => {
    if (originalWindow === undefined) {
      delete debugGlobal.window;
    } else {
      debugGlobal.window = originalWindow;
    }
    delete debugGlobal.__wasteManagementDebug;
  });

  it('skips debug buffer writes outside the browser runtime', () => {
    delete debugGlobal.window;

    appendWasteManagementDebugLog({
      scope: 'tour-delete',
      phase: 'start',
      tourId: 'tour-1',
    });

    expect(debugGlobal.__wasteManagementDebug).toBeUndefined();
  });

  it('stores debug entries in browser-like runtimes only', () => {
    debugGlobal.window = {};

    appendWasteManagementDebugLog({
      scope: 'tour-delete',
      phase: 'success',
      tourId: 'tour-1',
    });

    expect(debugGlobal.__wasteManagementDebug).toEqual([
      expect.objectContaining({
        scope: 'tour-delete',
        phase: 'success',
        tourId: 'tour-1',
      }),
    ]);
  });
});

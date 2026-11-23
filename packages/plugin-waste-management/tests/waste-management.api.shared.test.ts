import { afterEach, describe, expect, it, vi } from 'vitest';

import { appendWasteManagementDebugLog } from '../src/waste-management.api.shared.js';
import { searchWasteEmailMonitoring } from '../src/waste-management.api.read.js';

type WasteManagementDebugGlobal = typeof globalThis & {
  __wasteManagementDebug?: unknown[];
  __wasteManagementDebugEnabled?: boolean;
  window?: unknown;
};

const debugGlobal = globalThis as WasteManagementDebugGlobal;
const originalWindow = debugGlobal.window;
const originalDebugEnabled = debugGlobal.__wasteManagementDebugEnabled;

describe('waste-management.api.shared debug logging', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalWindow === undefined) {
      delete debugGlobal.window;
    } else {
      debugGlobal.window = originalWindow;
    }
    if (originalDebugEnabled === undefined) {
      delete debugGlobal.__wasteManagementDebugEnabled;
    } else {
      debugGlobal.__wasteManagementDebugEnabled = originalDebugEnabled;
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

  it('skips debug buffer writes when browser logging is not explicitly enabled', () => {
    debugGlobal.window = {};

    appendWasteManagementDebugLog({
      scope: 'tour-delete',
      phase: 'success',
      tourId: 'tour-1',
    });

    expect(debugGlobal.__wasteManagementDebug).toBeUndefined();
  });

  it('stores debug entries in browser-like runtimes only when explicitly enabled', () => {
    debugGlobal.window = {};
    debugGlobal.__wasteManagementDebugEnabled = true;

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

  it('keeps the search address in the JSON body and uses the CSRF request header', async () => {
    debugGlobal.window = {};
    debugGlobal.__wasteManagementDebugEnabled = true;
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ data: { subscriptions: [], total: 0, deliveries: [], deliveryTotal: 0 } }), {
        headers: { 'Content-Type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);
    const query = { email: 'fixture@example.invalid', page: 1, pageSize: 20, deliveryPage: 1 };
    await searchWasteEmailMonitoring(query, { signal: new AbortController().signal });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('/api/v1/waste-management/email-monitoring/search');
    expect(init).toMatchObject({ method: 'POST', cache: 'no-store', body: JSON.stringify(query) });
    expect(new Headers(init?.headers).get('X-Requested-With')).toBe('XMLHttpRequest');
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.stringify(debugGlobal.__wasteManagementDebug)).not.toMatch(/fixture|example\.invalid|sha256/);
  });
});

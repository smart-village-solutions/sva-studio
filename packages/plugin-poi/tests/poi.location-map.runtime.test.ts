import { describe, expect, it, vi } from 'vitest';

import { createPoiLocationMapRuntimeLoader } from '../src/poi.location-map.runtime.js';

describe('loadPoiLocationMapRuntime', () => {
  it('retries the runtime import after a transient failure', async () => {
    let runtimeAttempts = 0;
    const loadPoiLocationMapRuntime = createPoiLocationMapRuntimeLoader({
      hasWindow: () => true,
      loadCss: async () => undefined,
      loadRuntime: async () => {
        runtimeAttempts += 1;
        if (runtimeAttempts === 1) {
          throw new Error('runtime import failed');
        }

        return {
          default: {
            Map: class MockMap {},
            Marker: class MockMarker {},
          },
          Map: class MockMap {},
          Marker: class MockMarker {},
        } as never;
      },
    });

    await expect(loadPoiLocationMapRuntime()).rejects.toThrow('runtime import failed');

    await expect(loadPoiLocationMapRuntime()).resolves.toMatchObject({
      default: expect.objectContaining({
        Map: expect.any(Function),
        Marker: expect.any(Function),
      }),
    });
    expect(runtimeAttempts).toBe(2);
  });

  it('retries the stylesheet import after a transient failure', async () => {
    let cssAttempts = 0;
    const loadPoiLocationMapRuntime = createPoiLocationMapRuntimeLoader({
      hasWindow: () => true,
      loadCss: async () => {
        cssAttempts += 1;
        if (cssAttempts === 1) {
          throw new Error('css import failed');
        }
      },
      loadRuntime: async () =>
        ({
          default: {
            Map: class MockMap {},
            Marker: class MockMarker {},
          },
          Map: class MockMap {},
          Marker: class MockMarker {},
        }) as never,
    });

    await expect(loadPoiLocationMapRuntime()).rejects.toThrow('css import failed');

    await expect(loadPoiLocationMapRuntime()).resolves.toMatchObject({
      default: expect.objectContaining({
        Map: expect.any(Function),
        Marker: expect.any(Function),
      }),
    });
    expect(cssAttempts).toBe(2);
  });

  it('rejects when no browser runtime is available', async () => {
    const loadPoiLocationMapRuntime = createPoiLocationMapRuntimeLoader({
      hasWindow: () => false,
      loadCss: vi.fn(),
      loadRuntime: vi.fn(),
    });

    await expect(loadPoiLocationMapRuntime()).rejects.toThrow('map_runtime_unavailable');
  });
});

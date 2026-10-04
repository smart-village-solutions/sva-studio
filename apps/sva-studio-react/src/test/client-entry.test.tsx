import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { createBrowserBeaconMock, startBeaconMock, hydrateRootMock } = vi.hoisted(() => ({
  createBrowserBeaconMock: vi.fn(),
  startBeaconMock: vi.fn(),
  hydrateRootMock: vi.fn(),
}));

vi.mock('@fallow-cli/beacon/browser', () => ({
  createBrowserBeacon: createBrowserBeaconMock,
}));

vi.mock('@tanstack/react-start/client', () => ({
  StartClient: () => null,
}));

vi.mock('react-dom/client', () => ({
  hydrateRoot: hydrateRootMock,
}));

describe('Studio browser entry', () => {
  beforeEach(() => {
    vi.resetModules();
    createBrowserBeaconMock.mockReset();
    startBeaconMock.mockReset();
    hydrateRootMock.mockReset();
    createBrowserBeaconMock.mockReturnValue({ start: startBeaconMock });
  });

  afterEach(() => {
    document.querySelector('meta[name="sva-fallow-browser-beacon-key"]')?.remove();
  });

  it('hydrates without starting Fallow when no browser key is present', async () => {
    await import('../client');

    expect(createBrowserBeaconMock).not.toHaveBeenCalled();
    expect(hydrateRootMock).toHaveBeenCalledWith(document, expect.any(Object));
  });

  it('ignores a full server key in browser metadata', async () => {
    const meta = document.createElement('meta');
    meta.name = 'sva-fallow-browser-beacon-key';
    meta.content = 'fallow_live_k1_test_server_key';
    document.head.append(meta);

    await import('../client');

    expect(createBrowserBeaconMock).not.toHaveBeenCalled();
    expect(hydrateRootMock).toHaveBeenCalledWith(document, expect.any(Object));
  });

  it('starts Fallow with an ingest-only browser key and hydrates', async () => {
    const meta = document.createElement('meta');
    meta.name = 'sva-fallow-browser-beacon-key';
    meta.content = 'fallow_pub_k1_test_browser_key';
    document.head.append(meta);

    await import('../client');

    expect(createBrowserBeaconMock).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: meta.content,
        endpoint: 'https://api.fallow.cloud',
        projectId: 'smart-village-solutions/sva-studio',
        environment: 'staging',
        runtimeSurface: 'browser',
      })
    );
    expect(startBeaconMock).toHaveBeenCalledOnce();
    expect(hydrateRootMock).toHaveBeenCalledWith(document, expect.any(Object));
  });
});

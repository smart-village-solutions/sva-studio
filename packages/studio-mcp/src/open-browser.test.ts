import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ execFile: vi.fn() }));

vi.mock('node:child_process', () => ({ execFile: state.execFile }));

import { openLoginUrl } from './open-browser.js';

describe('openLoginUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.execFile.mockImplementation((...args: unknown[]) => {
      const callback = args.at(-1);
      if (typeof callback === 'function') {
        (callback as (error: Error | null, stdout: string, stderr: string) => void)(null, '', '');
      }
    });
  });

  it('selects the platform browser launcher without invoking a shell', async () => {
    const url = 'https://id.example/authorize?state=opaque';

    await openLoginUrl(url, 'darwin');
    expect(state.execFile).toHaveBeenLastCalledWith(
      'open', [url], expect.objectContaining({ timeout: 10_000 }), expect.any(Function)
    );

    await openLoginUrl(url, 'win32');
    expect(state.execFile).toHaveBeenLastCalledWith(
      'rundll32',
      ['url.dll,FileProtocolHandler', url],
      expect.objectContaining({ timeout: 10_000 }),
      expect.any(Function)
    );

    await openLoginUrl(url, 'linux');
    expect(state.execFile).toHaveBeenLastCalledWith(
      'xdg-open', [url], expect.objectContaining({ timeout: 10_000 }), expect.any(Function)
    );
  });
});

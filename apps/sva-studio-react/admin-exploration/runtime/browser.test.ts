import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AdminExplorationConfig } from './types.ts';
import { launchExplorationBrowser } from './browser.ts';

const { launch } = vi.hoisted(() => ({ launch: vi.fn() }));

vi.mock('@playwright/test', () => ({ chromium: { launch } }));

function createConfig(headless: boolean): AdminExplorationConfig {
  return {
    admin: { username: 'admin-user', password: 'test-password' },
    baseUrl: 'https://studio.example.test',
    localBrowser: { headless },
    mission: 'admin-users-overview',
    runMode: 'mission',
    storyFilters: { clusters: [], packageIds: [], resume: false, storyIds: [] },
    tenant: null,
  };
}

beforeEach(() => {
  launch.mockReset();
});

describe('launchExplorationBrowser', () => {
  it.each([true, false])('launches Playwright with the configured headless setting %s', async (headless) => {
    const browser = { close: vi.fn() };
    launch.mockResolvedValue(browser);

    await expect(launchExplorationBrowser(createConfig(headless))).resolves.toBe(browser);
    expect(launch).toHaveBeenCalledWith({ headless });
  });

  it('propagates browser launch failures', async () => {
    launch.mockRejectedValue(new Error('Chromium unavailable'));

    await expect(launchExplorationBrowser(createConfig(true))).rejects.toThrow('Chromium unavailable');
  });
});

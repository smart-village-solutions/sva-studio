import { describe, expect, it } from 'vitest';

import { buildLocalStagehandOptions } from './sdk.ts';
import type { StagehandAdminConfig } from './types.ts';

function createConfig(): StagehandAdminConfig {
  return {
    admin: {
      username: 'admin-user',
      password: 'super-secret',
    },
    baseUrl: 'https://studio.example.test',
    localBrowser: {
      headless: true,
    },
    mission: 'admin-users-overview',
    openAiApiKey: 'test-openai-key',
    runMode: 'mission',
    storyFilters: {
      clusters: [],
      packageIds: [],
      resume: false,
      storyIds: [],
    },
    tenant: null,
  };
}

describe('buildLocalStagehandOptions', () => {
  it('builds deterministic local Stagehand defaults for the admin pilot', () => {
    expect(buildLocalStagehandOptions(createConfig())).toEqual({
      env: 'LOCAL',
      localBrowserLaunchOptions: {
        headless: true,
      },
      model: 'openai/gpt-5',
      systemPrompt: expect.stringContaining('SVA Studio'),
      verbose: 1,
    });
  });

  it('allows explicit local browser overrides without mutating core defaults', () => {
    expect(
      buildLocalStagehandOptions(createConfig(), {
        headless: false,
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      })
    ).toEqual({
      env: 'LOCAL',
      localBrowserLaunchOptions: {
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        headless: false,
      },
      model: 'openai/gpt-5',
      systemPrompt: expect.stringContaining('admin-users-overview'),
      verbose: 1,
    });
  });

  it('uses the parsed local browser headless setting by default', () => {
    expect(
      buildLocalStagehandOptions({
        ...createConfig(),
        localBrowser: {
          headless: false,
        },
      })
    ).toEqual({
      env: 'LOCAL',
      localBrowserLaunchOptions: {
        headless: false,
      },
      model: 'openai/gpt-5',
      systemPrompt: expect.stringContaining('SVA Studio'),
      verbose: 1,
    });
  });
});

import { createRequire } from 'node:module';

import type { Stagehand } from '@browserbasehq/stagehand';
import type { StagehandAdminConfig } from './types.js';

type StagehandModule = typeof import('@browserbasehq/stagehand');
type StagehandConstructor = StagehandModule['Stagehand'];
type StagehandConstructorOptions = ConstructorParameters<StagehandConstructor>[0];

const require = createRequire(import.meta.url);

function loadStagehandConstructor(): StagehandConstructor {
  try {
    return (require('@browserbasehq/stagehand') as StagehandModule).Stagehand;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Stagehand load failure';

    throw new Error(`Failed to load @browserbasehq/stagehand for local admin runs: ${message}`, {
      cause: error,
    });
  }
}

export interface StagehandLocalOptionsOverrides {
  readonly executablePath?: string;
  readonly headless?: boolean;
  readonly model?: string;
  readonly systemPrompt?: string;
  readonly verbose?: 0 | 1 | 2;
}

function createDefaultSystemPrompt(config: StagehandAdminConfig): string {
  return [
    'Du steuerst eine lokale Stagehand-Sitzung für das SVA Studio.',
    `Mission: ${config.mission}.`,
    `Zielsystem: ${config.baseUrl}.`,
    'Handle vorsichtig, dokumentiere Beobachtungen präzise und verändere nur explizit benötigte Testdaten.',
  ].join(' ');
}

export function buildLocalStagehandOptions(
  config: StagehandAdminConfig,
  overrides: StagehandLocalOptionsOverrides = {}
): StagehandConstructorOptions {
  return {
    env: 'LOCAL',
    localBrowserLaunchOptions: {
      ...(overrides.executablePath === undefined ? {} : { executablePath: overrides.executablePath }),
      headless: overrides.headless ?? config.localBrowser.headless,
    },
    model: overrides.model ?? 'openai/gpt-5',
    systemPrompt: overrides.systemPrompt ?? createDefaultSystemPrompt(config),
    verbose: overrides.verbose ?? 1,
  };
}

export function createLocalStagehand(
  config: StagehandAdminConfig,
  overrides: StagehandLocalOptionsOverrides = {}
): Stagehand {
  const Stagehand = loadStagehandConstructor();

  return new Stagehand(buildLocalStagehandOptions(config, overrides));
}

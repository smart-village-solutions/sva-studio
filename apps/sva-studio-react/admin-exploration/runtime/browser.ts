import type { Browser } from '@playwright/test';

import type { AdminExplorationConfig } from './types.js';

export async function loadChromium() {
  return (await import('@playwright/test')).chromium;
}

export async function launchExplorationBrowser(config: AdminExplorationConfig): Promise<Browser> {
  const chromium = await loadChromium();

  return chromium.launch({ headless: config.localBrowser.headless });
}

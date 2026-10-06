import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  ssfInstallationContentV2Schema,
  ssfRuntimeConfigurationV2Schema,
} from '../src/content-v2-contracts.js';

const example = (name: string): unknown =>
  JSON.parse(
    readFileSync(new URL(`../../../docs/api/${name}`, import.meta.url), 'utf8')
  ) as unknown;

describe('SSF V2 response contracts', () => {
  it('accepts both agreed response examples', () => {
    expect(
      ssfInstallationContentV2Schema.safeParse(
        example('ssf-installation-content-v2.example.json')
      ).success
    ).toBe(true);
    expect(
      ssfRuntimeConfigurationV2Schema.safeParse(
        example('ssf-runtime-configuration-v2.example.json')
      ).success
    ).toBe(true);
  });

  it('rejects unsafe links and inconsistent storage policy', () => {
    const installation = example('ssf-installation-content-v2.example.json') as Record<string, unknown>;
    const legal = installation['legal'] as Record<string, unknown>;
    legal['privacyPolicyUrl'] = 'javascript:alert(1)';
    expect(ssfInstallationContentV2Schema.safeParse(installation).success).toBe(false);

    const runtime = example('ssf-runtime-configuration-v2.example.json') as Record<string, unknown>;
    const storage = runtime['conversationContentStorage'] as Record<string, unknown>;
    storage['mode'] = 'disabled';
    expect(ssfRuntimeConfigurationV2Schema.safeParse(runtime).success).toBe(false);
  });
});

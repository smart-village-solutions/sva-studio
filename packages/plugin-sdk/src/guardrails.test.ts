import { describe, expect, it } from 'vitest';

import {
  assertPluginContributionAllowedKeys,
  createPluginContributionGuardrailError,
} from './guardrails.js';

describe('plugin guardrails', () => {
  it('maps known guardrail fields to stable violation codes', () => {
    expect(createPluginContributionGuardrailError('news', 'news.publish', 'loader').message).toBe(
      'plugin_guardrail_route_bypass:news:news.publish:loader'
    );
  });

  it('falls back to the provided violation code for unknown fields', () => {
    expect(
      createPluginContributionGuardrailError(
        'news',
        'news.publish',
        'customField',
        'plugin_guardrail_dynamic_registration'
      ).message
    ).toBe('plugin_guardrail_dynamic_registration:news:news.publish:customField');
  });

  it('rejects unexpected contribution keys on typed objects', () => {
    expect(() =>
      assertPluginContributionAllowedKeys(
        { known: true, unexpected: true },
        new Set(['known']),
        'news',
        'news.publish'
      )
    ).toThrow('plugin_guardrail_unsupported_binding:news:news.publish:unexpected');
  });
});

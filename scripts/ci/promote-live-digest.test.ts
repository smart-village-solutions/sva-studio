import { describe, expect, it } from 'vitest';

import { matchesExpectedLiveImage } from './promote-live-digest.ts';

describe('matchesExpectedLiveImage', () => {
  const digest = 'sha256:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  const tag = 'ghcr.io/smart-village-solutions/sva-studio:5bdcfd1be7d7a72ba94c23ce16834bc1ebecc5de';

  it('accepts a live tag reference resolved to an immutable digest', () => {
    expect(matchesExpectedLiveImage(tag, `${tag}@${digest}`)).toBe(true);
  });

  it('rejects a live image from another target tag', () => {
    expect(matchesExpectedLiveImage(tag, `ghcr.io/smart-village-solutions/sva-studio:other@${digest}`)).toBe(false);
  });
});

import { describe, expect, it, vi } from 'vitest';

import {
  PluginOperationCancellationError,
  isPluginOperationCancellationError,
  throwIfCancellationRequested,
} from './job-cancellation.js';

describe('job cancellation helpers', () => {
  it('throws a typed cancellation error when a cancel request exists', async () => {
    await expect(
      throwIfCancellationRequested({
        isCancellationRequested: vi.fn(async () => true),
        cancelRequestedAt: '2026-05-09T12:10:00.000Z',
      })
    ).rejects.toMatchObject({
      name: 'PluginOperationCancellationError',
      cancelRequestedAt: '2026-05-09T12:10:00.000Z',
    });
  });

  it('detects cancellation errors explicitly', () => {
    expect(
      isPluginOperationCancellationError(
        new PluginOperationCancellationError('Plugin operation cancelled.', '2026-05-09T12:10:00.000Z')
      )
    ).toBe(true);
    expect(isPluginOperationCancellationError(new Error('boom'))).toBe(false);
  });
});

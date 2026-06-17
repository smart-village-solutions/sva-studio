import { describe, expect, it } from 'vitest';

import * as data from '../index.js';
import * as repos from '@sva/data-repositories';

describe('@sva/data waste reminder compatibility', () => {
  it('re-exports the leading waste email reminder repository factory', () => {
    expect(data.createWasteEmailReminderRepository).toBe(repos.createWasteEmailReminderRepository);
  });

  it('re-exports the leading waste email reminder statements', () => {
    expect(data.wasteEmailReminderStatements).toBe(repos.wasteEmailReminderStatements);
  });
});

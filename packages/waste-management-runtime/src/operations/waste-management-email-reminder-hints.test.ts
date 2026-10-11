import { describe, expect, it } from 'vitest';

import { buildReminderHintText } from './waste-management-email-reminder-hints.js';

describe('buildReminderHintText', () => {
  it('sanitizes, converts and deduplicates rich-text hints', () => {
    expect(
      buildReminderHintText([
        '<p>Bereitstellung am <strong>Vorabend</strong>.</p>',
        'Bereitstellung am Vorabend.',
        '<script>alert(1)</script>',
      ])
    ).toBe('Bereitstellung am Vorabend.');
  });
});

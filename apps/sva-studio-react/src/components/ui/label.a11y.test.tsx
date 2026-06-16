import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { expectNoA11yViolations } from '@/test/a11y';

import { Label } from './label';

afterEach(() => {
  cleanup();
});

describe('ui/label accessibility', () => {
  it('keeps explicit label and control wiring accessible', async () => {
    const { container } = render(
      <div>
        <Label htmlFor="news-title">Titel</Label>
        <input id="news-title" name="title" />
      </div>
    );

    await expect(expectNoA11yViolations(container)).resolves.toBeUndefined();
  });
});

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, it } from 'vitest';

import { expectNoA11yViolations } from '@/test/a11y';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from './dialog';

afterEach(() => {
  cleanup();
});

describe('ui/dialog accessibility', () => {
  it('renders an accessible dialog with title and description', async () => {
    const { container } = render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Dialogtitel</DialogTitle>
          <DialogDescription>Dialogbeschreibung</DialogDescription>
        </DialogContent>
      </Dialog>
    );

    await expectNoA11yViolations(container);
  });
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  ContentOwnershipPanelSlot,
  ContentOwnershipSaveHint,
  ContentOwnershipSlotsProvider,
} from './content-ownership-slots.js';

describe('content ownership slots', () => {
  it('renders provided ownership content and stays empty without a provider', () => {
    const { rerender } = render(
      <>
        <ContentOwnershipPanelSlot />
        <ContentOwnershipSaveHint />
      </>
    );

    expect(screen.queryByText('Ownership panel')).toBeNull();
    expect(screen.queryByText('Save hint')).toBeNull();

    rerender(
      <ContentOwnershipSlotsProvider
        value={{
          panel: <div>Ownership panel</div>,
          saveHint: <p>Save hint</p>,
        }}
      >
        <ContentOwnershipPanelSlot />
        <ContentOwnershipSaveHint />
      </ContentOwnershipSlotsProvider>
    );

    expect(screen.getByText('Ownership panel')).toBeTruthy();
    expect(screen.getByText('Save hint')).toBeTruthy();
  });
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  ContentOwnershipPanelSlot,
  ContentOwnershipSlotsProvider,
} from './content-ownership-slots.js';

describe('content ownership slots', () => {
  it('renders provided ownership content and stays empty without a provider', () => {
    const { rerender } = render(
      <>
        <ContentOwnershipPanelSlot />
      </>
    );

    expect(screen.queryByText('Ownership panel')).toBeNull();

    rerender(
      <ContentOwnershipSlotsProvider
        value={{
          panel: <div>Ownership panel</div>,
        }}
      >
        <ContentOwnershipPanelSlot />
      </ContentOwnershipSlotsProvider>
    );

    expect(screen.getByText('Ownership panel')).toBeTruthy();
  });
});

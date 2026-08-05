import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MainserverDeviationSummary } from './mainserver-deviation-summary.js';

describe('MainserverDeviationSummary', () => {
  it('renders unique localized field groups accessibly', () => {
    render(
      <MainserverDeviationSummary
        deviations={[
          { fieldGroup: 'dates' },
          { fieldGroup: 'dates' },
          { fieldGroup: 'mediaContents' },
        ]}
        title="Einige Bereiche sind schreibgeschützt."
        fieldLabel={(field) => ({ dates: 'Termine', mediaContents: 'Medien' })[field] ?? field}
      />
    );

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Termine',
      'Medien',
    ]);
  });
});

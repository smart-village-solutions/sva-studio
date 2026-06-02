import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Card, CardTitle } from './card';

afterEach(() => {
  cleanup();
});

describe('ui/card', () => {
  it('renders card titles as named headings', () => {
    render(<CardTitle>Kartentitel</CardTitle>);

    expect(screen.getByRole('heading', { level: 3, name: 'Kartentitel' })).toBeTruthy();
  });

  it('uses a restrained radius for larger card surfaces', () => {
    render(<Card>Datenfläche</Card>);

    expect(screen.getByText('Datenfläche').className).toContain('rounded-lg');
  });
});

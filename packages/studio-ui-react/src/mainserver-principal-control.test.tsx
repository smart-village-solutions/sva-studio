import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MainserverPrincipalControl } from './mainserver-principal-control.js';

const labels = {
  dataProviderLabel: 'Datenanbieter',
  dataProviderUnavailableLabel: 'Noch nicht verfügbar',
};

afterEach(cleanup);

describe('MainserverPrincipalControl', () => {
  it('offers only typed principals and reports a deliberate change', () => {
    const onChange = vi.fn();
    render(
      <MainserverPrincipalControl
        {...labels}
        id="principal"
        label="Erstellen als"
        value="organization"
        options={[
          { value: 'organization', label: 'Stadt Musterhausen' },
          { value: 'user', label: 'Redakteurin' },
        ]}
        onChange={onChange}
      />
    );

    fireEvent.change(screen.getByLabelText('Erstellen als'), { target: { value: 'user' } });
    expect(onChange).toHaveBeenCalledWith('user');
  });

  it('renders a fixed principal and the provider as read-only values', () => {
    render(
      <MainserverPrincipalControl
        {...labels}
        id="principal"
        label="Handeln als"
        value="organization"
        options={[{ value: 'organization', label: 'Stadt Musterhausen' }]}
        onChange={vi.fn()}
        dataProvider={{ id: 'provider-1', name: 'Mainserver-Redaktion' }}
      />
    );

    expect((screen.getByLabelText('Handeln als') as HTMLInputElement).value).toBe(
      'Stadt Musterhausen'
    );
    expect(screen.getByText('Mainserver-Redaktion')).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: 'Datenanbieter' })).toBeNull();
  });

  it('shows an explicit fallback when the provider has no stable identity yet', () => {
    render(
      <MainserverPrincipalControl
        {...labels}
        id="principal"
        label="Handeln als"
        value="user"
        options={[{ value: 'user', label: 'Redakteurin' }]}
        onChange={vi.fn()}
        dataProvider={null}
      />
    );

    expect(screen.getByText('Noch nicht verfügbar')).toBeTruthy();
  });
});

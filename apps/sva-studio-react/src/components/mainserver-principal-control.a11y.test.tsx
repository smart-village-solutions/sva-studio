import { MainserverPrincipalControl } from '@sva/studio-ui-react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { expectNoA11yViolations } from '../test/a11y.js';

afterEach(cleanup);

describe('MainserverPrincipalControl accessibility', () => {
  it('has no detectable violations with selectable principal and read-only provider', async () => {
    const { container } = render(
      <MainserverPrincipalControl
        id="mainserver-principal"
        label="Erstellen als"
        description="Bestimmt die für diesen Schreibvorgang verwendeten Credentials."
        value="organization"
        options={[
          { value: 'organization', label: 'Stadt Musterhausen' },
          { value: 'user', label: 'Redakteurin' },
        ]}
        onChange={vi.fn()}
        dataProvider={{ id: 'provider-1', name: 'Mainserver-Redaktion' }}
        dataProviderLabel="Datenanbieter"
        dataProviderUnavailableLabel="Noch nicht verfügbar"
      />
    );

    await expect(expectNoA11yViolations(container)).resolves.toBeUndefined();
  });
});

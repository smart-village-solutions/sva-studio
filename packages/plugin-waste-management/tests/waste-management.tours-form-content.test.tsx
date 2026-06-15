import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WasteToursFormContent } from '../src/waste-management.tours-form-content.js';

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string) => key,
}));

vi.mock('@sva/studio-ui-react', () => ({
  Button: (props: React.ComponentProps<'button'>) => <button {...props} />,
  StudioPageHeader: ({
    title,
    description,
    actions,
  }: {
    readonly title: React.ReactNode;
    readonly description: React.ReactNode;
    readonly actions?: React.ReactNode;
  }) => (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
      {actions}
    </div>
  ),
}));

vi.mock('../src/waste-management.tours-tour-fields.js', () => ({
  WasteToursTourFields: (props: { readonly customRecurrencePresets: readonly { readonly id: string }[] }) => (
    <div>{`fields:${props.customRecurrencePresets.length}`}</div>
  ),
}));

describe('WasteToursFormContent', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders duplication hint only when duplicateFromTourId is set', () => {
    const props = {
      mode: 'create' as const,
      form: {
        id: 'tour-copy-1',
        name: 'Bio Nord (Kopie)',
        description: '',
        wasteFractionIds: [],
        recurrence: 'custom' as const,
        customRecurrenceId: '',
        firstDate: '',
        endDate: '',
        customDates: [],
        dateLocationAssignments: [],
        active: true,
      },
      fractions: [] as const,
      locations: [] as const,
      customRecurrencePresets: [] as const,
      saving: false,
      onChange: vi.fn(),
      onCancel: vi.fn(),
      onSubmit: vi.fn(),
    };

    const { rerender } = render(
      <WasteToursFormContent
        {...props}
        showDuplicationHint
        duplicateFromTourName="Bio Nord"
      />
    );

    expect(screen.getByText('tours.messages.duplicateHint')).toBeTruthy();

    rerender(
      <WasteToursFormContent
        {...props}
        showDuplicationHint={false}
        duplicateFromTourName={undefined}
      />
    );

    expect(screen.queryByText('tours.messages.duplicateHint')).toBeNull();
  });

  it('forwards submit through the form element', () => {
    const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault());

    render(
      <WasteToursFormContent
        mode="create"
        form={{
          id: 'tour-copy-1',
          name: 'Bio Nord (Kopie)',
          description: '',
          wasteFractionIds: [],
          recurrence: 'custom',
          customRecurrenceId: '',
          firstDate: '',
          endDate: '',
          customDates: [],
          dateLocationAssignments: [],
          active: true,
        }}
        fractions={[]}
        locations={[]}
        customRecurrencePresets={[]}
        saving={false}
        onChange={vi.fn()}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
        showDuplicationHint
        duplicateFromTourName="Bio Nord"
      />
    );

    const form = document.getElementById('waste-tour-form');
    expect(form).toBeTruthy();
    if (!form) {
      throw new Error('missing waste-tour-form');
    }
    fireEvent.submit(form);

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});

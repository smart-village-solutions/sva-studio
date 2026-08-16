import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WasteToursFormContent } from '../src/waste-management.tours-form-content.js';

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string) => key,
  isWasteTourValidityApplicable: (tour: { recurrence?: string; customRecurrenceId?: string }) =>
    Boolean(tour.customRecurrenceId) ||
    ['weekly', 'biweekly', 'fourweekly', 'yearly'].includes(tour.recurrence ?? ''),
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
  WasteToursTourFields: (props: {
    readonly customRecurrencePresets: readonly { readonly id: string }[];
    readonly schedulingAction?: React.ReactNode;
  }) => (
    <div>
      {`fields:${props.customRecurrencePresets.length}`}
      {props.schedulingAction}
    </div>
  ),
}));

vi.mock('../src/waste-management.tour-shift-create-link.js', () => ({
  WasteTourShiftCreateLink: ({
    label,
    disabled,
  }: {
    readonly label: string;
    readonly disabled?: boolean;
  }) =>
    disabled ? (
      <span aria-disabled="true">{label}</span>
    ) : (
      <a href="/plugins/waste-management" target="_blank">
        {label}
      </a>
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
      <WasteToursFormContent {...props} showDuplicationHint duplicateFromTourName="Bio Nord" />
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

  it('offers shift creation only while editing a recurring tour with scheduling access', () => {
    const props = {
      form: {
        id: 'tour-1',
        name: 'Bio Nord',
        description: '',
        wasteFractionIds: [],
        recurrence: 'weekly' as const,
        customRecurrenceId: '',
        firstDate: '2026-01-01',
        endDate: '2026-12-31',
        customDates: [],
        dateLocationAssignments: [],
        active: true,
      },
      fractions: [] as const,
      locations: [] as const,
      customRecurrencePresets: [] as const,
      saving: false,
      canManageScheduling: true,
      persistedTour: {
        id: 'tour-1',
        recurrence: 'weekly',
        customRecurrenceId: undefined,
        firstDate: '2026-01-01',
        endDate: '2026-12-31',
      } as never,
      search: {
        tab: 'tours' as const,
        masterDataTab: 'locations' as const,
        fractionsView: 'list' as const,
        toursView: 'edit' as const,
        locationsView: 'list' as const,
        schedulingView: 'list' as const,
        q: '',
        page: 1,
        pageSize: 25,
        status: 'all' as const,
        tourValidityPeriod: 'all' as const,
        shiftContext: 'all' as const,
        fractionsSortBy: 'name' as const,
        fractionsSortDirection: 'asc' as const,
      },
      onChange: vi.fn(),
      onCancel: vi.fn(),
      onSubmit: vi.fn(),
    };

    const { rerender } = render(<WasteToursFormContent {...props} mode="edit" />);
    expect(screen.getByRole('link', { name: 'tours.actions.createShift' })).toBeTruthy();

    rerender(<WasteToursFormContent {...props} mode="create" />);
    expect(screen.queryByRole('link', { name: 'tours.actions.createShift' })).toBeNull();

    rerender(
      <WasteToursFormContent
        {...props}
        mode="edit"
        form={{ ...props.form, recurrence: 'custom', firstDate: '', endDate: '' }}
      />
    );
    expect(screen.queryByRole('link', { name: 'tours.actions.createShift' })).toBeNull();
    expect(screen.getByText('tours.actions.createShift').getAttribute('aria-disabled')).toBe(
      'true'
    );
  });
});

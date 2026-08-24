import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { BulkLocationAssignmentsDialog } from '../src/waste-management.master-data-location-bulk-dialog.js';

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation:
    () =>
    (key: string, variables?: Readonly<Record<string, string | number>>) =>
      variables?.value === undefined ? key : `${key}:${variables.value}`,
}));

vi.mock('@sva/studio-ui-react', () => ({
  Badge: ({ children }: { readonly children: React.ReactNode }) => <span>{children}</span>,
  Button: (props: React.ComponentProps<'button'>) => <button {...props} />,
  Dialog: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { readonly children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { readonly children: React.ReactNode }) => <h2>{children}</h2>,
  Select: (props: React.ComponentProps<'select'>) => <select {...props} />,
  StudioField: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  StudioFieldGroup: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../src/waste-management.page.support.js', () => ({
  StatusNotice: () => null,
}));

vi.mock('../src/waste-management.pending-save-button.js', () => ({
  WastePendingSaveButton: ({
    disabled,
    label,
  }: {
    readonly disabled: boolean;
    readonly label: string;
  }) => <button disabled={disabled}>{label}</button>,
}));

describe('BulkLocationAssignmentsDialog', () => {
  it('uses selected ids for count and enablement when overview labels are unavailable', () => {
    render(
      <BulkLocationAssignmentsDialog
        open
        form={{ tourId: 'tour-1' }}
        selectedLocationCount={1}
        selectedLocations={[]}
        tours={[]}
        saving={false}
        message={null}
        onOpenChange={vi.fn()}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(
      screen.getByText('masterData.collectionLocations.bulk.dialog.description:1')
    ).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: 'masterData.collectionLocations.bulk.actions.assign',
      }).hasAttribute('disabled')
    ).toBe(false);
  });
});

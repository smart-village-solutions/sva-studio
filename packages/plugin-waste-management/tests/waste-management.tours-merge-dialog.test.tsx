import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { WasteTourMergePreview, WasteTourRecord } from '@sva/waste-management-contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { wasteManagementPluginTranslationsDE } from '../src/plugin.translations.de.js';
import { mergeWasteManagementTours } from '../src/waste-management.api.operations.tours.js';
import { WasteToursMergeDialog } from '../src/waste-management.tours-merge-dialog.js';

vi.mock('@sva/plugin-sdk', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@sva/plugin-sdk')>()),
  usePluginTranslation:
    () =>
    (key: string, values: Record<string, string> = {}) => {
      const table = wasteManagementPluginTranslationsDE.wasteManagement;
      const template = key
        .split('.')
        .reduce<unknown>(
          (value, segment) => (value as Record<string, unknown> | undefined)?.[segment],
          table
        );
      return String(template ?? key).replace(
        /\{\{(\w+)\}\}/g,
        (_, variable) => values[variable] ?? ''
      );
    },
}));

vi.mock('../src/waste-management.api.operations.tours.js', () => ({
  mergeWasteManagementTours: vi.fn(),
}));

const request = vi.mocked(mergeWasteManagementTours);
const name = 'Frankfurt 2027 · Gelbe Tonne · Bezirk 12';
const tours: readonly WasteTourRecord[] = [13, 9, 6].map((locationCount, index) => ({
  id: ['6b4126e6', '913a54b2', 'a3f2494c'][index]!,
  name,
  locationCount,
  firstDate: '2027-01-20',
  endDate: '2027-12-31',
  recurrence: 'fourweekly',
  wasteFractionIds: ['yellow'],
  status: 'published',
  createdAt: '',
  updatedAt: '',
}));
const [target, , hidden] = tours as readonly [WasteTourRecord, WasteTourRecord, WasteTourRecord];
const preview: WasteTourMergePreview = {
  token: 'token',
  tours: tours.map((tour) => ({ ...tour, locationCount: tour.locationCount! })),
  addedCount: 13,
  totalCount: 26,
  sharedCount: 1,
  sharedLocationLabel: 'Grenzbahnhof / Oderbrücke',
  conflicts: [],
};
const renderDialog = () => {
  const onMerged = vi.fn(async () => undefined);
  const onClose = vi.fn();
  render(
    <WasteToursMergeDialog
      tours={tours}
      filteredTours={tours.slice(0, 2)}
      onClose={onClose}
      onRestoreFocus={vi.fn()}
      onMerged={onMerged}
    />
  );
  return { onMerged, onClose };
};
const confirm = () =>
  screen.getByRole<HTMLButtonElement>('button', { name: 'Touren zusammenführen' });
const selectTarget = (id: string) =>
  fireEvent.click(screen.getByRole('radio', { name: new RegExp(id) }));

describe('WasteToursMergeDialog', () => {
  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  it('requires an explicit target and shows the named consequences and hidden source', async () => {
    request
      .mockResolvedValueOnce({ kind: 'preview', preview })
      .mockResolvedValueOnce({ kind: 'merged', totalCount: 26, archivedCount: 2 });
    const { onMerged } = renderDialog();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(confirm().disabled).toBe(true);
    expect(request).not.toHaveBeenCalled();
    selectTarget(target.id);
    expect(await screen.findByText(/13 bisherige \+ 13 neue = 26 Abholpunkte/)).toBeTruthy();
    expect(screen.getByText(/Grenzbahnhof \/ Oderbrücke zählt einmal/)).toBeTruthy();
    expect(screen.getByText(/wird sie als Quelltour archiviert/).textContent).toContain(hidden.id);
    expect(screen.getByRole('heading', { name: 'Werden archiviert' })).toBeTruthy();
    fireEvent.click(confirm());
    await waitFor(() =>
      expect(onMerged).toHaveBeenCalledWith(name, {
        kind: 'merged',
        totalCount: 26,
        archivedCount: 2,
      })
    );
    expect(request).toHaveBeenLastCalledWith({
      tourIds: tours.map((tour) => tour.id),
      targetTourId: target.id,
      confirmationToken: 'token',
    });
  });

  it('describes the hidden tour as the published target when chosen', async () => {
    request.mockResolvedValueOnce({ kind: 'preview', preview: { ...preview, addedCount: 20 } });
    renderDialog();
    selectTarget(hidden.id);
    expect(await screen.findByText(/bleibt sie als Zieltour veröffentlicht/)).toBeTruthy();
    expect(await screen.findByText(/6 bisherige \+ 20 neue = 26 Abholpunkte/)).toBeTruthy();
  });

  it('explains a planning conflict and returns to the selection', async () => {
    request.mockResolvedValueOnce({
      kind: 'preview',
      preview: {
        ...preview,
        conflicts: [{ tourId: hidden.id, reason: 'recurrence' }],
      },
    });
    const { onClose } = renderDialog();
    selectTarget(target.id);
    expect(
      (await screen.findByText(/Wählen Sie Touren mit identischer wiederkehrender Terminplanung/))
        .textContent
    ).toContain(hidden.id);
    expect(confirm().disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Auswahl ändern' }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledOnce();
  });

  it.each([
    ['stale', 'Vorschau ist veraltet'],
    ['rolled-back', 'Zusammenführen fehlgeschlagen'],
    ['unknown', 'Ergebnis konnte nicht bestätigt werden'],
  ] as const)('requires a refreshed preview after %s', async (issue, title) => {
    request.mockResolvedValueOnce({ kind: 'preview', preview });
    if (issue === 'unknown') request.mockRejectedValueOnce(new Error('connection lost'));
    else request.mockResolvedValueOnce({ kind: issue });
    request.mockResolvedValueOnce({ kind: 'preview', preview: { ...preview, token: 'new-token' } });
    const { onMerged } = renderDialog();
    selectTarget(target.id);
    await screen.findByText(/13 bisherige/);
    fireEvent.click(confirm());
    expect(await screen.findByText(title)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Touren zusammenführen' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Vorschau aktualisieren' }));
    await screen.findByText(/13 bisherige/);
    expect(onMerged).not.toHaveBeenCalled();
    expect(request).toHaveBeenLastCalledWith({
      tourIds: tours.map((tour) => tour.id),
      targetTourId: target.id,
      confirmationToken: undefined,
    });
    expect(confirm().disabled).toBe(false);
  });
});

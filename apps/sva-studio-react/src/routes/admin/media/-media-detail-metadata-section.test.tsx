import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MediaDetailMetadataSection } from './-media-detail-metadata-section';
import type { IamRegisteredMediaAsset } from '../../../lib/iam-api';

vi.mock('../../../i18n', () => ({ t: (key: string) => key }));
const asset = { id: 'asset-1', metadata: { tags: ['Park'] } } as IamRegisteredMediaAsset;

describe('media tag editor', () => {
  afterEach(cleanup);
  it('normalizes tags before saving and permits clearing the list', async () => {
    const save = vi.fn(async () => true);
    render(<MediaDetailMetadataSection asset={asset} canEditTags onSaveTags={save} />);
    const input = screen.getByLabelText('media.fields.tags');
    fireEvent.change(input, { target: { value: ' Grün   Raum \nGRÜN RAUM' } });
    fireEvent.click(screen.getByText('media.actions.save'));
    await waitFor(() => expect(save).toHaveBeenCalledWith(['Grün Raum']));
    await waitFor(() =>
      expect((screen.getByText('media.actions.save') as HTMLButtonElement).disabled).toBe(false)
    );
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.click(screen.getByText('media.actions.save'));
    await waitFor(() => expect(save).toHaveBeenLastCalledWith([]));
  });
  it('rejects oversized tags without sending a mutation', () => {
    const save = vi.fn();
    render(<MediaDetailMetadataSection asset={asset} canEditTags onSaveTags={save} />);
    fireEvent.change(screen.getByLabelText('media.fields.tags'), {
      target: { value: 'x'.repeat(65) },
    });
    fireEvent.click(screen.getByText('media.actions.save'));
    expect(screen.getByRole('alert').textContent).toContain('media.errors.invalidTags');
    expect(save).not.toHaveBeenCalled();
  });
});

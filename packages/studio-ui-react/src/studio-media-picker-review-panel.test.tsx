import * as React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StudioMediaPickerReviewPanel } from './studio-media-picker-review-panel.js';

const asset = {
  id: 'asset-1',
  title: 'Titel',
  fileName: 'bild.jpg',
  previewUrl: 'https://cdn.example.test/bild.jpg',
  persistentUrl: 'https://cdn.example.test/bild.jpg',
  mimeType: 'image/jpeg',
  visibility: 'public' as const,
  metadata: {
    title: 'Titel',
    altText: 'Alt',
    description: 'Text',
    copyright: 'Stadt',
    license: 'CC',
  },
};
const labels = {
  review: { title: 'Prüfen', description: 'Metadaten prüfen' },
  fields: {
    title: 'Titel',
    altText: 'Alternativtext',
    description: 'Beschreibung',
    copyright: 'Urheber',
    license: 'Lizenz',
  },
  actions: {
    cancel: 'Abbrechen',
    backToLibrary: 'Zurück',
    backToUpload: 'Zurück Upload',
    openMediaManagement: 'Öffnen',
    useMedia: 'Übernehmen',
  },
};

afterEach(cleanup);

describe('StudioMediaPickerReviewPanel', () => {
  it('keeps metadata read-only while still allowing explicit selection', () => {
    const confirm = vi.fn();
    const change = vi.fn();
    render(
      <StudioMediaPickerReviewPanel
        reviewSource="library"
        reviewAsset={asset}
        metadataDraft={asset.metadata}
        labels={labels}
        isMetadataEditable={false}
        onMetadataChange={change}
        onBackFromReview={vi.fn()}
        onClose={vi.fn()}
        onConfirmSelection={confirm}
      />
    );
    expect((screen.getByLabelText('Titel') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText('Beschreibung') as HTMLTextAreaElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(change).not.toHaveBeenCalled();
  });

  it('allows content editing independently of central update permission', () => {
    const change = vi.fn();
    render(
      <StudioMediaPickerReviewPanel
        reviewSource="library"
        reviewAsset={asset}
        metadataDraft={asset.metadata}
        labels={labels}
        isMetadataEditable
        onMetadataChange={change}
        onBackFromReview={vi.fn()}
        onClose={vi.fn()}
        onConfirmSelection={vi.fn()}
      />
    );
    fireEvent.change(screen.getByLabelText('Alternativtext'), { target: { value: 'Neu' } });
    expect(change).toHaveBeenCalledWith('altText', 'Neu');
  });
  it('opens central metadata in the same panel and saves tags explicitly without accepting the content', async () => {
    const save = vi.fn(async () => true);
    const accept = vi.fn();
    const change = vi.fn();
    render(
      <StudioMediaPickerReviewPanel
        reviewSource="library"
        reviewAsset={{ ...asset, metadata: { ...asset.metadata, tags: ['Stadt'] } }}
        metadataDraft={{ ...asset.metadata, altText: 'Mein Inhalt' }}
        labels={labels}
        onMetadataChange={change}
        onBackFromReview={vi.fn()}
        onClose={vi.fn()}
        onConfirmSelection={accept}
        canEditCentralMetadata
        onSaveCentralMetadata={save}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'media.editor.centralMetadataAction' }));
    expect(screen.queryByRole('button', { name: 'Übernehmen' })).toBeNull();
    expect((screen.getByLabelText('media.fields.altText') as HTMLInputElement).value).toBe('Alt');
    fireEvent.change(screen.getByLabelText('media.fields.tags'), {
      target: { value: 'Stadt\n Natur ' },
    });
    expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'media.editor.saveCentralMetadata' }));
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe('media.editor.centralMetadataSaved')
    );
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ tags: ['Stadt', 'Natur'] }));
    expect(accept).not.toHaveBeenCalled();
    expect(change).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'media.editor.backToSelection' }));
    expect((screen.getByLabelText('Alternativtext') as HTMLInputElement).value).toBe('Mein Inhalt');
  });

  it('keeps unsaved central fields when returning is cancelled', () => {
    const dirty = vi.fn();
    render(
      <StudioMediaPickerReviewPanel
        reviewSource="library"
        reviewAsset={asset}
        metadataDraft={asset.metadata}
        labels={labels}
        onMetadataChange={vi.fn()}
        onBackFromReview={vi.fn()}
        onClose={vi.fn()}
        onConfirmSelection={vi.fn()}
        canEditCentralMetadata
        onSaveCentralMetadata={vi.fn()}
        onWorkspaceDirtyChange={dirty}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'media.editor.centralMetadataAction' }));
    fireEvent.change(screen.getByLabelText('media.fields.altText'), {
      target: { value: 'Ungespeichert' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'media.editor.backToSelection' }));
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'media.editor.keepEditing' }));
    expect(screen.getByLabelText('media.fields.altText')).toHaveProperty('value', 'Ungespeichert');
    expect(dirty).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByRole('button', { name: 'media.editor.backToSelection' }));
    fireEvent.click(screen.getByRole('button', { name: 'media.editor.discardAction' }));
    expect(screen.getByLabelText('Alternativtext')).toHaveProperty('value', 'Alt');
  });

  it('shows central metadata read-only without hiding the editable content draft', () => {
    const save = vi.fn();
    render(
      <StudioMediaPickerReviewPanel
        reviewSource="library"
        reviewAsset={asset}
        metadataDraft={asset.metadata}
        labels={labels}
        onMetadataChange={vi.fn()}
        onBackFromReview={vi.fn()}
        onClose={vi.fn()}
        onConfirmSelection={vi.fn()}
        onSaveCentralMetadata={save}
      />
    );
    expect((screen.getByLabelText('Alternativtext') as HTMLInputElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'media.editor.centralMetadataAction' }));
    expect((screen.getByLabelText('media.fields.altText') as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'media.editor.saveCentralMetadata' })).toBeNull();
    expect(save).not.toHaveBeenCalled();
  });

  it('retains invalid tag input without writing and keeps an available back action', async () => {
    const save = vi.fn();
    render(
      <StudioMediaPickerReviewPanel
        reviewSource="library"
        reviewAsset={asset}
        metadataDraft={asset.metadata}
        labels={labels}
        onMetadataChange={vi.fn()}
        onBackFromReview={vi.fn()}
        onClose={vi.fn()}
        onConfirmSelection={vi.fn()}
        canEditCentralMetadata
        onSaveCentralMetadata={save}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'media.editor.centralMetadataAction' }));
    const tags = screen.getByLabelText('media.fields.tags');
    fireEvent.change(tags, { target: { value: 'a'.repeat(65) } });
    fireEvent.click(screen.getByRole('button', { name: 'media.editor.saveCentralMetadata' }));
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe('media.errors.metadataSave')
    );
    expect(save).not.toHaveBeenCalled();
    expect((tags as HTMLTextAreaElement).value).toBe('a'.repeat(65));
    expect(
      (screen.getByRole('button', { name: 'media.editor.backToSelection' }) as HTMLButtonElement)
        .disabled
    ).toBe(false);
  });
  it('offers selective refresh after a central save and preserves own content changes by default', async () => {
    const accepted = vi.fn();
    const Harness = () => {
      const [current, setCurrent] = React.useState(asset);
      const [draft, setDraft] = React.useState({
        ...asset.metadata,
        altText: 'Eigener Alternativtext',
      });
      return (
        <StudioMediaPickerReviewPanel
          reviewSource="library"
          reviewAsset={current}
          metadataDraft={draft}
          labels={labels}
          visibleMetadataFields={['altText', 'description']}
          persistenceContext="content"
          onMetadataChange={(key, value) => setDraft((previous) => ({ ...previous, [key]: value }))}
          onBackFromReview={vi.fn()}
          onClose={vi.fn()}
          onConfirmSelection={accepted}
          canEditCentralMetadata
          onSaveCentralMetadata={async (metadata) => {
            setCurrent((previous) => ({
              ...previous,
              metadata: { ...previous.metadata, ...metadata },
            }));
            return true;
          }}
        />
      );
    };
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'media.editor.centralMetadataAction' }));
    fireEvent.change(screen.getByLabelText('media.fields.altText'), {
      target: { value: 'Neuer zentraler Alternativtext' },
    });
    fireEvent.change(screen.getByLabelText('media.fields.description'), {
      target: { value: 'Neue zentrale Beschreibung' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'media.editor.saveCentralMetadata' }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'media.editor.offerMetadataRefresh' })
    );
    const choices = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(choices).toHaveLength(2);
    expect(choices[0].checked).toBe(false);
    expect(choices[1].checked).toBe(true);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'media.editor.applySelectedMetadata' }));
    fireEvent.click(screen.getByRole('button', { name: 'media.editor.backToSelection' }));
    expect((screen.getByLabelText('Alternativtext') as HTMLInputElement).value).toBe(
      'Eigener Alternativtext'
    );
    expect((screen.getByLabelText('Beschreibung') as HTMLTextAreaElement).value).toBe(
      'Neue zentrale Beschreibung'
    );
    expect(screen.queryByLabelText('Lizenz')).toBeNull();
    expect(accepted).not.toHaveBeenCalled();
  });
});

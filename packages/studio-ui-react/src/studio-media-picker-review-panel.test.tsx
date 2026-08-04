import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StudioMediaPickerReviewPanel } from './studio-media-picker-review-panel.js';

const asset = { id: 'asset-1', title: 'Titel', fileName: 'bild.jpg', previewUrl: 'https://cdn.example.test/bild.jpg', persistentUrl: 'https://cdn.example.test/bild.jpg', mimeType: 'image/jpeg', visibility: 'public' as const, metadata: { title: 'Titel', altText: 'Alt', description: 'Text', copyright: 'Stadt', license: 'CC' } };
const labels = { review: { title: 'Prüfen', description: 'Metadaten prüfen' }, fields: { title: 'Titel', altText: 'Alternativtext', description: 'Beschreibung', copyright: 'Urheber', license: 'Lizenz' }, actions: { cancel: 'Abbrechen', backToLibrary: 'Zurück', backToUpload: 'Zurück Upload', openMediaManagement: 'Öffnen', useMedia: 'Übernehmen' } };

afterEach(cleanup);

describe('StudioMediaPickerReviewPanel', () => {
  it('keeps metadata read-only while still allowing explicit selection', () => {
    const confirm = vi.fn();
    const change = vi.fn();
    render(<StudioMediaPickerReviewPanel reviewSource="library" reviewAsset={asset} metadataDraft={asset.metadata} labels={labels} isMetadataEditable={false} onMetadataChange={change} onBackFromReview={vi.fn()} onClose={vi.fn()} onConfirmSelection={confirm} />);
    expect((screen.getByLabelText('Titel') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText('Beschreibung') as HTMLTextAreaElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(change).not.toHaveBeenCalled();
  });

  it('allows editing when media.update is represented by an editable review', () => {
    const change = vi.fn();
    render(<StudioMediaPickerReviewPanel reviewSource="library" reviewAsset={asset} metadataDraft={asset.metadata} labels={labels} isMetadataEditable onMetadataChange={change} onBackFromReview={vi.fn()} onClose={vi.fn()} onConfirmSelection={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Alternativtext'), { target: { value: 'Neu' } });
    expect(change).toHaveBeenCalledWith('altText', 'Neu');
  });
});

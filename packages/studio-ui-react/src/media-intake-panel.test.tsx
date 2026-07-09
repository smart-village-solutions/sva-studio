import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MediaIntakePanel } from './media-intake-panel.js';

const renderPanel = (onFileSelected: (file: File) => void) =>
  render(
    <MediaIntakePanel
      browseActionLabel="Datei auswählen"
      description="Beschreibung"
      inputTestId="media-input"
      onFileSelected={onFileSelected}
      phase="idle"
      regionLabel="Upload"
      supportLabel="JPG, PNG, WebP"
      title="Upload"
    />
  );

describe('MediaIntakePanel', () => {
  afterEach(() => {
    cleanup();
  });

  it('forwards unsupported files from the file input so the overlay can surface an error', () => {
    const onFileSelected = vi.fn();
    renderPanel(onFileSelected);

    const file = new File(['pdf'], 'manual.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByTestId('media-input'), {
      target: { files: [file] },
    });

    expect(onFileSelected).toHaveBeenCalledWith(file);
  });

  it('forwards unsupported files from drag and drop so the overlay can surface an error', () => {
    const onFileSelected = vi.fn();
    const view = renderPanel(onFileSelected);

    const file = new File(['pdf'], 'manual.pdf', { type: 'application/pdf' });
    fireEvent.drop(view.getByTestId('media-intake-shelf'), {
      dataTransfer: { files: [file] },
    });

    expect(onFileSelected).toHaveBeenCalledWith(file);
  });
});

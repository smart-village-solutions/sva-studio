import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getHostMediaEditing } from '@sva/plugin-sdk/content-media';
import type { FilerobotImageEditorConfig } from 'react-filerobot-image-editor';
import { StudioMediaImageEditor } from './media-image-editor.js';

const library = vi.hoisted(() => ({
  props: undefined as FilerobotImageEditorConfig | undefined,
  exportImage: vi.fn(),
}));
vi.mock('react-filerobot-image-editor', () => ({
  default: (props: FilerobotImageEditorConfig) => {
    library.props = props;
    if (props.getCurrentImgDataFnRef) props.getCurrentImgDataFnRef.current = library.exportImage;
    return null;
  },
}));
vi.mock('@sva/plugin-sdk/content-media', async (original) => ({
  ...(await original<typeof import('@sva/plugin-sdk/content-media')>()),
  getHostMediaEditing: vi.fn(),
}));
const asset = {
  id: 'copy',
  title: 'Titel',
  fileName: 'foto.jpg',
  mimeType: 'image/jpeg',
  metadata: { title: 'Titel', altText: 'Alt', description: '', copyright: '', license: '' },
};
const source = {
  assetId: 'copy',
  sourceAssetId: 'root',
  sourceUrl: 'https://private.test/source?signature=private',
  sourceExpiresAt: '2099-01-01T00:00:00Z',
};

beforeEach(() => {
  library.props = undefined;
  library.exportImage.mockReset();
  vi.mocked(getHostMediaEditing).mockReset().mockResolvedValue(source);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('StudioMediaImageEditor integration', () => {
  it('renders the host explanation on the server without loading the browser library or private source', () => {
    const html = renderToString(
      <StudioMediaImageEditor asset={asset} onApply={vi.fn()} onCancel={vi.fn()} />
    );
    expect(html).toContain('media.editor.accessibilityHint');
    expect(getHostMediaEditing).not.toHaveBeenCalled();
    expect(library.props).toBeUndefined();
  });

  it('uses the authorized source with local translations and no cloud or AI services', async () => {
    render(<StudioMediaImageEditor asset={asset} onApply={vi.fn()} onCancel={vi.fn()} />);
    await waitFor(() => expect(library.props).toBeDefined());
    expect(getHostMediaEditing).toHaveBeenCalledWith(
      expect.objectContaining({ assetId: 'copy', signal: expect.any(AbortSignal) })
    );
    expect(library.props).toMatchObject({
      source: source.sourceUrl,
      useBackendTranslations: false,
      useAiTab: false,
      useCloudimage: false,
      removeSaveButton: true,
      savingPixelRatio: 1,
      Text: { fonts: ['Fira Sans', 'Arial', 'serif', 'monospace'] },
      translations: { save: 'media.filerobot.save', textTool: 'media.filerobot.textTool' },
    });
  });

  it('retains an uncommitted image design while an editor dialog Activity is suspended', async () => {
    const designState = {
      annotations: { text: { text: 'Still editing' } },
      annotationIds: ['text'],
    };
    library.exportImage.mockReturnValue({ imageData: {}, designState });
    const view = render(
      <React.Activity mode="visible">
        <StudioMediaImageEditor asset={asset} onApply={vi.fn()} onCancel={vi.fn()} />
      </React.Activity>
    );
    await waitFor(() => expect(library.props).toBeDefined());
    view.rerender(
      <React.Activity mode="hidden">
        <StudioMediaImageEditor asset={asset} onApply={vi.fn()} onCancel={vi.fn()} />
      </React.Activity>
    );
    expect(library.exportImage).toHaveBeenCalled();
    view.rerender(
      <React.Activity mode="visible">
        <StudioMediaImageEditor asset={asset} onApply={vi.fn()} onCancel={vi.fn()} />
      </React.Activity>
    );
    await waitFor(() => expect(library.props?.loadableDesignState).toEqual(designState));
  });

  it('exports a portable editable copy against the root and strips signed runtime sources', async () => {
    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'toBlob').mockImplementation((callback) =>
      callback(new Blob(['png'], { type: 'image/png' }))
    );
    library.exportImage.mockReturnValue({
      imageData: { imageCanvas: canvas },
      designState: {
        imgSrc: source.sourceUrl,
        annotations: { text: { name: 'Text', text: 'Weiter bearbeitbar', x: 10, y: 20 } },
        annotationIds: ['text'],
      },
    });
    const apply = vi.fn();
    render(<StudioMediaImageEditor asset={asset} onApply={apply} onCancel={vi.fn()} />);
    await waitFor(() => expect(library.props).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: 'media.editor.previewEditedImage' }));
    await waitFor(() => expect(apply).toHaveBeenCalledOnce());
    const result = apply.mock.calls[0][0];
    expect(result.file.name).toBe('foto.png');
    expect(result.file.type).toBe('image/png');
    expect(result.editing.sourceAssetId).toBe('root');
    expect(result.editing.document.state.annotations.text.text).toBe('Weiter bearbeitbar');
    expect(JSON.stringify(result.editing.document)).not.toContain('signature');
  });

  it('keeps the workspace available after an invalid export and after a source load failure', async () => {
    vi.mocked(getHostMediaEditing).mockRejectedValueOnce(new Error('forbidden'));
    library.exportImage.mockReturnValue({ imageData: {}, designState: {} });
    const apply = vi.fn();
    render(<StudioMediaImageEditor asset={asset} onApply={apply} onCancel={vi.fn()} />);
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'media.editor.retry' }));
    await waitFor(() => expect(library.props).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: 'media.editor.previewEditedImage' }));
    await screen.findByRole('alert');
    expect(apply).not.toHaveBeenCalled();
    expect(
      (screen.getByRole('button', { name: 'media.editor.cancelEditing' }) as HTMLButtonElement)
        .disabled
    ).toBe(false);
  });

  it('re-enables an image workspace after suspension interrupts a pending export', async () => {
    const canvas = document.createElement('canvas');
    let finish: BlobCallback | undefined;
    vi.spyOn(canvas, 'toBlob').mockImplementation((callback) => {
      finish = callback;
    });
    library.exportImage.mockReturnValue({
      imageData: { imageCanvas: canvas },
      designState: { annotations: {} },
    });
    const apply = vi.fn();
    const view = render(
      <React.Activity mode="visible">
        <StudioMediaImageEditor asset={asset} onApply={apply} onCancel={vi.fn()} />
      </React.Activity>
    );
    await waitFor(() => expect(library.props).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: 'media.editor.previewEditedImage' }));
    view.rerender(
      <React.Activity mode="hidden">
        <StudioMediaImageEditor asset={asset} onApply={apply} onCancel={vi.fn()} />
      </React.Activity>
    );
    view.rerender(
      <React.Activity mode="visible">
        <StudioMediaImageEditor asset={asset} onApply={apply} onCancel={vi.fn()} />
      </React.Activity>
    );
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'media.editor.cancelEditing' }) as HTMLButtonElement)
          .disabled
      ).toBe(false)
    );
    await act(async () => finish?.(new Blob(['png'], { type: 'image/png' })));
    expect(apply).not.toHaveBeenCalled();
  });

  it('does not accept an asynchronous export after the workspace is closed', async () => {
    const canvas = document.createElement('canvas');
    let finish: BlobCallback | undefined;
    vi.spyOn(canvas, 'toBlob').mockImplementation((callback) => {
      finish = callback;
    });
    library.exportImage.mockReturnValue({
      imageData: { imageCanvas: canvas },
      designState: { annotations: {} },
    });
    const apply = vi.fn();
    const { unmount } = render(
      <StudioMediaImageEditor asset={asset} onApply={apply} onCancel={vi.fn()} />
    );
    await waitFor(() => expect(library.props).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: 'media.editor.previewEditedImage' }));
    unmount();
    await act(async () => finish?.(new Blob(['png'], { type: 'image/png' })));
    expect(apply).not.toHaveBeenCalled();
    expect(vi.mocked(getHostMediaEditing).mock.calls[0][0].signal?.aborted).toBe(true);
  });
});

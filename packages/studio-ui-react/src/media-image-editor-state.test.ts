import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMediaEditingDocument } from '@sva/media';
import { getHostMediaEditing } from '@sva/plugin-sdk/content-media';
import {
  canvasToMediaFile,
  hydrateMediaImageEditorState,
  loadMediaImageEditorSource,
  serializeMediaImageEditorState,
} from './media-image-editor-state.js';

vi.mock('@sva/plugin-sdk/content-media', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@sva/plugin-sdk/content-media')>()),
  getHostMediaEditing: vi.fn(),
}));
const asset = {
  id: 'a',
  title: 'Foto',
  fileName: 'foto.jpg',
  metadata: { title: 'Foto', altText: '', description: '', copyright: '', license: '' },
};
afterEach(() => vi.restoreAllMocks());

describe('media image editor boundary', () => {
  it('strips signed sources and transient library fields without losing editable annotations', () => {
    const state = {
      imgSrc: 'https://private.test/signed',
      originalSource: new Image(),
      presentOriginalSources: {},
      extra: undefined,
      annotations: { t: { name: 'Text', text: 'Hallo', x: 12, y: 34, unused: undefined } },
      annotationIds: ['t'],
    };
    expect(serializeMediaImageEditorState(state).state).toEqual({
      annotations: { t: { name: 'Text', text: 'Hallo', x: 12, y: 34 } },
      annotationIds: ['t'],
    });
  });
  it('rejects remote annotation resources before they can be persisted', () => {
    expect(() =>
      serializeMediaImageEditorState({
        annotations: { i: { name: 'Image', image: 'https://external.test/x.png' } },
      })
    ).toThrow('invalid_media_editor_document');
    const image = new Image();
    image.src = 'https://external.test/x.png';
    expect(() =>
      serializeMediaImageEditorState({ annotations: { i: { name: 'Image', image } } })
    ).toThrow('invalid_media_editor_resource');
  });
  it('retains and rasterizes native originalImage handles used when replacing an inserted image', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      'data:image/png;base64,YWJj'
    );
    const image = new Image();
    image.src = 'blob:local-image';
    expect(
      serializeMediaImageEditorState({ annotations: { i: { image, originalImage: image } } }).state
        .annotations
    ).toEqual({
      i: { image: 'data:image/png;base64,YWJj', originalImage: 'data:image/png;base64,YWJj' },
    });
  });
  it('hydrates only bounded inline image resources and leaves persisted state immutable', async () => {
    vi.spyOn(HTMLImageElement.prototype, 'decode').mockResolvedValue();
    const doc = createMediaEditingDocument({
      annotations: { i: { name: 'Image', image: 'data:image/png;base64,YWJj' } },
    });
    const hydrated = (await hydrateMediaImageEditorState(doc)) as {
      annotations: { i: { image: HTMLImageElement } };
    };
    expect(hydrated.annotations.i.image).toBeInstanceOf(HTMLImageElement);
    expect(doc.state.annotations).toEqual({
      i: { name: 'Image', image: 'data:image/png;base64,YWJj' },
    });
  });
  it('keeps the local original file when reopening a rendered draft and releases its object URL', async () => {
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:original');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const sourceFile = new File(['original'], 'original.jpg', { type: 'image/jpeg' });
    const rendered = new File(['rendered'], 'new.png', { type: 'image/png' });
    const doc = createMediaEditingDocument({ annotations: {} });
    const source = await loadMediaImageEditorSource(
      {
        ...asset,
        localDraft: { id: 'draft', file: rendered, editing: { sourceFile, document: doc } },
      },
      new AbortController().signal
    );
    expect(create).toHaveBeenCalledWith(sourceFile);
    expect(source.document).toBe(doc);
    expect(source.source).toEqual({ sourceFile });
    source.release();
    expect(revoke).toHaveBeenCalledWith('blob:original');
  });
  it('uses the authorized source endpoint and preserves a local draft document over the root document', async () => {
    const document = createMediaEditingDocument({ annotations: { t: { text: 'Mein Entwurf' } } });
    vi.mocked(getHostMediaEditing).mockResolvedValue({
      assetId: 'root',
      sourceAssetId: 'root',
      sourceUrl: 'https://private.test/x',
      sourceExpiresAt: 'soon',
    });
    const signal = new AbortController().signal;
    const loaded = await loadMediaImageEditorSource(
      {
        ...asset,
        instanceId: 'selected-instance',
        localDraft: {
          id: 'draft',
          file: new File([], 'copy.png'),
          editing: { sourceAssetId: 'root', document },
        },
      },
      signal
    );
    expect(getHostMediaEditing).toHaveBeenCalledWith(
      expect.objectContaining({ assetId: 'root', instanceId: 'selected-instance', signal })
    );
    expect(loaded.document).toBe(document);
    expect(loaded.source).toEqual({ sourceAssetId: 'root' });
  });
  it('forwards the selected instance when opening an existing asset', async () => {
    vi.mocked(getHostMediaEditing).mockResolvedValue({
      assetId: 'a',
      sourceAssetId: 'a',
      sourceUrl: 'https://private.test/x',
      sourceExpiresAt: 'soon',
    });
    await loadMediaImageEditorSource(
      { ...asset, instanceId: 'selected-instance' },
      new AbortController().signal
    );
    expect(getHostMediaEditing).toHaveBeenCalledWith(
      expect.objectContaining({ assetId: 'a', instanceId: 'selected-instance' })
    );
  });
  it('exports an explicitly encoded PNG with actual canvas dimensions', async () => {
    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'toBlob').mockImplementation((callback) =>
      callback(new Blob(['png'], { type: 'image/png' }))
    );
    const file = await canvasToMediaFile(canvas, 'foto.jpg');
    expect(file.name).toBe('foto.png');
    expect(file.type).toBe('image/png');
    canvas.width = 0;
    await expect(canvasToMediaFile(canvas, 'huge.jpg')).rejects.toThrow(
      'invalid_media_editor_dimensions'
    );
  });
});

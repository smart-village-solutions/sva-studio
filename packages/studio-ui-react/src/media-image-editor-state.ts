import type { getCurrentImgDataFunction } from 'react-filerobot-image-editor';
import {
  createMediaEditingDocument,
  parseMediaEditingDocument,
  type MediaEditingDocument,
} from '@sva/media';
import { getHostMediaEditing, type HostMediaEditingUpload } from '@sva/plugin-sdk/content-media';
import type { StudioMediaPickerAssetDetail } from './studio-media-picker-overlay.shared.js';

export type StudioMediaImageEdit = Readonly<{ file: File; editing: HostMediaEditingUpload }>;

/** Filerobot's JSON export may retain native originalImage handles after replacing an image. */
export const serializeMediaImageEditorState = (state: unknown): MediaEditingDocument => {
  if (typeof state !== 'object' || state === null || Array.isArray(state))
    throw new Error('invalid_media_editor_document');
  const portable = Object.fromEntries(
    Object.entries(state).filter(
      ([key]) => !['imgSrc', 'originalSource', 'presentOriginalSources', 'extra'].includes(key)
    )
  );
  const json: unknown = JSON.parse(
    JSON.stringify(portable, (_key, value: unknown) => {
      if (!(value instanceof HTMLImageElement)) return value;
      if (!value.src.startsWith('blob:') && !value.src.startsWith('data:image/'))
        throw new Error('invalid_media_editor_resource');
      const canvas = document.createElement('canvas');
      canvas.width = value.naturalWidth;
      canvas.height = value.naturalHeight;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('media_editor_canvas_unavailable');
      context.drawImage(value, 0, 0);
      return canvas.toDataURL('image/png');
    })
  );
  return createMediaEditingDocument(json);
};

export const loadMediaImageEditorSource = async (
  asset: StudioMediaPickerAssetDetail,
  signal: AbortSignal
) => {
  const local = asset.localDraft;
  const editing = local?.editing;
  if (local && !editing?.sourceAssetId) {
    const sourceFile = editing?.sourceFile ?? local.file;
    const sourceUrl = URL.createObjectURL(sourceFile);
    return {
      sourceUrl,
      document: editing?.document,
      source: { sourceFile },
      release: () => URL.revokeObjectURL(sourceUrl),
    };
  }
  const loaded = await getHostMediaEditing({
    fetch: globalThis.fetch.bind(globalThis),
    assetId: editing?.sourceAssetId ?? asset.id,
    signal,
  });
  return {
    sourceUrl: loaded.sourceUrl,
    document: editing?.document ?? loaded.document,
    source: { sourceAssetId: loaded.sourceAssetId },
    release: () => undefined,
  };
};

/** Konva requires native image objects at runtime; only the bounded inline raster values are hydrated. */
export const hydrateMediaImageEditorState = async (
  input?: MediaEditingDocument
): Promise<object | undefined> => {
  if (!input) return undefined;
  const state = parseMediaEditingDocument(input).state;
  const hydrate = async (value: unknown, key = ''): Promise<unknown> => {
    if ((key === 'image' || key === 'originalImage') && typeof value === 'string') {
      const img = new Image();
      img.src = value;
      await img.decode();
      return img;
    }
    if (Array.isArray(value)) return Promise.all(value.map((item) => hydrate(item)));
    if (typeof value !== 'object' || value === null) return value;
    return Object.fromEntries(
      await Promise.all(
        Object.entries(value).map(async ([childKey, child]) => [
          childKey,
          await hydrate(child, childKey),
        ])
      )
    );
  };
  return (await hydrate(state)) as object;
};

export const canvasToMediaFile = async (
  canvas: HTMLCanvasElement,
  fileName: string
): Promise<File> => {
  if (!canvas.width || !canvas.height) throw new Error('invalid_media_editor_dimensions');
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error('media_editor_export_failed'))),
      'image/png'
    )
  );
  if (blob.size > 64 * 1024 * 1024) throw new Error('media_editor_export_too_large');
  return new File([blob], `${fileName.replace(/\.[^.]+$/, '')}.png`, { type: 'image/png' });
};

export const exportMediaImageEdit = async (
  exportCurrent: getCurrentImgDataFunction,
  fileName: string,
  source: Awaited<ReturnType<typeof loadMediaImageEditorSource>>['source']
): Promise<StudioMediaImageEdit> => {
  const { imageData, designState } = exportCurrent({ name: 'edited', extension: 'png' }, 1, false);
  if (!imageData.imageCanvas) throw new Error('media_editor_export_failed');
  const document = serializeMediaImageEditorState(designState);
  const file = await canvasToMediaFile(imageData.imageCanvas, fileName);
  return { file, editing: { ...source, document } };
};

import { useContentMediaTranslation } from '@sva/plugin-sdk/content-media';
import * as React from 'react';
import type {
  FilerobotImageEditorConfig,
  getCurrentImgDataFunction,
} from 'react-filerobot-image-editor';

import { Button } from './button.js';
import { createMediaImageEditorConfig } from './media-image-editor-config.js';
import {
  exportMediaImageEdit,
  hydrateMediaImageEditorState,
  loadMediaImageEditorSource,
  type StudioMediaImageEdit,
} from './media-image-editor-state.js';
import type { StudioMediaPickerAssetDetail } from './studio-media-picker-overlay.shared.js';

type LoadedEditor = Awaited<ReturnType<typeof loadMediaImageEditorSource>> &
  Readonly<{
    signal: AbortSignal;
    Editor: typeof import('react-filerobot-image-editor').default;
    state: FilerobotImageEditorConfig['loadableDesignState'];
    config: Partial<FilerobotImageEditorConfig>;
  }>;

const useMediaImageEditor = (
  asset: StudioMediaPickerAssetDetail,
  root: React.RefObject<HTMLDivElement | null>
) => {
  const t = useContentMediaTranslation();
  const [loaded, setLoaded] = React.useState<LoadedEditor>();
  const [failed, setFailed] = React.useState(false);
  const [attempt, setAttempt] = React.useState(0);
  React.useEffect(() => {
    // Vite removes the browser-only library from the production SSR dependency graph.
    if ((import.meta as ImportMeta & { readonly env?: { readonly SSR?: boolean } }).env?.SSR) return;
    const controller = new AbortController();
    let source: Awaited<ReturnType<typeof loadMediaImageEditorSource>> | undefined;
    setLoaded(undefined);
    setFailed(false);
    const load = async () => {
      try {
        source = await loadMediaImageEditorSource(asset, controller.signal);
        if (controller.signal.aborted) {
          source.release();
          return;
        }
        const [library, state] = await Promise.all([
          import('react-filerobot-image-editor'),
          hydrateMediaImageEditorState(source.document),
        ]);
        if (!controller.signal.aborted && root.current)
          setLoaded({
            ...source,
            signal: controller.signal,
            Editor: library.default,
            state: state as FilerobotImageEditorConfig['loadableDesignState'],
            config: createMediaImageEditorConfig(root.current, t),
          });
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    };
    void load();
    return () => {
      controller.abort();
      source?.release();
    };
  }, [asset, attempt, root, t]);
  return { loaded, failed, retry: () => setAttempt((current) => current + 1) };
};

type MediaImageEditorProps = Readonly<{
  asset: StudioMediaPickerAssetDetail;
  onDirtyChange?: (dirty: boolean) => void;
  onApply: (result: StudioMediaImageEdit) => void | Promise<void>;
  onCancel: () => void;
}>;
export const StudioMediaImageEditor = ({
  asset,
  onApply,
  onCancel,
  onDirtyChange,
}: MediaImageEditorProps) => {
  const t = useContentMediaTranslation();
  const root = React.useRef<HTMLDivElement>(null);
  const heading = React.useRef<HTMLHeadingElement>(null);
  const exportImage = React.useRef<getCurrentImgDataFunction | undefined>(undefined);
  const { loaded, failed, retry } = useMediaImageEditor(asset, root);
  const [saving, setSaving] = React.useState(false);
  const [exportFailed, setExportFailed] = React.useState(false);
  React.useEffect(() => heading.current?.focus(), []);
  const apply = async () => {
    if (!loaded || !exportImage.current) return;
    setSaving(true);
    setExportFailed(false);
    try {
      const result = await exportMediaImageEdit(exportImage.current, asset.fileName, loaded.source);
      if (!loaded.signal.aborted) await onApply(result);
    } catch {
      if (!loaded.signal.aborted) setExportFailed(true);
    } finally {
      if (!loaded.signal.aborted) setSaving(false);
    }
  };
  return (
    <div ref={root} className="space-y-4">
      <div className="space-y-2">
        <h3
          ref={heading}
          tabIndex={-1}
          className="rounded-sm text-lg font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t('editor.imageTitle')}
        </h3>
        <p className="text-sm text-muted-foreground">{t('editor.originalPreserved')}</p>
        <p className="text-sm text-muted-foreground">{t('editor.originalRetainedHint')}</p>
        <p className="text-sm text-muted-foreground">{t('editor.accessibilityHint')}</p>
      </div>
      {failed || exportFailed ? (
        <p role="alert" className="text-sm text-destructive">
          {t('editor.imageError')}
        </p>
      ) : null}
      {failed ? (
        <Button type="button" variant="secondary" onClick={retry}>
          {t('editor.retry')}
        </Button>
      ) : null}
      {loaded ? (
        <div className="h-[min(62vh,760px)] min-h-[420px] overflow-hidden rounded-xl border border-border bg-card">
          <loaded.Editor
            {...loaded.config}
            source={loaded.sourceUrl}
            loadableDesignState={loaded.state}
            savingPixelRatio={1}
            previewPixelRatio={1}
            getCurrentImgDataFnRef={exportImage}
            onModify={() => onDirtyChange?.(true)}
          />
        </div>
      ) : !failed ? (
        <p role="status">{t('messages.loading')}</p>
      ) : null}
      <div className="flex flex-wrap justify-between gap-3 border-t border-border pt-4">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
          {t('editor.cancelEditing')}
        </Button>
        <Button type="button" disabled={!loaded || saving} onClick={() => void apply()}>
          {t('editor.previewEditedImage')}
        </Button>
      </div>
    </div>
  );
};

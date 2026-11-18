import { defaultMediaPresets, resolveMediaFocusCrop, type MediaFocusPoint } from '@sva/media';
import { useContentMediaTranslation } from '@sva/plugin-sdk/content-media';
import * as React from 'react';
import { Button } from './button.js';

const VariantPreview = ({
  url,
  preset,
  focus,
}: Readonly<{
  url: string;
  preset: (typeof defaultMediaPresets)[number];
  focus: MediaFocusPoint;
}>) => {
  const t = useContentMediaTranslation();
  const canvas = React.useRef<HTMLCanvasElement>(null);
  const [small, setSmall] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => {
    const image = new Image();
    image.onload = () => {
      const context = canvas.current?.getContext('2d');
      if (!context) {
        setFailed(true);
        return;
      }
      const crop = resolveMediaFocusCrop(
        image.naturalWidth,
        image.naturalHeight,
        preset,
        focus
      ) ?? { left: 0, top: 0, width: image.naturalWidth, height: image.naturalHeight };
      context.clearRect(0, 0, preset.width, preset.height);
      context.drawImage(
        image,
        crop.left,
        crop.top,
        crop.width,
        crop.height,
        0,
        0,
        preset.width,
        preset.height
      );
      setSmall(crop.width < preset.width || crop.height < preset.height);
      setFailed(false);
    };
    image.onerror = () => setFailed(true);
    image.src = url;
    return () => {
      image.onload = null;
      image.onerror = null;
    };
  }, [focus.x, focus.y, preset, url]);
  return (
    <figure className="space-y-2">
      <canvas
        ref={canvas}
        width={preset.width}
        height={preset.height}
        role="img"
        aria-label={t('editor.variantPreview', {
          name: t(`editor.presets.${preset.key}`),
          width: preset.width,
          height: preset.height,
        })}
        className="h-auto w-full rounded-lg border border-border bg-muted/20"
      />
      <figcaption className="text-sm text-muted-foreground">
        {t('editor.variantPreview', {
          name: t(`editor.presets.${preset.key}`),
          width: preset.width,
          height: preset.height,
        })}
        {small ? <span className="block">{t('editor.smallImageHint')}</span> : null}
        {failed ? <span className="block text-destructive">{t('editor.previewError')}</span> : null}
      </figcaption>
    </figure>
  );
};

const focusInputHandlers = (
  image: React.RefObject<HTMLImageElement | null>,
  disabled: boolean,
  position: MediaFocusPoint,
  onFocusChange: (point: MediaFocusPoint) => void
) => {
  const move = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled || !image.current) return;
    const rect = image.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    // Letterboxing, padding and pointer movements outside the image are not image coordinates.
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    onFocusChange({ x, y });
  };
  return {
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return;
      event.currentTarget.focus();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      move(event);
    },
    onPointerMove: (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) move(event);
    },
    onPointerUp: (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.currentTarget.hasPointerCapture?.(event.pointerId))
        event.currentTarget.releasePointerCapture(event.pointerId);
    },
    onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => {
      const delta = event.shiftKey ? 0.1 : 0.01;
      const offsets: Record<string, MediaFocusPoint> = {
        ArrowLeft: { x: -delta, y: 0 },
        ArrowRight: { x: delta, y: 0 },
        ArrowUp: { x: 0, y: -delta },
        ArrowDown: { x: 0, y: delta },
      };
      const offset = offsets[event.key];
      if (!offset || disabled) return;
      event.preventDefault();
      onFocusChange({
        x: Math.min(1, Math.max(0, position.x + offset.x)),
        y: Math.min(1, Math.max(0, position.y + offset.y)),
      });
    },
  };
};

export const StudioMediaImageFocus = ({
  url,
  focus,
  onFocusChange,
  disabled = false,
  alt = '',
}: Readonly<{
  url: string;
  focus: MediaFocusPoint;
  onFocusChange: (focus: MediaFocusPoint) => void;
  disabled?: boolean;
  alt?: string;
}>) => {
  const t = useContentMediaTranslation();
  const id = React.useId();
  const image = React.useRef<HTMLImageElement>(null);
  const [imageStatus, setImageStatus] = React.useState<'loading' | 'ready' | 'failed'>('loading');
  React.useEffect(() => setImageStatus('loading'), [url]);
  const ready = imageStatus === 'ready';
  const position = {
    x: Number.isFinite(focus.x) ? Math.min(1, Math.max(0, focus.x)) : 0.5,
    y: Number.isFinite(focus.y) ? Math.min(1, Math.max(0, focus.y)) : 0.5,
  };
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-muted/20 p-4 sm:p-6">
        <button
          type="button"
          disabled={disabled || !ready}
          aria-label={t('editor.focusTitle')}
          aria-describedby={`${id}-hint ${id}-position`}
          className="relative mx-auto block max-w-full touch-none rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 disabled:cursor-default"
          {...focusInputHandlers(image, disabled || !ready, position, onFocusChange)}
        >
          <img
            ref={image}
            src={url}
            alt={alt}
            draggable={false}
            className="block h-auto max-h-[50dvh] w-auto max-w-full rounded-lg"
            onLoad={() => setImageStatus('ready')}
            onError={() => setImageStatus('failed')}
          />
          {ready ? (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-primary/20 shadow-lg"
              style={{ left: `${position.x * 100}%`, top: `${position.y * 100}%` }}
            >
              <span className="h-4 w-4 rounded-full border-2 border-white bg-primary" />
            </span>
          ) : null}
        </button>
      </div>
      <p id={`${id}-hint`} className="text-sm text-muted-foreground">
        {t('editor.focusPointHint')}
      </p>
      <p id={`${id}-position`} role="status" className="text-sm text-muted-foreground">
        {t('editor.focusPosition', {
          x: Math.round(position.x * 100),
          y: Math.round(position.y * 100),
        })}
      </p>
      {imageStatus === 'failed' ? (
        <p role="alert" className="text-sm text-destructive">
          {t('editor.previewError')}
        </p>
      ) : null}
      <Button
        type="button"
        disabled={disabled || !ready}
        variant="secondary"
        onClick={() => onFocusChange({ x: 0.5, y: 0.5 })}
      >
        {t('editor.centerFocus')}
      </Button>
    </div>
  );
};

export const StudioMediaImagePreview = ({
  url,
  focus,
  onFocusChange,
  disabled = false,
}: Readonly<{
  url: string;
  focus: MediaFocusPoint;
  disabled?: boolean;
  onFocusChange: (focus: MediaFocusPoint) => void;
}>) => {
  const t = useContentMediaTranslation();
  return (
    <section className="space-y-4">
      <h4 className="font-semibold">{t('editor.focusTitle')}</h4>
      <StudioMediaImageFocus
        url={url}
        focus={focus}
        onFocusChange={onFocusChange}
        disabled={disabled}
      />
      <StudioMediaImageExamples url={url} focus={focus} />
    </section>
  );
};

/** Illustrative crops only; target applications choose their own rendering. */
export const StudioMediaImageExamples = ({
  url,
  focus,
}: Readonly<{ url: string; focus: MediaFocusPoint }>) => {
  const t = useContentMediaTranslation();
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t('editor.focusHint')}</p>
      <div className="grid gap-4 sm:grid-cols-3">
        {defaultMediaPresets.map((preset) => (
          <VariantPreview key={preset.key} url={url} preset={preset} focus={focus} />
        ))}
      </div>
    </div>
  );
};

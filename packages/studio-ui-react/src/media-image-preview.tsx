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
  const id = React.useId();
  return (
    <section className="space-y-4">
      <h4 className="font-semibold">{t('editor.focusTitle')}</h4>
      <p className="text-sm text-muted-foreground">{t('editor.focusHint')}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {(['x', 'y'] as const).map((axis) => (
          <div className="space-y-2" key={axis}>
            <label className="block text-sm font-medium" htmlFor={`${id}-${axis}`}>
              {t(`editor.focusAxis.${axis}`)}
            </label>
            <input
              id={`${id}-${axis}`}
              type="range"
              disabled={disabled}
              min={0}
              max={100}
              step={1}
              value={Math.round(focus[axis] * 100)}
              className="w-full accent-primary"
              onChange={(event) =>
                onFocusChange({ ...focus, [axis]: Number(event.target.value) / 100 })
              }
            />
          </div>
        ))}
      </div>
      <Button
        type="button"
        disabled={disabled}
        variant="secondary"
        onClick={() => onFocusChange({ x: 0.5, y: 0.5 })}
      >
        {t('editor.centerFocus')}
      </Button>
      <div className="grid gap-4 sm:grid-cols-3">
        {defaultMediaPresets.map((preset) => (
          <VariantPreview key={preset.key} url={url} preset={preset} focus={focus} />
        ))}
      </div>
    </section>
  );
};

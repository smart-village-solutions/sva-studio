import { Button } from './button.js';
import type {
  StudioMediaPickerMode,
  StudioMediaPickerOverlayLabels,
} from './studio-media-picker-overlay.shared.js';

export const StudioMediaPickerModeActions = ({
  labels,
  mode,
  onChangeMode,
  onAddManual,
  onClose,
  disabled,
}: Readonly<{
  labels: StudioMediaPickerOverlayLabels['modes'];
  mode: StudioMediaPickerMode;
  onChangeMode: (mode: 'library' | 'upload') => void;
  onAddManual: () => string | void;
  onClose: () => void;
  disabled: boolean;
}>) => (
  <div className="flex flex-wrap gap-2 border-b border-border/60 pb-4">
    <Button
      type="button"
      disabled={disabled}
      variant={mode === 'upload' ? 'default' : 'secondary'}
      aria-pressed={mode === 'upload'}
      onClick={() => onChangeMode('upload')}
    >
      {labels.upload}
    </Button>
    <Button
      type="button"
      disabled={disabled}
      variant={mode === 'library' ? 'default' : 'secondary'}
      aria-pressed={mode === 'library'}
      onClick={() => onChangeMode('library')}
    >
      {labels.library}
    </Button>
    <button
      type="button"
      disabled={disabled}
      className="rounded-sm px-1 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
      onClick={() => {
        const uiId = onAddManual();
        onClose();
        if (uiId) {
          globalThis.setTimeout(
            () => globalThis.document?.getElementById(`content-media-${uiId}-url`)?.focus(),
            0
          );
        }
      }}
    >
      {labels.manual}
    </button>
    {mode === 'review' ? (
      <Button type="button" variant="secondary" disabled>
        {labels.review}
      </Button>
    ) : null}
  </div>
);

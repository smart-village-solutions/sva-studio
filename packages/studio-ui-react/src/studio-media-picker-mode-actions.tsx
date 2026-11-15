import { IconLink, IconPhoto, IconUpload } from '@tabler/icons-react';
import { Button } from './button.js';
import type {
  StudioMediaPickerMode,
  StudioMediaPickerOverlayLabels,
} from './studio-media-picker-overlay.shared.js';

export const StudioMediaPickerModeActions = ({
  labels,
  mode,
  onChangeMode,
  onOpenManual,
  canUpload,
  disabled,
}: Readonly<{
  labels: StudioMediaPickerOverlayLabels['modes'];
  mode: StudioMediaPickerMode | 'manual';
  onChangeMode: (mode: 'library' | 'upload') => void;
  onOpenManual?: () => void;
  canUpload: boolean;
  disabled: boolean;
}>) => (
  <div className="flex flex-col gap-2 shrink-0 border-b border-border/60 pb-4 sm:flex-row">
    <Button
      className="min-w-0 flex-1 whitespace-normal text-center"
      type="button"
      disabled={disabled || !canUpload}
      variant={mode === 'upload' ? 'primary' : 'secondary'}
      aria-pressed={mode === 'upload'}
      onClick={() => onChangeMode('upload')}
    >
      <IconUpload aria-hidden="true" className="h-5 w-5 shrink-0" />
      {labels.upload}
    </Button>
    <Button
      className="min-w-0 flex-1 whitespace-normal text-center"
      type="button"
      disabled={disabled}
      variant={mode === 'library' ? 'primary' : 'secondary'}
      aria-pressed={mode === 'library'}
      onClick={() => onChangeMode('library')}
    >
      <IconPhoto aria-hidden="true" className="h-5 w-5 shrink-0" />
      {labels.library}
    </Button>
    {onOpenManual ? (
      <Button
        className="min-w-0 flex-1 whitespace-normal text-center"
        type="button"
        disabled={disabled}
        variant={mode === 'manual' ? 'primary' : 'secondary'}
        aria-pressed={mode === 'manual'}
        onClick={onOpenManual}
      >
        <IconLink aria-hidden="true" className="h-5 w-5 shrink-0" />
        {labels.manual}
      </Button>
    ) : null}
  </div>
);

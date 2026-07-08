import React from 'react';
import { FileImage, Upload } from 'lucide-react';

import { Button } from './button.js';

export type MediaIntakePanelPhase = 'idle' | 'initializing' | 'uploading' | 'finalizing' | 'success' | 'error';

export type MediaIntakePanelProps = Readonly<{
  regionLabel: string;
  title: string;
  description: string;
  browseActionLabel: string;
  supportLabel: string;
  phase: MediaIntakePanelPhase;
  statusMessage?: string | null;
  statusTone?: 'default' | 'success' | 'error';
  accept?: string;
  inputTestId?: string;
  onFileSelected: (file: File) => void;
  isSupportedUploadFile?: (file: File) => boolean;
}>;

const defaultIsSupportedUploadFile = () => true;

export const MediaIntakePanel = ({
  accept,
  browseActionLabel,
  description,
  inputTestId,
  isSupportedUploadFile = defaultIsSupportedUploadFile,
  onFileSelected,
  phase,
  regionLabel,
  statusMessage,
  statusTone = 'default',
  supportLabel,
  title,
}: MediaIntakePanelProps) => {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [isDragActive, setIsDragActive] = React.useState(false);
  const isBusy = phase === 'initializing' || phase === 'uploading' || phase === 'finalizing';

  const statusClassName =
    statusTone === 'error'
      ? 'text-destructive'
      : statusTone === 'success'
        ? 'text-foreground'
        : 'text-muted-foreground';

  return (
    <section
      aria-label={regionLabel}
      className={`rounded-[2rem] border border-dashed bg-card/95 px-6 py-10 shadow-shell transition-colors sm:px-8 sm:py-12 ${
        isDragActive ? 'border-primary/50 bg-muted/30' : 'border-border/70'
      }`}
      data-testid="media-intake-shelf"
      onDragEnter={(event) => {
        event.preventDefault();
        if (isBusy) {
          return;
        }
        setIsDragActive(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (isBusy) {
          return;
        }
        event.dataTransfer.dropEffect = 'copy';
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
          return;
        }
        setIsDragActive(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragActive(false);
        if (isBusy) {
          return;
        }
        const file = event.dataTransfer.files?.[0];
        if (file && isSupportedUploadFile(file)) {
          onFileSelected(file);
        }
      }}
    >
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border/70 bg-muted/40 text-muted-foreground">
          <Upload aria-hidden="true" className="h-8 w-8" strokeWidth={2.2} />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
        </div>

        <input
          ref={inputRef}
          hidden
          accept={accept}
          data-testid={inputTestId}
          type="file"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file && isSupportedUploadFile(file)) {
              onFileSelected(file);
            }
            event.currentTarget.value = '';
          }}
        />

        <div className="flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
          <Button
            className="h-11 rounded-xl px-5 text-sm font-semibold"
            disabled={isBusy}
            type="button"
            onClick={() => inputRef.current?.click()}
          >
            {browseActionLabel}
          </Button>

          <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground">
            <span>{supportLabel}</span>
            <div className="flex items-center gap-2 text-foreground/70">
              <FileImage aria-hidden="true" className="h-4 w-4" />
            </div>
          </div>
        </div>

        {statusMessage ? <p className={`text-sm font-medium ${statusClassName}`}>{statusMessage}</p> : null}
      </div>
    </section>
  );
};

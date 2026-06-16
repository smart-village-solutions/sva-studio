import React from 'react';
import { FileImage, FileText, Upload, Video } from 'lucide-react';

import { Button } from '../../../components/ui/button';
import { t } from '../../../i18n';
import type { IamHttpError } from '../../../lib/iam-api';

type MediaIntakeShelfProps = {
  readonly phase: 'idle' | 'initializing' | 'uploading' | 'finalizing' | 'success' | 'error';
  readonly error: IamHttpError | Error | null;
  readonly onFileSelected: (file: File) => void;
};

const acceptedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

const isSupportedUploadFile = (file: File) => acceptedMimeTypes.has(file.type);

const uploadErrorMessage = (error: IamHttpError | Error | null) => {
  if (!error || !('code' in error) || typeof error.code !== 'string') {
    return t('media.library.upload.error');
  }

  switch (error.code) {
    case 'forbidden':
      return t('media.errors.forbidden');
    case 'database_unavailable':
      return t('media.errors.databaseUnavailable');
    case 'invalid_media_content':
      return t('media.errors.invalidMediaContent');
    case 'upload_size_exceeded':
      return t('media.errors.uploadSizeExceeded');
    default:
      return t('media.library.upload.error');
  }
};

export const MediaIntakeShelf = ({ phase, error, onFileSelected }: MediaIntakeShelfProps) => {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [isDragActive, setIsDragActive] = React.useState(false);
  const isBusy = phase === 'initializing' || phase === 'uploading' || phase === 'finalizing';

  return (
    <section
      aria-label={t('media.library.quickIntake.regionLabel')}
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
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            {t('media.library.quickIntake.title')}
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            {t('media.library.quickIntake.description')}
          </p>
        </div>

        <input
          ref={inputRef}
          hidden
          accept="image/jpeg,image/png,image/webp"
          data-testid="media-upload-input"
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
            {t('media.actions.selectFiles')}
          </Button>

          <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground">
            <span>{t('media.library.quickIntake.supportLabel')}</span>
            <div className="flex items-center gap-2 text-foreground/70">
              <FileImage aria-hidden="true" className="h-4 w-4" />
              <Video aria-hidden="true" className="h-4 w-4" />
              <FileText aria-hidden="true" className="h-4 w-4" />
            </div>
          </div>
        </div>

        {phase === 'initializing' ? (
          <p className="text-sm font-medium text-muted-foreground">{t('media.library.upload.initializing')}</p>
        ) : null}
        {phase === 'uploading' ? (
          <p className="text-sm font-medium text-muted-foreground">{t('media.library.upload.uploading')}</p>
        ) : null}
        {phase === 'finalizing' ? (
          <p className="text-sm font-medium text-muted-foreground">{t('media.library.upload.finalizing')}</p>
        ) : null}
        {phase === 'success' ? (
          <p className="text-sm font-medium text-foreground">{t('media.library.upload.success')}</p>
        ) : null}
        {phase === 'error' ? (
          <p className="text-sm font-medium text-destructive">{uploadErrorMessage(error)}</p>
        ) : null}
      </div>
    </section>
  );
};

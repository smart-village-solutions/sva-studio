import { MediaIntakePanel } from '@sva/studio-ui-react';
import { t } from '../../../i18n';
import type { IamHttpError } from '../../../lib/iam-api';

type MediaIntakeShelfProps = {
  readonly phase: 'idle' | 'initializing' | 'uploading' | 'finalizing' | 'success' | 'error';
  readonly error: IamHttpError | Error | null;
  readonly onFileSelected: (file: File) => void;
};

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
  const statusTone = phase === 'error' ? 'error' : phase === 'success' ? 'success' : 'default';
  const statusMessage =
    phase === 'idle'
      ? null
      : phase === 'initializing'
        ? t('media.library.upload.initializing')
        : phase === 'uploading'
          ? t('media.library.upload.uploading')
          : phase === 'finalizing'
            ? t('media.library.upload.finalizing')
            : phase === 'success'
              ? t('media.library.upload.success')
              : uploadErrorMessage(error);

  return (
    <MediaIntakePanel
      accept="image/jpeg,image/png,image/webp"
      browseActionLabel={t('media.actions.selectFiles')}
      description={t('media.library.quickIntake.description')}
      inputTestId="media-upload-input"
      onFileSelected={onFileSelected}
      phase={phase}
      regionLabel={t('media.library.quickIntake.regionLabel')}
      statusMessage={statusMessage}
      statusTone={statusTone}
      supportLabel={t('media.library.quickIntake.supportLabel')}
      title={t('media.library.quickIntake.title')}
    />
  );
};

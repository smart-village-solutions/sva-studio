import * as React from 'react';
import { Alert, AlertDescription, Button } from '@sva/studio-ui-react';

export function PoiDetailMediaUpload({
  isUploading,
  uploadError,
  uploadSuccess,
  onUpload,
  onUploaded,
  pt,
}: Readonly<{
  isUploading: boolean;
  uploadError: string | null;
  uploadSuccess: string | null;
  onUpload: (file: File) => Promise<string | null>;
  onUploaded: (assetId: string) => void;
  pt: (key: string) => string;
}>) {
  const uploadInputId = React.useId();
  const uploadInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleFileSelection = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) {
        return;
      }
      const assetId = await onUpload(file);
      if (assetId) {
        onUploaded(assetId);
      }
    },
    [onUpload, onUploaded],
  );

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <input
          ref={uploadInputRef}
          id={uploadInputId}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => void handleFileSelection(event)}
        />
        <Button type="button" variant="outline" onClick={() => uploadInputRef.current?.click()} disabled={isUploading}>
          {isUploading ? pt('actions.uploadingMedia') : pt('actions.uploadMedia')}
        </Button>
      </div>
      {uploadError ? (
        <Alert>
          <AlertDescription>{uploadError}</AlertDescription>
        </Alert>
      ) : null}
      {uploadSuccess ? (
        <Alert>
          <AlertDescription>{uploadSuccess}</AlertDescription>
        </Alert>
      ) : null}
    </>
  );
}

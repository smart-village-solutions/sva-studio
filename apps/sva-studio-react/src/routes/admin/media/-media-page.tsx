import { useLocation, useParams, useSearch } from '@tanstack/react-router';

import { MediaCreatePage } from './-media-create-page.js';
import { MediaDetailPage } from './-media-detail-page.js';
import { MediaLibraryPage } from './-media-library-page.js';
import { MediaUnregisteredDetailPage } from './-media-unregistered-detail-page.js';
import { decodeBucketMediaId } from './-media-ui.shared.js';

const readSearchValue = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

export const MediaPage = () => {
  const { pathname } = useLocation();
  const { mediaId } = useParams({ strict: false });
  const search = useSearch({ strict: false });

  if (pathname.endsWith('/new')) {
    return <MediaCreatePage />;
  }

  if (typeof mediaId === 'string' && mediaId.length > 0) {
    const bucketStorageKey = decodeBucketMediaId(mediaId);
    if (bucketStorageKey) {
      return (
        <MediaUnregisteredDetailPage
          asset={{
            source: 'bucket',
            registrationStatus: 'unregistered',
            storageKey: bucketStorageKey,
            fileName: readSearchValue(search.fileName) ?? bucketStorageKey.split('/').pop() ?? bucketStorageKey,
            folderPath: readSearchValue(search.folderPath) ?? '',
            relativePath: readSearchValue(search.relativePath) ?? bucketStorageKey,
            byteSize: typeof search.byteSize === 'number' ? search.byteSize : Number(search.byteSize ?? 0),
            updatedAt: readSearchValue(search.updatedAt) ?? null,
            lastModified: readSearchValue(search.lastModified) ?? null,
            previewUrl: readSearchValue(search.previewUrl) ?? null,
          }}
        />
      );
    }

    return <MediaDetailPage assetId={mediaId} />;
  }

  return <MediaLibraryPage />;
};

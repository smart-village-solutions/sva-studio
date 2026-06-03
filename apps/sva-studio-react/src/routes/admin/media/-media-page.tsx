import { useLocation, useParams } from '@tanstack/react-router';

import MediaCreatePage from './-media-create-page.js';
import MediaDetailPage from './-media-detail-page.js';
import MediaLibraryPage from './-media-library-page.js';

export const MediaPage = () => {
  const { pathname } = useLocation();
  const { mediaId } = useParams({ strict: false });

  if (typeof mediaId === 'string' && mediaId.length > 0) {
    return <MediaDetailPage assetId={mediaId} />;
  }

  if (pathname.endsWith('/new')) {
    return <MediaCreatePage />;
  }

  return <MediaLibraryPage />;
};

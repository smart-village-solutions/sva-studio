import { useParams } from '@tanstack/react-router';

import { MediaDetailPage } from './-media-detail-page.js';

export const MediaUsagePage = () => {
  const params = useParams({ strict: false });
  const mediaId = typeof params.mediaId === 'string' ? params.mediaId : null;

  return mediaId ? <MediaDetailPage assetId={mediaId} /> : null;
};

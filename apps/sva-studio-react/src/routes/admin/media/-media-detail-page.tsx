import type { MediaDetailPageProps } from './-media-ui.shared.js';

export const MediaDetailPage = ({ assetId }: MediaDetailPageProps) => (
  <section data-testid="media-detail-page" data-asset-id={assetId} />
);

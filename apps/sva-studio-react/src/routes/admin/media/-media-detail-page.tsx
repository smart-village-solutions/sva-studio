import type { MediaDetailPageProps } from './-media-ui.shared.js';

const MediaDetailPage = ({ assetId }: MediaDetailPageProps) => (
  <section data-testid="media-detail-page" data-asset-id={assetId} />
);

export default MediaDetailPage;

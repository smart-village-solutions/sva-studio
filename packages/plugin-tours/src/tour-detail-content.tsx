import {
  fetchIamContentHistory,
  formatDateTimeInEditorTimeZone,
  readPluginLocales,
  type usePluginTranslation,
} from '@sva/plugin-sdk';
import { StudioContentHistory, StudioDetailCard } from '@sva/studio-ui-react';

export type TourDetailFields = {
  id: string;
  geometryTourData: readonly { latitude?: number | null; longitude?: number | null }[];
  tourStops: readonly { id: string; name?: string | null }[];
};

export function TourDetailContent({
  tour,
  pt,
}: {
  tour: TourDetailFields;
  pt: ReturnType<typeof usePluginTranslation>;
}) {
  const { locale } = readPluginLocales();
  return (
    <>
      <StudioDetailCard title={pt('route')}>
        {tour.geometryTourData.length ? (
          <ol className="list-decimal space-y-1 ps-6">
            {tour.geometryTourData.map(({ latitude, longitude }, index) => (
              <li key={index}>
                {latitude == null || longitude == null
                  ? pt('unknown')
                  : pt('coordinates', {
                      latitude: latitude.toLocaleString(locale, { maximumFractionDigits: 8 }),
                      longitude: longitude.toLocaleString(locale, { maximumFractionDigits: 8 }),
                    })}
              </li>
            ))}
          </ol>
        ) : (
          <p>{pt('noRoute')}</p>
        )}
      </StudioDetailCard>
      <StudioDetailCard title={pt('stops')}>
        {tour.tourStops.length ? (
          <ol className="list-decimal space-y-1 ps-6">
            {tour.tourStops.map((stop) => (
              <li key={stop.id}>{stop.name || pt('unknown')}</li>
            ))}
          </ol>
        ) : (
          <p>{pt('noStops')}</p>
        )}
      </StudioDetailCard>
      <StudioDetailCard title={pt('history')}>
        <StudioContentHistory
          contentId={tour.id}
          loadHistory={(id) => fetchIamContentHistory(id, { contentType: 'tours.tour' })}
          labels={{
            loading: pt('loading'),
            error: pt('historyError'),
            empty: pt('historyEmpty'),
            createHint: pt('historyEmpty'),
            tableLabel: pt('history'),
            time: pt('historyTime'),
            action: pt('historyAction'),
            actor: pt('historyActor'),
            summary: pt('historySummary'),
            emptySummary: pt('unknown'),
          }}
          formatAction={(action) => pt(action === 'created' ? 'historyCreated' : 'historyChanged')}
          formatDate={(date) => formatDateTimeInEditorTimeZone(date) ?? date}
        />
      </StudioDetailCard>
    </>
  );
}

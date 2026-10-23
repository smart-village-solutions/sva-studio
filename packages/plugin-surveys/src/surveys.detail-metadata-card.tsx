import { formatDateTimeInEditorTimeZone } from '@sva/plugin-sdk';
import { SurveyDetailCard } from './surveys.detail-card.js';
import type { SurveyContentItem } from './surveys.types.js';
import type { SurveyContentTranslate } from './surveys.question-editor.shared.js';

const formatMetadataDate = (value?: string) =>
  value ? (formatDateTimeInEditorTimeZone(value) ?? value) : '--.--.-- --:--';

export function SurveyMetadataCard({
  mode,
  loadedItem,
  pt,
}: Readonly<{
  mode: 'create' | 'edit';
  loadedItem: Pick<
    SurveyContentItem,
    'createdAt' | 'updatedAt' | 'publishedAt' | 'archivedAt'
  > | null;
  pt: SurveyContentTranslate;
}>) {
  return (
    <SurveyDetailCard
      title={pt('cards.basis.metadata.title')}
      description={pt('cards.basis.metadata.description')}
    >
      {mode === 'create' ? (
        <p className="text-sm text-muted-foreground">{pt('messages.metadataCreateHint')}</p>
      ) : (
        <dl className="grid gap-4 rounded-xl border border-border/60 bg-muted/20 p-4 text-sm md:grid-cols-2">
          <div className="space-y-1">
            <dt className="font-medium text-foreground">{pt('fields.createdAt')}</dt>
            <dd className="text-muted-foreground">{formatMetadataDate(loadedItem?.createdAt)}</dd>
          </div>
          <div className="space-y-1">
            <dt className="font-medium text-foreground">{pt('fields.updatedAt')}</dt>
            <dd className="text-muted-foreground">{formatMetadataDate(loadedItem?.updatedAt)}</dd>
          </div>
          <div className="space-y-1">
            <dt className="font-medium text-foreground">{pt('fields.publishedAt')}</dt>
            <dd className="text-muted-foreground">{formatMetadataDate(loadedItem?.publishedAt)}</dd>
          </div>
          <div className="space-y-1">
            <dt className="font-medium text-foreground">{pt('fields.archivedAt')}</dt>
            <dd className="text-muted-foreground">{formatMetadataDate(loadedItem?.archivedAt)}</dd>
          </div>
        </dl>
      )}
    </SurveyDetailCard>
  );
}

import { StudioSummaryCard } from '../../../components/StudioSummaryCard';
import { t } from '../../../i18n';

type MediaPriorityShelfProps = Readonly<{
  blocked: number;
  newItems: number;
  unused: number;
}>;

export const MediaPriorityShelf = ({ blocked, newItems, unused }: MediaPriorityShelfProps) => (
  <div className="grid gap-4 md:grid-cols-3">
    <StudioSummaryCard
      eyebrow={t('media.library.priority.blocked')}
      value={String(blocked)}
      description={t('media.library.priority.blockedHint')}
      valueClassName="text-destructive"
    />
    <StudioSummaryCard
      eyebrow={t('media.library.priority.new')}
      value={String(newItems)}
      description={t('media.library.priority.newHint')}
      valueClassName="text-secondary"
    />
    <StudioSummaryCard
      eyebrow={t('media.library.priority.unused')}
      value={String(unused)}
      description={t('media.library.priority.unusedHint')}
      valueClassName="text-muted-foreground"
    />
  </div>
);

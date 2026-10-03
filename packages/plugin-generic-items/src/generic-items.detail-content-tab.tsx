import type React from 'react';
import { ContentMediaUsageBlock, type ContentMediaUsage } from '@sva/studio-ui-react';
import { GenericItemsContentText } from './generic-items.content-text.js';
import { GenericItemsContentRelations } from './generic-items.content-relations.js';
import { GenericItemsContentLinksMedia } from './generic-items.content-links-media.js';
import { GenericItemsContentSecondary } from './generic-items.content-secondary.js';
import { GenericItemsContentSchedule } from './generic-items.content-schedule.js';

export const GenericItemsDetailContentTab = ({
  labels,
  onAddManualMedia,
  onOpenMediaPicker,
  mediaUsages,
  onChangeMediaUsages = () => undefined,
  canSelectMedia = true,
  canUploadMedia = true,
  mediaEditingDisabled = false,
  onLoadAssetSnapshot,
}: Readonly<{
  labels: Record<string, string>;
  onAddManualMedia: () => string;
  onOpenMediaPicker: (mode: 'library' | 'upload') => void;
  mediaUsages?: readonly ContentMediaUsage[];
  onChangeMediaUsages?: (usages: readonly ContentMediaUsage[]) => void;
  canSelectMedia?: boolean;
  canUploadMedia?: boolean;
  mediaEditingDisabled?: boolean;
  onLoadAssetSnapshot?: React.ComponentProps<typeof ContentMediaUsageBlock>['onLoadAssetSnapshot'];
}>) => {
  return (
    <div className="space-y-4">
      <GenericItemsContentText labels={labels} />
      <GenericItemsContentRelations labels={labels} />
      <GenericItemsContentLinksMedia
        labels={labels}
        onAddManualMedia={onAddManualMedia}
        onOpenMediaPicker={onOpenMediaPicker}
        mediaUsages={mediaUsages}
        onChangeMediaUsages={onChangeMediaUsages}
        canSelectMedia={canSelectMedia}
        canUploadMedia={canUploadMedia}
        mediaEditingDisabled={mediaEditingDisabled}
        onLoadAssetSnapshot={onLoadAssetSnapshot}
      />

      <GenericItemsContentSecondary labels={labels} />
      <GenericItemsContentSchedule labels={labels} />
    </div>
  );
};

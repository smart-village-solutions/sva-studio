import { useFormContext, useWatch } from 'react-hook-form';
import type { GenericItemsDetailFormValues } from './generic-items.validation.js';
import { GenericItemsDetailCard } from './generic-items.detail-card.js';
import { GenericItemsContentText } from './generic-items.content-text.js';
import { GenericItemsContentLinksMedia } from './generic-items.content-links-media.js';
import { GenericItemsContentRelations } from './generic-items.content-relations.js';
import { GenericItemsContentSchedule } from './generic-items.content-schedule.js';
import { GenericItemsContentSecondary } from './generic-items.content-secondary.js';
import {
  ContentOwnershipPanelSlot,
  StudioSection,
  ContentMediaUsageBlock,
  StudioDetailTabs,
  type ContentMediaUsage,
  type StudioDetailTabDefinition,
} from '@sva/studio-ui-react';
import type React from 'react';

import type { GenericItemCategoryOption } from './generic-items.api-types.js';
import { GenericItemsDetailBasisTab } from './generic-items.detail-basis-tab.js';
import { GenericItemsDetailContentTab } from './generic-items.detail-content-tab.js';
import { GenericItemsDetailHistoryTab } from './generic-items.detail-history-tab.js';
import { GenericItemsDetailSettingsTab } from './generic-items.detail-settings-tab.js';
import type { GenericItemsDetailTabId } from './generic-items.detail-tabs.js';

type GenericItemsDetailTabsProps = Readonly<{
  mode?: 'create' | 'edit';
  activeTab: GenericItemsDetailTabId;
  categoryOptions: readonly GenericItemCategoryOption[];
  categoryOptionsError: string | null;
  categoryOptionsLoading: boolean;
  contentId?: string;
  labels: Record<string, string>;
  onAddManualMedia: () => string;
  onOpenMediaPicker: (mode: 'library' | 'upload') => void;
  onTabChange: (tabId: GenericItemsDetailTabId) => void;
  pt: (key: string) => string;
  mediaUsages?: readonly ContentMediaUsage[];
  onChangeMediaUsages?: (usages: readonly ContentMediaUsage[]) => void;
  canSelectMedia?: boolean;
  canUploadMedia?: boolean;
  mediaEditingDisabled?: boolean;
  onLoadAssetSnapshot?: React.ComponentProps<typeof ContentMediaUsageBlock>['onLoadAssetSnapshot'];
}>;

const createGenericItemsDetailTabs = ({
  categoryOptions,
  categoryOptionsError,
  categoryOptionsLoading,
  contentId,
  labels,
  onAddManualMedia,
  onOpenMediaPicker,
  pt,
  mediaUsages,
  onChangeMediaUsages,
  canSelectMedia,
  canUploadMedia,
  mediaEditingDisabled,
  onLoadAssetSnapshot,
}: GenericItemsDetailTabsProps): readonly StudioDetailTabDefinition<GenericItemsDetailTabId>[] => [
  {
    id: 'basis',
    label: pt('tabs.basis.label'),
    title: pt('tabs.basis.title'),
    description: pt('tabs.basis.description'),
    icon: 'basis',
    panel: (
      <div className="space-y-4">
        {contentId ? <ContentOwnershipPanelSlot /> : null}
        <GenericItemsDetailBasisTab
          availableCategories={categoryOptions}
          categoryOptionsError={categoryOptionsError}
          categoryOptionsLoading={categoryOptionsLoading}
          labels={labels}
        />
      </div>
    ),
  },
  {
    id: 'content',
    label: pt('tabs.content.label'),
    title: pt('tabs.content.title'),
    description: pt('tabs.content.description'),
    icon: 'content',
    panel: (
      <GenericItemsDetailContentTab
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
    ),
  },
  {
    id: 'settings',
    label: pt('tabs.settings.label'),
    title: pt('tabs.settings.title'),
    description: pt('tabs.settings.description'),
    icon: 'settings',
    panel: <GenericItemsDetailSettingsTab labels={labels} />,
  },
  {
    id: 'history',
    label: pt('tabs.history.label'),
    title: pt('tabs.history.title'),
    description: pt('tabs.history.description'),
    icon: 'history',
    panel: <GenericItemsDetailHistoryTab contentId={contentId} pt={pt} />,
  },
];

function GenericItemsTechnicalCard({
  basis,
  pt,
}: Readonly<{
  basis: React.ComponentProps<typeof GenericItemsDetailBasisTab>;
  pt: GenericItemsDetailTabsProps['pt'];
}>) {
  const { labels } = basis;
  const {
    control,
    formState: { errors },
  } = useFormContext<GenericItemsDetailFormValues>();
  const keywords = useWatch({ control, name: 'keywords' });
  const externalId = useWatch({ control, name: 'externalId' });
  const payload = useWatch({ control, name: 'payloadText' });
  return (
    <GenericItemsDetailCard
      title={pt('create.technical')}
      collapsible
      invalid={Boolean(errors.keywords || errors.externalId || errors.payloadText)}
      summary={pt(
        keywords || externalId || (payload.trim() && payload.trim() !== '{}')
          ? 'create.technicalPresent'
          : 'create.technicalEmpty'
      )}
    >
      <GenericItemsDetailBasisTab {...basis} createSection="technical" />
      <GenericItemsDetailSettingsTab labels={labels} />
    </GenericItemsDetailCard>
  );
}

function GenericItemsCreateFields(props: GenericItemsDetailTabsProps) {
  const {
    categoryOptions,
    categoryOptionsError,
    categoryOptionsLoading,
    labels,
    pt,
    onAddManualMedia,
    onOpenMediaPicker,
    mediaUsages,
    onChangeMediaUsages,
    canSelectMedia,
    canUploadMedia,
    mediaEditingDisabled,
    onLoadAssetSnapshot,
  } = props;
  const basis = {
    availableCategories: categoryOptions,
    categoryOptionsError,
    categoryOptionsLoading,
    labels,
  };
  const media = {
    labels,
    onAddManualMedia,
    onOpenMediaPicker,
    mediaUsages,
    onChangeMediaUsages,
    canSelectMedia,
    canUploadMedia,
    mediaEditingDisabled,
    onLoadAssetSnapshot,
  };
  return (
    <StudioSection title={pt('create.heading')} className="space-y-6">
      <GenericItemsDetailBasisTab {...basis} createSection="identity" />
      <section id="generic-create-content" tabIndex={-1} className="space-y-6">
        <GenericItemsContentText labels={labels} createMode />
        <GenericItemsContentLinksMedia {...media} section="media" />
        <GenericItemsDetailBasisTab {...basis} createSection="categories" />
      </section>
      <section id="generic-create-links" tabIndex={-1}>
        <GenericItemsContentLinksMedia {...media} section="links" />
      </section>
      <section id="generic-create-relations" tabIndex={-1}>
        <GenericItemsContentRelations labels={labels} createMode />
      </section>
      <GenericItemsContentSchedule labels={labels} createMode />
      <GenericItemsContentSecondary labels={labels} createMode />
      <GenericItemsTechnicalCard basis={basis} pt={pt} />
      <section id="generic-create-publication" tabIndex={-1}>
        <GenericItemsDetailBasisTab {...basis} createSection="publication" />
      </section>
    </StudioSection>
  );
}

export const GenericItemsDetailTabs = (props: GenericItemsDetailTabsProps) => {
  const { mode, activeTab, onTabChange, pt } = props;
  if (mode === 'create') return <GenericItemsCreateFields {...props} />;
  const tabs = createGenericItemsDetailTabs(props);

  return (
    <StudioDetailTabs
      ariaLabel={pt('tabs.ariaLabel')}
      mobileSelectLabel={pt('tabs.mobileLabel')}
      tabs={tabs}
      value={activeTab}
      onValueChange={onTabChange}
      keepMounted
    />
  );
};

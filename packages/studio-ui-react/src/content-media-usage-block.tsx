import * as React from 'react';

import { Button } from './button.js';
import { ContentMediaMetadataDialog } from './content-media-metadata-dialog.js';
import type {
  ContentMediaAssetSnapshot,
  ContentMediaUsage,
  ContentMediaUsagePatch,
} from './content-media-usage.js';
import { ContentMediaUsageItem } from './content-media-usage-item.js';
import {
  useContentMediaMetadataRefresh,
  useContentMediaUsageObjectUrlCleanup,
  useContentMediaUsageListActions,
} from './use-content-media-usage-block.js';

export type ContentMediaUsageBlockLabels = Readonly<{
  title: string;
  description: string;
  empty: string;
  actions: Readonly<{
    add: string;
    remove: string;
    moveUp: string;
    moveDown: string;
    refreshMetadata: string;
    cancel: string;
    apply: string;
  }>;
  fields: Readonly<{
    url: string;
    altText: string;
    caption: string;
    credit: string;
    license: string;
  }>;
  states: Readonly<{
    linked: string;
    manual: string;
    synced: string;
    pending: string;
    missing: string;
    additional: string;
    unresolved: string;
    failed: string;
    previewUnavailable: string;
  }>;
  announcements: Readonly<{ moved: string; removed: string }>;
  urlFeedback: Readonly<{
    upgradedToHttps: string;
    insecureHttp: string;
    httpsUnavailable: string;
    invalid: string;
  }>;
  refresh: Readonly<{
    title: string;
    description: string;
    assetValue: string;
    contentValue: string;
  }>;
}>;

export type ContentMediaUsageSupportedFields = Readonly<{
  altText?: boolean;
  caption?: boolean;
  credit?: boolean;
  license?: boolean;
}>;

export type ContentMediaUsageBlockProps = Readonly<{
  usages: readonly ContentMediaUsage[];
  onChange: (usages: readonly ContentMediaUsage[]) => void;
  onAddManual: () => string | void;
  onOpenLibrary?: () => void;
  onOpenUpload?: () => void;
  onLoadAssetSnapshot?: (usage: ContentMediaUsage) => Promise<ContentMediaAssetSnapshot>;
  labels: ContentMediaUsageBlockLabels;
  supportedFields?: ContentMediaUsageSupportedFields;
  errors?: Readonly<Record<string, string | undefined>>;
  renderAdditionalFields?: (input: {
    usage: ContentMediaUsage;
    index: number;
    update: (patch: ContentMediaUsagePatch) => void;
  }) => React.ReactNode;
  showHeader?: boolean;
  disabled?: boolean;
}>;

type ContentMediaUsageItemsProps = Readonly<{
  usages: readonly ContentMediaUsage[];
  labels: ContentMediaUsageBlockLabels;
  supportedFields: ContentMediaUsageSupportedFields;
  errors: Readonly<Record<string, string | undefined>>;
  canRefresh: boolean;
  refreshingUiId: string | null;
  refreshErrorUiId: string | null;
  renderAdditionalFields?: ContentMediaUsageBlockProps['renderAdditionalFields'];
  update: (index: number, patch: ContentMediaUsagePatch) => void;
  move: (usage: ContentMediaUsage, index: number, direction: -1 | 1) => void;
  remove: (index: number) => void;
  refresh: (usage: ContentMediaUsage) => void;
}>;

const ContentMediaUsageBlockHeader = ({
  labels,
  showHeader,
}: Readonly<{ labels: ContentMediaUsageBlockLabels; showHeader: boolean }>) =>
  showHeader ? (
    <div className="space-y-1">
      <h3 id="content-media-block-title" className="text-lg font-semibold text-foreground">
        {labels.title}
      </h3>
      <p className="text-sm text-muted-foreground">{labels.description}</p>
    </div>
  ) : null;

const ContentMediaUsageItems = ({
  canRefresh,
  errors,
  labels,
  move,
  refresh,
  refreshErrorUiId,
  refreshingUiId,
  remove,
  renderAdditionalFields,
  supportedFields,
  update,
  usages,
}: ContentMediaUsageItemsProps) => (
  <div className="space-y-4">
    {usages.map((usage, index) => (
      <ContentMediaUsageItem
        key={usage.uiId}
        usage={usage}
        index={index}
        total={usages.length}
        labels={labels}
        supportedFields={supportedFields}
        errors={errors}
        refreshing={refreshingUiId === usage.uiId}
        refreshFailed={refreshErrorUiId === usage.uiId}
        canRefresh={canRefresh}
        onUpdate={(patch) => update(index, patch)}
        onMove={(direction) => move(usage, index, direction)}
        onRemove={() => remove(index)}
        onRefresh={() => refresh(usage)}
        additionalFields={renderAdditionalFields?.({
          usage,
          index,
          update: (patch) => update(index, patch),
        })}
      />
    ))}
  </div>
);

export const ContentMediaUsageBlock = ({
  disabled = false,
  errors = {},
  labels,
  onAddManual,
  onChange,
  onLoadAssetSnapshot,
  onOpenLibrary,
  onOpenUpload,
  renderAdditionalFields,
  supportedFields = { altText: true, caption: true, credit: true, license: false },
  showHeader = true,
  usages,
}: ContentMediaUsageBlockProps) => {
  useContentMediaUsageObjectUrlCleanup(usages);
  const { add, announcement, move, remove, update } = useContentMediaUsageListActions({
    announcements: labels.announcements,
    onAddManual,
    onChange,
    onOpenLibrary,
    onOpenUpload,
    usages,
  });
  const { diffState, refresh, refreshingUiId, refreshErrorUiId, setDiffState } =
    useContentMediaMetadataRefresh({ onLoadAssetSnapshot });

  return (
    <section
      aria-labelledby={showHeader ? 'content-media-block-title' : undefined}
      aria-label={showHeader ? undefined : labels.title}
    >
      <fieldset disabled={disabled} aria-busy={disabled} className="min-w-0 space-y-4 border-0 p-0">
        <ContentMediaUsageBlockHeader labels={labels} showHeader={showHeader} />
        <p className="sr-only" aria-live="polite">
          {announcement}
        </p>
        {usages.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-sm text-muted-foreground">
            {labels.empty}
          </p>
        ) : null}
        <ContentMediaUsageItems
          usages={usages}
          labels={labels}
          supportedFields={supportedFields}
          errors={errors}
          canRefresh={Boolean(onLoadAssetSnapshot)}
          refreshingUiId={refreshingUiId}
          refreshErrorUiId={refreshErrorUiId}
          renderAdditionalFields={renderAdditionalFields}
          update={update}
          move={move}
          remove={remove}
          refresh={refresh}
        />
        <div>
          <Button id="content-media-add" type="button" onClick={add}>
            {labels.actions.add}
          </Button>
        </div>
        {diffState ? (
          <ContentMediaMetadataDialog
            asset={diffState.asset}
            usage={diffState.usage}
            labels={labels}
            supportedFields={supportedFields}
            onClose={() => setDiffState(null)}
            onApply={(patch) => {
              const index = usages.findIndex((usage) => usage.uiId === diffState.usage.uiId);
              if (index >= 0) update(index, patch);
            }}
          />
        ) : null}
      </fieldset>
    </section>
  );
};

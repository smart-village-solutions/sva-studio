import * as React from 'react';

import { Button } from './button.js';
import { ContentMediaMetadataDialog } from './content-media-metadata-dialog.js';
import type { ContentMediaAssetSnapshot, ContentMediaUsage, ContentMediaUsagePatch } from './content-media-usage.js';
import { moveContentMediaUsage } from './content-media-usage.js';
import { ContentMediaUsageItem } from './content-media-usage-item.js';

export type ContentMediaUsageBlockLabels = Readonly<{
  title: string;
  description: string;
  empty: string;
  actions: Readonly<{ library: string; upload: string; manual: string; remove: string; moveUp: string; moveDown: string; refreshMetadata: string; cancel: string; apply: string }>;
  fields: Readonly<{ url: string; altText: string; caption: string; credit: string; license: string }>;
  states: Readonly<{ linked: string; manual: string; synced: string; pending: string; missing: string; additional: string; unresolved: string; failed: string; previewUnavailable: string }>;
  announcements: Readonly<{ moved: string; removed: string }>;
  refresh: Readonly<{ title: string; description: string; assetValue: string; contentValue: string }>;
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
  onAddManual: () => void;
  onOpenLibrary?: () => void;
  onOpenUpload?: () => void;
  onLoadAssetSnapshot?: (usage: ContentMediaUsage) => Promise<ContentMediaAssetSnapshot>;
  labels: ContentMediaUsageBlockLabels;
  supportedFields?: ContentMediaUsageSupportedFields;
  errors?: Readonly<Record<string, string | undefined>>;
  renderAdditionalFields?: (input: { usage: ContentMediaUsage; index: number; update: (patch: ContentMediaUsagePatch) => void }) => React.ReactNode;
  showHeader?: boolean;
}>;

type DiffState = Readonly<{ usage: ContentMediaUsage; asset: ContentMediaAssetSnapshot }>;

export const ContentMediaUsageBlock = ({
  errors = {}, labels, onAddManual, onChange, onLoadAssetSnapshot, onOpenLibrary,
  onOpenUpload, renderAdditionalFields,
  supportedFields = { altText: true, caption: true, credit: true, license: false },
  showHeader = true, usages,
}: ContentMediaUsageBlockProps) => {
  const [announcement, setAnnouncement] = React.useState('');
  const [refreshingUiId, setRefreshingUiId] = React.useState<string | null>(null);
  const [refreshErrorUiId, setRefreshErrorUiId] = React.useState<string | null>(null);
  const [diffState, setDiffState] = React.useState<DiffState | null>(null);
  const update = (index: number, patch: ContentMediaUsagePatch) =>
    onChange(usages.map((usage, currentIndex) => currentIndex === index ? { ...usage, ...patch } : usage));
  const move = (usage: ContentMediaUsage, index: number, direction: -1 | 1) => {
    onChange(moveContentMediaUsage(usages, index, index + direction));
    const position = direction < 0 ? index : index + 2;
    setAnnouncement(labels.announcements.moved.replace('{{position}}', String(position)).replace('{{total}}', String(usages.length)));
    globalThis.setTimeout(() => globalThis.document?.getElementById(`content-media-${usage.uiId}-remove`)?.focus(), 0);
  };
  const remove = (index: number) => {
    onChange(usages.filter((_, currentIndex) => currentIndex !== index).map((entry, sortOrder) => ({ ...entry, sortOrder })));
    setAnnouncement(labels.announcements.removed);
    globalThis.setTimeout(() => {
      const next = usages[index + 1] ?? usages[index - 1];
      globalThis.document?.getElementById(next ? `content-media-${next.uiId}-remove` : 'content-media-add-manual')?.focus();
    }, 0);
  };
  const refresh = (usage: ContentMediaUsage) => {
    if (!onLoadAssetSnapshot) return;
    setRefreshingUiId(usage.uiId);
    setRefreshErrorUiId(null);
    void onLoadAssetSnapshot(usage).then((asset) => setDiffState({ usage, asset }))
      .catch(() => setRefreshErrorUiId(usage.uiId)).finally(() => setRefreshingUiId(null));
  };

  return <section className="space-y-4" aria-labelledby={showHeader ? 'content-media-block-title' : undefined} aria-label={showHeader ? undefined : labels.title}>
    {showHeader ? <div className="space-y-1"><h3 id="content-media-block-title" className="text-lg font-semibold text-foreground">{labels.title}</h3><p className="text-sm text-muted-foreground">{labels.description}</p></div> : null}
    <p className="sr-only" aria-live="polite">{announcement}</p>
    {usages.length === 0 ? <p className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-sm text-muted-foreground">{labels.empty}</p> : null}
    <div className="space-y-4">{usages.map((usage, index) => <ContentMediaUsageItem
      key={usage.uiId} usage={usage} index={index} total={usages.length} labels={labels}
      supportedFields={supportedFields} errors={errors} refreshing={refreshingUiId === usage.uiId}
      refreshFailed={refreshErrorUiId === usage.uiId} canRefresh={Boolean(onLoadAssetSnapshot)}
      onUpdate={(patch) => update(index, patch)} onMove={(direction) => move(usage, index, direction)}
      onRemove={() => remove(index)} onRefresh={() => refresh(usage)}
      additionalFields={renderAdditionalFields?.({ usage, index, update: (patch) => update(index, patch) })}
    />)}</div>
    <div className="flex flex-wrap gap-3">
      {onOpenLibrary ? <Button type="button" variant="outline" onClick={onOpenLibrary}>{labels.actions.library}</Button> : null}
      {onOpenUpload ? <Button type="button" variant="outline" onClick={onOpenUpload}>{labels.actions.upload}</Button> : null}
      <Button id="content-media-add-manual" type="button" variant="outline" onClick={onAddManual}>{labels.actions.manual}</Button>
    </div>
    {diffState ? <ContentMediaMetadataDialog asset={diffState.asset} usage={diffState.usage} labels={labels} supportedFields={supportedFields} onClose={() => setDiffState(null)} onApply={(patch) => {
      const index = usages.findIndex((usage) => usage.uiId === diffState.usage.uiId);
      if (index >= 0) update(index, patch);
    }} /> : null}
  </section>;
};

import type { ReactNode } from 'react';

import { Badge } from './badge.js';
import { Button } from './button.js';
import type { ContentMediaUsageBlockLabels, ContentMediaUsageSupportedFields } from './content-media-usage-block.js';
import type { ContentMediaUsage, ContentMediaUsagePatch } from './content-media-usage.js';
import { Input } from './input.js';
import { StudioField, StudioFieldGroup } from './studio-primitives.js';

type ItemProps = Readonly<{
  usage: ContentMediaUsage; index: number; total: number; labels: ContentMediaUsageBlockLabels;
  supportedFields: ContentMediaUsageSupportedFields; errors: Readonly<Record<string, string | undefined>>;
  refreshing: boolean; refreshFailed: boolean; canRefresh: boolean; additionalFields?: ReactNode;
  onUpdate: (patch: ContentMediaUsagePatch) => void; onMove: (direction: -1 | 1) => void;
  onRemove: () => void; onRefresh: () => void;
}>;

const statusTone = (status: ContentMediaUsage['referenceStatus']) =>
  status === 'failed' || status === 'missing' || status === 'unresolved' ? 'destructive' : 'secondary';

const Preview = ({ labels, usage }: Pick<ItemProps, 'labels' | 'usage'>) => {
  const previewUrl = usage.previewUrl || usage.persistentUrl;
  const status = usage.referenceStatus ?? (usage.assetId ? 'pending' : 'synced');
  const showReferenceStatus = Boolean(usage.assetId) || status !== 'synced';
  return <div className="space-y-3">
    <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-muted/20">
      {previewUrl ? <img className="h-full w-full object-cover" src={previewUrl} alt={usage.altText} /> : <span className="px-4 text-center text-sm text-muted-foreground">{labels.states.previewUnavailable}</span>}
    </div>
    <div className="flex flex-wrap gap-2"><Badge variant="secondary">{usage.assetId ? labels.states.linked : labels.states.manual}</Badge>{showReferenceStatus ? <Badge variant={statusTone(status)}>{labels.states[status]}</Badge> : null}</div>
  </div>;
};

const UsageFields = ({ errors, labels, onUpdate, supportedFields, usage }: Pick<ItemProps, 'errors' | 'labels' | 'onUpdate' | 'supportedFields' | 'usage'>) => {
  const urlError = errors[`${usage.uiId}.persistentUrl`];
  const field = (suffix: string, label: string, value: string, patch: (value: string) => ContentMediaUsagePatch) => <StudioField id={`content-media-${usage.uiId}-${suffix}`} label={label}><Input id={`content-media-${usage.uiId}-${suffix}`} value={value} onChange={(event) => onUpdate(patch(event.currentTarget.value))} /></StudioField>;
  return <StudioFieldGroup columns={2}>
    <StudioField id={`content-media-${usage.uiId}-url`} label={labels.fields.url} error={urlError}>
      <Input id={`content-media-${usage.uiId}-url`} type="url" aria-invalid={urlError ? true : undefined} aria-describedby={urlError ? `content-media-${usage.uiId}-url-error` : undefined} value={usage.persistentUrl} onChange={(event) => onUpdate({ persistentUrl: event.currentTarget.value })} />
    </StudioField>
    {supportedFields.altText ? field('alt', labels.fields.altText, usage.altText, (altText) => ({ altText })) : null}
    {supportedFields.caption ? field('caption', labels.fields.caption, usage.caption, (caption) => ({ caption })) : null}
    {supportedFields.credit ? field('credit', labels.fields.credit, usage.credit, (credit) => ({ credit })) : null}
    {supportedFields.license ? field('license', labels.fields.license, usage.license ?? '', (license) => ({ license })) : null}
  </StudioFieldGroup>;
};

const UsageActions = ({ canRefresh, index, labels, onMove, onRefresh, onRemove, refreshFailed, refreshing, total, usage }: Pick<ItemProps, 'canRefresh' | 'index' | 'labels' | 'onMove' | 'onRefresh' | 'onRemove' | 'refreshFailed' | 'refreshing' | 'total' | 'usage'>) => <>
  <div className="flex flex-wrap gap-2">
    <Button type="button" variant="outline" disabled={index === 0} onClick={() => onMove(-1)}>{labels.actions.moveUp}</Button>
    <Button type="button" variant="outline" disabled={index === total - 1} onClick={() => onMove(1)}>{labels.actions.moveDown}</Button>
    {usage.assetId && canRefresh ? <Button type="button" variant="outline" disabled={refreshing} aria-describedby={refreshFailed ? `content-media-${usage.uiId}-refresh-error` : undefined} onClick={onRefresh}>{labels.actions.refreshMetadata}</Button> : null}
    <Button id={`content-media-${usage.uiId}-remove`} type="button" variant="outline" onClick={onRemove}>{labels.actions.remove}</Button>
  </div>
  {refreshFailed ? <p id={`content-media-${usage.uiId}-refresh-error`} role="alert" className="text-sm text-destructive">{labels.states.failed}</p> : null}
</>;

export const ContentMediaUsageItem = (props: ItemProps) => <article className="grid gap-4 rounded-xl border border-border/60 p-4 lg:grid-cols-[minmax(12rem,18rem)_1fr]">
  <Preview labels={props.labels} usage={props.usage} />
  <div className="space-y-4">
    <UsageFields errors={props.errors} labels={props.labels} onUpdate={props.onUpdate} supportedFields={props.supportedFields} usage={props.usage} />
    {props.additionalFields}
    <UsageActions {...props} />
  </div>
</article>;

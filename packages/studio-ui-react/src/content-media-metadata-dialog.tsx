import * as React from 'react';

import { Button } from './button.js';
import { Checkbox } from './checkbox.js';
import type { ContentMediaUsageBlockLabels, ContentMediaUsageSupportedFields } from './content-media-usage-block.js';
import type { ContentMediaAssetSnapshot, ContentMediaUsage, ContentMediaUsagePatch } from './content-media-usage.js';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './dialog.js';

type MetadataKey = keyof ContentMediaAssetSnapshot;
const metadataKeys = ['persistentUrl', 'altText', 'caption', 'credit', 'license'] as const;
const isVisible = (key: MetadataKey, fields: ContentMediaUsageSupportedFields) =>
  key === 'persistentUrl' || (key === 'altText' && fields.altText) || (key === 'caption' && fields.caption) || (key === 'credit' && fields.credit) || (key === 'license' && fields.license);
const defaultSelection = (usage: ContentMediaUsage, asset: ContentMediaAssetSnapshot) => Object.fromEntries(metadataKeys.map((key) => {
  const original = usage.assetSnapshot?.[key];
  return [key, original !== undefined && usage[key] === original && asset[key] !== usage[key]];
})) as Readonly<Record<MetadataKey, boolean>>;

export const ContentMediaMetadataDialog = ({ asset, labels, onApply, onClose, supportedFields, usage }: Readonly<{
  asset: ContentMediaAssetSnapshot;
  labels: ContentMediaUsageBlockLabels;
  onApply: (patch: ContentMediaUsagePatch) => void;
  onClose: () => void;
  supportedFields: ContentMediaUsageSupportedFields;
  usage: ContentMediaUsage;
}>) => {
  const [selection, setSelection] = React.useState(() => defaultSelection(usage, asset));
  const visibleKeys = metadataKeys.filter((key) => isVisible(key, supportedFields));
  const apply = () => {
    const patch = Object.fromEntries(visibleKeys.filter((key) => selection[key]).map((key) => [key, asset[key]])) as ContentMediaUsagePatch;
    onApply({ ...patch, assetSnapshot: asset });
    onClose();
  };
  return <Dialog open onOpenChange={(open) => !open ? onClose() : undefined}>
    <DialogContent>
      <DialogHeader><DialogTitle>{labels.refresh.title}</DialogTitle><DialogDescription>{labels.refresh.description}</DialogDescription></DialogHeader>
      <div className="max-h-[55vh] space-y-3 overflow-y-auto py-4">{visibleKeys.map((key) => <label key={key} className="grid cursor-pointer grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-xl border border-border/60 p-3">
        <Checkbox checked={selection[key]} onChange={(event) => setSelection((current) => ({ ...current, [key]: event.currentTarget.checked }))} />
        <span className="min-w-0 space-y-2"><span className="block text-sm font-medium text-foreground">{key === 'persistentUrl' ? labels.fields.url : labels.fields[key]}</span><span className="block break-all text-xs text-muted-foreground">{labels.refresh.assetValue}: {asset[key]}</span><span className="block break-all text-xs text-muted-foreground">{labels.refresh.contentValue}: {usage[key]}</span></span>
      </label>)}</div>
      <DialogFooter><Button type="button" variant="outline" onClick={onClose}>{labels.actions.cancel}</Button><Button type="button" onClick={apply}>{labels.actions.apply}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
};

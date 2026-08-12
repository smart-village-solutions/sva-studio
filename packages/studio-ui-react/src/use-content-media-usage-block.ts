import * as React from 'react';

import type { ContentMediaUsageBlockLabels } from './content-media-usage-block.js';
import type {
  ContentMediaAssetSnapshot,
  ContentMediaUsage,
  ContentMediaUsagePatch,
} from './content-media-usage.js';
import { moveContentMediaUsage } from './content-media-usage.js';

type UsageListActionsInput = Readonly<{
  usages: readonly ContentMediaUsage[];
  onChange: (usages: readonly ContentMediaUsage[]) => void;
  onAddManual: () => string | void;
  onOpenLibrary?: () => void;
  onOpenUpload?: () => void;
  announcements: ContentMediaUsageBlockLabels['announcements'];
}>;

export const useContentMediaUsageListActions = ({
  announcements,
  onAddManual,
  onChange,
  onOpenLibrary,
  onOpenUpload,
  usages,
}: UsageListActionsInput) => {
  const [announcement, setAnnouncement] = React.useState('');
  const update = (index: number, patch: ContentMediaUsagePatch) =>
    onChange(
      usages.map((usage, currentIndex) => (currentIndex === index ? { ...usage, ...patch } : usage))
    );
  const move = (usage: ContentMediaUsage, index: number, direction: -1 | 1) => {
    onChange(moveContentMediaUsage(usages, index, index + direction));
    const position = direction < 0 ? index : index + 2;
    setAnnouncement(
      announcements.moved
        .replace('{{position}}', String(position))
        .replace('{{total}}', String(usages.length))
    );
    globalThis.setTimeout(
      () => globalThis.document?.getElementById(`content-media-${usage.uiId}-remove`)?.focus(),
      0
    );
  };
  const remove = (index: number) => {
    onChange(
      usages
        .filter((_, currentIndex) => currentIndex !== index)
        .map((entry, sortOrder) => ({ ...entry, sortOrder }))
    );
    setAnnouncement(announcements.removed);
    globalThis.setTimeout(() => {
      const next = usages[index + 1] ?? usages[index - 1];
      globalThis.document
        ?.getElementById(next ? `content-media-${next.uiId}-remove` : 'content-media-add')
        ?.focus();
    }, 0);
  };
  const add = () => {
    if (onOpenUpload) return onOpenUpload();
    if (onOpenLibrary) return onOpenLibrary();
    const uiId = onAddManual();
    if (uiId) {
      globalThis.setTimeout(
        () => globalThis.document?.getElementById(`content-media-${uiId}-url`)?.focus(),
        0
      );
    }
  };

  return { add, announcement, move, remove, update };
};

type MetadataRefreshInput = Readonly<{
  onLoadAssetSnapshot?: (usage: ContentMediaUsage) => Promise<ContentMediaAssetSnapshot>;
}>;

export const useContentMediaMetadataRefresh = ({ onLoadAssetSnapshot }: MetadataRefreshInput) => {
  const [refreshingUiId, setRefreshingUiId] = React.useState<string | null>(null);
  const [refreshErrorUiId, setRefreshErrorUiId] = React.useState<string | null>(null);
  const [diffState, setDiffState] = React.useState<Readonly<{
    usage: ContentMediaUsage;
    asset: ContentMediaAssetSnapshot;
  }> | null>(null);
  const refresh = (usage: ContentMediaUsage) => {
    if (!onLoadAssetSnapshot) return;
    setRefreshingUiId(usage.uiId);
    setRefreshErrorUiId(null);
    void onLoadAssetSnapshot(usage)
      .then((asset) => setDiffState({ usage, asset }))
      .catch(() => setRefreshErrorUiId(usage.uiId))
      .finally(() => setRefreshingUiId(null));
  };

  return { diffState, refresh, refreshingUiId, refreshErrorUiId, setDiffState };
};

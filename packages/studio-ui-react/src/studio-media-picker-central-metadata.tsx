import { StudioConfirmDialog } from './studio-confirm-dialog.js';
import { StudioMediaMetadataRefresh } from './content-media-metadata-dialog.js';
import { normalizeMediaMetadataPatch, type MediaEditorialMetadataPatch } from '@sva/media';
import { useContentMediaTranslation } from '@sva/plugin-sdk/content-media';
import * as React from 'react';

import { Button } from './button.js';
import { CentralMetadataFields } from './studio-media-picker-review-fields.js';
import {
  createMetadataDraft,
  type StudioMediaPickerAssetDetail,
  type StudioMediaPickerMetadataDraft,
  type StudioMediaPickerMetadataField,
} from './studio-media-picker-overlay.shared.js';

type CentralMetadataFooterProps = Readonly<{
  status: 'saved' | 'error' | null;
  isLocal: boolean;
  persistenceContext?: 'content' | 'library' | 'settings';
  canRefresh: boolean;
  canEdit: boolean;
  isSaving: boolean;
  onBack: () => void;
  onSave: () => void;
  onRefresh: () => void;
}>;
const CentralMetadataFooter = (props: CentralMetadataFooterProps) => {
  const t = useContentMediaTranslation();
  const {
    status,
    isLocal,
    persistenceContext,
    canRefresh,
    canEdit,
    isSaving,
    onBack,
    onSave,
    onRefresh,
  } = props;
  const message =
    status === 'error'
      ? 'errors.metadataSave'
      : isLocal
        ? 'editor.localMetadataApplied'
        : persistenceContext === 'settings'
          ? 'editor.centralMetadataSettingsSaved'
          : 'editor.centralMetadataSaved';
  return (
    <>
      {status ? (
        <p
          role="status"
          className={
            status === 'error' ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'
          }
        >
          {t(message)}
        </p>
      ) : null}
      {status === 'saved' &&
      !isLocal &&
      canRefresh &&
      (persistenceContext ?? 'content') === 'content' ? (
        <Button type="button" variant="secondary" onClick={onRefresh}>
          {t('editor.offerMetadataRefresh')}
        </Button>
      ) : null}
      <div className="flex flex-wrap justify-between gap-3 border-t border-border/60 pt-4">
        <Button type="button" variant="secondary" disabled={isSaving} onClick={onBack}>
          {t('editor.backToSelection')}
        </Button>
        {canEdit ? (
          <Button type="button" disabled={isSaving} onClick={onSave}>
            {t(isLocal ? 'editor.applyLocalMetadata' : 'editor.saveCentralMetadata')}
          </Button>
        ) : null}
      </div>
    </>
  );
};

const CentralMetadataHeader = ({
  titleRef,
  isLocal,
}: Readonly<{
  titleRef: React.RefObject<HTMLHeadingElement | null>;
  isLocal: boolean;
}>) => {
  const t = useContentMediaTranslation();
  return (
    <div className="space-y-2">
      <h3
        className="rounded-sm text-lg font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
        ref={titleRef}
        tabIndex={-1}
      >
        {t('editor.centralMetadataTitle')}
      </h3>
      <p className="text-sm text-muted-foreground">
        {t(isLocal ? 'editor.localMetadataHint' : 'editor.centralMetadataHint')}
      </p>
    </div>
  );
};

type CentralMetadataProps = Readonly<{
  asset: StudioMediaPickerAssetDetail;
  canEdit: boolean;
  isSaving: boolean;
  onSave: (metadata: MediaEditorialMetadataPatch) => Promise<boolean>;
  onBack: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  persistenceContext?: 'content' | 'library' | 'settings';
  contentDraft?: StudioMediaPickerMetadataDraft;
  visibleFields?: readonly StudioMediaPickerMetadataField[];
  onContentChange?: (field: StudioMediaPickerMetadataField, value: string) => void;
}>;

const useCentralMetadataDiscard = (
  dirty: boolean,
  onDirtyChange: CentralMetadataProps['onDirtyChange'],
  onBack: () => void
) => {
  const [confirmDiscard, setConfirmDiscard] = React.useState(false);
  React.useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  const back = () => {
    if (dirty) setConfirmDiscard(true);
    else onBack();
  };
  return { confirmDiscard, setConfirmDiscard, back };
};

const useCentralMetadataDraft = (
  asset: CentralMetadataProps['asset'],
  onSave: CentralMetadataProps['onSave']
) => {
  const previous = React.useRef(asset.metadata);
  const [draft, setDraft] = React.useState(() => createMetadataDraft(asset));
  const [tags, setTags] = React.useState(() => (asset.metadata.tags ?? []).join('\n'));
  const [status, setStatus] = React.useState<'saved' | 'error' | null>(null);
  const dirty =
    status !== 'saved' &&
    (JSON.stringify(draft) !== JSON.stringify(createMetadataDraft(asset)) ||
      tags !== (asset.metadata.tags ?? []).join('\n'));
  const save = async () => {
    setStatus(null);
    try {
      const metadata = normalizeMediaMetadataPatch({
        ...draft,
        tags: tags.split('\n').filter((tag) => tag.trim()),
      });
      previous.current = asset.metadata;
      const saved = await onSave(metadata);
      setStatus(saved ? 'saved' : 'error');
    } catch {
      setStatus('error');
    }
  };
  return { previous, draft, setDraft, tags, setTags, status, setStatus, save, dirty };
};

export const StudioMediaPickerCentralMetadata = ({
  asset,
  canEdit,
  isSaving,
  onSave,
  onBack,
  onDirtyChange,
  persistenceContext,
  contentDraft,
  visibleFields = [],
  onContentChange,
}: CentralMetadataProps) => {
  const t = useContentMediaTranslation();
  const [showRefresh, setShowRefresh] = React.useState(false);
  const { previous, draft, setDraft, tags, setTags, status, setStatus, save, dirty } =
    useCentralMetadataDraft(asset, onSave);
  const { confirmDiscard, setConfirmDiscard, back } = useCentralMetadataDiscard(
    dirty,
    onDirtyChange,
    onBack
  );
  const titleRef = React.useRef<HTMLHeadingElement>(null);
  React.useEffect(() => titleRef.current?.focus(), []);
  if (showRefresh && contentDraft && onContentChange)
    return (
      <StudioMediaMetadataRefresh
        previous={previous.current}
        current={asset.metadata}
        content={contentDraft}
        fields={visibleFields}
        onChange={onContentChange}
        onBack={() => {
          setShowRefresh(false);
          requestAnimationFrame(() => titleRef.current?.focus());
        }}
      />
    );
  return (
    <section className="space-y-5">
      <StudioConfirmDialog
        open={confirmDiscard}
        title={t('editor.discardChanges')}
        description={t('editor.discardHint')}
        confirmLabel={t('editor.discardAction')}
        cancelLabel={t('editor.keepEditing')}
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={() => {
          onDirtyChange?.(false);
          onBack();
        }}
      />
      <CentralMetadataHeader titleRef={titleRef} isLocal={Boolean(asset.localDraft)} />
      <CentralMetadataFields
        draft={draft}
        tags={tags}
        canEdit={canEdit}
        isSaving={isSaving}
        onChange={(key, value) => {
          setDraft((current) => ({ ...current, [key]: value }));
          setStatus(null);
        }}
        onTagsChange={(value) => {
          setTags(value);
          setStatus(null);
        }}
      />
      <CentralMetadataFooter
        status={status}
        isLocal={Boolean(asset.localDraft)}
        persistenceContext={persistenceContext}
        canRefresh={Boolean(contentDraft && onContentChange)}
        canEdit={canEdit}
        isSaving={isSaving}
        onBack={back}
        onSave={() => void save()}
        onRefresh={() => setShowRefresh(true)}
      />
    </section>
  );
};

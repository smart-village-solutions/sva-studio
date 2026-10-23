/** Central metadata form. Changes never overwrite content-specific snapshots. */
import React from 'react';
import {
  mediaMetadataLimits,
  mediaMetadataTextFields,
  normalizeMediaMetadataPatch,
  type MediaEditorialMetadataPatch,
} from '@sva/media';
import { Button, StudioSaveButton, useStudioSaveFeedback } from '@sva/studio-ui-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import { Label } from '../../../components/ui/label';
import { t } from '../../../i18n';
import type { IamRegisteredMediaAsset } from '../../../lib/iam-api';

type MediaDetailMetadataSectionProps = Readonly<{
  asset: IamRegisteredMediaAsset;
  canEdit?: boolean;
  onDraftChange?: (metadata: MediaEditorialMetadataPatch) => void;
  onSave?: (metadata: MediaEditorialMetadataPatch) => Promise<boolean>;
}>;

const createDraft = (asset: IamRegisteredMediaAsset) => ({
  title: asset.metadata.title ?? '',
  altText: asset.metadata.altText ?? '',
  description: asset.metadata.description ?? '',
  copyright: asset.metadata.copyright ?? '',
  license: asset.metadata.license ?? '',
  tags: (asset.metadata.tags ?? []).join('\n'),
});

export const MediaDetailMetadataSection = ({
  asset,
  canEdit = false,
  onDraftChange,
  onSave,
}: MediaDetailMetadataSectionProps) => {
  const [draft, setDraft] = React.useState(() => createDraft(asset));
  React.useEffect(() => {
    onDraftChange?.({ ...draft, tags: draft.tags.split('\n').filter((line) => line.trim()) });
  }, [draft, onDraftChange]);
  const feedback = useStudioSaveFeedback();
  const saving = feedback.status === 'saving';
  const [error, setError] = React.useState<string | null>(null);
  const reset = () => {
    setDraft(createDraft(asset));
    setError(null);
    feedback.reset();
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canEdit || !onSave || saving) return;
    setError(null);
    feedback.markDirty();
    let metadata: MediaEditorialMetadataPatch;
    try {
      metadata = normalizeMediaMetadataPatch({
        ...draft,
        tags: draft.tags.split('\n').filter((line) => line.trim()),
      });
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message.startsWith('invalid_media_metadata:')
          ? 'media.errors.invalidMetadata'
          : 'media.errors.invalidTags'
      );
      return;
    }
    const operationId = feedback.beginSaving();
    try {
      if (await onSave(metadata)) {
        const next = createDraft(asset);
        for (const field of mediaMetadataTextFields) next[field] = metadata[field] ?? '';
        next.tags = (metadata.tags ?? []).join('\n');
        setDraft(next);
        feedback.markSaved(operationId);
      } else {
        feedback.markFailed(operationId);
      }
    } catch {
      setError('media.errors.metadataSave');
      feedback.markFailed(operationId);
    }
  };
  return (
    <Card className="border-border/70 bg-card/95 shadow-shell">
      <CardHeader>
        <CardTitle>{t('media.editor.metadataTitle')}</CardTitle>
        <CardDescription>{t('media.editor.centralMetadataHint')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          aria-busy={saving}
          className="grid gap-4 md:grid-cols-2"
          onSubmit={(event) => void submit(event)}
        >
          {mediaMetadataTextFields.map((field) => {
            const Field = field === 'description' ? Textarea : Input;
            return (
              <div
                key={field}
                className={field === 'description' ? 'space-y-2 md:col-span-2' : 'space-y-2'}
              >
                <Label htmlFor={`media-metadata-${field}`}>{t(`media.fields.${field}`)}</Label>
                <Field
                  id={`media-metadata-${field}`}
                  value={draft[field]}
                  maxLength={mediaMetadataLimits[field]}
                  disabled={!canEdit || saving}
                  onChange={(event) => {
                    setDraft((current) => ({ ...current, [field]: event.target.value }));
                    feedback.markDirty();
                  }}
                />
              </div>
            );
          })}
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="media-tags">{t('media.fields.tags')}</Label>
            <Textarea
              id="media-tags"
              value={draft.tags}
              disabled={!canEdit || saving}
              aria-describedby="media-tags-hint"
              aria-invalid={error === 'media.errors.invalidTags'}
              onChange={(event) => {
                setDraft((current) => ({ ...current, tags: event.target.value }));
                feedback.markDirty();
              }}
            />
            <p id="media-tags-hint" className="text-sm text-muted-foreground">
              {t('media.fields.tagsHint')}
            </p>
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive md:col-span-2">
              {t(error)}
            </p>
          ) : null}
          {canEdit ? (
            <div className="flex flex-wrap gap-3 md:col-span-2">
              <StudioSaveButton
                type="submit"
                status={feedback.status}
                labels={{
                  idle: t('media.actions.save'),
                  saving: t('account.actions.saving'),
                  saved: t('account.actions.saved'),
                }}
              />
              <Button type="button" variant="secondary" disabled={saving} onClick={reset}>
                {t('media.actions.discardMetadata')}
              </Button>
            </div>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
};

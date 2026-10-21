import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card';
import React from 'react';
import { normalizeMediaTags } from '@sva/media';
import { Button } from '@sva/studio-ui-react';
import { Textarea } from '../../../components/ui/textarea';
import { Label } from '../../../components/ui/label';
import { t } from '../../../i18n';
import type { IamRegisteredMediaAsset } from '../../../lib/iam-api';

type MediaDetailMetadataSectionProps = Readonly<{
  asset: IamRegisteredMediaAsset;
  canEditTags?: boolean;
  onSaveTags?: (tags: string[]) => Promise<boolean>;
}>;

const readTextValue = (value: string | undefined): string =>
  value?.trim() || t('media.values.notAvailable');

export const MediaDetailMetadataSection = ({
  asset,
  canEditTags = false,
  onSaveTags,
}: MediaDetailMetadataSectionProps) => {
  const [draft, setDraft] = React.useState(
    (Array.isArray(asset.metadata.tags) ? asset.metadata.tags : []).join('\n')
  );
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState(false);
  return (
    <Card className="border-border/70 bg-card/95 shadow-shell">
      <CardHeader>
        <CardTitle>{t('media.editor.metadataTitle')}</CardTitle>
        <CardDescription>{t('media.detail.metadataDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <form
          className="space-y-2 md:col-span-2"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!canEditTags || !onSaveTags || saving) return;
            setError(false);
            let tags: string[];
            try {
              tags = normalizeMediaTags(
                draft.trim() ? draft.split('\n').filter((line) => line.trim()) : []
              );
            } catch {
              setError(true);
              return;
            }
            setSaving(true);
            try {
              if (await onSaveTags(tags)) setDraft(tags.join('\n'));
            } finally {
              setSaving(false);
            }
          }}
        >
          <Label htmlFor="media-tags">{t('media.fields.tags')}</Label>
          <Textarea
            id="media-tags"
            value={draft}
            disabled={!canEditTags || saving}
            aria-describedby="media-tags-hint"
            aria-invalid={error}
            onChange={(event) => setDraft(event.target.value)}
          />
          <p id="media-tags-hint" className="text-sm text-muted-foreground">
            {t('media.fields.tagsHint')}
          </p>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {t('media.errors.invalidTags')}
            </p>
          ) : null}
          {canEditTags ? (
            <Button type="submit" disabled={saving}>
              {t('media.actions.save')}
            </Button>
          ) : null}
        </form>
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            {t('media.fields.title')}
          </p>
          <p className="text-sm text-foreground">{readTextValue(asset.metadata.title)}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            {t('media.fields.altText')}
          </p>
          <p className="text-sm text-foreground">{readTextValue(asset.metadata.altText)}</p>
        </div>
        <div className="space-y-1 md:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            {t('media.fields.description')}
          </p>
          <p className="text-sm text-foreground">{readTextValue(asset.metadata.description)}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            {t('media.fields.copyright')}
          </p>
          <p className="text-sm text-foreground">{readTextValue(asset.metadata.copyright)}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            {t('media.fields.license')}
          </p>
          <p className="text-sm text-foreground">{readTextValue(asset.metadata.license)}</p>
        </div>
      </CardContent>
    </Card>
  );
};

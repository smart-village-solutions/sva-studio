import React from 'react';

import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Select } from '../../../components/ui/select';
import { useCreateMediaUpload } from '../../../hooks/use-media';
import { t } from '../../../i18n';
import type {
  IamHttpError,
  InitializeMediaUploadPayload,
  InitializeMediaUploadResponse,
} from '../../../lib/iam-api';

type MediaCreateFormState = Readonly<{
  mimeType: string;
  byteSize: string;
  visibility: 'public' | 'protected';
}>;

const defaultFormState: MediaCreateFormState = {
  mimeType: 'image/jpeg',
  byteSize: '5242880',
  visibility: 'protected',
};

const mimeTypeOptions = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'video/mp4',
] as const;
const mediaCreatePlanningItems = ['mimeType', 'byteSize', 'visibility'] as const;
type MediaCreatePlanningItem = (typeof mediaCreatePlanningItems)[number];

const createErrorMessage = (error: IamHttpError | null): string => {
  if (!error) {
    return t('media.create.errors.default');
  }

  switch (error.code) {
    case 'forbidden':
      return t('media.errors.forbidden');
    case 'database_unavailable':
      return t('media.errors.databaseUnavailable');
    case 'invalid_media_content':
      return t('media.errors.invalidMediaContent');
    case 'upload_size_exceeded':
      return t('media.errors.uploadSizeExceeded');
    case 'conflict':
      return t('media.errors.conflict');
    default:
      return t('media.create.errors.default');
  }
};

const mediaTypeForMimeType = (mimeType: string): InitializeMediaUploadPayload['mediaType'] =>
  mimeType.startsWith('image/') ? 'image' : undefined;

const MediaCreatePlanningCard = ({ item }: Readonly<{ item: MediaCreatePlanningItem }>) => (
  <div className="rounded-2xl border border-white/80 bg-white/70 p-4 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.55)]">
    <div className="space-y-1">
      <p className="text-sm font-semibold text-foreground">{t(`media.create.planning.items.${item}.title`)}</p>
      <p className="text-sm text-muted-foreground">{t(`media.create.planning.items.${item}.body`)}</p>
    </div>
  </div>
);

const MediaCreateResultCard = ({ result }: Readonly<{ result: InitializeMediaUploadResponse }>) => (
  <Card className="border-emerald-500/25 bg-[linear-gradient(180deg,rgba(240,253,244,0.92),rgba(220,252,231,0.82))] shadow-shell">
    <CardHeader className="space-y-2">
      <CardTitle>{t('media.create.nextStepsTitle')}</CardTitle>
      <CardDescription>{t('media.create.nextStepsDescription')}</CardDescription>
    </CardHeader>
    <CardContent className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
      <div className="space-y-3 text-sm text-foreground">
        <p className="font-medium">{t('media.create.result.assetId', { value: result.assetId })}</p>
        <p>{t('media.create.result.uploadSessionId', { value: result.uploadSessionId })}</p>
        <p>{t('media.create.result.method', { value: result.method })}</p>
        <p>{t('media.create.result.expiresAt', { value: result.expiresAt })}</p>
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            {t('media.meta.uploadUrl')}
          </p>
          <code className="block break-all rounded-xl border border-emerald-700/10 bg-white/70 px-3 py-2 text-xs text-foreground">
            {result.uploadUrl}
          </code>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-white/75 bg-white/80 p-4">
        <p className="text-sm font-semibold text-foreground">{t('media.create.followUpTitle')}</p>
        <ol className="space-y-2 text-sm text-muted-foreground">
          <li>{t('media.create.followUpSteps.transfer')}</li>
          <li>{t('media.create.followUpSteps.describe')}</li>
          <li>{t('media.create.followUpSteps.review')}</li>
        </ol>
      </div>
    </CardContent>
  </Card>
);

export const MediaCreatePage = () => {
  const mediaApi = useCreateMediaUpload();
  const [formState, setFormState] = React.useState<MediaCreateFormState>(defaultFormState);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [result, setResult] = React.useState<InitializeMediaUploadResponse | null>(null);

  const updateFormState = <Key extends keyof MediaCreateFormState>(
    key: Key,
    value: MediaCreateFormState[Key]
  ) => {
    if (mediaApi.mutationError) {
      mediaApi.clearMutationError();
    }

    setFormState((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setIsSubmitting(true);
    setResult(null);

    const parsedByteSize = Number(formState.byteSize);
    const payload: InitializeMediaUploadPayload = {
      mediaType: mediaTypeForMimeType(formState.mimeType),
      mimeType: formState.mimeType,
      byteSize: Number.isFinite(parsedByteSize) && parsedByteSize > 0 ? parsedByteSize : 1,
      visibility: formState.visibility,
    };

    try {
      const response = await mediaApi.initializeUpload(payload);
      if (response) {
        setResult(response);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="space-y-6" data-testid="media-create-page">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-foreground">{t('media.create.title')}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">{t('media.create.subtitle')}</p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.95fr)]">
        <Card className="border-border/70 bg-card/95 shadow-shell">
          <CardHeader className="space-y-3">
            <Badge className="w-fit border-0 bg-cyan-500/15 text-cyan-700" variant="secondary">
              {t('media.create.intakeBadge')}
            </Badge>
            <div className="space-y-2">
              <CardTitle>{t('media.create.intakeTitle')}</CardTitle>
              <CardDescription>{t('media.create.intakeDescription')}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {mediaApi.mutationError ? (
              <Alert className="border-destructive/40 text-destructive">
                <AlertDescription>{createErrorMessage(mediaApi.mutationError)}</AlertDescription>
              </Alert>
            ) : null}

            <form className="space-y-5" onSubmit={(event) => void handleSubmit(event)}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="media-create-mime-type">{t('media.fields.mimeType')}</Label>
                  <Select
                    id="media-create-mime-type"
                    value={formState.mimeType}
                    onChange={(event) => updateFormState('mimeType', event.target.value)}
                  >
                    {mimeTypeOptions.map((mimeType) => (
                      <option key={mimeType} value={mimeType}>
                        {t(`media.create.mimeTypeOptions.${mimeType}`)}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="media-create-byte-size">{t('media.fields.byteSize')}</Label>
                  <Input
                    id="media-create-byte-size"
                    min={1}
                    required
                    step={1}
                    type="number"
                    value={formState.byteSize}
                    onChange={(event) => updateFormState('byteSize', event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">{t('media.create.byteSizeHint')}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="media-create-visibility">{t('media.fields.visibility')}</Label>
                <Select
                  id="media-create-visibility"
                  value={formState.visibility}
                  onChange={(event) =>
                    updateFormState('visibility', event.target.value as MediaCreateFormState['visibility'])
                  }
                >
                  <option value="protected">{t('media.visibility.protected')}</option>
                  <option value="public">{t('media.visibility.public')}</option>
                </Select>
              </div>

              <div className="flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-xl text-sm text-muted-foreground">{t('media.create.submitHint')}</p>
                <Button disabled={isSubmitting} type="submit">
                  {isSubmitting ? t('media.create.submitting') : t('media.actions.initializeUpload')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-[linear-gradient(180deg,rgba(247,250,252,0.94),rgba(226,232,240,0.74))] shadow-shell">
          <CardHeader className="space-y-2">
            <CardTitle>{t('media.create.planningTitle')}</CardTitle>
            <CardDescription>{t('media.create.planningDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {mediaCreatePlanningItems.map((item) => (
              <MediaCreatePlanningCard key={item} item={item} />
            ))}
          </CardContent>
        </Card>
      </div>

      {result ? <MediaCreateResultCard result={result} /> : null}
    </section>
  );
};

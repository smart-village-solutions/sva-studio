import { Link } from '@tanstack/react-router';
import React from 'react';

import { RichTextEditor } from '../../../components/RichTextEditor';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Select } from '../../../components/ui/select';
import { useLegalTexts } from '../../../hooks/use-legal-texts';
import { t } from '../../../i18n';
import type { IamHttpError, UpdateLegalTextPayload } from '../../../lib/iam-api';

type LegalTextDetailPageProps = {
  readonly legalTextVersionId: string;
};

type LegalTextStatus = 'draft' | 'valid' | 'archived';

const richTextEditorCommands = {
  bold: t('admin.legalTexts.editor.bold'),
  italic: t('admin.legalTexts.editor.italic'),
  underline: t('admin.legalTexts.editor.underline'),
  paragraph: t('admin.legalTexts.editor.paragraph'),
  heading: t('admin.legalTexts.editor.heading'),
  bulletList: t('admin.legalTexts.editor.bulletList'),
  clearFormatting: t('admin.legalTexts.editor.clearFormatting'),
} as const;

const legalTextErrorMessage = (error: IamHttpError | null): string => {
  if (!error) {
    return t('admin.legalTexts.messages.error');
  }

  switch (error.code) {
    case 'forbidden':
      return t('admin.legalTexts.errors.forbidden');
    case 'csrf_validation_failed':
      return t('admin.legalTexts.errors.csrfValidationFailed');
    case 'rate_limited':
      return t('admin.legalTexts.errors.rateLimited');
    case 'conflict':
      return t('admin.legalTexts.errors.conflict');
    case 'not_found':
      return t('admin.legalTexts.errors.notFound');
    case 'database_unavailable':
      return t('admin.legalTexts.errors.databaseUnavailable');
    case 'invalid_request':
      return error.message && error.message !== `http_${error.status}`
        ? error.message
        : t('admin.legalTexts.errors.invalidRequest');
    default:
      return t('admin.legalTexts.messages.error');
  }
};

const formatDateTime = (value?: string): string => {
  if (!value) {
    return t('admin.legalTexts.table.publishedUnset');
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const toDateTimeInputValue = (value?: string): string => {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const pad = (entry: number) => String(entry).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const toIsoDateTime = (value: string): string | undefined => {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

export const LegalTextDetailPage = ({ legalTextVersionId }: LegalTextDetailPageProps) => {
  const legalTextsApi = useLegalTexts();
  const selectedLegalText = React.useMemo(
    () => legalTextsApi.legalTexts.find((entry) => entry.id === legalTextVersionId) ?? null,
    [legalTextVersionId, legalTextsApi.legalTexts]
  );
  const [formValues, setFormValues] = React.useState({
    name: '',
    legalTextVersion: '',
    locale: '',
    contentHtml: '<p></p>',
    status: 'draft' as LegalTextStatus,
    publishedAt: '',
  });

  React.useEffect(() => {
    if (!selectedLegalText) {
      return;
    }

    setFormValues({
      name: selectedLegalText.name,
      legalTextVersion: selectedLegalText.legalTextVersion,
      locale: selectedLegalText.locale,
      contentHtml: selectedLegalText.contentHtml,
      status: selectedLegalText.status,
      publishedAt: toDateTimeInputValue(selectedLegalText.publishedAt),
    });
  }, [selectedLegalText]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload: UpdateLegalTextPayload = {
      name: formValues.name.trim(),
      legalTextVersion: formValues.legalTextVersion.trim(),
      locale: formValues.locale.trim(),
      contentHtml: formValues.contentHtml.trim(),
      status: formValues.status,
      publishedAt: toIsoDateTime(formValues.publishedAt),
    };

    await legalTextsApi.updateLegalText(legalTextVersionId, payload);
  };

  return (
    <section className="space-y-5" aria-busy={legalTextsApi.isLoading}>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">
            {selectedLegalText?.name ?? t('admin.legalTexts.dialogs.editTitle')}
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {selectedLegalText
              ? t('admin.legalTexts.dialogs.editDescription', {
                  id: selectedLegalText.id,
                  version: selectedLegalText.legalTextVersion,
                  locale: selectedLegalText.locale,
                })
              : t('admin.legalTexts.dialogs.editDescriptionFallback')}
          </p>
        </div>
        <Button asChild type="button" variant="outline">
          <Link to="/admin/legal-texts">{t('admin.legalTexts.detail.backToList')}</Link>
        </Button>
      </header>

      {!selectedLegalText && !legalTextsApi.isLoading ? (
        <Card className="p-6 text-sm text-muted-foreground">{t('admin.legalTexts.detail.notFound')}</Card>
      ) : null}

      {selectedLegalText ? (
        <Card className="space-y-4 p-4">
          <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="legal-text-edit-name">{t('admin.legalTexts.fields.name')}</Label>
                <Input
                  id="legal-text-edit-name"
                  value={formValues.name}
                  onChange={(event) => setFormValues((current) => ({ ...current, name: event.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="legal-text-edit-version">{t('admin.legalTexts.fields.legalTextVersion')}</Label>
                <Input
                  id="legal-text-edit-version"
                  value={formValues.legalTextVersion}
                  onChange={(event) => setFormValues((current) => ({ ...current, legalTextVersion: event.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="legal-text-edit-locale">{t('admin.legalTexts.fields.locale')}</Label>
                <Input
                  id="legal-text-edit-locale"
                  value={formValues.locale}
                  onChange={(event) => setFormValues((current) => ({ ...current, locale: event.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="legal-text-edit-status">{t('admin.legalTexts.fields.status')}</Label>
                <Select
                  id="legal-text-edit-status"
                  value={formValues.status}
                  onChange={(event) => setFormValues((current) => ({ ...current, status: event.target.value as LegalTextStatus }))}
                >
                  <option value="draft">{t('admin.legalTexts.status.draft')}</option>
                  <option value="valid">{t('admin.legalTexts.status.valid')}</option>
                  <option value="archived">{t('admin.legalTexts.status.archived')}</option>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="legal-text-edit-published">{t('admin.legalTexts.fields.publishedAt')}</Label>
                <Input
                  id="legal-text-edit-published"
                  type="datetime-local"
                  value={formValues.publishedAt}
                  required={formValues.status === 'valid'}
                  onChange={(event) => setFormValues((current) => ({ ...current, publishedAt: event.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-4 rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground md:grid-cols-3">
              <p>{t('admin.legalTexts.meta.uuid', { value: selectedLegalText.id })}</p>
              <p>{t('admin.legalTexts.meta.createdAt', { value: formatDateTime(selectedLegalText.createdAt) })}</p>
              <p>{t('admin.legalTexts.meta.updatedAt', { value: formatDateTime(selectedLegalText.updatedAt) })}</p>
            </div>

            <div className="space-y-2">
              <Label id="legal-text-edit-content-label" htmlFor="legal-text-edit-content">
                {t('admin.legalTexts.fields.contentHtml')}
              </Label>
              <RichTextEditor
                id="legal-text-edit-content"
                labelId="legal-text-edit-content-label"
                value={formValues.contentHtml}
                onChange={(contentHtml) => setFormValues((current) => ({ ...current, contentHtml }))}
                placeholder={t('admin.legalTexts.fields.contentPlaceholder')}
                commands={richTextEditorCommands}
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit">{t('admin.legalTexts.actions.save')}</Button>
            </div>
          </form>
        </Card>
      ) : null}

      {legalTextsApi.mutationError ? (
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertDescription>{legalTextErrorMessage(legalTextsApi.mutationError)}</AlertDescription>
        </Alert>
      ) : null}
    </section>
  );
};

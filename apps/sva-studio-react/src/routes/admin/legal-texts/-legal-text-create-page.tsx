import { Link, useNavigate } from '@tanstack/react-router';
import React from 'react';

import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Select } from '../../../components/ui/select';
import { RichTextEditor } from '../../../components/RichTextEditor';
import { useLegalTexts } from '../../../hooks/use-legal-texts';
import { t } from '../../../i18n';
import type { CreateLegalTextPayload, IamHttpError } from '../../../lib/iam-api';

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

const emptyForm = () => ({
  name: '',
  legalTextVersion: '',
  locale: 'de-DE',
  contentHtml: '<p></p>',
  status: 'draft' as LegalTextStatus,
  publishedAt: '',
});

const toIsoDateTime = (value: string): string | undefined => {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

export const LegalTextCreatePage = () => {
  const navigate = useNavigate();
  const legalTextsApi = useLegalTexts();
  const [formValues, setFormValues] = React.useState(emptyForm);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload: CreateLegalTextPayload = {
      name: formValues.name.trim(),
      legalTextVersion: formValues.legalTextVersion.trim(),
      locale: formValues.locale.trim(),
      contentHtml: formValues.contentHtml.trim(),
      status: formValues.status,
      publishedAt: toIsoDateTime(formValues.publishedAt),
    };

    const created = await legalTextsApi.createLegalText(payload);
    if (!created) {
      return;
    }

    await navigate({
      to: '/admin/legal-texts/$legalTextVersionId',
      params: { legalTextVersionId: created.id },
    });
  };

  return (
    <section className="space-y-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">{t('admin.legalTexts.dialogs.createTitle')}</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">{t('admin.legalTexts.dialogs.createDescription')}</p>
        </div>
        <Button asChild type="button" variant="outline">
          <Link to="/admin/legal-texts">{t('admin.legalTexts.detail.backToList')}</Link>
        </Button>
      </header>

      <Card className="space-y-4 p-4">
        <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="legal-text-create-name">{t('admin.legalTexts.fields.name')}</Label>
              <Input
                id="legal-text-create-name"
                value={formValues.name}
                onChange={(event) => setFormValues((current) => ({ ...current, name: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="legal-text-create-version">{t('admin.legalTexts.fields.legalTextVersion')}</Label>
              <Input
                id="legal-text-create-version"
                value={formValues.legalTextVersion}
                onChange={(event) => setFormValues((current) => ({ ...current, legalTextVersion: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="legal-text-create-locale">{t('admin.legalTexts.fields.locale')}</Label>
              <Input
                id="legal-text-create-locale"
                value={formValues.locale}
                onChange={(event) => setFormValues((current) => ({ ...current, locale: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="legal-text-create-status">{t('admin.legalTexts.fields.status')}</Label>
              <Select
                id="legal-text-create-status"
                value={formValues.status}
                onChange={(event) => setFormValues((current) => ({ ...current, status: event.target.value as LegalTextStatus }))}
              >
                <option value="draft">{t('admin.legalTexts.status.draft')}</option>
                <option value="valid">{t('admin.legalTexts.status.valid')}</option>
                <option value="archived">{t('admin.legalTexts.status.archived')}</option>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="legal-text-create-published">{t('admin.legalTexts.fields.publishedAt')}</Label>
              <Input
                id="legal-text-create-published"
                type="datetime-local"
                value={formValues.publishedAt}
                required={formValues.status === 'valid'}
                onChange={(event) => setFormValues((current) => ({ ...current, publishedAt: event.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label id="legal-text-create-content-label" htmlFor="legal-text-create-content">
              {t('admin.legalTexts.fields.contentHtml')}
            </Label>
            <RichTextEditor
              id="legal-text-create-content"
              labelId="legal-text-create-content-label"
              value={formValues.contentHtml}
              onChange={(contentHtml) => setFormValues((current) => ({ ...current, contentHtml }))}
              placeholder={t('admin.legalTexts.fields.contentPlaceholder')}
              commands={richTextEditorCommands}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button asChild type="button" variant="outline">
              <Link to="/admin/legal-texts">{t('account.actions.cancel')}</Link>
            </Button>
            <Button type="submit">{t('admin.legalTexts.actions.create')}</Button>
          </div>
        </form>
      </Card>

      {legalTextsApi.mutationError ? (
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertDescription>{legalTextErrorMessage(legalTextsApi.mutationError)}</AlertDescription>
        </Alert>
      ) : null}
    </section>
  );
};

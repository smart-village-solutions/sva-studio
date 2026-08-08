import { Link, useNavigate } from '@tanstack/react-router';
import { toDatetimeLocalValue } from '@sva/plugin-sdk';
import { StudioDetailPageTemplate } from '@sva/studio-ui-react';
import React from 'react';

import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { RichTextEditor } from '../../../components/RichTextEditor';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Select } from '../../../components/ui/select';
import { useLegalTexts } from '../../../hooks/use-legal-texts';
import { isIamAccessAllowed, useIamResourceAccess } from '../../../hooks/use-iam-resource-access';
import { t } from '../../../i18n';
import { parseOptionalEditorDateTime } from '../../../lib/editor-date-time';
import type { UpdateLegalTextPayload } from '../../../lib/iam-api';
import {
  formatLegalTextDateTime,
  getLegalTextErrorMessage,
  type LegalTextStatus,
} from './-legal-texts-shared';

type LegalTextDetailPageProps = {
  readonly legalTextVersionId: string;
};

const richTextEditorCommands = {
  bold: t('admin.legalTexts.editor.bold'),
  italic: t('admin.legalTexts.editor.italic'),
  underline: t('admin.legalTexts.editor.underline'),
  paragraph: t('admin.legalTexts.editor.paragraph'),
  heading: t('admin.legalTexts.editor.heading'),
  bulletList: t('admin.legalTexts.editor.bulletList'),
  clearFormatting: t('admin.legalTexts.editor.clearFormatting'),
} as const;

const splitTargetIds = (value: string): string[] =>
  Array.from(
    new Set(
      value
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
    )
  );

const joinTargetIds = (values: readonly string[]): string => values.join(', ');

const toDateTimeInputValue = (value?: string): string => {
  return toDatetimeLocalValue(value);
};

export const LegalTextDetailPage = ({ legalTextVersionId }: LegalTextDetailPageProps) => {
  const legalTextsApi = useLegalTexts();
  const access = useIamResourceAccess('legalText');
  const canUpdateLegalText = isIamAccessAllowed(access.update);
  const canDeleteLegalText = isIamAccessAllowed(access.delete);
  const navigate = useNavigate();
  const selectedLegalText = React.useMemo(
    () => legalTextsApi.legalTexts.find((entry) => entry.id === legalTextVersionId) ?? null,
    [legalTextVersionId, legalTextsApi.legalTexts]
  );
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const [formValues, setFormValues] = React.useState({
    name: '',
    legalTextVersion: '',
    locale: '',
    contentHtml: '<p></p>',
    status: 'draft' as LegalTextStatus,
    publishedAt: '',
    targetRoleIds: '',
    targetGroupIds: '',
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
      targetRoleIds: joinTargetIds(selectedLegalText.targets?.roleIds ?? []),
      targetGroupIds: joinTargetIds(selectedLegalText.targets?.groupIds ?? []),
    });
    setValidationError(null);
  }, [selectedLegalText]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canUpdateLegalText) {
      return;
    }
    setValidationError(null);

    const publishedAt = parseOptionalEditorDateTime(
      formValues.publishedAt,
      selectedLegalText?.publishedAt
    );
    if (publishedAt.kind === 'invalid') {
      setValidationError(t('admin.legalTexts.validation.publishedAtInvalid'));
      return;
    }
    if (formValues.status === 'valid' && publishedAt.kind === 'empty') {
      setValidationError(t('admin.legalTexts.validation.publishedAtRequired'));
      return;
    }

    const payload: UpdateLegalTextPayload = {
      name: formValues.name.trim(),
      legalTextVersion: formValues.legalTextVersion.trim(),
      locale: formValues.locale.trim(),
      contentHtml: formValues.contentHtml.trim(),
      status: formValues.status,
      publishedAt: publishedAt.kind === 'value' ? publishedAt.value : undefined,
      targetRoleIds: splitTargetIds(formValues.targetRoleIds),
      targetGroupIds: splitTargetIds(formValues.targetGroupIds),
    };

    await legalTextsApi.updateLegalText(legalTextVersionId, payload);
  };

  const onDelete = async () => {
    if (!canDeleteLegalText) {
      return;
    }
    const deleted = await legalTextsApi.deleteLegalText(legalTextVersionId);
    if (!deleted) {
      return;
    }

    setDeleteConfirmOpen(false);
    await navigate({ to: '/admin/legal-texts' });
  };

  return (
    <section aria-busy={legalTextsApi.isLoading}>
      <StudioDetailPageTemplate
        title={selectedLegalText?.name ?? t('admin.legalTexts.dialogs.editTitle')}
        description={
          selectedLegalText
            ? t('admin.legalTexts.dialogs.editDescription', {
                id: selectedLegalText.id,
                version: selectedLegalText.legalTextVersion,
                locale: selectedLegalText.locale,
              })
            : t('admin.legalTexts.dialogs.editDescriptionFallback')
        }
        actions={
          <Button asChild type="button" variant="outline">
            <Link to="/admin/legal-texts">{t('admin.legalTexts.detail.backToList')}</Link>
          </Button>
        }
        primaryAction={
          selectedLegalText && canUpdateLegalText ? (
            <Button type="submit" form="legal-text-edit-form">
              {t('admin.legalTexts.actions.save')}
            </Button>
          ) : undefined
        }
      >
        {!selectedLegalText && !legalTextsApi.isLoading ? (
          <Card className="p-6 text-sm text-muted-foreground">
            {t('admin.legalTexts.detail.notFound')}
          </Card>
        ) : null}

        {selectedLegalText ? (
          <Card className="space-y-4 p-4">
            <form
              id="legal-text-edit-form"
              className="space-y-4"
              aria-readonly={!canUpdateLegalText}
              onSubmit={(event) => void onSubmit(event)}
            >
              <fieldset className="contents" disabled={!canUpdateLegalText}>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="legal-text-edit-name">
                      {t('admin.legalTexts.fields.name')}
                    </Label>
                    <Input
                      id="legal-text-edit-name"
                      value={formValues.name}
                      onChange={(event) =>
                        setFormValues((current) => ({ ...current, name: event.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="legal-text-edit-version">
                      {t('admin.legalTexts.fields.legalTextVersion')}
                    </Label>
                    <Input
                      id="legal-text-edit-version"
                      value={formValues.legalTextVersion}
                      onChange={(event) =>
                        setFormValues((current) => ({
                          ...current,
                          legalTextVersion: event.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="legal-text-edit-locale">
                      {t('admin.legalTexts.fields.locale')}
                    </Label>
                    <Input
                      id="legal-text-edit-locale"
                      value={formValues.locale}
                      onChange={(event) =>
                        setFormValues((current) => ({ ...current, locale: event.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="legal-text-edit-status">
                      {t('admin.legalTexts.fields.status')}
                    </Label>
                    <Select
                      id="legal-text-edit-status"
                      value={formValues.status}
                      onChange={(event) =>
                        setFormValues((current) => ({
                          ...current,
                          status: event.target.value as LegalTextStatus,
                        }))
                      }
                    >
                      <option value="draft">{t('admin.legalTexts.status.draft')}</option>
                      <option value="valid">{t('admin.legalTexts.status.valid')}</option>
                      <option value="archived">{t('admin.legalTexts.status.archived')}</option>
                    </Select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="legal-text-edit-published">
                      {t('admin.legalTexts.fields.publishedAt')}
                    </Label>
                    <Input
                      id="legal-text-edit-published"
                      type="datetime-local"
                      value={formValues.publishedAt}
                      required={formValues.status === 'valid'}
                      onChange={(event) =>
                        setFormValues((current) => ({
                          ...current,
                          publishedAt: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="legal-text-edit-role-targets">
                      {t('admin.legalTexts.fields.targetRoleIds')}
                    </Label>
                    <Input
                      id="legal-text-edit-role-targets"
                      value={formValues.targetRoleIds}
                      onChange={(event) =>
                        setFormValues((current) => ({
                          ...current,
                          targetRoleIds: event.target.value,
                        }))
                      }
                      placeholder={t('admin.legalTexts.fields.targetRoleIdsPlaceholder')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="legal-text-edit-group-targets">
                      {t('admin.legalTexts.fields.targetGroupIds')}
                    </Label>
                    <Input
                      id="legal-text-edit-group-targets"
                      value={formValues.targetGroupIds}
                      onChange={(event) =>
                        setFormValues((current) => ({
                          ...current,
                          targetGroupIds: event.target.value,
                        }))
                      }
                      placeholder={t('admin.legalTexts.fields.targetGroupIdsPlaceholder')}
                    />
                  </div>
                </div>

                <div className="grid gap-4 rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground md:grid-cols-3">
                  <p>{t('admin.legalTexts.meta.uuid', { value: selectedLegalText.id })}</p>
                  <p>
                    {t('admin.legalTexts.meta.createdAt', {
                      value: formatLegalTextDateTime(selectedLegalText.createdAt),
                    })}
                  </p>
                  <p>
                    {t('admin.legalTexts.meta.updatedAt', {
                      value: formatLegalTextDateTime(selectedLegalText.updatedAt),
                    })}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label id="legal-text-edit-content-label" htmlFor="legal-text-edit-content">
                    {t('admin.legalTexts.fields.contentHtml')}
                  </Label>
                  <RichTextEditor
                    id="legal-text-edit-content"
                    labelId="legal-text-edit-content-label"
                    value={formValues.contentHtml}
                    onChange={(contentHtml) =>
                      setFormValues((current) => ({ ...current, contentHtml }))
                    }
                    placeholder={t('admin.legalTexts.fields.contentPlaceholder')}
                    readOnly={!canUpdateLegalText}
                    commands={richTextEditorCommands}
                  />
                </div>

                <div className="flex justify-end gap-3">
                  {canDeleteLegalText ? (
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => setDeleteConfirmOpen(true)}
                    >
                      {t('admin.legalTexts.actions.delete')}
                    </Button>
                  ) : null}
                </div>
              </fieldset>
            </form>
          </Card>
        ) : null}

        {validationError || legalTextsApi.mutationError ? (
          <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
            <AlertDescription>
              {validationError ?? getLegalTextErrorMessage(legalTextsApi.mutationError)}
            </AlertDescription>
          </Alert>
        ) : null}

        <ConfirmDialog
          open={canDeleteLegalText && deleteConfirmOpen}
          title={t('admin.legalTexts.confirm.deleteTitle')}
          description={t('admin.legalTexts.confirm.deleteDescription')}
          confirmLabel={t('admin.legalTexts.actions.delete')}
          cancelLabel={t('account.actions.cancel')}
          onConfirm={() => void onDelete()}
          onCancel={() => setDeleteConfirmOpen(false)}
        />
      </StudioDetailPageTemplate>
    </section>
  );
};

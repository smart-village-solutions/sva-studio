import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import { toDatetimeLocalValue } from '@sva/plugin-sdk';
import {
  hasStudioCreatedSaveFeedback,
  removeStudioSaveFeedback,
  StudioDetailPageTemplate,
  StudioPersistentFormError,
  StudioSaveButton,
  useStudioSaveFeedback,
} from '@sva/studio-ui-react';
import React from 'react';

import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { useLegalTexts } from '../../../hooks/use-legal-texts';
import { isIamAccessAllowed, useIamResourceAccess } from '../../../hooks/use-iam-resource-access';
import { t } from '../../../i18n';
import { parseOptionalEditorDateTime } from '../../../lib/editor-date-time';
import type { UpdateLegalTextPayload } from '../../../lib/iam-api';
import { getLegalTextErrorMessage } from './-legal-texts-shared';
import { LegalTextDetailForm, type LegalTextDetailFormValues } from './-legal-text-detail-form';

type LegalTextDetailPageProps = {
  readonly legalTextVersionId: string;
};

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

const getDetailDescription = (
  legalText: ReturnType<typeof useLegalTexts>['legalTexts'][number] | null
) =>
  legalText
    ? t('admin.legalTexts.dialogs.editDescription', {
        id: legalText.id,
        version: legalText.legalTextVersion,
        locale: legalText.locale,
      })
    : t('admin.legalTexts.dialogs.editDescriptionFallback');

const LegalTextSaveAction = ({
  canUpdate,
  hasLegalText,
  status,
}: Readonly<{
  canUpdate: boolean;
  hasLegalText: boolean;
  status: ReturnType<typeof useStudioSaveFeedback>['status'];
}>) =>
  hasLegalText && canUpdate ? (
    <StudioSaveButton
      type="submit"
      form="legal-text-edit-form"
      status={status}
      labels={{
        idle: t('admin.legalTexts.actions.save'),
        saving: t('account.actions.saving'),
        saved: t('account.actions.saved'),
      }}
    />
  ) : undefined;

export const LegalTextDetailPage = ({ legalTextVersionId }: LegalTextDetailPageProps) => {
  const location = useLocation();
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
  const [formValues, setFormValues] = React.useState<LegalTextDetailFormValues>({
    name: '',
    legalTextVersion: '',
    locale: '',
    contentHtml: '<p></p>',
    status: 'draft',
    publishedAt: '',
    targetRoleIds: '',
    targetGroupIds: '',
  });
  const saveFeedback = useStudioSaveFeedback();
  const initialSaveFeedbackShownRef = React.useRef(false);
  React.useEffect(() => {
    if (
      legalTextsApi.isLoading ||
      !selectedLegalText ||
      initialSaveFeedbackShownRef.current ||
      !hasStudioCreatedSaveFeedback(location.state, 'legal-texts', legalTextVersionId)
    ) {
      return;
    }

    initialSaveFeedbackShownRef.current = true;
    saveFeedback.showSaved();
    void navigate({
      to: '/admin/legal-texts/$legalTextVersionId',
      params: { legalTextVersionId },
      replace: true,
      state: (previous) => removeStudioSaveFeedback(previous),
    });
  }, [
    legalTextVersionId,
    legalTextsApi.isLoading,
    location.state,
    navigate,
    saveFeedback,
    selectedLegalText,
  ]);
  const updateFormValues: typeof setFormValues = (value) => {
    saveFeedback.markDirty();
    setFormValues(value);
  };

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

    const operationId = saveFeedback.beginSaving();
    const updated = await legalTextsApi.updateLegalText(legalTextVersionId, payload);
    (updated ? saveFeedback.markSaved : saveFeedback.markFailed)(operationId);
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
        description={getDetailDescription(selectedLegalText)}
        actions={
          <Button asChild type="button" variant="outline">
            <Link to="/admin/legal-texts">{t('admin.legalTexts.detail.backToList')}</Link>
          </Button>
        }
        primaryAction={
          <LegalTextSaveAction
            canUpdate={canUpdateLegalText}
            hasLegalText={Boolean(selectedLegalText)}
            status={saveFeedback.status}
          />
        }
      >
        {!selectedLegalText && !legalTextsApi.isLoading ? (
          <Card className="p-6 text-sm text-muted-foreground">
            {t('admin.legalTexts.detail.notFound')}
          </Card>
        ) : null}

        {selectedLegalText ? (
          <LegalTextDetailForm
            canDelete={canDeleteLegalText}
            canUpdate={canUpdateLegalText}
            formValues={formValues}
            onDelete={() => setDeleteConfirmOpen(true)}
            onSubmit={(event) => void onSubmit(event)}
            selectedLegalText={selectedLegalText}
            setFormValues={updateFormValues}
          />
        ) : null}

        {validationError ? (
          <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
            <AlertDescription>{validationError}</AlertDescription>
          </Alert>
        ) : null}
        {legalTextsApi.mutationError ? (
          <StudioPersistentFormError
            message={getLegalTextErrorMessage(legalTextsApi.mutationError)}
          />
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

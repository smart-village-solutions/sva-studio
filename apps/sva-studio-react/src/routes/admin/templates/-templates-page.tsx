/** Server-wide text template administration for the Studio installation. */
import * as React from 'react';
import type { AccountInvitationPurpose, ServerAccountInvitationTemplateView } from '@sva/core';
import { Button, StudioLoadingState } from '@sva/studio-ui-react';

import { Card } from '../../../components/ui/card';
import { t } from '../../../i18n';
import {
  getServerAccountInvitationTemplate,
  IamHttpError,
  updateServerAccountInvitationTemplate,
} from '../../../lib/iam-api';
import {
  AccountInvitationTemplateEditorCard,
  type AccountInvitationTemplateDraft,
  type AccountInvitationTemplateSaveResult,
} from '../instances/-account-invitation-template-card';

export const TemplatesPage = () => {
  const [template, setTemplate] = React.useState<ServerAccountInvitationTemplateView | null>(null);
  const [loadFailed, setLoadFailed] = React.useState(false);
  const [purpose, setPurpose] = React.useState<AccountInvitationPurpose>('studio');
  const [purposeMessage, setPurposeMessage] = React.useState<string | null>(null);
  const [savingPurpose, setSavingPurpose] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    void getServerAccountInvitationTemplate()
      .then((response) => {
        if (active) {
          setTemplate(response.data);
          setPurpose(response.data.defaultPurpose);
        }
      })
      .catch(() => {
        if (active) setLoadFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const save = async (
    draft: AccountInvitationTemplateDraft | null
  ): Promise<AccountInvitationTemplateSaveResult> => {
    if (!template) return false;
    try {
      const response = await updateServerAccountInvitationTemplate({
        expectedRevision: template.revision,
        template: draft,
      });
      setTemplate(response.data);
      return true;
    } catch (error) {
      if (
        error instanceof IamHttpError &&
        error.code === 'account_invitation_template_revision_conflict'
      ) {
        try {
          const response = await getServerAccountInvitationTemplate();
          setTemplate(response.data);
          return 'conflict';
        } catch {
          return false;
        }
      }
      return false;
    }
  };

  const savePurpose = async () => {
    if (!template || savingPurpose) return;
    setSavingPurpose(true);
    setPurposeMessage(null);
    try {
      const response = await updateServerAccountInvitationTemplate({
        expectedRevision: template.revision,
        defaultPurpose: purpose,
      });
      setTemplate(response.data);
      setPurpose(response.data.defaultPurpose);
      setPurposeMessage(t('admin.instances.invitation.destinationSaved'));
    } catch (error) {
      if (
        error instanceof IamHttpError &&
        error.code === 'account_invitation_template_revision_conflict'
      ) {
        try {
          const response = await getServerAccountInvitationTemplate();
          setTemplate(response.data);
          setPurpose(response.data.defaultPurpose);
          setPurposeMessage(t('admin.instances.invitation.saveConflict'));
        } catch {
          setPurposeMessage(t('admin.instances.invitation.destinationSaveFailed'));
        }
      } else {
        setPurposeMessage(t('admin.instances.invitation.destinationSaveFailed'));
      }
    } finally {
      setSavingPurpose(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">
          {t('admin.instances.invitation.pageTitle')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('admin.instances.invitation.pageDescription')}
        </p>
      </header>
      {loadFailed ? (
        <p role="status" className="text-sm text-destructive">
          {t('admin.instances.invitation.loadFailed')}
        </p>
      ) : template ? (
        <>
          <Card className="space-y-3 p-4">
            <h2 className="text-sm font-medium text-foreground">
              {t('admin.instances.invitation.destinationTitle')}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t('admin.instances.invitation.destinationDescription')}
            </p>
            <label className="block text-sm font-medium" htmlFor="invitation-default-purpose">
              {t('admin.instances.invitation.destinationLabel')}
            </label>
            <select
              id="invitation-default-purpose"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={purpose}
              onChange={(event) => setPurpose(event.target.value as AccountInvitationPurpose)}
            >
              <option value="studio">{t('admin.instances.invitation.destinationStudio')}</option>
              <option value="ssf">{t('admin.instances.invitation.destinationSsf')}</option>
            </select>
            <Button
              type="button"
              onClick={() => void savePurpose()}
              disabled={savingPurpose || purpose === template.defaultPurpose}
            >
              {t('admin.instances.invitation.destinationSave')}
            </Button>
            {purposeMessage ? <p role="status">{purposeMessage}</p> : null}
          </Card>
          <AccountInvitationTemplateEditorCard
            effectiveTemplate={template.effectiveTemplate}
            source={template.source}
            preview={{
              tenantName: t('admin.instances.invitation.sampleTenantName'),
              tenantHomepageUrl: t('admin.instances.invitation.sampleHomepageUrl'),
            }}
            mode="server"
            onSave={save}
          />
        </>
      ) : (
        <StudioLoadingState>{t('admin.instances.invitation.loading')}</StudioLoadingState>
      )}
    </div>
  );
};

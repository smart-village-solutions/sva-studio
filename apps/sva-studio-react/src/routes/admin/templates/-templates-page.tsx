/** Server-wide text template administration for the Studio installation. */
import * as React from 'react';
import type { ServerAccountInvitationTemplateView } from '@sva/core';
import { StudioLoadingState } from '@sva/studio-ui-react';

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

  React.useEffect(() => {
    let active = true;
    void getServerAccountInvitationTemplate()
      .then((response) => {
        if (active) setTemplate(response.data);
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
      ) : (
        <StudioLoadingState>{t('admin.instances.invitation.loading')}</StudioLoadingState>
      )}
    </div>
  );
};

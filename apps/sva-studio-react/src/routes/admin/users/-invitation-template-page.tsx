import * as React from 'react';
import type { TenantAccountInvitationTemplateView } from '@sva/core';
import { StudioLoadingState } from '@sva/studio-ui-react';

import { t } from '../../../i18n';
import {
  getTenantAccountInvitationTemplate,
  IamHttpError,
  updateTenantAccountInvitationTemplate,
} from '../../../lib/iam-api';
import {
  AccountInvitationTemplateEditorCard,
  type AccountInvitationTemplateDraft,
  type AccountInvitationTemplateSaveResult,
} from '../instances/-account-invitation-template-card';

export const InvitationTemplatePage = () => {
  const [view, setView] = React.useState<TenantAccountInvitationTemplateView | null>(null);
  const [loadFailed, setLoadFailed] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    void getTenantAccountInvitationTemplate()
      .then((response) => {
        if (active) setView(response.data);
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
    if (!view) return false;
    try {
      const response = await updateTenantAccountInvitationTemplate({
        expectedRevision: view.revision,
        template: draft
          ? {
              subject: draft.subject,
              body: draft.body,
              passwordSetupLinkLabel: draft.passwordSetupLinkLabel,
              tenantHomepageLinkLabel: draft.tenantHomepageLinkLabel,
            }
          : null,
      });
      setView(response.data);
      return true;
    } catch (error) {
      if (
        error instanceof IamHttpError &&
        error.code === 'account_invitation_template_revision_conflict'
      ) {
        try {
          const response = await getTenantAccountInvitationTemplate();
          setView(response.data);
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
          {t('admin.instances.invitation.tenantPageTitle')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('admin.instances.invitation.tenantPageDescription')}
        </p>
      </header>
      {loadFailed ? (
        <p role="status" className="text-sm text-destructive">
          {t('admin.instances.invitation.loadFailed')}
        </p>
      ) : view ? (
        <AccountInvitationTemplateEditorCard
          effectiveTemplate={view.effectiveTemplate}
          source={view.source}
          preview={{ tenantName: view.tenantName, tenantHomepageUrl: view.tenantHomepageUrl }}
          mode="instance"
          onSave={save}
        />
      ) : (
        <StudioLoadingState>{t('admin.instances.invitation.loading')}</StudioLoadingState>
      )}
    </div>
  );
};

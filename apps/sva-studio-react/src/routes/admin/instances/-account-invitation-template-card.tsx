/** Shared editor card for server-wide and instance-specific account invitations. */
import * as React from 'react';
import {
  validateAccountInvitationTemplate,
  type AccountInvitationTemplate,
  type AccountInvitationTemplateSource,
  type IamInstanceDetail,
} from '@sva/core';
import { Button } from '@sva/studio-ui-react';

import { Card } from '../../../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../../components/ui/dialog';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import { t } from '../../../i18n';

export type AccountInvitationTemplateDraft = Omit<AccountInvitationTemplate, 'revision'>;
export type AccountInvitationTemplateSaveResult = boolean | 'conflict';

type PreviewContext = Readonly<{ tenantName: string; tenantHomepageUrl: string }>;

const renderPreview = (template: AccountInvitationTemplateDraft, preview: PreviewContext): string =>
  template.body
    .replaceAll('{{tenantName}}', preview.tenantName)
    .replaceAll('{{passwordSetupLink}}', `[${template.passwordSetupLinkLabel}]`)
    .replaceAll(
      '{{tenantHomepageLink}}',
      `[${template.tenantHomepageLinkLabel}: ${preview.tenantHomepageUrl}]`
    )
    .replaceAll('{{linkExpiresIn}}', t('admin.instances.invitation.previewExpiry'));

export const AccountInvitationTemplateEditorCard = ({
  effectiveTemplate,
  source,
  preview,
  mode,
  onSave,
}: {
  readonly effectiveTemplate: AccountInvitationTemplate;
  readonly source: AccountInvitationTemplateSource;
  readonly preview: PreviewContext;
  readonly mode: 'instance' | 'server';
  readonly onSave: (
    template: AccountInvitationTemplateDraft | null
  ) => Promise<AccountInvitationTemplateSaveResult>;
}) => {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<AccountInvitationTemplateDraft>(effectiveTemplate);
  const [message, setMessage] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => setDraft(effectiveTemplate), [effectiveTemplate]);

  const save = async (template: AccountInvitationTemplateDraft | null) => {
    if (template) {
      try {
        validateAccountInvitationTemplate(template);
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : t('admin.instances.invitation.invalid')
        );
        return;
      }
    }
    setSaving(true);
    setMessage(null);
    const result = await onSave(template);
    setSaving(false);
    setMessage(
      result === true
        ? t('admin.instances.invitation.saved')
        : result === 'conflict'
          ? t('admin.instances.invitation.saveConflict')
          : t('admin.instances.invitation.saveFailed')
    );
  };

  const descriptionKey =
    mode === 'server'
      ? 'admin.instances.invitation.serverDescription'
      : 'admin.instances.invitation.description';
  const resetKey =
    mode === 'server'
      ? 'admin.instances.invitation.resetServer'
      : 'admin.instances.invitation.resetInstance';
  const resetConfirmKey =
    mode === 'server'
      ? 'admin.instances.invitation.resetServerConfirm'
      : 'admin.instances.invitation.resetInstanceConfirm';

  return (
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-foreground">
            {t('admin.instances.invitation.title')}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t('admin.instances.invitation.source', {
              source: t(`admin.instances.invitation.sources.${source}`),
            })}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="secondary">
              {t('admin.instances.invitation.open')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('admin.instances.invitation.dialogTitle')}</DialogTitle>
              <DialogDescription>{t(descriptionKey)}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                {t('admin.instances.invitation.tokens')}
              </p>
              <label className="block space-y-1 text-sm">
                <span>{t('admin.instances.invitation.subject')}</span>
                <Input
                  value={draft.subject}
                  maxLength={200}
                  onChange={(event) => setDraft({ ...draft, subject: event.target.value })}
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span>{t('admin.instances.invitation.body')}</span>
                <Textarea
                  value={draft.body}
                  maxLength={5_000}
                  rows={12}
                  onChange={(event) => setDraft({ ...draft, body: event.target.value })}
                />
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block space-y-1 text-sm">
                  <span>{t('admin.instances.invitation.passwordLinkLabel')}</span>
                  <Input
                    value={draft.passwordSetupLinkLabel}
                    maxLength={120}
                    onChange={(event) =>
                      setDraft({ ...draft, passwordSetupLinkLabel: event.target.value })
                    }
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  <span>{t('admin.instances.invitation.homepageLinkLabel')}</span>
                  <Input
                    value={draft.tenantHomepageLinkLabel}
                    maxLength={120}
                    onChange={(event) =>
                      setDraft({ ...draft, tenantHomepageLinkLabel: event.target.value })
                    }
                  />
                </label>
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-medium">{t('admin.instances.invitation.preview')}</h3>
                <pre className="whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3 text-xs">
                  {renderPreview(draft, preview)}
                </pre>
              </div>
              {message ? (
                <p role="status" aria-live="polite" className="text-sm text-foreground">
                  {message}
                </p>
              ) : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                disabled={saving}
                onClick={() => {
                  if (window.confirm(t(resetConfirmKey))) void save(null);
                }}
              >
                {t(resetKey)}
              </Button>
              <Button type="button" disabled={saving} onClick={() => void save(draft)}>
                {saving ? t('account.actions.saving') : t('admin.instances.invitation.save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Card>
  );
};

export const AccountInvitationTemplateCard = ({
  instance,
  onSave,
}: {
  readonly instance: IamInstanceDetail;
  readonly onSave: (
    template: AccountInvitationTemplateDraft | null
  ) => Promise<AccountInvitationTemplateSaveResult>;
}) => (
  <AccountInvitationTemplateEditorCard
    effectiveTemplate={instance.effectiveAccountInvitationTemplate}
    source={instance.accountInvitationTemplateSource}
    preview={{
      tenantName: instance.displayName,
      tenantHomepageUrl: `https://${instance.primaryHostname}/`,
    }}
    mode="instance"
    onSave={onSave}
  />
);
